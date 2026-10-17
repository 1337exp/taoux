import { describe, expect, it } from 'vitest';
import { addPoint, movePoint, removePoint, sampleCurve, sampleSegment, setEase, valueBounds } from '../src/curveeditor';

const pts = [
    { t: 0, v: 0 },
    { t: 0.5, v: 1 },
    { t: 1, v: 0 },
];

describe('точки кривой', () => {
    it('значение: линейно между точками, за краями равно крайней', () => {
        expect(sampleCurve(pts, 0.25)).toBeCloseTo(0.5);
        expect(sampleCurve(pts, 0.75)).toBeCloseTo(0.5);
        expect(sampleCurve(pts, -1)).toBe(0);
        expect(sampleCurve([], 0.5)).toBe(0);
    });

    it('точка двигается по v свободно, а по t остаётся между соседями', () => {
        expect(movePoint(pts, 1, 0.8, 3)[1]).toEqual({ t: 0.8, v: 3 });
        expect(movePoint(pts, 1, 2, 0)[1]!.t).toBe(1);
        expect(movePoint(pts, 1, -1, 0)[1]!.t).toBe(0);
        expect(movePoint(pts, 0, 0.9, 0)[0]!.t).toBe(0.5);
        expect(pts[1]).toEqual({ t: 0.5, v: 1 }); // исходный список не тронут
    });

    it('добавление берёт значение кривой и сохраняет порядок, удаление оставляет две точки', () => {
        const r = addPoint(pts, 0.25);
        expect(r.index).toBe(1);
        expect(r.points.map((p) => p.t)).toEqual([0, 0.25, 0.5, 1]);
        expect(r.points[1]!.v).toBeCloseTo(0.5);
        expect(addPoint(pts, 0.75, 9).points[2]).toEqual({ t: 0.75, v: 9 });
        expect(removePoint(pts, 1)).toHaveLength(2);
        expect(removePoint(removePoint(pts, 1), 0)).toHaveLength(2);
    });
});

describe('вид графика', () => {
    it('границы поля фиксируют вид, пустые оставляют автоматику', () => {
        expect(valueBounds(pts, 0, 1)).toEqual({ min: 0, max: 1 });
        expect(valueBounds([{ t: 0, v: 0 }, { t: 1, v: 3 }], 0)).toEqual({ min: 0, max: 3.3000000000000003 });
        expect(valueBounds(pts, 2, 1)).toEqual({ min: 2, max: 3 });
    });
});

describe('переходы между точками', () => {
    const ramp = (ease?: import('../src/ease').Ease): { t: number; v: number; ease?: import('../src/ease').Ease }[] => [{ t: 0, v: 0, ease }, { t: 1, v: 10 }];

    it('значение идёт по переходу левой точки, без перехода линейно', () => {
        expect(sampleCurve(ramp(), 0.5)).toBe(5);
        expect(sampleCurve(ramp('quad-in'), 0.5)).toBeCloseTo(2.5, 6);
        expect(sampleCurve(ramp('quad-out'), 0.5)).toBeCloseTo(7.5, 6);
        expect(sampleCurve(ramp('step'), 0.99)).toBe(0);
        expect(sampleCurve(ramp('step'), 1)).toBe(10);
        expect(sampleCurve(ramp({ bezier: [0.42, 0, 0.58, 1] }), 0.5)).toBeCloseTo(5, 3);
    });

    it('переход действует только на свой участок', () => {
        const p = [{ t: 0, v: 0 }, { t: 0.5, v: 10, ease: 'cubic-in' as const }, { t: 1, v: 0 }];
        expect(sampleCurve(p, 0.25)).toBe(5); // первый участок линейный
        expect(sampleCurve(p, 0.75)).toBeCloseTo(10 - 10 * 0.125, 6); // второй: cubic-in на спуск
    });

    it('перемещение точки не теряет её переход', () => {
        const moved = movePoint([{ t: 0, v: 0, ease: 'back-out' }, { t: 1, v: 1 }], 0, 0.2, 0.5);
        expect(moved[0]).toEqual({ t: 0.2, v: 0.5, ease: 'back-out' });
    });

    it('setEase ставит и убирает переход, linear убирает поле, исходный список не трогается', () => {
        const base = [{ t: 0, v: 0 }, { t: 1, v: 1 }];
        const eased = setEase(base, 0, 'elastic-out');
        expect(eased[0]).toEqual({ t: 0, v: 0, ease: 'elastic-out' });
        expect(base[0]).toEqual({ t: 0, v: 0 });
        expect(setEase(eased, 0, 'linear')[0]).toEqual({ t: 0, v: 0 });
        expect(setEase(eased, 0, undefined)[0]).toEqual({ t: 0, v: 0 });
        expect('ease' in setEase(eased, 0, 'linear')[0]!).toBe(false);
    });

    it('ломаная участка: у прямой два конца, у плавного много, у ступеньки угол', () => {
        const a = { t: 0, v: 0 };
        const b = { t: 1, v: 1 };
        expect(sampleSegment(a, b)).toHaveLength(2);
        expect(sampleSegment({ ...a, ease: 'cubic-in-out' }, b)).toHaveLength(25);
        expect(sampleSegment({ ...a, ease: 'step' }, b)).toEqual([{ t: 0, v: 0 }, { t: 1, v: 0 }, { t: 1, v: 1 }]);
        const s = sampleSegment({ ...a, ease: 'quad-in' }, b, 4);
        expect(s.map((p) => p.t)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        expect(s[2]!.v).toBeCloseTo(0.25, 6);
    });

    it('вид подбирается по самой кривой: заступ back не обрезается', () => {
        const flat = valueBounds([{ t: 0, v: 0 }, { t: 1, v: 1 }]);
        const overshoot = valueBounds([{ t: 0, v: 0, ease: 'back-out' as const }, { t: 1, v: 1 }]);
        expect(overshoot.max).toBeGreaterThan(flat.max);
        expect(valueBounds([{ t: 0, v: 0, ease: 'back-out' as const }, { t: 1, v: 1 }], 0, 1)).toEqual({ min: 0, max: 1 }); // заданные границы главнее
    });

    it('вид растёт вместе с ручками Безье', () => {
        const b = valueBounds([{ t: 0, v: 0, ease: { bezier: [0.2, 0.1, 0.8, 2.5] } }, { t: 1, v: 1 }]);
        expect(b.max).toBeGreaterThan(2.5);
    });
});
