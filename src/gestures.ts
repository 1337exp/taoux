/**
 * Распознавание сенсорных жестов. Чистая логика без DOM и таймеров: время и координаты приходят снаружи,
 * поэтому всё проверяется тестами. События и таймеры (долгое нажатие) живут в EditorCanvas.
 */

/** На сколько px палец может сместиться и всё ещё считаться «стоящим на месте». */
export const TAP_SLOP_PX = 8;
/** Дольше этого касание уже не тап. */
export const TAP_MAX_MS = 300;
/** Сколько надо держать палец неподвижно для долгого нажатия. */
export const LONG_PRESS_MS = 500;
/** Второй тап должен прийти не позже и не дальше этого от первого. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_RADIUS_PX = 30;

export interface Sample {
    x: number;
    y: number;
    /** Время, мс (любая монотонная шкала). */
    t: number;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export type TapResult = 'tap' | 'double' | null;

/** Разбирает касание одним пальцем: тап, двойной тап, сдвиг, готовность долгого нажатия. */
export class TapRecognizer {
    private start: Sample | null = null;
    private moved = false;
    private lastTap: Sample | null = null;
    private doubleDown = false;

    /**
     * Палец лёг. Возвращает true, если это второе касание двойного тапа (оно ещё не закончено:
     * дальше может быть протяжка, как «двойной тап и тянуть»).
     */
    down(s: Sample): boolean {
        this.start = s;
        this.moved = false;
        const prev = this.lastTap;
        this.doubleDown = prev !== null && s.t - prev.t <= DOUBLE_TAP_MS && dist(s, prev) <= DOUBLE_TAP_RADIUS_PX;
        return this.doubleDown;
    }

    /** Палец сдвинулся. Возвращает true, если он уже ушёл дальше допуска (не тап и не долгое нажатие). */
    move(s: Sample): boolean {
        if (this.start && !this.moved && dist(s, this.start) > TAP_SLOP_PX) this.moved = true;
        return this.moved;
    }

    get isMoved(): boolean {
        return this.moved;
    }

    /** Пора ли считать касание долгим нажатием: палец лежит на месте дольше `LONG_PRESS_MS`. */
    longPressDue(now: number): boolean {
        return this.start !== null && !this.moved && now - this.start.t >= LONG_PRESS_MS;
    }

    /** Палец поднят: что это было. После `double` следующий тап снова считается одиночным. */
    up(s: Sample): TapResult {
        const start = this.start;
        this.start = null;
        if (!start) return null;

        this.move(s);
        if (this.moved || s.t - start.t > TAP_MAX_MS) {
            this.lastTap = null;
            return null;
        }
        if (this.doubleDown) {
            this.lastTap = null;
            return 'double';
        }
        this.lastTap = s;
        return 'tap';
    }

    /** Жест оказался чем-то другим (долгое нажатие, щипок, прерывание): забываем и текущее касание, и предыдущий тап. */
    cancel(): void {
        this.start = null;
        this.lastTap = null;
        this.doubleDown = false;
    }
}

//--------------------------------------------------
// Щипок и жест двумя пальцами

type Point = { x: number; y: number };

export interface Pinch {
    /** Центр между пальцами. */
    cx: number;
    cy: number;
    /** Расстояние между пальцами; 0, если палец один (тогда только сдвиг). */
    dist: number;
}

export function pinchOf(a: Point, b?: Point): Pinch {
    if (!b) return { cx: a.x, cy: a.y, dist: 0 };
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: dist(a, b) };
}

export interface PinchStep {
    /** Во сколько раз изменить масштаб. */
    factor: number;
    /** Вокруг какой точки (центр до шага). */
    pivot: [number, number];
    /** На сколько сдвинуть камеру после масштаба. */
    pan: [number, number];
}

/** Пока расстояние между пальцами не изменилось на столько, жест считается просто сдвигом: масштаб не трогаем. */
export const PINCH_ENGAGE_PX = 20;
/** Изменения расстояния мельче этого считаем дрожанием пальцев и игнорируем. */
export const PINCH_DEADBAND_PX = 1.5;
/** Сколько последних шагов смотрим, решая «сдвигают или масштабируют». */
export const PINCH_WINDOW = 6;
/** Для включения масштаба расстояние за окно должно меняться не меньше, чем сдвигается центр, и не меньше этого. */
export const PINCH_DOMINANCE = 1;
export const PINCH_MIN_NET_PX = 4;
/** Масштаб выключается обратно, когда центр за окно уходит в столько раз дальше, чем меняется расстояние (и не меньше `PINCH_RELEASE_MIN_PX`). */
export const PINCH_RELEASE_RATIO = 2;
export const PINCH_RELEASE_MIN_PX = 12;

interface PinchDelta {
    dx: number;
    dy: number;
    dd: number;
}

/**
 * Жест двумя пальцами: сдвиг и/или масштаб. Масштаб считается как отношение расстояний, а расстояние между
 * пальцами при обычном сдвиге двумя пальцами тоже «плывёт», поэтому его нельзя применять просто так.
 *
 * - Расстояние должно измениться осознанно (`PINCH_ENGAGE_PX`), а не накопиться дрейфом.
 * - При этом за последние `PINCH_WINDOW` шагов расстояние должно меняться сильнее, чем сдвигается центр:
 *   пока пальцы везут вместе, масштаб не включается, как бы расстояние ни плавало. Смотрим на сумму со знаком:
 *   браузер присылает движение пальцев по одному, и «один сдвинулся, второй догнал» взаимно сокращается.
 * - Когда масштаб включился, скачка нет (отсчёт идёт от текущего расстояния), а мелкое дрожание отсекается
 *   мёртвой зоной. Если потом пальцы повезли вместе, масштаб выключается обратно.
 *
 * Сдвиг центра работает всегда.
 */
export class PinchTracker {
    private prev: Pinch = { cx: 0, cy: 0, dist: 0 };
    private startDist = 0;
    private baseDist = 0;
    private engaged = false;
    private recent: PinchDelta[] = [];

    /** Новый набор пальцев (жест начался или число пальцев изменилось): отсчёт заново, скачка не будет. */
    begin(p: Pinch): void {
        this.prev = p;
        this.startDist = p.dist;
        this.baseDist = p.dist;
        this.engaged = false;
        this.recent = [];
    }

    get isZooming(): boolean {
        return this.engaged;
    }

    update(next: Pinch): PinchStep {
        const step: PinchStep = {
            factor: 1,
            pivot: [this.prev.cx, this.prev.cy],
            pan: [next.cx - this.prev.cx, next.cy - this.prev.cy],
        };

        // С одним пальцем (расстояние 0 с любой стороны) масштаба нет.
        const twoFingers = this.startDist > 0 && next.dist > 0 && this.prev.dist > 0;
        this.recent.push({ dx: step.pan[0], dy: step.pan[1], dd: twoFingers ? next.dist - this.prev.dist : 0 });
        if (this.recent.length > PINCH_WINDOW) this.recent.shift();
        this.prev = next;
        if (!twoFingers) return step;

        let sx = 0;
        let sy = 0;
        let sd = 0;
        for (const d of this.recent) {
            sx += d.dx;
            sy += d.dy;
            sd += d.dd;
        }
        const netCenter = Math.hypot(sx, sy);
        const netDist = Math.abs(sd);

        if (!this.engaged) {
            const intentional = Math.abs(next.dist - this.startDist) >= PINCH_ENGAGE_PX;
            if (intentional && netDist >= PINCH_MIN_NET_PX && netDist >= PINCH_DOMINANCE * netCenter) {
                this.engaged = true;
                this.baseDist = next.dist; // отсчёт с этого момента: без скачка
            }
        } else if (netCenter >= PINCH_RELEASE_MIN_PX && netCenter >= PINCH_RELEASE_RATIO * netDist) {
            // Пальцы повезли вместе: масштаб выключаем, новый порог отсчитываем от нынешнего расстояния.
            this.engaged = false;
            this.startDist = next.dist;
            this.baseDist = next.dist;
        } else if (Math.abs(next.dist - this.baseDist) >= PINCH_DEADBAND_PX) {
            step.factor = next.dist / this.baseDist;
            this.baseDist = next.dist;
        }
        return step;
    }
}
