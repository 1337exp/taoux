import { describe, expect, it } from 'vitest';
import { addStop, gradientCss, moveStop, removeStop, sampleGradient, toLinear, toSrgb, type GradientStop } from '../src/gradienteditor';

const stops: GradientStop[] = [
    { t: 0, color: [0, 0, 0], alpha: 1 },
    { t: 1, color: [1, 1, 1], alpha: 0 },
];

describe('градиент', () => {
    it('значение: линейно между остановками, за краями равно крайней', () => {
        expect(sampleGradient(stops, 0.5)).toEqual([0.5, 0.5, 0.5, 0.5]);
        expect(sampleGradient(stops, -1)).toEqual([0, 0, 0, 1]);
        expect(sampleGradient(stops, 2)).toEqual([1, 1, 1, 0]);
        expect(sampleGradient([], 0.5)).toEqual([1, 1, 1, 1]);
    });

    it('остановка двигается между соседями, исходный список не трогается', () => {
        const three = [stops[0]!, { t: 0.5, color: [1, 0, 0] as GradientStop['color'], alpha: 1 }, stops[1]!];
        expect(moveStop(three, 1, 0.8)[1]!.t).toBe(0.8);
        expect(moveStop(three, 1, 5)[1]!.t).toBe(1);
        expect(moveStop(three, 1, -5)[1]!.t).toBe(0);
        expect(three[1]!.t).toBe(0.5);
    });

    it('добавление берёт цвет градиента в этой точке и сохраняет порядок', () => {
        const r = addStop(stops, 0.25);
        expect(r.index).toBe(1);
        expect(r.stops.map((s) => s.t)).toEqual([0, 0.25, 1]);
        expect(r.stops[1]!.color[0]).toBeCloseTo(0.25);
        expect(r.stops[1]!.alpha).toBeCloseTo(0.75);
    });

    it('последнюю остановку убрать нельзя', () => {
        expect(removeStop(stops, 0)).toHaveLength(1);
        expect(removeStop([stops[0]!], 0)).toHaveLength(1);
    });

    it('CSS содержит остановки и альфу, sRGB и линейный цвет взаимно обратны', () => {
        const css = gradientCss(stops);
        expect(css).toContain('rgba(0, 0, 0, 1.000) 0.0%');
        expect(css).toContain('rgba(255, 255, 255, 0.000) 100.0%');
        for (const c of [0, 0.02, 0.3, 0.8, 1]) expect(toLinear(toSrgb(c))).toBeCloseTo(c, 6);
    });
});
