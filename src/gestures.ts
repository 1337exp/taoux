/**
 * Recognition of touch gestures. Pure logic with no DOM and no timers: time and coordinates come from outside,
 * so everything is covered by tests. Events and timers (long press) live in EditorCanvas.
 * Распознавание сенсорных жестов. Чистая логика без DOM и таймеров: время и координаты приходят снаружи,
 * поэтому всё проверяется тестами. События и таймеры (долгое нажатие) живут в EditorCanvas.
 */

/**
 * By how many px a finger may move and still count as "standing still".
 * На сколько px палец может сместиться и всё ещё считаться «стоящим на месте».
 */
export const TAP_SLOP_PX = 8;
/**
 * A touch longer than this is no longer a tap.
 * Дольше этого касание уже не тап.
 */
export const TAP_MAX_MS = 300;
/**
 * How long the finger must be held still for a long press.
 * Сколько надо держать палец неподвижно для долгого нажатия.
 */
export const LONG_PRESS_MS = 500;
/**
 * The second tap must come no later and no further than this from the first.
 * Второй тап должен прийти не позже и не дальше этого от первого.
 */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_RADIUS_PX = 30;

export interface Sample {
    x: number;
    y: number;
    /**
     * Time, ms (any monotonic scale).
     * Время, мс (любая монотонная шкала).
     */
    t: number;
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export type TapResult = 'tap' | 'double' | null;

/**
 * Parses a one-finger touch: tap, double tap, movement, readiness of a long press.
 * Разбирает касание одним пальцем: тап, двойной тап, сдвиг, готовность долгого нажатия.
 */
export class TapRecognizer {
    private start: Sample | null = null;
    private moved = false;
    private lastTap: Sample | null = null;
    private doubleDown = false;

    /**
     * The finger landed. Returns true if this is the second touch of a double tap (it is not finished yet:
     * a drag may follow, as in "double tap and drag").
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

    /**
     * The finger moved. Returns true if it already left the slop (neither a tap nor a long press).
     * Палец сдвинулся. Возвращает true, если он уже ушёл дальше допуска (не тап и не долгое нажатие).
     */
    move(s: Sample): boolean {
        if (this.start && !this.moved && dist(s, this.start) > TAP_SLOP_PX) this.moved = true;
        return this.moved;
    }

    get isMoved(): boolean {
        return this.moved;
    }

    /**
     * Whether it is time to count the touch as a long press: the finger lies still longer than `LONG_PRESS_MS`.
     * Пора ли считать касание долгим нажатием: палец лежит на месте дольше `LONG_PRESS_MS`.
     */
    longPressDue(now: number): boolean {
        return this.start !== null && !this.moved && now - this.start.t >= LONG_PRESS_MS;
    }

    /**
     * The finger was lifted: what that was. After `double` the next tap counts as single again.
     * Палец поднят: что это было. После `double` следующий тап снова считается одиночным.
     */
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

    /**
     * The gesture turned out to be something else (a long press, a pinch, an interruption): forget both the current touch and the previous tap.
     * Жест оказался чем-то другим (долгое нажатие, щипок, прерывание): забываем и текущее касание, и предыдущий тап.
     */
    cancel(): void {
        this.start = null;
        this.lastTap = null;
        this.doubleDown = false;
    }
}

//--------------------------------------------------
// Pinch and a two-finger gesture
// Щипок и жест двумя пальцами

type Point = { x: number; y: number };

export interface Pinch {
    /**
     * The centre between the fingers.
     * Центр между пальцами.
     */
    cx: number;
    cy: number;
    /**
     * The distance between the fingers; 0 if there is one finger (then only a shift).
     * Расстояние между пальцами; 0, если палец один (тогда только сдвиг).
     */
    dist: number;
}

export function pinchOf(a: Point, b?: Point): Pinch {
    if (!b) return { cx: a.x, cy: a.y, dist: 0 };
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: dist(a, b) };
}

export interface PinchStep {
    /**
     * By how many times to change the scale.
     * Во сколько раз изменить масштаб.
     */
    factor: number;
    /**
     * Around which point (the centre before the step).
     * Вокруг какой точки (центр до шага).
     */
    pivot: [number, number];
    /**
     * By how much to shift the camera after the scale.
     * На сколько сдвинуть камеру после масштаба.
     */
    pan: [number, number];
}

/**
 * Until the distance between the fingers has changed by this much, the gesture counts as a plain shift: the scale is not touched.
 * Пока расстояние между пальцами не изменилось на столько, жест считается просто сдвигом: масштаб не трогаем.
 */
export const PINCH_ENGAGE_PX = 20;
/**
 * Distance changes smaller than this count as finger jitter and are ignored.
 * Изменения расстояния мельче этого считаем дрожанием пальцев и игнорируем.
 */
export const PINCH_DEADBAND_PX = 1.5;
/**
 * How many last steps we look at when deciding "shifting or scaling".
 * Сколько последних шагов смотрим, решая «сдвигают или масштабируют».
 */
export const PINCH_WINDOW = 6;
/**
 * To turn the scale on, the distance over the window must change at least as much as the centre moves, and at least this much.
 * Для включения масштаба расстояние за окно должно меняться не меньше, чем сдвигается центр, и не меньше этого.
 */
export const PINCH_DOMINANCE = 1;
export const PINCH_MIN_NET_PX = 4;
/**
 * The scale turns off again when the centre moves this many times further than the distance changes over the window (and at least `PINCH_RELEASE_MIN_PX`).
 * Масштаб выключается обратно, когда центр за окно уходит в столько раз дальше, чем меняется расстояние (и не меньше `PINCH_RELEASE_MIN_PX`).
 */
export const PINCH_RELEASE_RATIO = 2;
export const PINCH_RELEASE_MIN_PX = 12;

interface PinchDelta {
    dx: number;
    dy: number;
    dd: number;
}

/**
 * A two-finger gesture: shift and/or scale. The scale is the ratio of distances, and the distance between the fingers
 * drifts during an ordinary two-finger shift too, so it cannot be applied just like that.
 * Жест двумя пальцами: сдвиг и/или масштаб. Масштаб считается как отношение расстояний, а расстояние между
 * пальцами при обычном сдвиге двумя пальцами тоже «плывёт», поэтому его нельзя применять просто так.
 *
 * - The distance must change deliberately (`PINCH_ENGAGE_PX`), not build up by drift.
 * - Over the last `PINCH_WINDOW` steps the distance must change more than the centre moves:
 *   while the fingers are carried together, the scale does not turn on however the distance floats. We look at the signed sum:
 *   the browser sends finger movement one at a time, and "one moved, the other caught up" cancels out.
 * - Once the scale is on there is no jump (counting is from the current distance), and small jitter is cut by a
 *   dead zone. If the fingers are then carried together, the scale turns off again.
 * - Расстояние должно измениться осознанно (`PINCH_ENGAGE_PX`), а не накопиться дрейфом.
 * - При этом за последние `PINCH_WINDOW` шагов расстояние должно меняться сильнее, чем сдвигается центр:
 *   пока пальцы везут вместе, масштаб не включается, как бы расстояние ни плавало. Смотрим на сумму со знаком:
 *   браузер присылает движение пальцев по одному, и «один сдвинулся, второй догнал» взаимно сокращается.
 * - Когда масштаб включился, скачка нет (отсчёт идёт от текущего расстояния), а мелкое дрожание отсекается
 *   мёртвой зоной. Если потом пальцы повезли вместе, масштаб выключается обратно.
 *
 * The centre shift always works.
 * Сдвиг центра работает всегда.
 */
export class PinchTracker {
    private prev: Pinch = { cx: 0, cy: 0, dist: 0 };
    private startDist = 0;
    private baseDist = 0;
    private engaged = false;
    private recent: PinchDelta[] = [];

    /**
     * A new set of fingers (a gesture began or the number of fingers changed): count from scratch, there will be no jump.
     * Новый набор пальцев (жест начался или число пальцев изменилось): отсчёт заново, скачка не будет.
     */
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

        // With one finger (the distance is 0 either way) there is no scale.
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
                this.baseDist = next.dist; // counted from this moment: no jump / отсчёт с этого момента: без скачка
            }
        } else if (netCenter >= PINCH_RELEASE_MIN_PX && netCenter >= PINCH_RELEASE_RATIO * netDist) {
            // The fingers were carried together: the scale turns off, the new threshold is counted from the current distance.
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

//--------------------------------------------------
// Swipe: a row that slides open to show its actions, a sheet pulled down
// Свайп: строка, которая отъезжает и показывает действия, лист, который тянут вниз

/**
 * How far the finger moves before the intent is decided: a swipe along the axis, or a scroll across it.
 * Сколько палец проходит, прежде чем решается намерение: свайп вдоль оси или прокрутка поперёк.
 */
export const SWIPE_SLOP_PX = 10;
/**
 * A release faster than this (px/ms) is a fling: it goes on in its direction whatever the offset.
 * Отпускание быстрее этого (px/мс) — бросок: он продолжается в своём направлении при любом сдвиге.
 */
export const SWIPE_FLING_PX_PER_MS = 0.4;
/**
 * The release speed is measured over this last stretch of the gesture, ms.
 * Скорость отпускания меряется на этом последнем отрезке жеста, мс.
 */
export const SWIPE_VELOCITY_WINDOW_MS = 100;

/**
 * `pending` — not decided yet (inside the slop); `swipe` — along the axis, the app moves the row; `scroll` — across,
 * the gesture belongs to the page and the tracker ignores it until the next `down`.
 * `pending` — ещё не решено (в пределах допуска); `swipe` — вдоль оси, приложение двигает строку; `scroll` — поперёк,
 * жест принадлежит странице, и трекер его игнорирует до следующего `down`.
 */
export type SwipeIntent = 'pending' | 'swipe' | 'scroll';

export interface SwipeStep {
    intent: SwipeIntent;
    /**
     * Where the row stands now: the offset it had at `down` plus the travel since the swipe engaged (so it does not
     * jump by the slop).
     * Где строка сейчас: сдвиг на момент `down` плюс путь с момента, как свайп включился (поэтому без скачка на допуск).
     */
    offset: number;
}

export interface SwipeRelease {
    offset: number;
    /** px/ms along the axis, + to the right / down. / px/мс вдоль оси, + вправо / вниз. */
    velocity: number;
}

/**
 * Tells a swipe from a scroll and follows it. Pure logic, as the other recognizers: the app feeds it pointer samples,
 * moves the element by `offset` and, on release, asks `settleOpen` where the element should come to rest.
 * Отличает свайп от прокрутки и ведёт его. Чистая логика, как остальные распознаватели: приложение подаёт отсчёты
 * указателя, двигает элемент на `offset`, а при отпускании спрашивает `settleOpen`, где элементу остановиться.
 */
export class SwipeTracker {
    private start: Sample | null = null;
    private from = 0;
    private engage: Sample | null = null;
    private intent: SwipeIntent = 'pending';
    private trail: Sample[] = [];

    constructor(
        private readonly axis: 'x' | 'y' = 'x',
        private readonly slop: number = SWIPE_SLOP_PX,
    ) {}

    private along(s: Sample): number {
        return this.axis === 'x' ? s.x : s.y;
    }

    private across(s: Sample): number {
        return this.axis === 'x' ? s.y : s.x;
    }

    /**
     * The finger landed. `from` is where the row already stands (0 closed, or its open offset).
     * Палец лёг. `from` — где строка уже стоит (0 — закрыта, или её открытый сдвиг).
     */
    down(s: Sample, from = 0): void {
        this.start = s;
        this.from = from;
        this.engage = null;
        this.intent = 'pending';
        this.trail = [s];
    }

    move(s: Sample): SwipeStep {
        const start = this.start;
        if (!start || this.intent === 'scroll') return { intent: this.intent, offset: this.from };

        if (this.intent === 'pending') {
            const da = Math.abs(this.along(s) - this.along(start));
            const dc = Math.abs(this.across(s) - this.across(start));
            if (Math.max(da, dc) <= this.slop) return { intent: 'pending', offset: this.from };
            // the axis wins only when it leads: a diagonal goes to the page / ось побеждает, только если ведёт: диагональ — странице
            this.intent = da > dc ? 'swipe' : 'scroll';
            if (this.intent === 'scroll') return { intent: 'scroll', offset: this.from };
            this.engage = s;
        }

        this.trail.push(s);
        while (this.trail.length > 2 && s.t - this.trail[0]!.t > SWIPE_VELOCITY_WINDOW_MS) this.trail.shift();
        return { intent: 'swipe', offset: this.from + this.along(s) - this.along(this.engage!) };
    }

    /**
     * The finger was lifted. Null unless it was a swipe.
     * Палец поднят. Null, если это был не свайп.
     */
    up(s: Sample): SwipeRelease | null {
        const step = this.move(s);
        const swiped = this.intent === 'swipe';
        const first = this.trail[0];
        this.start = null;
        if (!swiped || !first) return null;
        const dt = s.t - first.t;
        const velocity = dt > 0 ? (this.along(s) - this.along(first)) / dt : 0;
        return { offset: step.offset, velocity };
    }

    cancel(): void {
        this.start = null;
        this.intent = 'pending';
        this.trail = [];
    }

    get current(): SwipeIntent {
        return this.intent;
    }
}

/**
 * Where a released row comes to rest: closed (0), open at the start (`start`, > 0, actions on the left) or open at
 * the end (`-end`, actions on the right). A fling goes on in its direction, one stop at a time (an open row flung
 * back closes, it does not fly to the other side); otherwise the nearest stop wins.
 * Где отпущенная строка останавливается: закрыта (0), открыта в начале (`start`, > 0, действия слева) или в конце
 * (`-end`, действия справа). Бросок продолжается в своём направлении на одну остановку (открытая строка, брошенная
 * обратно, закрывается, а не улетает на другую сторону); иначе побеждает ближайшая остановка.
 */
export function settleOpen(
    release: SwipeRelease,
    open: { start?: number; end?: number },
    fling: number = SWIPE_FLING_PX_PER_MS,
): number {
    const stops = [0];
    if (open.start) stops.push(open.start);
    if (open.end) stops.push(-open.end);
    stops.sort((a, b) => a - b);

    const { offset, velocity } = release;
    if (Math.abs(velocity) >= fling) {
        // the stop beyond the offset in the direction of the fling, or the last one / остановка за сдвигом по ходу броска
        const ahead = velocity > 0 ? stops.filter((p) => p > offset) : stops.filter((p) => p < offset).reverse();
        return ahead[0] ?? (velocity > 0 ? stops[stops.length - 1]! : stops[0]!);
    }
    return stops.reduce((best, p) => (Math.abs(p - offset) < Math.abs(best - offset) ? p : best), 0);
}
