import { describe, expect, it } from 'vitest';
import { linkPointAt, HEAD_MIN_PX, curvePath, headSizePx, linkShape } from '../src/curve';

describe('linkShape', () => {
    it('без стрелки наконечника нет', () => {
        expect(linkShape([0, 0], 'right', [200, 0], 'left', 'none', 1).head).toBeNull();
    });

    it('наконечник упирается в пин и смотрит в ноду, линия кончается внутри него', () => {
        const left = linkShape([0, 0], 'right', [200, 0], 'left', 'end', 1);
        expect(left.head).toMatch(/^M 200 0 L 186 /); // с левой грани стрелка идёт вправо
        expect(left.d).toMatch(/188\.8 0$/);

        const right = linkShape([300, 0], 'left', [200, 0], 'right', 'end', 1);
        expect(right.head).toMatch(/^M 200 0 L 214 /);
    });

    it('при зуме 1 и ближе наконечник 14 px на экране', () => {
        const head = linkShape([0, 0], 'right', [200, 0], 'left', 'end', 2).head!;
        expect(head).toMatch(/^M 200 0 L 193 /); // 14px экрана = 7 мировых единиц при zoom 2
        expect(headSizePx(1)).toBe(14);
        expect(headSizePx(3)).toBe(14);
    });

    it('при отдалении наконечник плавно уменьшается, но не мельче порога', () => {
        const sizes = [1, 0.7, 0.5, 0.3, 0.2, 0.1].map(headSizePx);
        for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeLessThanOrEqual(sizes[i - 1]!);
        expect(headSizePx(0.5)).toBeCloseTo(9.9, 1);
        expect(headSizePx(0.2)).toBeCloseTo(6.26, 1);
        expect(headSizePx(0.05)).toBe(HEAD_MIN_PX);

        // и в мировых единицах это размер на экране, делённый на масштаб
        const head = linkShape([0, 0], 'right', [200, 0], 'left', 'end', 0.2).head!;
        expect(head).toMatch(/^M 200 0 L 168\.69/); // 6.26 / 0.2 = 31.3 мировых единиц
    });
});

describe('linkShape: вертикальные связи', () => {
    it('стрелка сверху вниз: наконечник упирается в верхний пин и смотрит вниз', () => {
        const shape = linkShape([0, 0], 'bottom', [0, 200], 'top', 'end', 1);
        expect(shape.head).toMatch(/^M 0 200 L /);
        expect(shape.d).toMatch(/0 188\.8$/);
        const ys = [...shape.head!.matchAll(/L (-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
        expect(ys).toEqual([186, 186]); // основание выше острия
    });
});

describe('curvePath', () => {
    it('горизонтальные касательные, минимум 60', () => {
        expect(curvePath(0, 0, 10, 0)).toBe('M 0 0 C 60 0, -50 0, 10 0');
    });
});

describe('linkPointAt', () => {
    it('концы кривой это пины, середина лежит между ними и на кривой симметрично', () => {
        const a: [number, number] = [0, 0];
        const b: [number, number] = [200, 100];
        expect(linkPointAt(a, 'right', b, 'left', 0)).toEqual(a);
        expect(linkPointAt(a, 'right', b, 'left', 1)).toEqual(b);
        // горизонтальные касательные и симметричные пины: середина ровно посередине
        const mid = linkPointAt(a, 'right', b, 'left');
        expect(mid[0]).toBeCloseTo(100);
        expect(mid[1]).toBeCloseTo(50);
    });

    it('вертикальная связь: середина смещается по оси стороны, а не уходит вбок', () => {
        const mid = linkPointAt([0, 0], 'bottom', [0, 300], 'top');
        expect(mid[0]).toBeCloseTo(0);
        expect(mid[1]).toBeCloseTo(150);
    });

    it('совпадает с серединой пути linkShape (без стрелки)', () => {
        const a: [number, number] = [10, 20];
        const b: [number, number] = [400, 90];
        const shape = linkShape(a, 'right', b, 'left', 'none', 1);
        const nums = shape.d.match(/-?\d+(\.\d+)?/g)!.map(Number); // M ax ay C c1x c1y, c2x c2y, bx by
        const [ax, ay, c1x, c1y, c2x, c2y, bx, by] = nums as [number, number, number, number, number, number, number, number];
        const mid = linkPointAt(a, 'right', b, 'left');
        expect(mid[0]).toBeCloseTo((ax + 3 * c1x + 3 * c2x + bx) / 8);
        expect(mid[1]).toBeCloseTo((ay + 3 * c1y + 3 * c2y + by) / 8);
    });
});
