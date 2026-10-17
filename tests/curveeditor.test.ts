import { describe, expect, it } from 'vitest';
import { addPoint, movePoint, removePoint, sampleCurve, valueBounds } from '../src/curveeditor';

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
