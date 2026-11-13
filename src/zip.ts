// ZIP without libraries: the browser's CompressionStream does the deflate. No DOM, no Vue.
// ZIP без библиотек: deflate делает CompressionStream браузера. Без DOM и Vue.

/**
 * A file in an archive: the path with `/` as the separator (`assets/hero.png`) and its bytes.
 * Файл в архиве: путь с разделителем `/` (`assets/hero.png`) и его байты.
 */
export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

export type ZipErrorCode =
    | 'notZip' // not an archive at all / это вообще не архив
    | 'unsupported' // encrypted, ZIP64, several disks, an unknown method / шифрование, ZIP64, несколько дисков, незнакомый метод
    | 'corrupt' // damaged: bounds, size, CRC, a failed inflate / повреждён: границы, размер, CRC, сбой распаковки
    | 'unsafeName' // a path that would leave the folder it is unpacked into / путь, который выбрался бы из папки распаковки
    | 'duplicate' // the same name twice / одно имя дважды
    | 'tooMany' // more files than allowed / файлов больше, чем разрешено
    | 'tooLarge'; // a file or the whole archive unpacks bigger than allowed / файл или весь архив распакуется больше, чем разрешено

/**
 * Why an archive was refused or could not be written. The interface builds the user text from `code`.
 * Почему архив отклонён или не записан. Текст для пользователя собирает интерфейс по `code`.
 */
export class ZipError extends Error {
    constructor(
        readonly code: ZipErrorCode,
        readonly detail?: string,
    ) {
        super(detail === undefined ? code : `${code}: ${detail}`);
        this.name = 'ZipError';
    }
}

/**
 * Limits of reading. An archive comes from outside, and a few KB can unpack into gigabytes, so the sizes are checked
 * twice: the declared ones before unpacking and the real ones while unpacking.
 * Пределы чтения. Архив приходит извне, а несколько КБ могут распаковаться в гигабайты, поэтому размеры проверяются
 * дважды: объявленные до распаковки и настоящие во время неё.
 */
export interface ZipReadLimits {
    /** Files in the archive. Default 10 000. / Файлов в архиве. По умолчанию 10 000. */
    maxEntries?: number;
    /** Bytes of one unpacked file. Default 512 MiB. / Байт в одном распакованном файле. По умолчанию 512 МиБ. */
    maxEntryBytes?: number;
    /** Bytes of all unpacked files together. Default 1 GiB. / Байт во всех файлах вместе. По умолчанию 1 ГиБ. */
    maxTotalBytes?: number;
}

export const ZIP_LIMITS: Required<ZipReadLimits> = { maxEntries: 10_000, maxEntryBytes: 512 * 1024 * 1024, maxTotalBytes: 1024 * 1024 * 1024 };

export interface ZipWriteOptions {
    /** Modification time written for every file. Now by default. / Время изменения у всех файлов. По умолчанию сейчас. */
    date?: Date;
    /**
     * `auto` (default): a file is deflated unless it is already compressed (PNG, JPEG, WebP, audio, video, archives) and
     * only when that makes it smaller; `store`: everything as it is.
     * `auto` (по умолчанию): файл сжимается, если он ещё не сжат (PNG, JPEG, WebP, звук, видео, архивы) и только когда
     * от этого становится меньше; `store`: всё как есть.
     */
    compress?: 'auto' | 'store';
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const VERSION = 20; // 2.0: the lowest that every unzip tool understands / 2.0: ниже все распаковщики понимают
const UTF8_NAMES = 0x0800;
const ENCRYPTED = 0x0001 | 0x0040;
const STORED = 0;
const DEFLATED = 8;
const MAX32 = 0xffffffff;
const MAX16 = 0xffff;
const ALREADY_COMPRESSED = /\.(png|jpe?g|gif|webp|avif|zip|gz|bz2|7z|rar|mp3|ogg|opus|m4a|aac|mp4|webm|mov|woff2?)$/i;

const encoder = new TextEncoder();

/**
 * A path that would climb out of the folder it is unpacked into (`../x`, `/etc/x`, `a\..\x`) is how a ZIP overwrites
 * files it should not touch, so such names never get in or out.
 * Путь, который выбрался бы из папки распаковки (`../x`, `/etc/x`, `a\..\x`), — это способ ZIP затереть то, что ему
 * трогать нельзя, поэтому такие имена ни входят, ни выходят.
 */
function assertName(name: string): void {
    const unsafe =
        name === '' ||
        name.includes('\\') ||
        /[\x00-\x1f\x7f]/.test(name) ||
        name.split('/').some((part) => part === '' || part === '.' || part === '..');
    if (unsafe) throw new ZipError('unsafeName', JSON.stringify(name));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

/** Local time as DOS date and time (2 s resolution, from 1980). / Местное время как DOS-дата и время (шаг 2 с, с 1980). */
function dosTime(date: Date): { time: number; day: number } {
    const year = Math.max(1980, date.getFullYear());
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

/** Passes the bytes through a (de)compression stream. `max` stops a result that grows past what is expected. */
async function through(data: Uint8Array, transform: CompressionStream | DecompressionStream, max = Infinity): Promise<Uint8Array> {
    const source = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(data);
            controller.close();
        },
    });
    const reader = source.pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > max) {
            await reader.cancel();
            throw new ZipError('corrupt', 'size');
        }
        chunks.push(value);
    }
    return concat(chunks, total);
}

function concat(chunks: readonly Uint8Array[], total = chunks.reduce((n, c) => n + c.length, 0)): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
        out.set(c, at);
        at += c.length;
    }
    return out;
}

//--------------------------------------------------
// writing / запись

/**
 * Writes a ZIP archive. Names are UTF-8; no ZIP64, so up to 65 535 files and 4 GiB. Files already compressed are stored
 * as they are (see `compress`), the rest are deflated.
 * Пишет ZIP-архив. Имена в UTF-8; без ZIP64: до 65 535 файлов и 4 ГиБ. Уже сжатые файлы кладутся как есть
 * (см. `compress`), остальные сжимаются.
 */
export async function createZip(entries: readonly ZipEntry[], options: ZipWriteOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
    if (entries.length > MAX16) throw new ZipError('tooMany', `${entries.length} files do not fit into a ZIP without ZIP64`);
    const { time, day } = dosTime(options.date ?? new Date());
    const seen = new Set<string>();
    const body: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        assertName(entry.name);
        if (seen.has(entry.name)) throw new ZipError('duplicate', entry.name);
        seen.add(entry.name);

        const name = encoder.encode(entry.name);
        const crc = crc32(entry.data);
        let method = STORED;
        let stored = entry.data;
        if (options.compress !== 'store' && !ALREADY_COMPRESSED.test(entry.name)) {
            const packed = await through(entry.data, new CompressionStream('deflate-raw'));
            if (packed.length < entry.data.length) {
                method = DEFLATED;
                stored = packed;
            }
        }
        if (entry.data.length > MAX32 || offset > MAX32) throw new ZipError('tooLarge', entry.name);

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, LOCAL, true);
        local.setUint16(4, VERSION, true);
        local.setUint16(6, UTF8_NAMES, true);
        local.setUint16(8, method, true);
        local.setUint16(10, time, true);
        local.setUint16(12, day, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, stored.length, true);
        local.setUint32(22, entry.data.length, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);

        const head = new DataView(new ArrayBuffer(46));
        head.setUint32(0, CENTRAL, true);
        head.setUint16(4, VERSION, true);
        head.setUint16(6, VERSION, true);
        head.setUint16(8, UTF8_NAMES, true);
        head.setUint16(10, method, true);
        head.setUint16(12, time, true);
        head.setUint16(14, day, true);
        head.setUint32(16, crc, true);
        head.setUint32(20, stored.length, true);
        head.setUint32(24, entry.data.length, true);
        head.setUint16(28, name.length, true);
        head.setUint32(42, offset, true);

        body.push(new Uint8Array(local.buffer), name, stored);
        central.push(new Uint8Array(head.buffer), name);
        offset += 30 + name.length + stored.length;
    }

    const directory = concat(central);
    if (offset + directory.length > MAX32) throw new ZipError('tooLarge');
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, END, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, directory.length, true);
    end.setUint32(16, offset, true);
    return concat([...body, directory, new Uint8Array(end.buffer)]);
}

//--------------------------------------------------
// reading / чтение

/**
 * Whether the bytes start like a ZIP (a file or an empty archive). A quick check to tell an archive from a text file
 * before opening it; `readZip` does the real checking.
 * Начинаются ли байты как ZIP (файл или пустой архив). Быстрая проверка, чтобы отличить архив от текстового файла
 * до открытия; настоящую проверку делает `readZip`.
 */
export function looksLikeZip(data: Uint8Array): boolean {
    return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && ((data[2] === 3 && data[3] === 4) || (data[2] === 5 && data[3] === 6));
}

function decodeName(bytes: Uint8Array, utf8: boolean): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        if (utf8) throw new ZipError('corrupt', 'name');
        return String.fromCharCode(...bytes); // an old tool without the UTF-8 flag: Latin-1 at least keeps the letters apart
    }
}

/**
 * Reads a ZIP archive into its files (folders are skipped). Throws `ZipError`. Never writes anywhere: the names are
 * checked (no `..`, no absolute paths, no backslashes) and the sizes are limited (`limits`), CRC is verified.
 * Reads the central directory, so archives written by any tool open, including those with sizes after the data.
 * Читает ZIP-архив в файлы (папки пропускаются). Бросает `ZipError`. Никуда ничего не пишет: имена проверяются
 * (без `..`, абсолютных путей и обратных косых), размеры ограничены (`limits`), CRC сверяется.
 * Читает центральный каталог, поэтому открываются архивы любой программы, в том числе с размерами после данных.
 */
export async function readZip(data: Uint8Array, limits: ZipReadLimits = {}): Promise<ZipEntry[]> {
    const { maxEntries, maxEntryBytes, maxTotalBytes } = { ...ZIP_LIMITS, ...limits };
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // the end record: the last 22 bytes, or before a comment of up to 65 535 bytes
    let end = -1;
    for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - MAX16); i--) {
        if (view.getUint32(i, true) === END && i + 22 + view.getUint16(i + 20, true) === data.length) {
            end = i;
            break;
        }
    }
    if (end < 0) throw new ZipError('notZip');

    const count = view.getUint16(end + 10, true);
    const directorySize = view.getUint32(end + 12, true);
    const directoryOffset = view.getUint32(end + 16, true);
    if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 || view.getUint16(end + 8, true) !== count) throw new ZipError('unsupported', 'several disks');
    if (count === MAX16 || directorySize === MAX32 || directoryOffset === MAX32) throw new ZipError('unsupported', 'ZIP64');
    if (count > maxEntries) throw new ZipError('tooMany', String(count));
    if (directoryOffset + directorySize > end) throw new ZipError('corrupt', 'directory');

    const result: ZipEntry[] = [];
    const seen = new Set<string>();
    let at = directoryOffset;
    let declaredTotal = 0;

    for (let n = 0; n < count; n++) {
        if (at + 46 > end || view.getUint32(at, true) !== CENTRAL) throw new ZipError('corrupt', 'directory');
        const flags = view.getUint16(at + 8, true);
        const method = view.getUint16(at + 10, true);
        const crc = view.getUint32(at + 16, true);
        const packedSize = view.getUint32(at + 20, true);
        const size = view.getUint32(at + 24, true);
        const nameLength = view.getUint16(at + 28, true);
        const extraLength = view.getUint16(at + 30, true);
        const commentLength = view.getUint16(at + 32, true);
        const localOffset = view.getUint32(at + 42, true);
        if (at + 46 + nameLength + extraLength + commentLength > end) throw new ZipError('corrupt', 'directory');
        const name = decodeName(data.subarray(at + 46, at + 46 + nameLength), (flags & UTF8_NAMES) !== 0);
        at += 46 + nameLength + extraLength + commentLength;

        if (name.endsWith('/')) {
            assertName(name.slice(0, -1));
            continue; // a folder: folders follow from the paths / папка: папки следуют из путей
        }
        assertName(name);
        if (seen.has(name)) throw new ZipError('duplicate', name);
        seen.add(name);

        if (flags & ENCRYPTED) throw new ZipError('unsupported', 'encrypted');
        if (method !== STORED && method !== DEFLATED) throw new ZipError('unsupported', `method ${method}`);
        if (packedSize === MAX32 || size === MAX32 || localOffset === MAX32) throw new ZipError('unsupported', 'ZIP64');
        declaredTotal += size;
        if (size > maxEntryBytes || declaredTotal > maxTotalBytes) throw new ZipError('tooLarge', name);

        if (localOffset + 30 > directoryOffset || view.getUint32(localOffset, true) !== LOCAL) throw new ZipError('corrupt', name);
        const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        if (start + packedSize > directoryOffset) throw new ZipError('corrupt', name);
        const packed = data.subarray(start, start + packedSize);

        let bytes: Uint8Array;
        if (method === STORED) {
            bytes = packed.slice();
        } else {
            try {
                bytes = await through(packed, new DecompressionStream('deflate-raw'), size);
            } catch {
                throw new ZipError('corrupt', name); // bad deflate data, or more than the declared size / плохие данные или больше заявленного размера
            }
        }
        if (bytes.length !== size || crc32(bytes) !== crc) throw new ZipError('corrupt', name);
        result.push({ name, data: bytes });
    }
    return result;
}
