/** Точка кривой: t в 0…1, v значение. Между точками кривая линейна. */
export interface CurvePoint {
    t: number;
    v: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Значение кривой в t: вне крайних точек равно крайней, между ними линейно. */
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
            return span <= 0 ? b.v : a.v + ((b.v - a.v) * (x - a.t)) / span;
        }
    }
    return points[n - 1]!.v;
}

/** Двигает точку `i`: по t она остаётся между соседями (порядок не нарушается), по v свободна. */
export function movePoint(points: readonly CurvePoint[], i: number, t: number, v: number): CurvePoint[] {
    const next = points.map((p) => ({ ...p }));
    const lo = i > 0 ? next[i - 1]!.t : 0;
    const hi = i < next.length - 1 ? next[i + 1]!.t : 1;
    next[i] = { t: Math.min(hi, Math.max(lo, clamp01(t))), v };
    return next;
}

/** Добавляет точку в `t` со значением `v` (по умолчанию значение кривой в этой точке); возвращает новый список и индекс точки. */
export function addPoint(points: readonly CurvePoint[], t: number, v?: number): { points: CurvePoint[]; index: number } {
    const x = clamp01(t);
    const next = points.map((p) => ({ ...p }));
    const at = next.findIndex((p) => p.t > x);
    const index = at === -1 ? next.length : at;
    next.splice(index, 0, { t: x, v: v ?? sampleCurve(points, x) });
    return { points: next, index };
}

/** Убирает точку; меньше двух точек не оставляет (кривая из одной точки это просто число). */
export function removePoint(points: readonly CurvePoint[], i: number): CurvePoint[] {
    if (points.length <= 2) return points.map((p) => ({ ...p }));
    return points.filter((_, k) => k !== i).map((p) => ({ ...p }));
}

/**
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
    const auto = { min: lo, max: hi === lo ? lo + 1 : hi * 1.1 };
    const a = min ?? auto.min;
    const b = max ?? auto.max;
    return b > a ? { min: a, max: b } : { min: a, max: a + 1 };
}

/** Шаг сетки «1, 2, 5 × 10ⁿ», при котором на отрезке `span` выходит около `target` делений. */
export function niceStep(span: number, target = 4): number {
    if (!(span > 0)) return 1;
    const raw = span / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/** Метки на отрезке lo…hi с шагом `step` (кратные шагу, без накопления ошибки float). */
export function ticks(lo: number, hi: number, step: number): number[] {
    const out: number[] = [];
    const first = Math.ceil(lo / step - 1e-9);
    const last = Math.floor(hi / step + 1e-9);
    for (let i = first; i <= last; i++) out.push(Math.round(i * step * 1e6) / 1e6 + 0); // + 0 убирает «-0»
    return out;
}

/** Прижимает x к ближайшему кратному `step`; шаг 0 или меньше оставляет значение как есть. */
export function snapTo(x: number, step: number): number {
    return step > 0 ? Math.round(Math.round(x / step) * step * 1e6) / 1e6 + 0 : x;
}

/** Обрезает до `digits` знаков после запятой; без `digits` значение остаётся как есть. */
export function roundTo(x: number, digits?: number): number {
    if (digits === undefined) return x;
    const k = Math.pow(10, Math.max(0, Math.floor(digits)));
    return Math.round(x * k) / k + 0;
}

/** Зажимает v в границы; незаданная граница не ограничивает. */
export function clampTo(v: number, min?: number, max?: number): number {
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
}
