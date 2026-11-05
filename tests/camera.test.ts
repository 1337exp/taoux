import { describe, expect, it } from 'vitest';
import { clampZoom, MAX_ZOOM, MIN_ZOOM, panBy, screenToWorld, worldToScreen, zoomAt, zoomLimits } from '../src/camera';

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
});
