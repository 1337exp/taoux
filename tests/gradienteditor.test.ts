import { describe, expect, it } from 'vitest';
import { addStop, colorDigits, gradientCss, moveStop, pickFromStack, patchStop, removeStop, roundAlpha, sampleGradient, stackAround, toLinear, toSrgb, type GradientStop } from '../src/gradienteditor';

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
        expect(r.stops[1]!.alpha).toBe(0.75);
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

describe('стопка наложенных ручек', () => {
    const at = (t: number): GradientStop => ({ t, color: [0, 0, 0], alpha: 1 });
    const stack = [at(0), at(1), at(1), at(1)];

    it('находит соседей вплотную, дальние не трогает', () => {
        expect(stackAround(stack, 3, 200, 7)).toEqual([1, 2, 3]);
        expect(stackAround(stack, 0, 200, 7)).toEqual([0]);
        expect(stackAround([at(0.5), at(0.52)], 0, 200, 7)).toEqual([0, 1]); // 4 px
        expect(stackAround([at(0.5), at(0.6)], 0, 200, 7)).toEqual([0]); // 20 px
    });

    it('влево вытягивается первая из стопки, вправо последняя: порядок не ломается', () => {
        expect(pickFromStack([1, 2, 3], -5)).toBe(1);
        expect(pickFromStack([1, 2, 3], 5)).toBe(3);
        // стопка у правого края: первая уходит влево без помех
        expect(moveStop(stack, 1, 0.5)[1]!.t).toBe(0.5);
        // последняя влево не пошла бы: упирается в соседа
        expect(moveStop(stack, 3, 0.5)[3]!.t).toBe(1);
    });
});

describe('непрозрачность', () => {
    it('обрезается до трёх знаков и зажимается в 0…1', () => {
        expect(roundAlpha(0.5700000000000001)).toBe(0.57);
        expect(roundAlpha(0.12345)).toBe(0.123);
        expect(roundAlpha(2)).toBe(1);
        expect(roundAlpha(-1)).toBe(0);
    });

    it('добавленная остановка получает короткую альфу', () => {
        const odd: GradientStop[] = [{ t: 0, color: [0, 0, 0], alpha: 1 }, { t: 1, color: [0, 0, 0], alpha: 0 }];
        expect(addStop(odd, 0.43).stops[1]!.alpha).toBe(0.57);
    });
});

describe('знаки после запятой', () => {
    const three: GradientStop[] = [{ t: 0, color: [0, 0, 0], alpha: 1 }, { t: 1, color: [0, 0, 0], alpha: 0 }];

    it('patchStop округляет альфу и t до трёх знаков, precision null не обрезает', () => {
        expect(patchStop(three, 0, { alpha: 0.5700000000000001 })[0]!.alpha).toBe(0.57);
        expect(patchStop(three, 1, { t: 0.123456 })[1]!.t).toBe(0.123);
        expect(patchStop(three, 0, { alpha: 0.12345 }, 2)[0]!.alpha).toBe(0.12);
        expect(patchStop(three, 0, { alpha: 0.123456 }, null)[0]!.alpha).toBe(0.123456);
        expect(three[0]!.alpha).toBe(1); // исходный список не тронут
    });

    it('moveStop и addStop учитывают precision', () => {
        expect(moveStop(three, 1, 0.8123456, 3)[1]!.t).toBe(0.812);
        expect(moveStop(three, 1, 0.8123456)[1]!.t).toBe(0.8123456);
        expect(addStop(three, 0.314159).stops[1]!.t).toBe(0.314);
        expect(addStop(three, 0.314159, null).stops[1]!.t).toBe(0.314159);
    });
});

describe('знаки у цвета', () => {
    const base: GradientStop[] = [{ t: 0, color: [0, 0, 0], alpha: 1 }, { t: 1, color: [1, 1, 1], alpha: 1 }];

    it('цвет получает на два знака больше, чем t и альфа', () => {
        expect(colorDigits(3)).toBe(5);
        expect(colorDigits(null)).toBeNull();
        expect(patchStop(base, 0, { color: [0.07939999999999997, 0.123456789, 0.5] })[0]!.color).toEqual([0.0794, 0.12346, 0.5]);
        expect(patchStop(base, 0, { color: [0.123456789, 0, 0] }, null)[0]!.color[0]).toBe(0.123456789);
    });

    it('добавленная остановка получает короткий цвет', () => {
        const added = addStop(base, 0.3333333).stops[1]!;
        expect(added.color.every((c) => String(c).length <= 7)).toBe(true);
        expect(added.color[0]).toBe(0.333); // t уже округлён до 0.333, цвет взят в этой точке
    });
});
