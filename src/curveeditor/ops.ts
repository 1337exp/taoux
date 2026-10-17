import { easeValue, type Ease } from '../ease';
import { clamp01 } from '../num';

/**
 * A curve point: t in 0…1, v is the value. `ease` sets how to go from this point to the next (linear by default);
 * on the last point it has no effect.
 * Точка кривой: t в 0…1, v значение. `ease` задаёт, как идти от этой точки к следующей (по умолчанию линейно);
 * у последней точки он ни на что не влияет.
 */
/**
 * Guides from the selected point to the axes: none, lines only, lines and values.
 * Направляющие от выбранной точки к осям: нет, только линии, линии и значения.
 */
export type CurveGuides = 'off' | 'lines' | 'values';

export interface CurvePoint {
    t: number;
    v: number;
    ease?: Ease;
}

/**
 * The curve value at t: beyond the end points it equals the end point, between them it follows the `ease` of the left point (linear without it).
 * Значение кривой в t: вне крайних точек равно крайней, между ними по переходу `ease` левой точки (без него линейно).
 */
export function sampleCurve(points: readonly CurvePoint[], t: number): number {
    const n = points.length;
    if (n === 0) return 0;
    const x = clamp01(t);
    if (x <= points[0]!.t) return points[0]!.v;
    if (x >= points[n - 1]!.t) return points[n - 1]!.v;
    for (let i = 1; i < n; i++) {
        const b = points[i]!;
        if (x <= b.t) {
            const a = points[i - 1]!;
            const span = b.t - a.t;
            return span <= 0 ? b.v : a.v + (b.v - a.v) * easeValue(a.ease, (x - a.t) / span);
        }
    }
    return points[n - 1]!.v;
}

/**
 * Moves point `i`: along t it stays between its neighbours (the order is kept), along v it is free.
 * Двигает точку `i`: по t она остаётся между соседями (порядок не нарушается), по v свободна.
 */
export function movePoint(points: readonly CurvePoint[], i: number, t: number, v: number): CurvePoint[] {
    const next = points.map((p) => ({ ...p }));
    const lo = i > 0 ? next[i - 1]!.t : 0;
    const hi = i < next.length - 1 ? next[i + 1]!.t : 1;
    next[i] = { ...next[i]!, t: Math.min(hi, Math.max(lo, clamp01(t))), v };
    return next;
}

/**
 * Adds a point at `t` with value `v` (the curve value at that point by default); returns the new list and the point index.
 * Добавляет точку в `t` со значением `v` (по умолчанию значение кривой в этой точке); возвращает новый список и индекс точки.
 */
export function addPoint(points: readonly CurvePoint[], t: number, v?: number): { points: CurvePoint[]; index: number } {
    const x = clamp01(t);
    const next = points.map((p) => ({ ...p }));
    const at = next.findIndex((p) => p.t > x);
    const index = at === -1 ? next.length : at;
    next.splice(index, 0, { t: x, v: v ?? sampleCurve(points, x) });
    return { points: next, index };
}

/**
 * Removes a point; never leaves fewer than two (a curve of one point is just a number).
 * Убирает точку; меньше двух точек не оставляет (кривая из одной точки это просто число).
 */
export function removePoint(points: readonly CurvePoint[], i: number): CurvePoint[] {
    if (points.length <= 2) return points.map((p) => ({ ...p }));
    return points.filter((_, k) => k !== i).map((p) => ({ ...p }));
}

/**
 * A segment transition that is neither a straight line nor a step: its shape has to be drawn and taken into account when choosing the view.
 * Переход участка, который не прямая и не ступенька: его форму нужно рисовать и учитывать при подборе вида.
 */
const curved = (e: Ease | undefined) => e !== undefined && e !== 'linear' && e !== 'step';

/**
 * The polyline of segment a→b for drawing: a straight one has two ends, other transitions `steps` pieces (a step: a corner).
 * Ломаная участка a→b для рисования: у прямой два конца, у остальных переходов `steps` отрезков (ступенька: угол).
 */
export function sampleSegment(a: CurvePoint, b: CurvePoint, steps = 24): { t: number; v: number }[] {
    if (a.ease === 'step') return [{ t: a.t, v: a.v }, { t: b.t, v: a.v }, { t: b.t, v: b.v }];
    if (!curved(a.ease)) return [{ t: a.t, v: a.v }, { t: b.t, v: b.v }];
    const out: { t: number; v: number }[] = [];
    for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        out.push({ t: a.t + (b.t - a.t) * u, v: a.v + (b.v - a.v) * easeValue(a.ease, u) });
    }
    return out;
}

/**
 * A copy of the list with the transition of point `i` (`undefined` and `linear` remove the field: the file stays short).
 * Копия списка с переходом точки `i` (`undefined` и `linear` убирают поле: файл остаётся коротким).
 */
export function setEase(points: readonly CurvePoint[], i: number, ease: Ease | undefined): CurvePoint[] {
    return points.map((p, k) => {
        if (k !== i) return { ...p };
        const { ease: _old, ...rest } = p;
        return ease === undefined || ease === 'linear' ? rest : { ...rest, ease };
    });
}

/**
 * Value limits for drawing: from 0 (or below the minimum) to the maximum with some headroom, no narrower than 0…1.
 * The given `min`/`max` (the field bounds) fix the view: the plot neither drifts nor leaves the allowed range.
 * Пределы значений для отрисовки: от 0 (или ниже минимума) до максимума с запасом, не уже чем 0…1.
 * Заданные `min`/`max` (границы поля) фиксируют вид: график не плывёт и не выходит за допустимое.
 */
export function valueBounds(points: readonly CurvePoint[], min?: number, max?: number): { min: number; max: number } {
    let lo = 0;
    let hi = 1;
    for (const p of points) {
        lo = Math.min(lo, p.v);
        hi = Math.max(hi, p.v);
    }
    // what goes beyond the point values (overshoot, handles): the field bounds are the allowed point values, but all of it has to be visible
    // то, что выходит за значения точек (заступ, ручки): границы поля это допустимые значения точек, а видеть это нужно всё
    let outLo = Infinity;
    let outHi = -Infinity;
    const see = (v: number) => {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
        outLo = Math.min(outLo, v);
        outHi = Math.max(outHi, v);
    };
    // transitions with overshoot (back, elastic, Bezier) go beyond the point values: the view is chosen by the curve itself
    // переходы с заступом (back, elastic, Безье) выходят за значения точек: вид подбираем по самой кривой
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]!;
        if (!curved(a.ease)) continue;
        // Bezier handles must fit the view too: otherwise a handle that went off the edge cannot be reached
        // ручки Безье тоже должны попадать в вид: иначе уехавшую за край ручку не достать
        if (typeof a.ease === 'object') {
            const dv = points[i + 1]!.v - a.v;
            for (const y of [a.ease.bezier[1], a.ease.bezier[3]]) see(a.v + y * dv);
        }
        for (const s of sampleSegment(points[i]!, points[i + 1]!)) see(s.v);
    }
    const auto = { min: lo, max: hi === lo ? lo + 1 : hi * 1.1 };
    // a given bound fixes the view, but overshoot and handles widen it: so they do not hide behind the edge
    // заданная граница фиксирует вид, но заступ и ручки её раздвигают: так они не прячутся за край
    const a = min === undefined ? auto.min : Math.min(min, outLo);
    const b = max === undefined ? auto.max : Math.max(max, outHi);
    return b > a ? { min: a, max: b } : { min: a, max: a + 1 };
}
