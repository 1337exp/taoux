import { describe, expect, it } from 'vitest';
import { createPlayback, MAX_FRAME_DT, stepTime, type PlaybackState } from '../src/playback';

/** Кадры и часы под управлением теста. */
function manual() {
    let now = 0;
    let pending: ((t: number) => void) | null = null;
    let handle = 0;
    return {
        options: {
            now: () => now,
            schedule: (cb: (t: number) => void) => {
                pending = cb;
                return ++handle;
            },
            cancel: () => {
                pending = null;
            },
        },
        /** Следующий кадр через `ms` миллисекунд. */
        frame(ms: number) {
            now += ms;
            const cb = pending;
            pending = null;
            cb?.(now);
        },
        get scheduled() {
            return pending !== null;
        },
    };
}

describe('stepTime', () => {
    it('в цикле оборачивается через конец, назад тоже', () => {
        expect(stepTime(7.5, 1, 8, true)).toEqual({ time: 0.5, ended: false });
        expect(stepTime(0.5, -1, 8, true)).toEqual({ time: 7.5, ended: false });
    });

    it('без цикла упирается в конец и сообщает об этом, назад в ноль без остановки', () => {
        expect(stepTime(7.5, 1, 8, false)).toEqual({ time: 8, ended: true });
        expect(stepTime(0.5, -1, 8, false)).toEqual({ time: 0, ended: false });
        expect(stepTime(3, 1, 8, false)).toEqual({ time: 4, ended: false });
    });

    it('нулевая длина не ломает', () => {
        expect(stepTime(1, 1, 0, true)).toEqual({ time: 0, ended: false });
    });
});

describe('createPlayback', () => {
    it('играет по кадрам: время идёт в секундах, большой скачок кадра ограничен', () => {
        const m = manual();
        const p = createPlayback({ length: 10, ...m.options });
        p.play();
        expect(p.playing).toBe(true);
        m.frame(500);
        expect(p.time).toBeCloseTo(MAX_FRAME_DT); // пауза в 0.5 с срезана до 0.1
        m.frame(50);
        expect(p.time).toBeCloseTo(MAX_FRAME_DT + 0.05);
        p.pause();
        expect(p.playing).toBe(false);
        expect(m.scheduled).toBe(false);
    });

    it('скорость умножает шаг, перемотка идёт во время игры', () => {
        const m = manual();
        const p = createPlayback({ length: 10, speed: 2, ...m.options });
        p.play();
        m.frame(50);
        expect(p.time).toBeCloseTo(0.1);
        p.seek(5);
        m.frame(50);
        expect(p.time).toBeCloseTo(5.1);
        p.seek(99);
        expect(p.time).toBe(10);
        p.seek(-4);
        expect(p.time).toBe(0);
        p.seek(Number.NaN);
        expect(p.time).toBe(0);
    });

    it('без цикла на конце останавливается, «играть» оттуда начинает сначала', () => {
        const m = manual();
        const p = createPlayback({ length: 1, time: 0.95, ...m.options });
        p.play();
        m.frame(100);
        expect(p.time).toBe(1);
        expect(p.playing).toBe(false);
        expect(m.scheduled).toBe(false);
        p.play();
        expect(p.time).toBe(0);
        expect(p.playing).toBe(true);
    });

    it('в цикле не останавливается', () => {
        const m = manual();
        const p = createPlayback({ length: 1, time: 0.95, loop: true, ...m.options });
        p.play();
        m.frame(100);
        expect(p.time).toBeCloseTo(0.05);
        expect(p.playing).toBe(true);
    });

    it('restart, toggle и setLength держат время в границах', () => {
        const p = createPlayback({ length: 8, time: 6, ...manual().options });
        p.restart();
        expect(p.time).toBe(0);
        p.toggle();
        expect(p.playing).toBe(true);
        p.toggle();
        expect(p.playing).toBe(false);
        p.seek(7);
        p.setLength(4);
        expect(p.time).toBe(4);
        expect(p.length).toBe(4);
    });

    it('подписчики получают снимок состояния при каждом изменении, отписка работает, dispose останавливает', () => {
        const m = manual();
        const p = createPlayback({ length: 10, ...m.options });
        const seen: PlaybackState[] = [];
        const off = p.subscribe((s) => seen.push(s));
        p.seek(2);
        p.play();
        expect(seen.map((s) => [s.time, s.playing])).toEqual([[2, false], [2, true]]);
        off();
        p.pause();
        expect(seen).toHaveLength(2);

        p.play();
        p.dispose();
        expect(p.playing).toBe(false);
        expect(m.scheduled).toBe(false);
    });

    it('advance двигает время вручную, с циклом', () => {
        const p = createPlayback({ length: 4, loop: true, time: 3.5, ...manual().options });
        p.advance(1);
        expect(p.time).toBeCloseTo(0.5);
    });
});
