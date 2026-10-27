/**
 * Keyboard shortcuts: parse `Mod+Shift+Z`, match a keydown against it, show it the way the platform writes it,
 * and know which ones the browser never gives to a page. `Mod` is ⌘ on Apple platforms and Ctrl elsewhere,
 * so the data stores `Mod` and not a concrete key.
 * Сочетания клавиш: разобрать `Mod+Shift+Z`, сверить с ним keydown, показать так, как пишет платформа,
 * и знать, какие браузер странице не отдаёт никогда. `Mod` — это ⌘ на платформах Apple и Ctrl на остальных,
 * поэтому в данных хранится `Mod`, а не конкретная клавиша.
 */

export interface Hotkey {
    /**
     * `event.key` in lower case: `z`, `arrowup`, `escape`, `f2`, `'`, `' '` for the space bar.
     * `event.key` в нижнем регистре: `z`, `arrowup`, `escape`, `f2`, `'`, `' '` для пробела.
     */
    key: string;
    /** ⌘ on Apple, Ctrl elsewhere. / ⌘ у Apple, Ctrl у остальных. */
    mod: boolean;
    ctrl: boolean;
    /** ⌘ / the Windows key. / ⌘ / клавиша Windows. */
    meta: boolean;
    /** Option on Apple. / Option у Apple. */
    alt: boolean;
    shift: boolean;
}

export interface PlatformOptions {
    /**
     * Apple platform (⌘ for `Mod`, glyphs in labels). Default: detected from `navigator`, false without one (SSR).
     * Платформа Apple (⌘ для `Mod`, значки в подписях). По умолчанию: из `navigator`, без него (SSR) false.
     */
    mac?: boolean;
}

/**
 * Apple platform: macOS, iOS, iPadOS. False on the server.
 * Платформа Apple: macOS, iOS, iPadOS. На сервере false.
 */
export function isApplePlatform(): boolean {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
    return /mac|iphone|ipad|ipod/i.test(platform);
}

const MODIFIERS: Record<string, keyof Omit<Hotkey, 'key'>> = {
    mod: 'mod',
    ctrl: 'ctrl',
    control: 'ctrl',
    cmd: 'meta',
    command: 'meta',
    meta: 'meta',
    super: 'meta',
    win: 'meta',
    alt: 'alt',
    option: 'alt',
    opt: 'alt',
    shift: 'shift',
};

const KEY_ALIASES: Record<string, string> = {
    esc: 'escape',
    del: 'delete',
    ins: 'insert',
    return: 'enter',
    space: ' ',
    spacebar: ' ',
    plus: '+',
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright',
    pgup: 'pageup',
    pgdn: 'pagedown',
};

/**
 * Parses `Mod+Shift+Z`, `Ctrl+Alt+Delete`, `Shift+?`, `Mod++` (the plus key). Case and spaces around `+` do not matter.
 * Throws on an empty combination, an unknown modifier or two keys: a typo in a shortcut is a bug, not data.
 * Разбирает `Mod+Shift+Z`, `Ctrl+Alt+Delete`, `Shift+?`, `Mod++` (клавиша плюс). Регистр и пробелы вокруг `+` не важны.
 * Бросает ошибку на пустое сочетание, незнакомый модификатор или две клавиши: опечатка в сочетании — это баг, а не данные.
 */
export function parseHotkey(combo: string): Hotkey {
    const text = combo.trim();
    // a trailing "+" after a separator is the plus key itself / «+» в конце после разделителя — это сама клавиша плюс
    const parts = text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text === '+' ? ['+'] : text.split('+');
    const hotkey: Hotkey = { key: '', mod: false, ctrl: false, meta: false, alt: false, shift: false };

    parts.forEach((raw, index) => {
        const part = raw.trim();
        const lower = part.toLowerCase();
        const last = index === parts.length - 1;
        if (!last) {
            const modifier = MODIFIERS[lower];
            if (!modifier) throw new Error(`hotkeys: unknown modifier "${part}" in "${combo}"`);
            hotkey[modifier] = true;
            return;
        }
        if (!part && raw !== ' ') throw new Error(`hotkeys: no key in "${combo}"`);
        hotkey.key = KEY_ALIASES[lower] ?? (raw === ' ' ? ' ' : lower);
    });
    return hotkey;
}

const asHotkey = (combo: string | Hotkey): Hotkey => (typeof combo === 'string' ? parseHotkey(combo) : combo);

/**
 * What modifiers the combination really needs on this platform (`Mod` resolved).
 * Какие модификаторы сочетанию нужны на этой платформе на самом деле (`Mod` раскрыт).
 */
function resolve(hotkey: Hotkey, mac: boolean) {
    return {
        ctrl: hotkey.ctrl || (hotkey.mod && !mac),
        meta: hotkey.meta || (hotkey.mod && mac),
        alt: hotkey.alt,
        shift: hotkey.shift,
    };
}

export interface KeyLike {
    key: string;
    code?: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}

const isLatinLetter = (key: string) => /^[a-z]$/.test(key);
const isDigit = (key: string) => /^[0-9]$/.test(key);
const isSymbol = (key: string) => key.length === 1 && !isLatinLetter(key) && !isDigit(key) && key !== ' ';

/**
 * Does this keydown press the combination?
 * A letter or a digit is also found by its physical key when the layout gives a non-Latin character (Ctrl+Я is Ctrl+Z
 * on a Russian layout, Option+S on a Mac gives ß), but not on another Latin layout, where the letter itself counts.
 * A symbol (`?`, `+`) often needs Shift to be typed at all, so Shift is checked for it only when the combination names it.
 * Нажимает ли этот keydown сочетание?
 * Буква или цифра находится и по физической клавише, когда раскладка даёт нелатинский символ (Ctrl+Я — это Ctrl+Z
 * в русской раскладке, Option+S на Mac даёт ß), но не на другой латинской раскладке, там считается сама буква.
 * Символ (`?`, `+`) часто без Shift не набрать, поэтому Shift для него проверяется, только если он назван в сочетании.
 */
export function matchHotkey(event: KeyLike, combo: string | Hotkey, options: PlatformOptions = {}): boolean {
    const hotkey = asHotkey(combo);
    const need = resolve(hotkey, options.mac ?? isApplePlatform());
    if (event.ctrlKey !== need.ctrl || event.metaKey !== need.meta || event.altKey !== need.alt) return false;
    if (!(isSymbol(hotkey.key) && !need.shift) && event.shiftKey !== need.shift) return false;

    const key = event.key.toLowerCase();
    if (key === hotkey.key) return true;
    if (!event.code) return false;
    // the digit row is the same on every layout, but Shift (or AZERTY) types a symbol on it: ask the physical key
    // ряд цифр один на всех раскладках, но Shift (или AZERTY) набирает на нём символ: спрашиваем физическую клавишу
    if (isDigit(hotkey.key)) return event.code === `Digit${hotkey.key}`;
    // a non-ASCII character: the layout is not Latin (or Option made a special one), ask the physical key
    // не-ASCII символ: раскладка не латинская (или Option дал особый символ), спрашиваем физическую клавишу
    if (isLatinLetter(hotkey.key) && /[^\x20-\x7e]/.test(event.key)) return event.code === `Key${hotkey.key.toUpperCase()}`;
    return false;
}

const MAC_KEYS: Record<string, string> = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    enter: '↩',
    escape: '⎋',
    backspace: '⌫',
    delete: '⌦',
    tab: '⇥',
    ' ': 'Space',
    pageup: '⇞',
    pagedown: '⇟',
    home: '↖',
    end: '↘',
};

const PC_KEYS: Record<string, string> = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    escape: 'Esc',
    delete: 'Del',
    insert: 'Ins',
    ' ': 'Space',
    pageup: 'PgUp',
    pagedown: 'PgDn',
};

const keyLabel = (key: string, mac: boolean) => (mac ? MAC_KEYS : PC_KEYS)[key] ?? (key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1));

/**
 * The label to show in a menu or a tooltip: `Ctrl+Shift+Z` on Windows and Linux, `⇧⌘Z` on a Mac
 * (glyphs in Apple's order ⌃⌥⇧⌘, no separators; Backspace is ⌫, forward Delete ⌦).
 * Подпись для меню или подсказки: `Ctrl+Shift+Z` на Windows и Linux, `⇧⌘Z` на Mac
 * (значки в порядке Apple ⌃⌥⇧⌘, без разделителей; Backspace — ⌫, Delete вперёд — ⌦).
 */
export function formatHotkey(combo: string | Hotkey, options: PlatformOptions = {}): string {
    const hotkey = asHotkey(combo);
    const mac = options.mac ?? isApplePlatform();
    const need = resolve(hotkey, mac);
    const key = keyLabel(hotkey.key, mac);
    if (mac) {
        return `${need.ctrl ? '⌃' : ''}${need.alt ? '⌥' : ''}${need.shift ? '⇧' : ''}${need.meta ? '⌘' : ''}${key}`;
    }
    const mods = [need.ctrl && 'Ctrl', need.alt && 'Alt', need.shift && 'Shift', need.meta && 'Win'].filter(Boolean);
    return [...mods, key].join('+');
}

/**
 * A canonical form for comparing two combinations on one platform: `Mod+Z` and `Ctrl+Z` are equal off Apple.
 * Каноническая запись для сравнения двух сочетаний на одной платформе: вне Apple `Mod+Z` и `Ctrl+Z` равны.
 */
export function normalizeHotkey(combo: string | Hotkey, options: PlatformOptions = {}): string {
    const hotkey = asHotkey(combo);
    const need = resolve(hotkey, options.mac ?? isApplePlatform());
    const mods = [need.ctrl && 'ctrl', need.meta && 'meta', need.alt && 'alt', need.shift && 'shift'].filter(Boolean);
    return [...mods, hotkey.key === ' ' ? 'space' : hotkey.key].join('+');
}

/** The browser or the system keeps these: a page never gets them (closing, opening, switching tabs and windows). */
const RESERVED_ALL = ['Mod+W', 'Mod+T', 'Mod+N', 'Mod+Shift+T', 'Mod+Shift+N', 'Mod+Shift+W', 'Ctrl+Tab', 'Ctrl+Shift+Tab'];
const RESERVED_MAC = ['Mod+Q', 'Mod+H', 'Mod+M', 'Mod+Tab', 'Mod+Space', 'Mod+Alt+Escape'];
const RESERVED_PC = ['Alt+F4', 'Alt+Tab', 'Ctrl+Alt+Delete'];
/** Safari does not let a page take reload. / Safari не даёт странице перехватить перезагрузку. */
const RESERVED_SAFARI = ['Mod+R'];

export interface ReservedOptions extends PlatformOptions {
    /** Safari (it keeps ⌘R). Default: detected from `navigator`. / Safari (оставляет себе ⌘R). По умолчанию из `navigator`. */
    safari?: boolean;
}

const isSafari = () => typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

/**
 * Will the browser or the system keep this combination to itself? Such a combination must not be offered as a shortcut:
 * it closes the tab or the window instead of reaching the page. `preventDefault` cannot help.
 * Оставит ли браузер или система это сочетание себе? Такое нельзя предлагать как горячую клавишу:
 * оно закроет вкладку или окно вместо того, чтобы дойти до страницы. `preventDefault` тут не поможет.
 */
export function isReservedHotkey(combo: string | Hotkey, options: ReservedOptions = {}): boolean {
    const mac = options.mac ?? isApplePlatform();
    const safari = options.safari ?? isSafari();
    const list = [...RESERVED_ALL, ...(mac ? RESERVED_MAC : RESERVED_PC), ...(safari ? RESERVED_SAFARI : [])];
    const own = normalizeHotkey(combo, { mac });
    return list.some((reserved) => normalizeHotkey(reserved, { mac }) === own);
}

/**
 * When a key comes from a text field: `smart` lets through only combinations with Ctrl / ⌘ / Alt and leaves the text
 * editing ones to the field (Mod+Z, Mod+Shift+Z, Mod+Y, Mod+A, Mod+C, Mod+X, Mod+V); `never` ignores fields; `always` takes everything.
 * Когда клавиша пришла из текстового поля: `smart` пропускает только сочетания с Ctrl / ⌘ / Alt и оставляет полю
 * текстовые (Mod+Z, Mod+Shift+Z, Mod+Y, Mod+A, Mod+C, Mod+X, Mod+V); `never` поля игнорирует; `always` берёт всё.
 */
export type EditablePolicy = 'smart' | 'never' | 'always';

export interface BindOptions extends PlatformOptions {
    /** Default `smart`. / По умолчанию `smart`. */
    editable?: EditablePolicy;
    /** Fire again while the key is held. Default true. / Срабатывать снова, пока клавиша зажата. По умолчанию true. */
    repeat?: boolean;
}

/** One binding: the combination and what it does. Returning `false` lets the key go on (no `preventDefault`). */
export type HotkeyHandler = (event: KeyboardEvent) => void | boolean;

const TEXT_EDITING = ['Mod+Z', 'Mod+Shift+Z', 'Mod+Y', 'Mod+A', 'Mod+C', 'Mod+X', 'Mod+V'];

function isEditable(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || typeof el.tagName !== 'string') return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
    if (el.tagName !== 'INPUT') return false;
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image'].includes(type);
}

/**
 * Listens to `keydown` on the target (an element, `document`, `window`) and runs the first matching handler.
 * A matched key gets `preventDefault` (unless the handler returns `false`). Returns the function that stops listening.
 * In Vue: bind in `onMounted`, call the result in `onBeforeUnmount`.
 * Слушает `keydown` на цели (элемент, `document`, `window`) и запускает первый подходящий обработчик.
 * Совпавшей клавише делается `preventDefault` (если обработчик не вернул `false`). Возвращает функцию, которая перестаёт слушать.
 * Во Vue: связать в `onMounted`, вызвать результат в `onBeforeUnmount`.
 */
export function bindHotkeys(
    target: EventTarget,
    bindings: Record<string, HotkeyHandler> | (() => Record<string, HotkeyHandler>),
    options: BindOptions = {},
): () => void {
    const mac = options.mac ?? isApplePlatform();
    const editable = options.editable ?? 'smart';
    const textEditing = TEXT_EDITING.map((combo) => parseHotkey(combo));
    // a function is read on every key, so bindings added later count; parsing is cached per string
    // функция читается на каждую клавишу, так что поздние привязки тоже работают; разбор кэшируется по строке
    const cache = new Map<string, Hotkey>();
    const parse = (combo: string) => cache.get(combo) ?? cache.set(combo, parseHotkey(combo)).get(combo)!;
    if (typeof bindings !== 'function') Object.keys(bindings).forEach(parse); // a typo throws at once / опечатка бросает сразу

    const onKeydown = (raw: Event) => {
        const event = raw as KeyboardEvent;
        if (event.defaultPrevented || event.isComposing) return;
        if (event.repeat && options.repeat === false) return;
        const inField = isEditable(event.target);
        if (inField && editable === 'never') return;

        const current = typeof bindings === 'function' ? bindings() : bindings;
        for (const [combo, handler] of Object.entries(current)) {
            if (!matchHotkey(event, parse(combo), { mac })) continue;
            if (inField && editable === 'smart') {
                const modified = event.ctrlKey || event.metaKey || event.altKey;
                if (!modified || textEditing.some((t) => matchHotkey(event, t, { mac }))) return;
            }
            if (handler(event) !== false) event.preventDefault();
            return;
        }
    };

    target.addEventListener('keydown', onKeydown);
    return () => target.removeEventListener('keydown', onKeydown);
}
