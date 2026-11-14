/**
 * The glide of the camera after a pan: if the pointer is released while still moving, the camera keeps going and slows
 * down smoothly. Pure arithmetic (no DOM, no timers), so it is unit-tested; the gesture machine only feeds it samples.
 * Скольжение камеры после перетаскивания: если указатель отпустили на ходу, камера продолжает движение и плавно
 * тормозит. Чистая арифметика (без DOM и таймеров), поэтому проверяется тестом; машина жестов лишь подаёт отсчёты.
 */
export interface GlideOptions {
    /**
     * Time constant of the slowing down, ms: the speed falls `e` times over it (the camera travels about speed × this in
     * total). Default 140.
     * Постоянная времени торможения, мс: за неё скорость падает в `e` раз (камера проедет примерно скорость × это).
     * По умолчанию 140.
     */
    friction?: number;
    /**
     * A release slower than this (px/ms) does not start a glide: a careful drag, a small jerk or a tremor of the hand must
     * not glide. Default 0.4 (400 px/s, a clear flick).
     * Отпускание медленнее этого (px/мс) скольжения не запускает: аккуратная протяжка, небольшой рывок или дрожь руки не
     * должны скользить. По умолчанию 0.4 (400 px/с, явный бросок).
     */
    minSpeed?: number;
    /**
     * The speed is not allowed to exceed this (px/ms). Default 6.
     * Скорость не больше этого (px/мс). По умолчанию 6.
     */
    maxSpeed?: number;
}

export const GLIDE_DEFAULTS = { friction: 140, minSpeed: 0.4, maxSpeed: 6 } as const;
/** A glide slower than this (px/ms) is over. / Скольжение медленнее этого (px/мс) окончено. */
export const STOP_SPEED = 0.03;
/** How far back the release speed is measured, ms. / За какое время до отпускания меряется скорость, мс. */
export const VELOCITY_WINDOW = 100;
/** A pointer held still this long before the release does not glide (the person stopped on purpose), ms. / Указатель, который перед отпусканием стоял столько, не скользит (человек остановился намеренно), мс. */
export const HOLD_STILL = 90;

export interface PanSample {
    /** Time, ms. */
    t: number;
    dx: number;
    dy: number;
}

/**
 * The release velocity (px/ms) from the last samples, or null when there should be no glide: nothing measured, the
 * pointer stood still before the release, or it was slower than `minSpeed`.
 * Скорость в момент отпускания (px/мс) по последним отсчётам, либо null, если скользить не надо: ничего не измерено,
 * указатель перед отпусканием стоял или он медленнее `minSpeed`.
 */
export function releaseVelocity(samples: readonly PanSample[], now: number, options: GlideOptions = {}): [number, number] | null {
    const { minSpeed, maxSpeed } = { ...GLIDE_DEFAULTS, ...options };
    const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW);
    const last = recent[recent.length - 1];
    if (!last || now - last.t > HOLD_STILL) return null;

    const first = recent[0]!;
    // The span starts one step before the first sample: a sample is the movement that ended at its time.
    const span = Math.max(last.t - first.t, 16);
    const sx = recent.reduce((s, p) => s + p.dx, 0);
    const sy = recent.reduce((s, p) => s + p.dy, 0);
    let vx = sx / span;
    let vy = sy / span;

    const speed = Math.hypot(vx, vy);
    if (speed < minSpeed) return null;
    if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
    }
    return [vx, vy];
}

export interface GlideStep {
    /** How far the camera moves in this step, px. */
    dx: number;
    dy: number;
    /** The speed after the step, px/ms. */
    v: [number, number];
    /** The glide is over. */
    done: boolean;
}

/**
 * One step of `dt` ms. The speed decays exponentially and the distance is its exact integral, so the glide does not
 * depend on the frame rate (a slow frame travels as far as the fast ones it replaces).
 * Один шаг в `dt` мс. Скорость затухает по экспоненте, а путь это её точный интеграл, поэтому скольжение не зависит
 * от частоты кадров (медленный кадр проезжает столько же, сколько заменённые им быстрые).
 */
export function glideStep(v: readonly [number, number], dt: number, options: GlideOptions = {}): GlideStep {
    const { friction } = { ...GLIDE_DEFAULTS, ...options };
    const decay = Math.exp(-dt / friction);
    const k = friction * (1 - decay);
    const next: [number, number] = [v[0] * decay, v[1] * decay];
    return { dx: v[0] * k, dy: v[1] * k, v: next, done: Math.hypot(next[0], next[1]) < STOP_SPEED };
}
