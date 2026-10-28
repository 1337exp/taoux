let counter = 0;

/**
 * A unique id with a prefix; `taken` lets you skip ids already in use (for example, loaded from a file).
 * The counter starts from zero on every page load: good for ids that live inside one document (the nodes of a graph),
 * not for records that are stored or synced. For those use `uuid()`.
 * Уникальный id с префиксом; `taken` позволяет пропустить уже занятые (например, загруженные из файла).
 * Счётчик начинается с нуля при каждой загрузке страницы: годится для id внутри одного документа (узлы графа), но не
 * для записей, которые хранятся или синхронизируются. Для них — `uuid()`.
 */
export function uid(prefix: string, taken: (id: string) => boolean = () => false): string {
    let id: string;
    do id = `${prefix}${++counter}`;
    while (taken(id));
    return id;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * A random UUID v4, unique across loads, tabs and devices: for records that are stored or synced.
 * `crypto.randomUUID` where there is one; outside a secure context (plain http on a LAN address) it is missing, so the
 * same v4 is built from `crypto.getRandomValues`, and only without Web Crypto at all from `Math.random`.
 * Случайный UUID v4, уникальный между загрузками, вкладками и устройствами: для записей, которые хранятся или
 * синхронизируются. `crypto.randomUUID`, где он есть; вне безопасного контекста (http по адресу в локальной сети) его
 * нет, поэтому тот же v4 собирается из `crypto.getRandomValues`, а без Web Crypto совсем — из `Math.random`.
 */
export function uuid(): string {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (typeof c?.randomUUID === 'function') return c.randomUUID();

    const bytes = new Uint8Array(16);
    if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4 / версия 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10 / вариант 10
    const h = hex(bytes);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
