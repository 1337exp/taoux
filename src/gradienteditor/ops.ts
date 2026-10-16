/**
 * Остановка градиента: t в 0…1, цвет в линейном RGB 0…1 (не sRGB), alpha 0…1.
 * Линейный цвет нужен рендеру; в CSS-полоску он переводится в sRGB (`gradientCss`).
 */
export interface GradientStop {
    t: number;
    color: [number, number, number];
    alpha: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

const copy = (stops: readonly GradientStop[]): GradientStop[] => stops.map((s) => ({ ...s, color: [...s.color] as GradientStop['color'] }));

/** Цвет и непрозрачность градиента в t: линейно между остановками, за краями равны крайней. Возвращает [r, g, b, a]. */
export function sampleGradient(stops: readonly GradientStop[], t: number): [number, number, number, number] {
    const n = stops.length;
    if (n === 0) return [1, 1, 1, 1];
    const x = clamp01(t);
    let a = stops[0]!;
    let b = stops[0]!;
    let k = 0;
    if (x >= stops[n - 1]!.t) {
        a = b = stops[n - 1]!;
    } else if (x > stops[0]!.t) {
        for (let i = 1; i < n; i++) {
            if (x <= stops[i]!.t) {
                a = stops[i - 1]!;
                b = stops[i]!;
                const span = b.t - a.t;
                k = span <= 0 ? 1 : (x - a.t) / span;
                break;
            }
        }
    }
    return [
        a.color[0] + (b.color[0] - a.color[0]) * k,
        a.color[1] + (b.color[1] - a.color[1]) * k,
        a.color[2] + (b.color[2] - a.color[2]) * k,
        a.alpha + (b.alpha - a.alpha) * k,
    ];
}

/** Сдвигает остановку `i` по t в пределах соседей. */
export function moveStop(stops: readonly GradientStop[], i: number, t: number): GradientStop[] {
    const next = copy(stops);
    const lo = i > 0 ? next[i - 1]!.t : 0;
    const hi = i < next.length - 1 ? next[i + 1]!.t : 1;
    next[i] = { ...next[i]!, t: Math.min(hi, Math.max(lo, clamp01(t))) };
    return next;
}

/** Добавляет остановку в `t` с цветом, который градиент имеет в этой точке; возвращает новый список и индекс. */
export function addStop(stops: readonly GradientStop[], t: number): { stops: GradientStop[]; index: number } {
    const x = clamp01(t);
    const [r, g, b, a] = sampleGradient(stops, x);
    const next = copy(stops);
    const at = next.findIndex((s) => s.t > x);
    const index = at === -1 ? next.length : at;
    next.splice(index, 0, { t: x, color: [r, g, b], alpha: a });
    return { stops: next, index };
}

/** Убирает остановку; последнюю не убирает. */
export function removeStop(stops: readonly GradientStop[], i: number): GradientStop[] {
    if (stops.length <= 1) return copy(stops);
    return copy(stops.filter((_, k) => k !== i));
}

/** Линейный цвет → sRGB, 0…1. */
export const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
/** sRGB → линейный цвет, 0…1. */
export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** CSS-градиент для полосы предпросмотра (линейный цвет переводится в sRGB, альфа остаётся). */
export function gradientCss(stops: readonly GradientStop[]): string {
    const srgb = (c: number) => Math.round(255 * toSrgb(Math.min(1, Math.max(0, c))));
    const parts = stops.map((s) => `rgba(${srgb(s.color[0])}, ${srgb(s.color[1])}, ${srgb(s.color[2])}, ${s.alpha.toFixed(3)}) ${(s.t * 100).toFixed(1)}%`);
    return `linear-gradient(to right, ${parts.join(', ')})`;
}
