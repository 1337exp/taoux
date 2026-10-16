/** Ширина зоны у края холста, в которой включается автопрокрутка, px. */
export const EDGE_ZONE = 48;
/** Скорость камеры у самой границы холста (и за ней), экранных px в секунду. */
export const EDGE_MAX_SPEED = 1000;

/** Одна ось: -1…0…1 — глубина захода курсора в зону (минус — у начала оси, плюс — у конца). */
function depth(pos: number, size: number, zone: number): number {
    if (pos < zone) return -Math.min(1, (zone - pos) / zone);
    if (pos > size - zone) return Math.min(1, (pos - (size - zone)) / zone);
    return 0;
}

/**
 * Скорость автопрокрутки (экранные px/с) для курсора в точке (x, y) холста размером w × h.
 * Знак — куда «уезжает» видимая область: у левого края отрицательная по x (открывается то, что левее).
 * Скорость растёт с глубиной по квадрату: у границы зоны почти стоим, можно мягко подвести ноду и остановиться.
 * Курсор за краем холста (указатель захвачен) даёт максимум.
 */
export function edgeScrollVelocity(x: number, y: number, w: number, h: number, zone = EDGE_ZONE, max = EDGE_MAX_SPEED): [number, number] {
    const ease = (t: number) => Math.sign(t) * t * t * max;
    return [ease(depth(x, w, zone)), ease(depth(y, h, zone))];
}
