import { clamp01, roundTo } from '../num';

/**
 * A gradient stop: t in 0…1, colour in linear RGB 0…1 (not sRGB), alpha 0…1.
 * Linear colour is what rendering needs; for the CSS preview bar it is converted to sRGB (`gradientCss`).
 * Остановка градиента: t в 0…1, цвет в линейном RGB 0…1 (не sRGB), alpha 0…1.
 * Линейный цвет нужен рендеру; в CSS-полоску он переводится в sRGB (`gradientCss`).
 */
export interface GradientStop {
    t: number;
    color: [number, number, number];
    alpha: number;
}


const copy = (stops: readonly GradientStop[]): GradientStop[] => stops.map((s) => ({ ...s, color: [...s.color] as GradientStop['color'] }));

/**
 * Default decimals of t and opacity: "0.5700000000000001" in a file is of use to nobody.
 * Знаков после запятой по умолчанию у t и непрозрачности: «0.5700000000000001» в файле никому не нужно.
 */
export const DEFAULT_PRECISION = 3;

/**
 * Decimals of the colour components for a given `precision` of t and opacity. The colour is linear, and in the dark part of the scale sRGB rises steeply
 * (a linear step of 0.001 is 3 levels out of 255), so two more decimals are needed here: five when t has three.
 * Знаков у компонент цвета при `precision` у t и непрозрачности. Цвет линейный, а в тёмной части шкалы sRGB круто растёт
 * (шаг 0.001 линейного это 3 уровня из 255), поэтому тут нужно на два знака больше: при трёх у t это пять.
 */
export const colorDigits = (precision: number | null): number | null => (precision === null ? null : precision + 2);

/**
 * Opacity 0…1 with `digits` decimals (three by default).
 * Непрозрачность 0…1 с `digits` знаками (по умолчанию три).
 */
export const roundAlpha = (a: number, digits: number | null = DEFAULT_PRECISION): number => roundTo(Math.min(1, Math.max(0, a)), digits);

/**
 * Changes stop `i`; t and opacity are rounded to `precision` decimals (three by default; `null` turns it off), the colour to `precision + 2`.
 * Меняет остановку `i`; t и непрозрачность округляются до `precision` знаков (по умолчанию три; `null` отключает), цвет до `precision + 2`.
 */
export function patchStop(stops: readonly GradientStop[], i: number, patch: Partial<GradientStop>, precision: number | null = DEFAULT_PRECISION): GradientStop[] {
    const next = copy(stops);
    const stop = { ...next[i]!, ...patch };
    stop.alpha = roundAlpha(stop.alpha, precision);
    stop.t = roundTo(Math.min(1, Math.max(0, stop.t)), precision);
    stop.color = stop.color.map((c) => roundTo(c, colorDigits(precision))) as GradientStop['color'];
    next[i] = stop;
    return next;
}

/**
 * The colour and opacity of the gradient at t: linear between stops, equal to the end stop beyond the ends. Returns [r, g, b, a].
 * Цвет и непрозрачность градиента в t: линейно между остановками, за краями равны крайней. Возвращает [r, g, b, a].
 */
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

/**
 * Moves stop `i` along t within its neighbours.
 * Сдвигает остановку `i` по t в пределах соседей.
 */
export function moveStop(stops: readonly GradientStop[], i: number, t: number, precision?: number | null): GradientStop[] {
    const next = copy(stops);
    const lo = i > 0 ? next[i - 1]!.t : 0;
    const hi = i < next.length - 1 ? next[i + 1]!.t : 1;
    next[i] = { ...next[i]!, t: Math.min(hi, Math.max(lo, roundTo(clamp01(t), precision))) };
    return next;
}

/**
 * Adds a stop at `t` with the colour the gradient has at that point; returns the new list and the index.
 * Добавляет остановку в `t` с цветом, который градиент имеет в этой точке; возвращает новый список и индекс.
 */
export function addStop(stops: readonly GradientStop[], t: number, precision: number | null = DEFAULT_PRECISION): { stops: GradientStop[]; index: number } {
    const x = roundTo(clamp01(t), precision);
    const [r, g, b, a] = sampleGradient(stops, x);
    const next = copy(stops);
    const at = next.findIndex((s) => s.t > x);
    const index = at === -1 ? next.length : at;
    const d = colorDigits(precision);
    next.splice(index, 0, { t: x, color: [roundTo(r, d), roundTo(g, d), roundTo(b, d)], alpha: roundAlpha(a, precision) });
    return { stops: next, index };
}

/**
 * Removes a stop; the last one is never removed.
 * Убирает остановку; последнюю не убирает.
 */
export function removeStop(stops: readonly GradientStop[], i: number): GradientStop[] {
    if (stops.length <= 1) return copy(stops);
    return copy(stops.filter((_, k) => k !== i));
}

/**
 * Stops lying right next to stop `i` (within `px` pixels at bar width `width`), itself included: a pile of overlapping handles.
 * Остановки, лежащие вплотную к остановке `i` (в пределах `px` пикселей при ширине полосы `width`), включая её саму: стопка наложенных ручек.
 */
export function stackAround(stops: readonly GradientStop[], i: number, width: number, px: number): number[] {
    const here = stops[i]?.t ?? 0;
    return stops.flatMap((s, k) => (Math.abs(s.t - here) * width <= px ? [k] : []));
}

/**
 * Which handle of the pile to take when it was dragged by `dx` pixels. The order of stops must not change, so only an outer one can be pulled out:
 * the first to the left, the last to the right.
 * Какую ручку из стопки взять, когда её потянули на `dx` пикселей. Порядок остановок менять нельзя, поэтому вытянуть можно
 * только крайнюю: влево первую, вправо последнюю.
 */
export function pickFromStack(cluster: readonly number[], dx: number): number {
    return dx < 0 ? Math.min(...cluster) : Math.max(...cluster);
}

/**
 * Linear colour → sRGB, 0…1.
 * Линейный цвет → sRGB, 0…1.
 */
export const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
/**
 * sRGB → linear colour, 0…1.
 * sRGB → линейный цвет, 0…1.
 */
export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * A CSS gradient for the preview bar (linear colour is converted to sRGB, alpha stays).
 * CSS-градиент для полосы предпросмотра (линейный цвет переводится в sRGB, альфа остаётся).
 */
export function gradientCss(stops: readonly GradientStop[]): string {
    const srgb = (c: number) => Math.round(255 * toSrgb(Math.min(1, Math.max(0, c))));
    const parts = stops.map((s) => `rgba(${srgb(s.color[0])}, ${srgb(s.color[1])}, ${srgb(s.color[2])}, ${s.alpha.toFixed(3)}) ${(s.t * 100).toFixed(1)}%`);
    return `linear-gradient(to right, ${parts.join(', ')})`;
}
