// Мелкая числовая математика, которая нужна сразу нескольким модулям (кривая, градиент, воспроизведение):
// зажим, округление, шаг, «красивые» деления шкалы. Ничего не импортирует.

/** Зажимает `v` в `lo…hi`. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Зажимает в 0…1. */
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Зажимает `v` в границы; незаданная граница не ограничивает. */
export function clampTo(v: number, min?: number, max?: number): number {
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
}

/** Обрезает до `digits` знаков после запятой (без «-0»); `null` и `undefined` оставляют значение как есть. */
export function roundTo(x: number, digits?: number | null): number {
    if (digits === undefined || digits === null) return x;
    const k = Math.pow(10, Math.max(0, Math.floor(digits)));
    return Math.round(x * k) / k + 0;
}

/** Прижимает `x` к ближайшему кратному `step`, без хвоста float; шаг 0 или меньше оставляет значение как есть. */
export function snapTo(x: number, step: number): number {
    return step > 0 ? Math.round(Math.round(x / step) * step * 1e6) / 1e6 + 0 : x;
}

/** Шаг «1, 2, 5 × 10ⁿ», при котором на отрезке длиной `span` выходит около `target` делений. */
export function niceStep(span: number, target = 4): number {
    if (!(span > 0)) return 1;
    const raw = span / Math.max(1, target);
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

/** Метки на отрезке `lo…hi` с шагом `step`: кратные шагу, без накопления ошибки float и без «-0». */
export function ticks(lo: number, hi: number, step: number): number[] {
    const out: number[] = [];
    const first = Math.ceil(lo / step - 1e-9);
    const last = Math.floor(hi / step + 1e-9);
    for (let i = first; i <= last; i++) out.push(Math.round(i * step * 1e6) / 1e6 + 0);
    return out;
}
