import { describe, expect, it } from 'vitest';
import { clamp, clamp01, clampTo, niceStep, roundTo, snapTo, ticks } from '../src/num';

describe('сетка', () => {
    it('шаг подбирается из 1, 2, 5 и ложится на отрезок', () => {
        expect(niceStep(1, 4)).toBe(0.2);
        expect(niceStep(10, 4)).toBe(2);
        expect(niceStep(0.3, 4)).toBe(0.1);
        expect(niceStep(0)).toBe(1);
    });

    it('метки кратны шагу и включают края', () => {
        expect(ticks(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(ticks(-0.1, 0.35, 0.1)).toEqual([-0.1, 0, 0.1, 0.2, 0.3]);
        expect(ticks(0, 0.3, 0.1)).toEqual([0, 0.1, 0.2, 0.3]);
    });

});

describe('округление и зажим', () => {
    it('прижатие к шагу', () => {
        expect(snapTo(0.123, 0.05)).toBe(0.1);
        expect(snapTo(0.126, 0.05)).toBe(0.15);
        expect(snapTo(0.123, 0)).toBe(0.123);
    });

    it('обрезка знаков: без digits не трогает', () => {
        expect(roundTo(0.123456)).toBe(0.123456);
        expect(roundTo(0.126, 2)).toBe(0.13);
        expect(roundTo(1.5, 0)).toBe(2);
        expect(Object.is(roundTo(-0.001, 2), -0)).toBe(false);
    });

    it('зажим в границы', () => {
        expect(clampTo(-1, 0)).toBe(0);
        expect(clampTo(5, 0, 2)).toBe(2);
        expect(clampTo(5)).toBe(5);
    });
});

describe('зажим', () => {
    it('clamp и clamp01', () => {
        expect(clamp(5, 0, 2)).toBe(2);
        expect(clamp(-1, 0, 2)).toBe(0);
        expect(clamp(1, 0, 2)).toBe(1);
        expect(clamp01(-0.5)).toBe(0);
        expect(clamp01(1.5)).toBe(1);
        expect(clamp01(0.3)).toBe(0.3);
    });

    it('roundTo: null и undefined не трогают значение', () => {
        expect(roundTo(0.123456, null)).toBe(0.123456);
        expect(roundTo(0.126, 2)).toBe(0.13);
    });
});
