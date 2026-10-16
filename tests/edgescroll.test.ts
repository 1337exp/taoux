import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEdgeScroller, EDGE_MAX_SPEED, EDGE_ZONE, edgeScrollVelocity, type EdgeScrollerOptions } from '../src/edgescroll';

describe('edgeScrollVelocity', () => {
    const W = 1000;
    const H = 600;

    it('в середине холста камера стоит', () => {
        expect(edgeScrollVelocity(500, 300, W, H)).toEqual([0, 0]);
        expect(edgeScrollVelocity(EDGE_ZONE, EDGE_ZONE, W, H)).toEqual([0, 0]); // ровно на границе зоны
    });

    it('у края камера едет в его сторону: минус у левого/верхнего, плюс у правого/нижнего', () => {
        const [lx, ly] = edgeScrollVelocity(10, 300, W, H);
        expect(lx).toBeLessThan(0);
        expect(ly).toBe(0);

        const [rx] = edgeScrollVelocity(W - 10, 300, W, H);
        expect(rx).toBeGreaterThan(0);

        const [, ty] = edgeScrollVelocity(500, 5, W, H);
        const [, by] = edgeScrollVelocity(500, H - 5, W, H);
        expect(ty).toBeLessThan(0);
        expect(by).toBeGreaterThan(0);
    });

    it('чем глубже в зону, тем быстрее; на самом краю и за ним — максимум', () => {
        const shallow = Math.abs(edgeScrollVelocity(EDGE_ZONE - 5, 300, W, H)[0]);
        const deeper = Math.abs(edgeScrollVelocity(EDGE_ZONE / 2, 300, W, H)[0]);
        expect(shallow).toBeGreaterThan(0);
        expect(deeper).toBeGreaterThan(shallow);

        expect(edgeScrollVelocity(0, 300, W, H)[0]).toBe(-EDGE_MAX_SPEED);
        expect(edgeScrollVelocity(-500, 300, W, H)[0]).toBe(-EDGE_MAX_SPEED); // указатель захвачен и ушёл за окно
        expect(edgeScrollVelocity(W + 500, 300, W, H)[0]).toBe(EDGE_MAX_SPEED);
    });

    it('в углу едет по обеим осям', () => {
        const [vx, vy] = edgeScrollVelocity(W - 4, H - 4, W, H);
        expect(vx).toBeGreaterThan(0);
        expect(vy).toBeGreaterThan(0);
    });
});

describe('createEdgeScroller', () => {
    const rafs: Array<(t: number) => void> = [];
    let now = 0;

    const run = (frames: number, step = 16) => {
        for (let i = 0; i < frames; i++) {
            const cb = rafs.shift();
            if (!cb) return;
            now += step;
            cb(now);
        }
    };

    beforeEach(() => {
        rafs.length = 0;
        now = 0;
        vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => rafs.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => rafs.splice(0));
        vi.stubGlobal('performance', { now: () => now });
    });
    afterEach(() => vi.unstubAllGlobals());

    const make = (pointer: [number, number], extra: Partial<EdgeScrollerOptions> = {}) => {
        const steps: Array<[number, number]> = [];
        const scroller = createEdgeScroller({
            bounds: () => ({ left: 0, top: 0, width: 200, height: 100 }),
            pointer: () => pointer,
            onScroll: (dx, dy) => steps.push([dx, dy]),
            ...extra,
        });
        return { scroller, steps };
    };

    it('в середине не запускается', () => {
        const { scroller, steps } = make([100, 50]);
        scroller.kick();
        expect(rafs).toHaveLength(0);
        expect(steps).toEqual([]);
    });

    it('у края ездит каждый кадр, скорость по времени', () => {
        const { scroller, steps } = make([100, 100], { zone: 20, maxSpeed: 100 });
        scroller.kick();
        run(2, 20);
        expect(steps).toHaveLength(2);
        expect(steps[0]![0]).toBe(0);
        expect(steps[0]![1]).toBeCloseTo(100 * 0.02); // у границы и за ней — максимум
    });

    it('stop останавливает, enabled=false гасит цикл', () => {
        const a = make([100, 100], { zone: 20 });
        a.scroller.kick();
        a.scroller.stop();
        run(3);
        expect(a.steps).toEqual([]);

        let on = true;
        const b = make([100, 100], { zone: 20, enabled: () => on });
        b.scroller.kick();
        run(1);
        on = false;
        run(2);
        expect(b.steps).toHaveLength(1);
    });

    it('после долгой паузы шаг ограничен', () => {
        const { scroller, steps } = make([100, 100], { zone: 20, maxSpeed: 100 });
        scroller.kick();
        run(1, 5000);
        expect(steps[0]![1]).toBeCloseTo(100 * 0.05);
    });
});
