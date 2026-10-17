// Small numeric maths several modules need (curve, gradient, playback):
// clamping, rounding, steps, "nice" scale ticks. Imports nothing.
// Мелкая числовая математика, которая нужна сразу нескольким модулям (кривая, градиент, воспроизведение):
// зажим, округление, шаг, «красивые» деления шкалы. Ничего не импортирует.

/**
 * Clamps `v` into `lo…hi`.
 * Зажимает `v` в `lo…hi`.
 */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Clamps into 0…1.
 * Зажимает в 0…1.
 */
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Clamps `v` into the bounds; a bound that is not set does not limit.
 * Зажимает `v` в границы; незаданная граница не ограничивает.
 */
export function clampTo(v: number, min?: number, max?: number): number {
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
}

/**
 * Rounds to `digits` decimals (no "-0"); `null` and `undefined` leave the value as is.
 * Обрезает до `digits` знаков после запятой (без «-0»); `null` и `undefined` оставляют значение как есть.
 */
export function roundTo(x: number, digits?: number | null): number {
    if (digits === undefined || digits === null) return x;
    const k = Math.pow(10, Math.max(0, Math.floor(digits)));
    return Math.round(x * k) / k + 0;
}

/**
 * Snaps `x` to the nearest multiple of `step` without a float tail; a step of 0 or less leaves the value as is.
 * Прижимает `x` к ближайшему кратному `step`, без хвоста float; шаг 0 или меньше оставляет значение как есть.
 */
export function snapTo(x: number, step: number): number {
    return step > 0 ? Math.round(Math.round(x / step) * step * 1e6) / 1e6 + 0 : x;
}

/**
 * A "1, 2, 5 × 10ⁿ" step that gives about `target` ticks on a span of length `span`.
 * Шаг «1, 2, 5 × 10ⁿ», при котором на отрезке длиной `span` выходит около `target` делений.
 */
export function niceStep(span: number, target = 4): number {
    if (!(span > 0)) return 1;
    const raw = span / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/**
 * Ticks on `lo…hi` with step `step`: multiples of the step, with no float error build-up and no "-0".
 * Метки на отрезке `lo…hi` с шагом `step`: кратные шагу, без накопления ошибки float и без «-0».
 */
export function ticks(lo: number, hi: number, step: number): number[] {
    const out: number[] = [];
    const first = Math.ceil(lo / step - 1e-9);
    const last = Math.floor(hi / step + 1e-9);
    for (let i = first; i <= last; i++) out.push(Math.round(i * step * 1e6) / 1e6 + 0);
    return out;
}
