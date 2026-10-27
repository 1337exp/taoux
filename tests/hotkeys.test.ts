import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindHotkeys, formatHotkey, isReservedHotkey, matchHotkey, normalizeHotkey, parseHotkey } from '../src/hotkeys';

const mac = { mac: true };
const pc = { mac: false };

const press = (key: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}, code?: string) => ({
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
});

describe('parseHotkey', () => {
    it('reads modifiers in any case and order, the key in lower case', () => {
        expect(parseHotkey('Mod+Shift+Z')).toEqual({ key: 'z', mod: true, ctrl: false, meta: false, alt: false, shift: true });
        expect(parseHotkey('shift + ctrl + alt + F2')).toEqual({ key: 'f2', mod: false, ctrl: true, meta: false, alt: true, shift: true });
        expect(parseHotkey('Cmd+K').meta).toBe(true);
        expect(parseHotkey('Option+S').alt).toBe(true);
    });

    it('knows the key aliases and the plus key', () => {
        expect(parseHotkey('Esc').key).toBe('escape');
        expect(parseHotkey('Del').key).toBe('delete');
        expect(parseHotkey('Mod+Space').key).toBe(' ');
        expect(parseHotkey('Up').key).toBe('arrowup');
        expect(parseHotkey('Mod++').key).toBe('+');
        expect(parseHotkey('Mod+Plus').key).toBe('+');
        expect(parseHotkey('+').key).toBe('+');
    });

    it('a typo is an error, not a shortcut that never fires', () => {
        expect(() => parseHotkey('')).toThrow();
        expect(() => parseHotkey('Mod+')).toThrow();
        expect(() => parseHotkey('Hyper+Z')).toThrow(/unknown modifier/);
    });
});

describe('matchHotkey', () => {
    it('Mod is ⌘ on a Mac and Ctrl elsewhere', () => {
        expect(matchHotkey(press('s', { metaKey: true }), 'Mod+S', mac)).toBe(true);
        expect(matchHotkey(press('s', { ctrlKey: true }), 'Mod+S', mac)).toBe(false);
        expect(matchHotkey(press('s', { ctrlKey: true }), 'Mod+S', pc)).toBe(true);
        expect(matchHotkey(press('s', { metaKey: true }), 'Mod+S', pc)).toBe(false);
    });

    it('every modifier must be exactly as asked', () => {
        expect(matchHotkey(press('Z', { ctrlKey: true, shiftKey: true }), 'Mod+Z', pc)).toBe(false);
        expect(matchHotkey(press('Z', { ctrlKey: true, shiftKey: true }), 'Mod+Shift+Z', pc)).toBe(true);
        expect(matchHotkey(press('z', { ctrlKey: true, altKey: true }), 'Mod+Z', pc)).toBe(false);
        expect(matchHotkey(press('v'), 'V', pc)).toBe(true);
        expect(matchHotkey(press('v', { ctrlKey: true }), 'V', pc)).toBe(false);
    });

    it('a Russian layout: Ctrl+Я is Ctrl+Z by the physical key', () => {
        expect(matchHotkey(press('я', { ctrlKey: true }, 'KeyZ'), 'Mod+Z', pc)).toBe(true);
        expect(matchHotkey(press('ч', { ctrlKey: true }, 'KeyX'), 'Mod+Z', pc)).toBe(false);
    });

    it('Option on a Mac types a special character, the physical key still counts', () => {
        expect(matchHotkey(press('ß', { altKey: true }, 'KeyS'), 'Alt+S', mac)).toBe(true);
    });

    it('another Latin layout counts the letter, not the position (Dvorak)', () => {
        // on Dvorak the physical Z types ";"
        expect(matchHotkey(press(';', { ctrlKey: true }, 'KeyZ'), 'Mod+Z', pc)).toBe(false);
        expect(matchHotkey(press('z', { ctrlKey: true }, 'Semicolon'), 'Mod+Z', pc)).toBe(true);
    });

    it('digits by the digit row: Shift and AZERTY type symbols on it', () => {
        expect(matchHotkey(press('!', { ctrlKey: true, shiftKey: true }, 'Digit1'), 'Mod+Shift+1', pc)).toBe(true);
        expect(matchHotkey(press('&', { ctrlKey: true }, 'Digit1'), 'Mod+1', pc)).toBe(true);
    });

    it('a symbol that needs Shift to be typed matches without naming Shift', () => {
        expect(matchHotkey(press('?', { shiftKey: true }), '?', pc)).toBe(true);
        expect(matchHotkey(press('+', { ctrlKey: true, shiftKey: true }), 'Mod++', pc)).toBe(true);
        expect(matchHotkey(press('+', { ctrlKey: true }), 'Mod++', pc)).toBe(true);
    });

    it('named keys', () => {
        expect(matchHotkey(press('Delete'), 'Del', pc)).toBe(true);
        expect(matchHotkey(press('ArrowUp', { shiftKey: true }), 'Shift+Up', pc)).toBe(true);
        expect(matchHotkey(press(' '), 'Space', pc)).toBe(true);
    });
});

describe('formatHotkey', () => {
    it('Windows and Linux: words joined by +, Ctrl Alt Shift order', () => {
        expect(formatHotkey('Mod+Shift+Z', pc)).toBe('Ctrl+Shift+Z');
        expect(formatHotkey('Shift+Alt+Mod+S', pc)).toBe('Ctrl+Alt+Shift+S');
        expect(formatHotkey('Del', pc)).toBe('Del');
        expect(formatHotkey('Mod+Up', pc)).toBe('Ctrl+↑');
        expect(formatHotkey('F2', pc)).toBe('F2');
        expect(formatHotkey('Escape', pc)).toBe('Esc');
        expect(formatHotkey('Mod+Space', pc)).toBe('Ctrl+Space');
    });

    it("Mac: glyphs in Apple's order ⌃⌥⇧⌘, no separators", () => {
        expect(formatHotkey('Mod+Shift+Z', mac)).toBe('⇧⌘Z');
        expect(formatHotkey('Ctrl+Shift+G', mac)).toBe('⌃⇧G');
        expect(formatHotkey('Mod+Alt+Shift+Ctrl+K', mac)).toBe('⌃⌥⇧⌘K');
        expect(formatHotkey('Backspace', mac)).toBe('⌫');
        expect(formatHotkey('Delete', mac)).toBe('⌦');
        expect(formatHotkey('Mod+Enter', mac)).toBe('⌘↩');
    });
});

describe('normalizeHotkey and isReservedHotkey', () => {
    it('Mod and Ctrl are one off Apple and two on it', () => {
        expect(normalizeHotkey('Mod+Z', pc)).toBe(normalizeHotkey('Ctrl+Z', pc));
        expect(normalizeHotkey('Mod+Z', mac)).not.toBe(normalizeHotkey('Ctrl+Z', mac));
        expect(normalizeHotkey('Shift+Mod+Z', mac)).toBe(normalizeHotkey('Mod+Shift+Z', mac));
    });

    it('closing and opening tabs and windows never reach the page', () => {
        for (const combo of ['Mod+W', 'Mod+T', 'Mod+N', 'Mod+Shift+T', 'Ctrl+Tab']) {
            expect(isReservedHotkey(combo, { ...pc, safari: false }), combo).toBe(true);
            expect(isReservedHotkey(combo, { ...mac, safari: false }), combo).toBe(true);
        }
        expect(isReservedHotkey('Ctrl+W', { ...pc, safari: false })).toBe(true);
    });

    it('per platform: ⌘Q on a Mac, Alt+F4 elsewhere; ⌘R only in Safari', () => {
        expect(isReservedHotkey('Mod+Q', { ...mac, safari: false })).toBe(true);
        expect(isReservedHotkey('Mod+Q', { ...pc, safari: false })).toBe(false);
        expect(isReservedHotkey('Alt+F4', { ...pc, safari: false })).toBe(true);
        expect(isReservedHotkey('Mod+R', { ...mac, safari: true })).toBe(true);
        expect(isReservedHotkey('Mod+R', { ...mac, safari: false })).toBe(false);
    });

    it('ordinary editor shortcuts are free', () => {
        for (const combo of ['Mod+S', 'Mod+Z', 'Mod+Shift+Z', 'Mod+D', 'Delete', 'V']) {
            expect(isReservedHotkey(combo, { ...pc, safari: false }), combo).toBe(false);
            expect(isReservedHotkey(combo, { ...mac, safari: true }), combo).toBe(false);
        }
    });
});

describe('bindHotkeys', () => {
    const stops: (() => void)[] = [];
    afterEach(() => {
        stops.splice(0).forEach((stop) => stop());
        document.body.innerHTML = '';
    });

    const key = (target: EventTarget, init: KeyboardEventInit) => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
        target.dispatchEvent(event);
        return event;
    };

    it('runs the matching handler and prevents the default', () => {
        const save = vi.fn();
        stops.push(bindHotkeys(document, { 'Mod+S': save }, pc));
        const event = key(document.body, { key: 's', ctrlKey: true });
        expect(save).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(true);
        expect(key(document.body, { key: 's' }).defaultPrevented).toBe(false);
    });

    it('a handler returning false lets the key go on', () => {
        stops.push(bindHotkeys(document, { 'Mod+S': () => false }, pc));
        expect(key(document.body, { key: 's', ctrlKey: true }).defaultPrevented).toBe(false);
    });

    it('stops listening when told to', () => {
        const save = vi.fn();
        bindHotkeys(document, { 'Mod+S': save }, pc)();
        key(document.body, { key: 's', ctrlKey: true });
        expect(save).not.toHaveBeenCalled();
    });

    it('listens only on its element', () => {
        const panel = document.body.appendChild(document.createElement('div'));
        const other = document.body.appendChild(document.createElement('div'));
        const hit = vi.fn();
        stops.push(bindHotkeys(panel, { Delete: hit }, pc));
        key(other, { key: 'Delete' });
        key(panel, { key: 'Delete' });
        expect(hit).toHaveBeenCalledOnce();
    });

    it('in a text field (smart): plain keys and text editing stay with the field, the rest goes through', () => {
        const input = document.body.appendChild(document.createElement('input'));
        const del = vi.fn();
        const undo = vi.fn();
        const save = vi.fn();
        stops.push(bindHotkeys(document, { Delete: del, 'Mod+Z': undo, 'Mod+S': save }, pc));
        key(input, { key: 'Delete' });
        key(input, { key: 'z', ctrlKey: true });
        key(input, { key: 's', ctrlKey: true });
        expect(del).not.toHaveBeenCalled();
        expect(undo).not.toHaveBeenCalled();
        expect(save).toHaveBeenCalledOnce();
        // a checkbox is not a text field
        const box = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'checkbox' }));
        key(box, { key: 'Delete' });
        expect(del).toHaveBeenCalledOnce();
    });

    it('editable: never and always', () => {
        const area = document.body.appendChild(document.createElement('textarea'));
        const save = vi.fn();
        stops.push(bindHotkeys(document, { 'Mod+S': save }, { ...pc, editable: 'never' }));
        key(area, { key: 's', ctrlKey: true });
        expect(save).not.toHaveBeenCalled();
        const del = vi.fn();
        stops.push(bindHotkeys(document, { Delete: del }, { ...pc, editable: 'always' }));
        key(area, { key: 'Delete' });
        expect(del).toHaveBeenCalledOnce();
    });

    it('skips a held key when repeat is off, an IME composition and an already handled key', () => {
        const hit = vi.fn();
        stops.push(bindHotkeys(document, { V: hit }, { ...pc, repeat: false }));
        key(document.body, { key: 'v', repeat: true });
        key(document.body, { key: 'v', isComposing: true });
        const handled = new KeyboardEvent('keydown', { key: 'v', bubbles: true, cancelable: true });
        handled.preventDefault();
        document.body.dispatchEvent(handled);
        expect(hit).not.toHaveBeenCalled();
        key(document.body, { key: 'v' });
        expect(hit).toHaveBeenCalledOnce();
    });

    it('a typo in a binding throws at once; a function of bindings is read on every key', () => {
        expect(() => bindHotkeys(document, { 'Hyper+S': () => {} })).toThrow();
        const bindings: Record<string, () => void> = {};
        stops.push(bindHotkeys(document, () => bindings, pc));
        const late = vi.fn();
        bindings['Mod+K'] = late;
        key(document.body, { key: 'k', ctrlKey: true });
        expect(late).toHaveBeenCalledOnce();
    });
});
