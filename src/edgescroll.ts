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

//--------------------------------------------------
// Цикл автопрокрутки: общий для холста и любых других виджетов, где что-то тащат у края.

const MAX_FRAME_S = 0.05; // после паузы (вкладка спала) прокрутка не «прыгает»

export interface EdgeScrollerOptions {
    /** Область, у краёв которой едем (обычно getBoundingClientRect элемента); null — прокрутки нет. */
    bounds: () => { left: number; top: number; width: number; height: number } | null;
    /** Где сейчас указатель, в координатах окна. */
    pointer: () => [number, number];
    /** Пока false, прокрутка не идёт (например, жест не тянет ничего). Проверяется каждый кадр. */
    enabled?: () => boolean;
    /** Шаг за кадр: на сколько экранных px уехала видимая область (знак как у `edgeScrollVelocity`). */
    onScroll: (dx: number, dy: number) => void;
    /** Ширина зоны у края, px. */
    zone?: number;
    /** Скорость у границы и за ней, px/с. */
    maxSpeed?: number;
}

export interface EdgeScroller {
    /** Сообщить, что указатель сдвинулся или жест начался: запускает цикл, если указатель в зоне. */
    kick(): void;
    /** Остановить цикл (жест кончился). */
    stop(): void;
}

/**
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
