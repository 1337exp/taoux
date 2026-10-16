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
