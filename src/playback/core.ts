// Playback model: time, pause, loop, speed, seeking. No Vue and no tie to a view: it can drive a timeline
// from any UI kit, or run an animation with no interface at all. Time advances by browser frames
// (requestAnimationFrame) and is in seconds.
// Модель воспроизведения: время, пауза, цикл, скорость, перемотка. Без Vue и без привязки к виду: ею можно вести
// таймлайн из любого UI-кита, а можно крутить анимацию вообще без интерфейса. Время считается по кадрам браузера
// (requestAnimationFrame) и идёт в секундах.
import { clamp } from '../num';

/**
 * The largest time step per frame, s: after a tab sleeps playback does not "jump".
 * Самый большой шаг времени за кадр, с: после сна вкладки воспроизведение не «прыгает».
 */
export const MAX_FRAME_DT = 0.1;

/**
 * Time after a step of `dt` seconds: in a loop it wraps through the end, without a loop it stops at the end.
 * Returns the new time and a flag "reached the end and stopped".
 * Время после шага `dt` секунд: в цикле оборачивается через конец, без цикла упирается в конец и останавливается.
 * Возвращает новое время и признак «дошли до конца и встали».
 */
export function stepTime(time: number, dt: number, length: number, loop: boolean): { time: number; ended: boolean } {
    if (!(length > 0)) return { time: 0, ended: false };
    const next = time + dt;
    if (loop) {
        const wrapped = next % length;
        return { time: wrapped < 0 ? wrapped + length : wrapped, ended: false };
    }
    if (next >= length) return { time: length, ended: dt > 0 };
    return { time: Math.max(0, next), ended: false };
}

export interface PlaybackState {
    readonly time: number;
    readonly length: number;
    readonly playing: boolean;
    readonly loop: boolean;
    readonly speed: number;
}

export interface PlaybackOptions {
    /**
     * Length, s.
     * Длина, с.
     */
    length: number;
    /**
     * Initial time, s.
     * Начальное время, с.
     */
    time?: number;
    loop?: boolean;
    /**
     * Speed multiplier (1 is normal).
     * Множитель скорости (1 — обычная).
     */
    speed?: number;
    /**
     * Where frames come from: requestAnimationFrame by default (replaced in tests and in environments without a window).
     * Откуда брать кадры: по умолчанию requestAnimationFrame (подмена нужна тестам и окружению без окна).
     */
    schedule?: (callback: (nowMs: number) => void) => number;
    cancel?: (handle: number) => void;
    /**
     * Clock in milliseconds: performance.now by default.
     * Часы в миллисекундах: по умолчанию performance.now.
     */
    now?: () => number;
}

export interface Playback extends PlaybackState {
    play(): void;
    pause(): void;
    toggle(): void;
    /**
     * Time 0; playback is not touched.
     * Время 0; воспроизведение не трогается.
     */
    restart(): void;
    /**
     * Sets the time (within 0…length). Running playback continues from that place.
     * Ставит время (в пределах 0…длина). Идущее воспроизведение продолжается с этого места.
     */
    seek(time: number): void;
    setLength(length: number): void;
    setLoop(loop: boolean): void;
    setSpeed(speed: number): void;
    /**
     * Advances by `dt` seconds by hand (the loop is honoured, speed is not applied): for your own loops and tests.
     * Шаг на `dt` секунд вручную (учитывает цикл, скорость не применяет): для своих циклов и тестов.
     */
    advance(dt: number): void;
    /**
     * The listener is called on any state change. Returns an unsubscribe function.
     * Слушатель вызывается при любом изменении состояния. Возвращает функцию отписки.
     */
    subscribe(listener: (state: PlaybackState) => void): () => void;
    dispose(): void;
}

export function createPlayback(options: PlaybackOptions): Playback {
    const schedule = options.schedule ?? ((cb) => requestAnimationFrame(cb));
    const cancel = options.cancel ?? ((h) => cancelAnimationFrame(h));
    const clock = options.now ?? (() => performance.now());

    let length = Math.max(0, options.length);
    let time = clamp(options.time ?? 0, 0, length);
    let loop = options.loop ?? false;
    let speed = options.speed ?? 1;
    let playing = false;
    let frame = 0;
    let last = 0;
    const listeners = new Set<(state: PlaybackState) => void>();

    const notify = () => {
        const snapshot: PlaybackState = { time, length, playing, loop, speed };
        for (const l of listeners) l(snapshot);
    };

    function applyStep(dt: number) {
        const r = stepTime(time, dt, length, loop);
        time = r.time;
        if (r.ended) playing = false;
        notify();
    }

    function tick(nowMs: number) {
        frame = 0;
        if (!playing) return;
        const dt = Math.min((nowMs - last) / 1000, MAX_FRAME_DT) * speed;
        last = nowMs;
        applyStep(dt);
        if (playing) frame = schedule(tick);
    }

    function stopLoop() {
        if (frame) cancel(frame);
        frame = 0;
    }

    const api: Playback = {
        get time() {
            return time;
        },
        get length() {
            return length;
        },
        get playing() {
            return playing;
        },
        get loop() {
            return loop;
        },
        get speed() {
            return speed;
        },
        play() {
            if (playing) return;
            // from the end without a loop "play" starts over instead of standing still
            // с конца без цикла «играть» начинает сначала, а не стоит на месте
            if (!loop && time >= length) time = 0;
            playing = true;
            last = clock();
            frame = schedule(tick);
            notify();
        },
        pause() {
            if (!playing) return;
            playing = false;
            stopLoop();
            notify();
        },
        toggle() {
            if (playing) api.pause();
            else api.play();
        },
        restart() {
            time = 0;
            notify();
        },
        seek(next) {
            time = clamp(Number.isFinite(next) ? next : 0, 0, length);
            notify();
        },
        setLength(next) {
            length = Math.max(0, next);
            time = clamp(time, 0, length);
            notify();
        },
        setLoop(next) {
            loop = next;
            notify();
        },
        setSpeed(next) {
            speed = next;
            notify();
        },
        advance(dt) {
            applyStep(dt);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        dispose() {
            playing = false;
            stopLoop();
            listeners.clear();
        },
    };
    return api;
}
