import { describe, expect, it } from 'vitest';
import { GLIDE_DEFAULTS, glideStep, releaseVelocity, type PanSample } from '../src/canvas/glide';

/** Равномерное движение: `speed` px/мс по x, отсчёт каждые 16 мс, последний в момент `end`. */
const moving = (speed: number, end: number, count = 8): PanSample[] =>
    Array.from({ length: count }, (_, i) => ({ t: end - (count - 1 - i) * 16, dx: speed * 16, dy: 0 }));

describe('canvas/glide: скорость в момент отпускания', () => {
    it('равномерное движение даёт его скорость', () => {
        const v = releaseVelocity(moving(2, 1000), 1005)!;
        expect(v[0]).toBeCloseTo(2, 0);
        expect(v[1]).toBeCloseTo(0, 5);
    });

    it('указатель, придержанный перед отпусканием, не скользит: это 1:1', () => {
        expect(releaseVelocity(moving(2, 1000), 1000 + 200)).toBeNull();
        expect(releaseVelocity([], 1000)).toBeNull();
    });

    it('медленное движение не запускает скольжение, быстрое ограничено максимумом, направление сохраняется', () => {
        expect(releaseVelocity(moving(0.01, 1000), 1000)).toBeNull();
        expect(releaseVelocity(moving(0.4, 1000), 1000)).toBeNull(); // небольшой рывок: ниже порога 0.5
        expect(releaseVelocity(moving(0.8, 1000), 1000)).not.toBeNull();
        const fast = releaseVelocity(moving(50, 1000), 1000)!;
        expect(Math.hypot(fast[0], fast[1])).toBeCloseTo(GLIDE_DEFAULTS.maxSpeed, 5);
        const diagonal = releaseVelocity(moving(2, 1000).map((s) => ({ ...s, dy: -s.dx })), 1000)!;
        expect(diagonal[0]).toBeGreaterThan(0);
        expect(diagonal[1]).toBeLessThan(0);
        expect(Math.abs(diagonal[0] + diagonal[1])).toBeLessThan(1e-9);
    });

    it('старые отсчёты за окном не считаются', () => {
        const old: PanSample[] = [{ t: 100, dx: 500, dy: 0 }];
        expect(releaseVelocity([...old, ...moving(1, 1000)], 1000)![0]).toBeCloseTo(1, 0);
    });
});

describe('canvas/glide: торможение', () => {
    it('путь не зависит от частоты кадров: один шаг в 64 мс равен четырём по 16', () => {
        const once = glideStep([3, 0], 64);
        let x = 0;
        let v: [number, number] = [3, 0];
        for (let i = 0; i < 4; i++) {
            const s = glideStep(v, 16);
            x += s.dx;
            v = s.v;
        }
        expect(x).toBeCloseTo(once.dx, 6);
        expect(v[0]).toBeCloseTo(once.v[0], 6);
    });

    it('скорость падает, путь в сумме около скорость × постоянная времени, в конце done', () => {
        let v: [number, number] = [2, 0];
        let total = 0;
        let steps = 0;
        for (let done = false; !done && steps < 10000; steps++) {
            const s = glideStep(v, 16);
            total += s.dx;
            v = s.v;
            done = s.done;
        }
        expect(steps).toBeLessThan(10000);
        expect(total).toBeGreaterThan(2 * GLIDE_DEFAULTS.friction * 0.9);
        expect(total).toBeLessThanOrEqual(2 * GLIDE_DEFAULTS.friction);
    });

    it('настройки: меньшее трение останавливает быстрее', () => {
        const soft = glideStep([2, 0], 100, { friction: 600 }).dx;
        const hard = glideStep([2, 0], 100, { friction: 100 }).dx;
        expect(hard).toBeLessThan(soft);
    });
});
