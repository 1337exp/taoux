/**
 * Smart guides for dragging on a canvas (as in Figma and Miro): while a rectangle is dragged, its edges and its centre
 * are compared with the edges and centres of the other rectangles; when two coincide (or are within the threshold) the
 * rectangle is pulled so that they do, and a thin line is drawn through them.
 * The module only counts: where the rectangle goes (`dx`, `dy`) and which lines to draw. Collecting the rectangles of the
 * other nodes, applying the shift and drawing are the app's business. Plain numbers, no DOM, no Vue.
 *
 * Умные направляющие при перетаскивании по холсту (как в Figma и Miro): пока прямоугольник тащат, его края и центр
 * сравниваются с краями и центрами остальных прямоугольников; когда два значения совпали (или ближе порога), прямоугольник
 * притягивается так, чтобы они совпали, и через них рисуется тонкая линия.
 * Модуль только считает: куда сдвинуть прямоугольник (`dx`, `dy`) и какие линии нарисовать. Собрать прямоугольники других
 * нод, применить сдвиг и нарисовать — забота приложения. Просто числа, без DOM и Vue.
 */

export interface GuideRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * A guide line. `axis: 'x'` is a vertical line at `x = at` that runs from `from` to `to` in y; `axis: 'y'` is a
 * horizontal line at `y = at` that runs from `from` to `to` in x.
 * Линия-направляющая. `axis: 'x'` — вертикальная линия при `x = at` от `from` до `to` по y; `axis: 'y'` — горизонтальная
 * при `y = at` от `from` до `to` по x.
 */
export interface GuideLine {
    axis: 'x' | 'y';
    at: number;
    from: number;
    to: number;
}

export interface GuideResult {
    /** How far to shift the rectangle in x so that it lies on a guide; 0 when there is none. / Сдвиг по x, 0 если направляющей нет. */
    dx: number;
    dy: number;
    /** What to draw, for the rectangle already shifted by `dx`, `dy`. / Что рисовать для уже сдвинутого прямоугольника. */
    lines: GuideLine[];
}

export interface GuideOptions {
    /** Compare edges (left / right, top / bottom). Default true. / Сравнивать края. По умолчанию true. */
    edges?: boolean;
    /** Compare centres. Default true. / Сравнивать центры. По умолчанию true. */
    centers?: boolean;
}

/** Two values this close count as the same line (float noise). / Значения ближе этого считаются одной линией. */
const SAME = 1e-6;

type Axis = 'x' | 'y';
const pos = (axis: Axis, r: GuideRect) => (axis === 'x' ? r.x : r.y);
const size = (axis: Axis, r: GuideRect) => (axis === 'x' ? r.w : r.h);
const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

/** The comparable positions of a rectangle along an axis: edges and centre. / Сравниваемые положения вдоль оси: края и центр. */
function marks(axis: Axis, r: GuideRect, options: GuideOptions): number[] {
    const start = pos(axis, r);
    const out: number[] = [];
    if (options.edges !== false) out.push(start, start + size(axis, r));
    if (options.centers !== false) out.push(start + size(axis, r) / 2);
    return out;
}

/** The shift along one axis that puts the nearest pair of marks together; 0 when none is within the threshold. */
function shiftAlong(axis: Axis, moving: GuideRect, others: readonly GuideRect[], threshold: number, options: GuideOptions): number {
    const mine = marks(axis, moving, options);
    let best = Infinity;
    for (const o of others) {
        for (const t of marks(axis, o, options)) {
            for (const m of mine) {
                const d = t - m;
                if (Math.abs(d) < Math.abs(best)) best = d;
            }
        }
    }
    return Math.abs(best) <= threshold ? best : 0;
}

/**
 * The lines on one axis for a rectangle that is already in its final place: every pair of marks that coincides makes a
 * line, and several rectangles on one line share it (it runs from the first to the last of them).
 * Линии по одной оси для прямоугольника, уже стоящего на итоговом месте: каждая совпавшая пара даёт линию, а несколько
 * прямоугольников на одной линии делят её (она идёт от первого до последнего).
 */
function linesAlong(axis: Axis, rect: GuideRect, others: readonly GuideRect[], options: GuideOptions): GuideLine[] {
    const cross = other(axis);
    const mine = marks(axis, rect, options);
    const lines = new Map<number, GuideLine>();
    for (const o of others) {
        for (const t of marks(axis, o, options)) {
            if (!mine.some((m) => Math.abs(m - t) <= SAME)) continue;
            const from = Math.min(pos(cross, rect), pos(cross, o));
            const to = Math.max(pos(cross, rect) + size(cross, rect), pos(cross, o) + size(cross, o));
            const key = Math.round(t / SAME);
            const line = lines.get(key);
            if (line) {
                line.from = Math.min(line.from, from);
                line.to = Math.max(line.to, to);
            } else {
                lines.set(key, { axis, at: t, from, to });
            }
        }
    }
    return [...lines.values()];
}

/**
 * Where a dragged rectangle goes and which guide lines to draw. `threshold` is in the units of the rectangles (world
 * units; for a screen threshold divide by the zoom). Each axis is decided on its own: the rectangle may stick to a
 * vertical guide and move freely along y. A rectangle exactly on a guide (distance 0) gets its line too.
 * Куда встаёт тащимый прямоугольник и какие линии рисовать. `threshold` в единицах прямоугольников (мировых; экранный
 * порог делится на масштаб). Каждая ось решается сама по себе: прямоугольник может прилипнуть к вертикальной
 * направляющей и свободно ехать по y. Прямоугольник, стоящий точно на направляющей (расстояние 0), тоже получает линию.
 */
export function snapToGuides(moving: GuideRect, others: readonly GuideRect[], threshold: number, options: GuideOptions = {}): GuideResult {
    if (others.length === 0 || !(threshold >= 0)) return { dx: 0, dy: 0, lines: [] };

    const dx = shiftAlong('x', moving, others, threshold, options);
    const dy = shiftAlong('y', moving, others, threshold, options);
    const fin: GuideRect = { ...moving, x: moving.x + dx, y: moving.y + dy };

    // Only an axis that really is on a guide draws lines: a pair within the threshold but not coinciding would not.
    // Линии рисует только ось, которая правда стоит на направляющей: пара в пределах порога, но не совпавшая, не нарисуется.
    return { dx, dy, lines: [...linesAlong('x', fin, others, options), ...linesAlong('y', fin, others, options)] };
}
