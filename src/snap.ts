/**
 * Grid step in world units: matches the fine grid on the canvas background.
 * Шаг сетки в мировых единицах: совпадает с мелкой сеткой на фоне холста.
 */
export const GRID = 24;
/**
 * How far from a grid line (screen px) a node is pulled to it.
 * На каком расстоянии от линии сетки (экранные px) нода притягивается.
 */
export const SNAP_PX = 6;

/**
 * Soft snapping: a value is pulled to the nearest grid line only if it is closer than `threshold`,
 * and moves freely between lines. Hard snapping would turn the grid step into a few px when zoomed out,
 * and the node would crawl in jumps.
 * Мягкая привязка: значение притягивается к ближайшей линии сетки, только если оно ближе `threshold`,
 * а между линиями двигается свободно. Жёсткая привязка при отдалении превращала бы шаг сетки в несколько px,
 * и нода ползла бы скачками.
 */
export function softSnap(value: number, grid = GRID, threshold = grid / 2): number {
    const nearest = Math.round(value / grid) * grid;
    return Math.abs(value - nearest) <= threshold ? nearest : value;
}

/**
 * Snap threshold in world units for a camera scale: `SNAP_PX` on screen, but no more than half a step.
 * Порог привязки в мировых единицах для масштаба камеры: `SNAP_PX` на экране, но не больше половины шага.
 */
export function snapThreshold(zoom: number, grid = GRID): number {
    return Math.min(SNAP_PX / zoom, grid / 2);
}
