import { afterEach, describe, expect, it, vi } from 'vitest';
import { uid, uuid } from '../src/ids';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('uid', () => {
    it('counts with a prefix and skips the taken ones', () => {
        const a = uid('n');
        const b = uid('n', (id) => id === `n${Number(a.slice(1)) + 1}`);
        expect(Number(b.slice(1))).toBe(Number(a.slice(1)) + 2);
    });
});

describe('uuid', () => {
    it('is a v4 UUID and never repeats', () => {
        const ids = new Set(Array.from({ length: 500 }, uuid));
        expect(ids.size).toBe(500);
        for (const id of ids) expect(id).toMatch(V4);
    });

    it('without randomUUID (plain http on a LAN address) builds the same v4 from getRandomValues', () => {
        const real = globalThis.crypto;
        const getRandomValues = vi.fn(<T extends ArrayBufferView<ArrayBuffer>>(a: T) => real.getRandomValues(a));
        vi.stubGlobal('crypto', { getRandomValues });
        expect(uuid()).toMatch(V4);
        expect(getRandomValues).toHaveBeenCalled();
    });

    it('without Web Crypto at all still gives a v4', () => {
        vi.stubGlobal('crypto', undefined);
        expect(uuid()).toMatch(V4);
    });
});
