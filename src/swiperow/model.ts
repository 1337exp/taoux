import { settleOpen, SWIPE_FLING_PX_PER_MS, type SwipeRelease } from '../gestures';

/**
 * An action of a swipe row. `tone` is a TaoUI tone (`neutral`, `danger`, `success`…), `icon` a TaoIcon name.
 * Действие свайп-строки. `tone` — тон TaoUI, `icon` — имя TaoIcon.
 */
export interface SwipeRowAction {
    id: string;
    label: string;
    icon?: string;
    tone?: 'accent' | 'neutral' | 'success' | 'danger' | 'warning' | 'info';
}

/**
 * The thresholds of the row, px or a share of its width.
 * Пороги строки, px или доля её ширины.
 */
export interface SwipeRowGeometry {
    /** The row width. / Ширина строки. */
    width: number;
    /** How wide each end action stands when the row is open. / Ширина каждого действия справа в открытой строке. */
    actionWidth: number;
    /** How many end actions. / Сколько действий справа. */
    endCount: number;
    /** Whether there is a start action. / Есть ли действие слева. */
    hasStart: boolean;
    /** Whether pulling far runs the last end action by itself. / Выполняет ли длинный свайп последнее действие сам. */
    fullSwipe: boolean;
}

/** Past this share of the width a pull to the end runs the last action. / После этой доли ширины длинный свайп выполняет последнее действие. */
export const FULL_SWIPE_RATIO = 0.6;
/** A pull to the start runs its action past this many px (or a third of a narrow row). / Свайп вправо выполняет действие после стольких px. */
export const START_THRESHOLD_PX = 96;

export const startThreshold = (g: SwipeRowGeometry) => Math.min(START_THRESHOLD_PX, g.width / 3);
export const endOpenWidth = (g: SwipeRowGeometry) => g.actionWidth * g.endCount;
export const fullThreshold = (g: SwipeRowGeometry) => Math.max(endOpenWidth(g) + 24, g.width * FULL_SWIPE_RATIO);

/**
 * Whether the row, at this offset, is past the point where releasing runs an action: `start`, `full` or null.
 * Пройдена ли при этом сдвиге точка, после которой отпускание выполняет действие: `start`, `full` или null.
 */
export function armedAt(offset: number, g: SwipeRowGeometry): 'start' | 'full' | null {
    if (offset > 0 && g.hasStart && offset >= startThreshold(g)) return 'start';
    if (offset < 0 && g.fullSwipe && g.endCount > 0 && -offset >= fullThreshold(g)) return 'full';
    return null;
}

/** How far the row may move: no further than there is something behind it. / Насколько строка может уехать. */
export function clampOffset(offset: number, g: SwipeRowGeometry): number {
    const right = g.hasStart ? g.width : 0;
    const left = g.endCount === 0 ? 0 : g.fullSwipe ? -g.width : -endOpenWidth(g) * 1.5;
    return Math.min(right, Math.max(left, offset));
}

export type SwipeRowOutcome =
    | { kind: 'rest'; open: boolean } // the row comes to rest: open (the end actions shown) or closed
    | { kind: 'start' } // the start action runs, the row goes back
    | { kind: 'full' }; // the last end action runs

/**
 * What a release does. A pull to the start past its threshold (or flung that way past half of it) runs the start
 * action; a pull to the end past the full threshold runs the last end action; otherwise the row rests open or closed,
 * a fling going on in its direction (`settleOpen`).
 * Что делает отпускание. Свайп вправо дальше порога (или брошенный туда дальше его половины) выполняет действие слева;
 * влево дальше полного порога — последнее действие справа; иначе строка встаёт открытой или закрытой, бросок
 * продолжается в своём направлении.
 */
export function swipeRowRelease(release: SwipeRelease, g: SwipeRowGeometry): SwipeRowOutcome {
    const offset = clampOffset(release.offset, g);
    const armed = armedAt(offset, g);
    if (armed) return { kind: armed };
    if (offset > 0 && g.hasStart && release.velocity >= SWIPE_FLING_PX_PER_MS && offset >= startThreshold(g) / 2) {
        return { kind: 'start' };
    }
    if (g.endCount === 0) return { kind: 'rest', open: false };
    const rest = settleOpen({ offset: Math.min(0, offset), velocity: release.velocity }, { end: endOpenWidth(g) });
    return { kind: 'rest', open: rest < 0 };
}

/** The narrowest an action between the row and the last one gets: still a visible link. / Самое узкое промежуточное действие. */
export const SWIPE_SLIVER_PX = 32;

/**
 * The widths of the end actions at a pull of `drag` px (≥ 0), one continuous function, so nothing jumps. Up to the
 * open width they share the space evenly and grow to their width. Past it the actions between the row and the last one
 * stop growing and shrink back, smoothly, to slivers (`SWIPE_SLIVER_PX`) a little past the full-swipe threshold, and the last one
 * takes what they give up; further on they stay slivers, so a pull back opens them out again the same way.
 * `armed` is no longer used (the widths depend on the pull alone); it stays for the 0.5.0 signature.
 * Ширины действий справа при протяжке на `drag` px — одна непрерывная функция, поэтому ничего не прыгает. До открытой
 * ширины они делят место поровну и растут до своей ширины. Дальше промежуточные перестают расти и плавно сжимаются до
 * полосок к порогу длинного свайпа, а последнее забирает отданное место; за порогом они остаются полосками, поэтому
 * при обратном движении так же плавно раскрываются. `armed` больше не нужен; оставлен ради подписи 0.5.0.
 */
export function endWidths(drag: number, g: SwipeRowGeometry, _armed?: boolean, gap = 6): number[] {
    const n = g.endCount;
    if (n === 0 || drag <= 0) return Array.from({ length: n }, () => 0);
    const room = Math.max(0, drag - gap * n);
    const open = endOpenWidth(g);
    if (n === 1) return [room];
    if (drag <= open) return Array.from({ length: n }, () => room / n);

    // the squeeze runs a little past the full threshold (a fifth of the row more), so on a phone it takes a long stretch
    // of the pull and reads as a slide, not a snap
    // сжатие идёт чуть дальше порога длинного свайпа (ещё пятая часть строки), поэтому на телефоне занимает длинный
    // отрезок протяжки и читается как плавный переход, а не рывок
    const end = Math.max(open + 1, Math.min(g.width * 0.9, fullThreshold(g) + g.width * 0.2));
    const t = Math.min(1, (drag - open) / (end - open));
    const widest = g.actionWidth - gap;
    const middle = Math.min(widest, Math.max(0, widest + (Math.min(SWIPE_SLIVER_PX, widest) - widest) * t));
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? room - middle * (n - 1) : middle));
}
