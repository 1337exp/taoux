import { describe, expect, it } from 'vitest';
import { clampZoom, fitCamera, MAX_ZOOM, MIN_ZOOM, panBy, screenToWorld, worldToScreen, zoomAt, zoomLimits } from '../src/camera';

describe('camera', () => {
    it('screenToWorld и worldToScreen взаимно обратны', () => {
        const cam = { x: 40, y: -20, z: 1.5 };
        const [wx, wy] = screenToWorld(cam, 300, 200);
        const [sx, sy] = worldToScreen(cam, wx, wy);
        expect(sx).toBeCloseTo(300);
        expect(sy).toBeCloseTo(200);
    });

    it('zoomAt держит мировую точку под курсором', () => {
        const cam = panBy({ x: 0, y: 0, z: 1 }, 100, 50);
        const before = screenToWorld(cam, 400, 300);
        const next = zoomAt(cam, 400, 300, 1.6);
        const after = screenToWorld(next, 400, 300);
        expect(next.z).toBeCloseTo(1.6);
        expect(after[0]).toBeCloseTo(before[0]);
        expect(after[1]).toBeCloseTo(before[1]);
    });

    it('zoomAt ограничивает масштаб', () => {
        const cam = { x: 0, y: 0, z: 1 };
        expect(zoomAt(cam, 0, 0, 100).z).toBe(MAX_ZOOM);
        expect(zoomAt(cam, 0, 0, 0.001).z).toBe(MIN_ZOOM);
    });

    it('zoomAt берёт свои пределы, если их передали', () => {
        const cam = { x: 0, y: 0, z: 1 };
        const limits = zoomLimits({ min: 0.05, max: 4 });
        expect(zoomAt(cam, 0, 0, 100, limits).z).toBe(4);
        expect(zoomAt(cam, 0, 0, 0.001, limits).z).toBe(0.05);
    });

    it('zoomLimits подставляет непереданный конец по умолчанию', () => {
        expect(zoomLimits()).toEqual({ min: MIN_ZOOM, max: MAX_ZOOM });
        expect(zoomLimits({ min: 0.05 })).toEqual({ min: 0.05, max: MAX_ZOOM });
        expect(clampZoom(10)).toBe(MAX_ZOOM);
    });

    it('fitCamera: вписывает прямоугольник по центру с запасом, масштаб в пределах', () => {
        const cam = fitCamera({ x: 100, y: 100, w: 400, h: 200 }, { w: 1000, h: 600 }, 50);
        expect(cam.z).toBeCloseTo(2); // 900 / 400 = 2.25, 500 / 200 = 2.5 → меньший, затем предел 2
        // центр прямоугольника попадает в центр экрана
        const [sx, sy] = worldToScreen(cam, 300, 200);
        expect(sx).toBeCloseTo(500);
        expect(sy).toBeCloseTo(300);

        const big = fitCamera({ x: 0, y: 0, w: 4000, h: 1000 }, { w: 1000, h: 600 }, 0);
        expect(big.z).toBeCloseTo(0.25);
        expect(fitCamera({ x: 0, y: 0, w: 10, h: 10 }, { w: 1000, h: 600 }, 0, { min: 0.2, max: 1 }).z).toBe(1);
    });

    it('fitCamera: пустое или вырожденное даёт камеру по умолчанию', () => {
        expect(fitCamera(null, { w: 100, h: 100 })).toEqual({ x: 0, y: 0, z: 1 });
        expect(fitCamera({ x: 0, y: 0, w: 0, h: 5 }, { w: 100, h: 100 })).toEqual({ x: 0, y: 0, z: 1 });
    });
});
