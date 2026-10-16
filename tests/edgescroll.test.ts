import { describe, expect, it } from 'vitest';
import { EDGE_MAX_SPEED, EDGE_ZONE, edgeScrollVelocity } from '../src/edgescroll';

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
