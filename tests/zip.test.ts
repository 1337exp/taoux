// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createZip, looksLikeZip, readZip, ZipError, type ZipEntry } from '../src/zip';

const text = (s: string) => new TextEncoder().encode(s);
const str = (b: Uint8Array) => new TextDecoder().decode(b);
const entry = (name: string, data: string | Uint8Array): ZipEntry => ({ name, data: typeof data === 'string' ? text(data) : data });

/** Zip made by Python's zipfile: a deflated file, a folder entry and a stored file with a non-ASCII name. */
const PYTHON_ZIP = 'UEsDBBQAAAAIAABgbV3zMaINDwAAAFgCAAAKAAAAcmVhZG1lLnR4dMtIzcnJV8gYJUfJVGqSAFBLAwQUAAAAAAAAYG1dAAAAAAAAAAAAAAAABAAAAGRpci9QSwMEFAAACAAAAGBtXXOMBSkAAQAAAAEAAA0AAABkaXIvw7xuw68uYmluAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/1BLAQIUABQAAAAIAABgbV3zMaINDwAAAFgCAAAKAAAAAAAAAAAAAACAAQAAAAByZWFkbWUudHh0UEsBAhQAFAAAAAAAAGBtXQAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAIABNwAAAGRpci9QSwECFAAUAAAIAAAAYG1dc4wFKQABAAAAAQAADQAAAAAAAAAAAAAAgAFZAAAAZGlyL8O8bsOvLmJpblBLBQYAAAAAAwADAKUAAACEAQAAAAA=';
const fromBase64 = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));

const codeOf = async (promise: Promise<unknown>) => {
    try {
        await promise;
    } catch (e) {
        return e instanceof ZipError ? e.code : `other: ${String(e)}`;
    }
    return 'no error';
};

/** The end record and the central directory of a zip without a comment. */
function layout(zip: Uint8Array) {
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const end = zip.length - 22;
    return { view, end, central: view.getUint32(end + 16, true) };
}

function patch(zip: Uint8Array, change: (l: ReturnType<typeof layout>) => void): Uint8Array {
    const copy = zip.slice();
    change(layout(copy));
    return copy;
}

/** Replaces a name of the same length everywhere it occurs (the local header and the central directory). */
function rename(zip: Uint8Array, from: string, to: string): Uint8Array {
    expect(to).toHaveLength(from.length);
    const copy = zip.slice();
    const a = text(from);
    const b = text(to);
    for (let i = 0; i + a.length <= copy.length; i++) if (a.every((v, k) => copy[i + k] === v)) copy.set(b, i);
    return copy;
}

const method = (zip: Uint8Array) => new DataView(zip.buffer, zip.byteOffset).getUint16(8, true);
const repetitive = 'abcdefgh'.repeat(500);

describe('createZip and readZip', () => {
    it('round trip: text, empty file, binary, UTF-8 names, folders in paths', async () => {
        const random = Uint8Array.from({ length: 3000 }, (_, i) => (i * 7919 + (i >> 3) * 31) & 255);
        const zip = await createZip([entry('project.json', '{"a":1}'), entry('empty.txt', ''), entry('assets/ñandú ✓.bin', random), entry('a/b/c.txt', repetitive)]);
        expect(looksLikeZip(zip)).toBe(true);
        const back = await readZip(zip);
        expect(back.map((e) => e.name)).toEqual(['project.json', 'empty.txt', 'assets/ñandú ✓.bin', 'a/b/c.txt']);
        expect(str(back[0]!.data)).toBe('{"a":1}');
        expect(back[1]!.data).toHaveLength(0);
        expect([...back[2]!.data]).toEqual([...random]);
        expect(str(back[3]!.data)).toBe(repetitive);
    });

    it('compresses what compresses, stores what is already compressed or does not shrink', async () => {
        const packed = await createZip([entry('t.txt', repetitive)]);
        expect(method(packed)).toBe(8);
        expect(packed.length).toBeLessThan(repetitive.length / 4);

        expect(method(await createZip([entry('hero.png', repetitive)]))).toBe(0); // the name says it is compressed
        expect(method(await createZip([entry('t.txt', repetitive)], { compress: 'store' }))).toBe(0);
        expect(method(await createZip([entry('t.txt', 'hi')]))).toBe(0); // deflate would not make it smaller
        expect(method(await createZip([entry('t.txt', '')]))).toBe(0);
    });

    it('reads an archive made by another tool (Python zipfile): folders skipped, UTF-8 name', async () => {
        const files = await readZip(fromBase64(PYTHON_ZIP));
        expect(files.map((f) => f.name)).toEqual(['readme.txt', 'dir/ünï.bin']);
        expect(str(files[0]!.data)).toBe('hello '.repeat(100));
        expect([...files[1]!.data]).toEqual(Array.from({ length: 256 }, (_, i) => i));
    });

    it('an empty archive is an archive', async () => {
        const zip = await createZip([]);
        expect(zip).toHaveLength(22);
        expect(looksLikeZip(zip)).toBe(true);
        expect(await readZip(zip)).toEqual([]);
    });

    it('what is read does not share memory with the archive', async () => {
        const zip = await createZip([entry('a.txt', 'hi')], { compress: 'store' });
        const [file] = await readZip(zip);
        zip.fill(0);
        expect(str(file!.data)).toBe('hi');
    });

    it('looksLikeZip tells an archive from text', () => {
        expect(looksLikeZip(text('{"format":"taofx"}'))).toBe(false);
        expect(looksLikeZip(new Uint8Array())).toBe(false);
        expect(looksLikeZip(Uint8Array.of(0x50, 0x4b, 3, 4))).toBe(true);
    });
});

describe('createZip refuses', () => {
    it('unsafe names and duplicates', async () => {
        for (const name of ['', '/a', '../a', 'a/../b', './a', 'a//b', 'a/', 'a\\b', 'a\x00b']) expect(await codeOf(createZip([entry(name, 'x')])), JSON.stringify(name)).toBe('unsafeName');
        expect(await codeOf(createZip([entry('a', '1'), entry('a', '2')]))).toBe('duplicate');
    });

    it('more files than a ZIP without ZIP64 holds', async () => {
        const many = Array.from({ length: 65536 }, (_, i) => entry(`f${i}`, ''));
        expect(await codeOf(createZip(many))).toBe('tooMany');
    });
});

describe('readZip refuses', () => {
    const base = () => createZip([entry('a.txt', 'hello'), entry('b.txt', 'world')], { compress: 'store' });

    it('what is not an archive', async () => {
        for (const bytes of [new Uint8Array(), Uint8Array.of(1, 2, 3), text('{"format":"taofx-project"}'), new Uint8Array(100)]) expect(await codeOf(readZip(bytes))).toBe('notZip');
        const zip = await base();
        expect(await codeOf(readZip(zip.slice(0, zip.length - 5)))).toBe('notZip'); // the end record is cut
    });

    it('damaged data: a flipped byte (stored and deflated), a bad local header, a bad directory', async () => {
        const stored = await base();
        expect(await codeOf(readZip(patch(stored, ({ view }) => view.setUint8(30 + 5, view.getUint8(30 + 5) ^ 1))))).toBe('corrupt');

        const packed = await createZip([entry('t.txt', repetitive)]);
        expect(await codeOf(readZip(patch(packed, ({ view }) => view.setUint8(30 + 5 + 4, view.getUint8(30 + 5 + 4) ^ 255))))).toBe('corrupt');

        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint32(central + 42, 0x00fffff0, true))))).toBe('corrupt');
        expect(await codeOf(readZip(patch(stored, ({ view }) => view.setUint32(0, 0, true))))).toBe('corrupt'); // the local signature
        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint32(central, 0, true))))).toBe('corrupt'); // the central signature
        expect(await codeOf(readZip(patch(stored, ({ view, end }) => view.setUint32(end + 12, 0x00fffff0, true))))).toBe('corrupt'); // the directory runs past the end
        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint16(central + 28, 5000, true))))).toBe('corrupt'); // a name longer than the file
    });

    it('a stored size that disagrees with the data', async () => {
        const stored = await base();
        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint32(central + 24, 3, true))))).toBe('corrupt');
    });

    it('what it does not support: encryption, other methods, ZIP64, several disks', async () => {
        const stored = await base();
        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint16(central + 8, 1, true))))).toBe('unsupported');
        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint16(central + 10, 9, true))))).toBe('unsupported');
        expect(await codeOf(readZip(patch(stored, ({ view, end }) => view.setUint32(end + 16, 0xffffffff, true))))).toBe('unsupported');
        expect(await codeOf(readZip(patch(stored, ({ view, central }) => view.setUint32(central + 24, 0xffffffff, true))))).toBe('unsupported');
        expect(await codeOf(readZip(patch(stored, ({ view, end }) => view.setUint16(end + 4, 1, true))))).toBe('unsupported');
    });

    it('names that leave the folder, and the same name twice', async () => {
        const zip = await createZip([entry('abcd', 'x')], { compress: 'store' });
        for (const bad of ['../x', '/abc', 'a\\bc', 'a//b']) expect(await codeOf(readZip(rename(zip, 'abcd', bad))), bad).toBe('unsafeName');
        const two = await createZip([entry('a', '1'), entry('b', '2')], { compress: 'store' });
        expect(await codeOf(readZip(rename(two, 'b', 'a')))).toBe('duplicate');
    });

    it('limits: files, one file, all files together', async () => {
        const zip = await createZip([entry('a', 'x'.repeat(40)), entry('b', 'y'.repeat(40)), entry('c', 'z')], { compress: 'store' });
        expect(await codeOf(readZip(zip, { maxEntries: 2 }))).toBe('tooMany');
        expect(await codeOf(readZip(zip, { maxEntryBytes: 30 }))).toBe('tooLarge');
        expect(await codeOf(readZip(zip, { maxTotalBytes: 60 }))).toBe('tooLarge');
        expect((await readZip(zip, { maxEntries: 3, maxEntryBytes: 40, maxTotalBytes: 81 })).length).toBe(3);
    });

    it('a bomb: a small declared size over data that unpacks bigger is stopped', async () => {
        const zip = await createZip([entry('zeros', new Uint8Array(200_000))]);
        expect(method(zip)).toBe(8);
        expect(zip.length).toBeLessThan(1000);
        const lying = patch(zip, ({ view, central }) => {
            view.setUint32(22, 10, true); // the local header
            view.setUint32(central + 24, 10, true); // the central directory
        });
        expect(await codeOf(readZip(lying))).toBe('corrupt');
    });

    it('a comment at the end is skipped, and an end record inside it is not taken for the real one', async () => {
        const zip = await createZip([entry('a.txt', 'hi'), entry('b.txt', 'yo')], { compress: 'store' });
        const decoy = Uint8Array.from([0x50, 0x4b, 5, 6, ...new Array(40).fill(0)]); // looks like an end record, has 40 bytes after it
        const withComment = new Uint8Array(zip.length + decoy.length);
        withComment.set(zip);
        withComment.set(decoy, zip.length);
        new DataView(withComment.buffer).setUint16(zip.length - 2, decoy.length, true); // the comment length of the real record
        expect((await readZip(withComment)).map((e) => e.name)).toEqual(['a.txt', 'b.txt']);
    });

    it('the number of files in the record must match the directory of the disk', async () => {
        const zip = await base();
        expect(await codeOf(readZip(patch(zip, ({ view, end }) => view.setUint16(end + 8, 1, true))))).toBe('unsupported');
    });

    it('total size is judged by the declared sizes before the rest is touched', async () => {
        const zip = await createZip([entry('a', 'x'.repeat(40)), entry('b', 'y'.repeat(40))], { compress: 'store' });
        // the second file is broken on purpose: a refusal for size must come first
        const broken = patch(zip, ({ view, central }) => view.setUint32(central + 46 + 1 + 42, 0x00fffff0, true));
        expect(await codeOf(readZip(broken, { maxTotalBytes: 60 }))).toBe('tooLarge');
        expect(await codeOf(readZip(broken))).toBe('corrupt');
    });

    it('a deflated file whose declared size is bigger than what it unpacks to, with a matching CRC', async () => {
        const zip = await createZip([entry('t.txt', repetitive)]);
        const lying = patch(zip, ({ view, central }) => view.setUint32(central + 24, repetitive.length + 5, true));
        expect(await codeOf(readZip(lying))).toBe('corrupt');
    });

    it('a packed size that runs past the data', async () => {
        const zip = await createZip([entry('t.txt', repetitive)]);
        const lying = patch(zip, ({ view, central }) => view.setUint32(central + 20, view.getUint32(central + 20, true) + 1000, true));
        expect(await codeOf(readZip(lying))).toBe('corrupt');
    });

    it('a name that is not UTF-8: corrupt with the UTF-8 flag, Latin-1 without it', async () => {
        const zip = await createZip([entry('abcd', 'x')], { compress: 'store' });
        const bad = (flagged: boolean) =>
            patch(zip, ({ view, central }) => {
                view.setUint8(central + 46, 0xe9); // é in Latin-1, a broken sequence in UTF-8
                if (!flagged) view.setUint16(central + 8, 0, true);
            });
        expect(await codeOf(readZip(bad(true)))).toBe('corrupt');
        expect((await readZip(bad(false))).map((e) => e.name)).toEqual(['ébcd']);
    });

    it('a date before 1980 does not break the DOS date', async () => {
        const zip = await createZip([entry('a', 'x')], { date: new Date(1970, 0, 1) });
        expect(new DataView(zip.buffer).getUint16(12, true)).toBe((1 << 5) | 1); // 1980-01-01
    });

    it('a declared size over the limit is refused before anything is unpacked', async () => {
        const zip = await createZip([entry('zeros', new Uint8Array(200_000))]);
        expect(await codeOf(readZip(zip, { maxEntryBytes: 100_000 }))).toBe('tooLarge');
    });
});
