import { describe, expect, it } from 'vitest';
import { cubicBezier, DEFAULT_BEZIER, EASE_DIRECTIONS, EASE_FAMILIES, EASE_NAMES, easeName, easeParts, easeValue, isEase, type EaseName } from '../src/ease';

describe('имена', () => {
    it('linear, step и 8 семейств по три направления', () => {
        expect(EASE_NAMES).toHaveLength(2 + EASE_FAMILIES.length * EASE_DIRECTIONS.length);
        expect(EASE_NAMES).toContain('cubic-in-out');
        expect(new Set(EASE_NAMES).size).toBe(EASE_NAMES.length);
    });

    it('имя собирается и разбирается', () => {
        expect(easeName('elastic', 'in-out')).toBe('elastic-in-out');
        expect(easeParts('back-out')).toEqual({ family: 'back', direction: 'out' });
        expect(easeParts('quad-in-out')).toEqual({ family: 'quad', direction: 'in-out' });
        expect(easeParts('linear')).toBeNull();
        expect(easeParts('step')).toBeNull();
    });

    it('проверка значения из файла', () => {
        expect(isEase('linear')).toBe(true);
        expect(isEase('cubic-out')).toBe(true);
        expect(isEase('wobble')).toBe(false);
        expect(isEase({ bezier: [0.25, 0.1, 0.25, 1] })).toBe(true);
        expect(isEase({ bezier: [0.25, 3, 0.25, -1] })).toBe(true); // y свободный
        expect(isEase({ bezier: [1.5, 0, 0, 1] })).toBe(false); // x в 0…1
        expect(isEase({ bezier: [0, 0, 1] })).toBe(false);
        expect(isEase({ bezier: [0, 0, 1, Number.NaN] })).toBe(false);
        expect(isEase(null)).toBe(false);
        expect(isEase(5)).toBe(false);
    });
});

describe('easeValue', () => {
    it('края: каждый переход начинается в 0 и приходит в 1', () => {
        for (const name of EASE_NAMES) {
            expect(easeValue(name, 0), name).toBeCloseTo(0, 6);
            expect(easeValue(name, 1), name).toBeCloseTo(1, 6);
        }
        expect(easeValue({ bezier: [0.25, 0.1, 0.25, 1] }, 0)).toBe(0);
        expect(easeValue({ bezier: [0.25, 0.1, 0.25, 1] }, 1)).toBe(1);
    });

    it('без перехода и linear линейно, вне 0…1 зажимается', () => {
        expect(easeValue(undefined, 0.3)).toBe(0.3);
        expect(easeValue('linear', 0.7)).toBe(0.7);
        expect(easeValue('quad-in', -1)).toBe(0);
        expect(easeValue('quad-in', 2)).toBe(1);
    });

    it('step держит значение до конца участка', () => {
        expect(easeValue('step', 0)).toBe(0);
        expect(easeValue('step', 0.99)).toBe(0);
        expect(easeValue('step', 1)).toBe(1);
    });

    it('in медленнее линейного в начале, out быстрее, in-out симметричен вокруг середины', () => {
        for (const f of ['sine', 'quad', 'cubic', 'quart', 'expo'] as const) {
            expect(easeValue(easeName(f, 'in'), 0.3), f).toBeLessThan(0.3);
            expect(easeValue(easeName(f, 'out'), 0.3), f).toBeGreaterThan(0.3);
            expect(easeValue(easeName(f, 'in-out'), 0.5), f).toBeCloseTo(0.5, 6);
            expect(easeValue(easeName(f, 'in-out'), 0.2) + easeValue(easeName(f, 'in-out'), 0.8), f).toBeCloseTo(1, 6);
        }
    });

    it('известные значения', () => {
        expect(easeValue('quad-in', 0.5)).toBeCloseTo(0.25, 6);
        expect(easeValue('quad-out', 0.5)).toBeCloseTo(0.75, 6);
        expect(easeValue('cubic-in', 0.5)).toBeCloseTo(0.125, 6);
        expect(easeValue('sine-out', 0.5)).toBeCloseTo(Math.sin(Math.PI / 4), 6);
        expect(easeValue('quart-in', 0.5)).toBeCloseTo(0.0625, 6);
    });

    it('back и elastic заступают за 0…1, bounce нет', () => {
        const samples = Array.from({ length: 101 }, (_, i) => i / 100);
        expect(Math.max(...samples.map((u) => easeValue('back-out', u)))).toBeGreaterThan(1.05);
        expect(Math.min(...samples.map((u) => easeValue('back-in', u)))).toBeLessThan(-0.05);
        expect(Math.max(...samples.map((u) => easeValue('elastic-out', u)))).toBeGreaterThan(1.05);
        expect(Math.max(...samples.map((u) => easeValue('bounce-out', u)))).toBeLessThanOrEqual(1 + 1e-9);
        expect(Math.min(...samples.map((u) => easeValue('bounce-in', u)))).toBeGreaterThanOrEqual(-1e-9);
    });

    it('непрерывность: соседние отсчёты не прыгают (кроме step)', () => {
        for (const name of EASE_NAMES.filter((n) => n !== 'step') as EaseName[]) {
            let prev = easeValue(name, 0);
            for (let i = 1; i <= 400; i++) {
                const v = easeValue(name, i / 400);
                expect(Math.abs(v - prev), `${name} at ${i}`).toBeLessThan(0.2);
                prev = v;
            }
        }
    });
});

describe('cubicBezier', () => {
    it('прямая (0,0,1,1) это линейный переход', () => {
        const f = cubicBezier(0, 0, 1, 1);
        for (const t of [0.1, 0.25, 0.5, 0.9]) expect(f(t)).toBeCloseTo(t, 4);
    });

    it('как CSS: ease-in-out (0.42, 0, 0.58, 1) симметричен и даёт 0.5 в середине', () => {
        const f = cubicBezier(0.42, 0, 0.58, 1);
        expect(f(0.5)).toBeCloseTo(0.5, 4);
        expect(f(0.2) + f(0.8)).toBeCloseTo(1, 4);
        expect(f(0.1)).toBeLessThan(0.1);
    });

    it('y за пределами 0…1 даёт заступ, x зажимается в 0…1', () => {
        const f = cubicBezier(0.3, 1.8, 0.7, 1);
        expect(Math.max(...Array.from({ length: 101 }, (_, i) => f(i / 100)))).toBeGreaterThan(1.1);
        const g = cubicBezier(5, 0, -3, 1); // x-ы зажаты в 1 и 0: не падает и монотонно приходит в края
        expect(g(0)).toBe(0);
        expect(g(1)).toBe(1);
        expect(Number.isFinite(g(0.5))).toBe(true);
    });

    it('easeValue принимает Безье из файла и кэширует функцию', () => {
        const ease = { bezier: [0.42, 0, 0.58, 1] as const };
        expect(easeValue(ease, 0.5)).toBeCloseTo(0.5, 4);
        expect(easeValue(ease, 0.25)).toBeCloseTo(cubicBezier(0.42, 0, 0.58, 1)(0.25), 8);
        expect(DEFAULT_BEZIER).toHaveLength(4);
    });
});
