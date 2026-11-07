import { describe, expect, it } from 'vitest';
import { snapToGuides, type GuideRect } from '../src/guides';

const r = (x: number, y: number, w = 100, h = 50): GuideRect => ({ x, y, w, h });

describe('snapToGuides', () => {
    it('без других прямоугольников или с нулевым порогом без совпадения ничего не делает', () => {
        expect(snapToGuides(r(0, 0), [], 8)).toEqual({ dx: 0, dy: 0, lines: [] });
        expect(snapToGuides(r(3, 0), [r(0, 100)], 0)).toMatchObject({ dx: 0 });
        expect(snapToGuides(r(0, 0), [r(0, 100)], Number.NaN)).toEqual({ dx: 0, dy: 0, lines: [] });
    });

    it('левый край притягивается к левому краю соседа, линия идёт через обе ноды', () => {
        // двигаемая: x 5..105, y 0..50; соседняя: x 0..100, y 200..250
        const res = snapToGuides(r(5, 0), [r(0, 200)], 8);
        expect(res.dx).toBe(-5);
        expect(res.dy).toBe(0);
        // левый край и правый края совпали на x = 0 и x = 100
        expect(res.lines).toEqual(
            expect.arrayContaining([
                { axis: 'x', at: 0, from: 0, to: 250 },
                { axis: 'x', at: 100, from: 0, to: 250 },
            ]),
        );
    });

    it('центр к центру: разная ширина, одинаковая ось', () => {
        const res = snapToGuides(r(30, 0, 60, 50), [r(0, 200, 200, 50)], 8);
        // края 30/90 и центр 60 против 0, 100, 200: ближайшая пара (90 и 100) дальше порога
        expect(res.dx).toBe(0);
        const near = snapToGuides(r(66, 0, 60, 50), [r(0, 200, 200, 50)], 8);
        // центр 96 → 100: сдвиг 4
        expect(near.dx).toBe(4);
        expect(near.lines).toEqual([{ axis: 'x', at: 100, from: 0, to: 250 }]);
    });

    it('берёт ближайшую пару, а за порогом ничего', () => {
        const others = [r(0, 300), r(500, 300)];
        expect(snapToGuides(r(3, 0), others, 8).dx).toBe(-3); // к краю 0, а не к 500
        expect(snapToGuides(r(9, 0), others, 8).dx).toBe(0);
        expect(snapToGuides(r(8, 0), others, 8).dx).toBe(-8); // на самом пороге включительно
    });

    it('оси решаются независимо: по x прилипла, по y свободна', () => {
        const res = snapToGuides(r(4, 120), [r(0, 0)], 6);
        expect(res.dx).toBe(-4);
        expect(res.dy).toBe(0);
        expect(res.lines.every((l) => l.axis === 'x')).toBe(true);
    });

    it('горизонтальная направляющая: верх к верху, линия по оси y', () => {
        const res = snapToGuides(r(300, 6), [r(0, 0)], 8);
        expect(res.dy).toBe(-6);
        const horizontal = res.lines.filter((l) => l.axis === 'y');
        expect(horizontal).toContainEqual({ axis: 'y', at: 0, from: 0, to: 400 });
    });

    it('несколько нод на одной линии делят её: линия идёт от первой до последней', () => {
        const res = snapToGuides(r(2, 500), [r(0, 0), r(0, 200), r(0, 800)], 6);
        expect(res.dx).toBe(-2);
        const left = res.lines.find((l) => l.axis === 'x' && l.at === 0)!;
        expect(left.from).toBe(0);
        expect(left.to).toBe(850); // до низа самой нижней
        expect(res.lines.filter((l) => l.axis === 'x' && l.at === 0)).toHaveLength(1);
    });

    it('точно на направляющей (расстояние 0) линия тоже рисуется, сдвиг нулевой', () => {
        const res = snapToGuides(r(0, 100), [r(0, 0)], 6);
        expect(res.dx).toBe(0);
        expect(res.lines.length).toBeGreaterThan(0);
    });

    it('параметры: только края или только центры', () => {
        const centersOnly = snapToGuides(r(66, 0, 60, 50), [r(0, 200, 200, 50)], 8, { edges: false });
        expect(centersOnly.dx).toBe(4);
        const edgesOnly = snapToGuides(r(66, 0, 60, 50), [r(0, 200, 200, 50)], 8, { centers: false });
        expect(edgesOnly.dx).toBe(0);
    });

    it('линии строятся для итогового положения, в том числе после сдвига по y', () => {
        // по x прилипаем к краю 0, по y к верху 300: линия по x должна доходить до итогового низа
        const res = snapToGuides(r(2, 297, 100, 50), [r(0, 300, 100, 80)], 6);
        expect(res.dx).toBe(-2);
        expect(res.dy).toBe(3);
        const v = res.lines.find((l) => l.axis === 'x' && l.at === 0)!;
        expect(v.from).toBe(300);
        expect(v.to).toBe(380);
    });
});
