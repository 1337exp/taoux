/**
 * Width of the zone at the canvas edge where auto-scroll turns on, px.
 * Ширина зоны у края холста, в которой включается автопрокрутка, px.
 */
export const EDGE_ZONE = 48;
/**
 * Camera speed at the very border of the canvas (and beyond it), screen px per second.
 * Скорость камеры у самой границы холста (и за ней), экранных px в секунду.
 */
export const EDGE_MAX_SPEED = 1000;

/**
 * One axis: -1…0…1 is how deep the cursor is in the zone (minus at the start of the axis, plus at the end).
 * Одна ось: -1…0…1 — глубина захода курсора в зону (минус — у начала оси, плюс — у конца).
 */
function depth(pos: number, size: number, zone: number): number {
    if (pos < zone) return -Math.min(1, (zone - pos) / zone);
    if (pos > size - zone) return Math.min(1, (pos - (size - zone)) / zone);
    return 0;
}

/**
 * Auto-scroll speed (screen px/s) for a cursor at (x, y) of a canvas of size w × h.
 * The sign is where the visible area "moves": at the left edge x is negative (what is further left opens up).
 * Speed grows with depth as a square: at the zone border we almost stand still, so a node can be brought up gently and stopped.
 * A cursor beyond the canvas edge (pointer captured) gives the maximum.
 * Скорость автопрокрутки (экранные px/с) для курсора в точке (x, y) холста размером w × h.
 * Знак — куда «уезжает» видимая область: у левого края отрицательная по x (открывается то, что левее).
 * Скорость растёт с глубиной по квадрату: у границы зоны почти стоим, можно мягко подвести ноду и остановиться.
 * Курсор за краем холста (указатель захвачен) даёт максимум.
 */
export function edgeScrollVelocity(x: number, y: number, w: number, h: number, zone = EDGE_ZONE, max = EDGE_MAX_SPEED): [number, number] {
    const ease = (t: number) => Math.sign(t) * t * t * max;
    return [ease(depth(x, w, zone)), ease(depth(y, h, zone))];
}

//--------------------------------------------------
// The auto-scroll loop: shared by the canvas and any other widgets where something is dragged near an edge.
// Цикл автопрокрутки: общий для холста и любых других виджетов, где что-то тащат у края.

const MAX_FRAME_S = 0.05; // after a pause (the tab slept) the scroll does not "jump" / после паузы (вкладка спала) прокрутка не «прыгает»

export interface EdgeScrollerOptions {
    /**
     * The area whose edges we scroll at (usually the element's getBoundingClientRect); null means no scrolling.
     * Область, у краёв которой едем (обычно getBoundingClientRect элемента); null — прокрутки нет.
     */
    bounds: () => { left: number; top: number; width: number; height: number } | null;
    /**
     * Where the pointer is now, in window coordinates.
     * Где сейчас указатель, в координатах окна.
     */
    pointer: () => [number, number];
    /**
     * While false, scrolling does not run (for example, the gesture drags nothing). Checked every frame.
     * Пока false, прокрутка не идёт (например, жест не тянет ничего). Проверяется каждый кадр.
     */
    enabled?: () => boolean;
    /**
     * A step per frame: by how many screen px the visible area moved (sign as in `edgeScrollVelocity`).
     * Шаг за кадр: на сколько экранных px уехала видимая область (знак как у `edgeScrollVelocity`).
     */
    onScroll: (dx: number, dy: number) => void;
    /**
     * Width of the zone at the edge, px.
     * Ширина зоны у края, px.
     */
    zone?: number;
    /**
     * Speed at the border and beyond it, px/s.
     * Скорость у границы и за ней, px/с.
     */
    maxSpeed?: number;
}

export interface EdgeScroller {
    /**
     * Report that the pointer moved or the gesture began: starts the loop if the pointer is in the zone.
     * Сообщить, что указатель сдвинулся или жест начался: запускает цикл, если указатель в зоне.
     */
    kick(): void;
    /**
     * Stop the loop (the gesture ended).
     * Остановить цикл (жест кончился).
     */
    stop(): void;
}

/**
 * The loop runs even when the mouse stands still; speed is counted by time, not by frames.
 * It moves nothing itself: on every frame it calls `onScroll`, and the consumer shifts the camera/view and catches up with the pointer.
 * Цикл крутится, даже когда мышь стоит; скорость считается по времени, а не по кадрам.
 * Сам ничего не двигает: на каждом кадре зовёт `onScroll`, а потребитель сдвигает камеру/вид и догоняет указатель.
 */
export function createEdgeScroller(options: EdgeScrollerOptions): EdgeScroller {
    let frame = 0;
    let last = 0;

    function velocity(): [number, number] {
        if (options.enabled && !options.enabled()) return [0, 0];
        const r = options.bounds();
        if (!r) return [0, 0];
        const [x, y] = options.pointer();
        return edgeScrollVelocity(x - r.left, y - r.top, r.width, r.height, options.zone, options.maxSpeed);
    }

    function tick(now: number) {
        frame = 0;
        const [vx, vy] = velocity();
        if (vx === 0 && vy === 0) return;

        const dt = Math.min((now - last) / 1000, MAX_FRAME_S);
        last = now;
        options.onScroll(vx * dt, vy * dt);

        frame = requestAnimationFrame(tick);
    }

    return {
        kick() {
            if (frame) return;
            const [vx, vy] = velocity();
            if (vx === 0 && vy === 0) return;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        },
        stop() {
            cancelAnimationFrame(frame);
            frame = 0;
        },
    };
}
