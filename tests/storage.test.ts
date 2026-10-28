import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSavedStorage } from '../src/storage';

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe('createSavedStorage', () => {
    it('пишет и читает по своему ключу', () => {
        const s = createSavedStorage('app.state');
        expect(s.read()).toBeNull();
        expect(s.write('{"a":1}')).toBe(true);
        expect(s.read()).toBe('{"a":1}');
        expect(localStorage.getItem('app.state')).toBe('{"a":1}');
    });

    it('копию сломанного кладёт под ключ .broken и не трогает основной', () => {
        const s = createSavedStorage('app.state');
        s.write('good');
        s.backupBroken('bad');
        expect(localStorage.getItem('app.state.broken')).toBe('bad');
        expect(s.read()).toBe('good');
    });

    it('при сбое хранилища не бросает исключение, а сообщает результатом', () => {
        const s = createSavedStorage('app.state');
        const fail = () => {
            throw new Error('denied');
        };
        vi.stubGlobal('localStorage', { getItem: fail, setItem: fail });
        expect(s.write('x')).toBe(false);
        expect(s.read()).toBeNull();
        expect(() => s.backupBroken('x')).not.toThrow();
    });
});

describe('createSavedStorage: remove, the failure reason, other tabs', () => {
    it('remove deletes the key; tryWrite says ok', () => {
        const s = createSavedStorage('app.state');
        expect(s.tryWrite('x')).toEqual({ ok: true });
        expect(s.remove()).toBe(true);
        expect(s.read()).toBeNull();
    });

    it('tryWrite tells a full quota from a ban; write stays a plain boolean', () => {
        const s = createSavedStorage('app.state');
        const quota = () => {
            throw new DOMException('full', 'QuotaExceededError');
        };
        vi.stubGlobal('localStorage', { getItem: () => null, setItem: quota, removeItem: quota });
        expect(s.tryWrite('x')).toEqual({ ok: false, reason: 'quota' });
        expect(s.write('x')).toBe(false);
        expect(s.remove()).toBe(false);

        const denied = () => {
            throw new DOMException('no', 'SecurityError');
        };
        vi.stubGlobal('localStorage', { getItem: denied, setItem: denied });
        expect(s.tryWrite('x')).toEqual({ ok: false, reason: 'denied' });
    });

    it('subscribe hears another tab: a change of its key, a removal, a clear; not other keys or sessionStorage', () => {
        const s = createSavedStorage('app.state');
        const heard: (string | null)[] = [];
        const stop = s.subscribe((text) => heard.push(text));
        const fire = (init: StorageEventInit) => window.dispatchEvent(new StorageEvent('storage', init));
        fire({ key: 'app.state', newValue: 'from another tab', storageArea: localStorage });
        fire({ key: 'other', newValue: 'nope', storageArea: localStorage });
        fire({ key: 'app.state', newValue: 'session', storageArea: sessionStorage });
        fire({ key: 'app.state', newValue: null, storageArea: localStorage });
        fire({ key: null, storageArea: localStorage });
        stop();
        fire({ key: 'app.state', newValue: 'after stop', storageArea: localStorage });
        expect(heard).toEqual(['from another tab', null, null]);
    });

    it('still fits where a SavedStorage is expected', () => {
        const s: import('../src/storage').SavedStorage = createSavedStorage('app.state');
        expect(typeof s.write).toBe('function');
    });
});
