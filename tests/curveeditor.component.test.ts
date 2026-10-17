import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaoxCurveEditor, type CurvePoint } from '../src/curveeditor';

// Геометрия поля: viewBox 280×132, плот x = 30 + t·240, y = 10 + (1 − v)·106 при границах 0…1.
const x = (t: number) => 30 + t * 240;
const y = (v: number) => 10 + (1 - v) * 106;

const pts = (): CurvePoint[] => [
    { t: 0, v: 0 },
    { t: 0.5, v: 1 },
    { t: 1, v: 0 },
];

const last = <T,>(list: T[]): T => list[list.length - 1]!;

function mountCurve(props: Record<string, unknown> = {}) {
    const w = mount(TaoxCurveEditor, { props: { modelValue: pts(), selected: 0, min: 0, max: 1, ...props }, attachTo: document.body });
    // SVG в happy-dom без раскладки: задаём размер в тех же единицах, что viewBox, чтобы пиксели совпадали с координатами
    w.find('svg').element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 280, height: 132, right: 280, bottom: 132, x: 0, y: 0, toJSON: () => ({}) });
    return w;
}

const dots = (w: VueWrapper) => w.findAll('.tx-curve-dot');
const model = (w: VueWrapper) => last(w.emitted('update:modelValue')!)[0] as CurvePoint[];

describe('TaoxCurveEditor: мышь', () => {
    let w: VueWrapper;
    afterEach(() => w?.unmount());

    it('точки нарисованы, выбранная помечена, подписи для скринридеров есть', () => {
        w = mountCurve({ selected: 1 });
        expect(dots(w)).toHaveLength(3);
        expect(dots(w).map((d) => d.classes('on'))).toEqual([false, true, false]);
        expect(dots(w)[1]!.attributes('aria-label')).toBe('Point 2: 0.5, 1');

        w.unmount();
        w = mountCurve({ pointLabel: (i: number, p: CurvePoint) => `Точка ${i + 1}: ${p.v}` });
        expect(dots(w)[0]!.attributes('aria-label')).toBe('Точка 1: 0');
    });

    it('нажатие выбирает точку, перетаскивание ставит её под указатель с прилипанием к шагу', async () => {
        w = mountCurve();
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        expect(last(w.emitted('update:selected')!)).toEqual([1]);

        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.26), clientY: y(0.52), pointerId: 1 });
        const p = model(w)[1]!;
        expect(p.t).toBeCloseTo(0.25); // шаг по времени 0.05
        expect(p.v).toBeCloseTo(0.5); // шаг по значению для вида 0…1: 0.05

        expect(w.emitted('commit')).toBeUndefined(); // правка ещё идёт
        await dots(w)[1]!.trigger('pointerup', { pointerId: 1 });
        expect(w.emitted('commit')).toHaveLength(1);
    });

    it('Shift отключает прилипание, snap=false включает его только с Shift', async () => {
        w = mountCurve();
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.2541), clientY: y(0.5123), pointerId: 1, shiftKey: true });
        expect(model(w)[1]!.t).toBeCloseTo(0.2541, 4);
        expect(model(w)[1]!.v).toBeCloseTo(0.5123, 4);
        await dots(w)[1]!.trigger('pointerup', { pointerId: 1 });
        w.unmount();

        w = mountCurve({ snap: false });
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.2541), clientY: y(0.5123), pointerId: 1 });
        expect(model(w)[1]!.t).toBeCloseTo(0.2541, 4);
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.2541), clientY: y(0.5123), pointerId: 1, shiftKey: true });
        expect(model(w)[1]!.t).toBeCloseTo(0.25, 4);
    });

    it('precision обрезает знаки, границы min и max не пускают точку дальше', async () => {
        w = mountCurve({ snap: false, precision: 2 });
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.31234), clientY: y(0.45678), pointerId: 1 });
        expect(model(w)[1]).toEqual({ t: 0.31, v: 0.46 });

        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.5), clientY: -60, pointerId: 1 });
        expect(model(w)[1]!.v).toBe(1); // выше max
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.5), clientY: y(0) + 80, pointerId: 1 });
        expect(model(w)[1]!.v).toBe(0); // ниже min
    });

    it('точка не перескакивает соседей по времени', async () => {
        w = mountCurve();
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        await dots(w)[1]!.trigger('pointermove', { clientX: x(1.4), clientY: y(1), pointerId: 1 });
        expect(model(w)[1]!.t).toBe(1);
        await dots(w)[1]!.trigger('pointermove', { clientX: x(-0.5), clientY: y(1), pointerId: 1 });
        expect(model(w)[1]!.t).toBe(0);
    });

    it('двойной клик по полю добавляет точку на этом месте и выбирает её', async () => {
        w = mountCurve();
        await w.find('svg').trigger('dblclick', { clientX: x(0.25), clientY: y(0.3) });
        const next = model(w);
        expect(next).toHaveLength(4);
        expect(next[1]!.t).toBeCloseTo(0.25);
        expect(next[1]!.v).toBeCloseTo(0.3);
        expect(last(w.emitted('update:selected')!)).toEqual([1]);
        expect(w.emitted('commit')).toHaveLength(1);
    });

    it('Alt+нажатие убирает точку, но две точки остаются всегда', async () => {
        w = mountCurve();
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0, altKey: true });
        expect(model(w)).toEqual([{ t: 0, v: 0 }, { t: 1, v: 0 }]);
        w.unmount();

        w = mountCurve({ modelValue: [{ t: 0, v: 0 }, { t: 1, v: 1 }] });
        await dots(w)[0]!.trigger('pointerdown', { clientX: x(0), clientY: y(0), pointerId: 1, button: 0, altKey: true });
        expect(model(w)).toHaveLength(2);
    });
});

describe('TaoxCurveEditor: автопрокрутка у края', () => {
    const frames: Array<(t: number) => void> = [];
    let now = 0;

    beforeEach(() => {
        frames.length = 0;
        now = 0;
        vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => frames.push(cb));
        vi.stubGlobal('cancelAnimationFrame', () => frames.splice(0));
        vi.stubGlobal('performance', { now: () => now });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('тянем точку к верхнему краю без max: вид едет вверх, значение растёт, пока указатель стоит', async () => {
        const w = mountCurve({ max: undefined });
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.5), clientY: 4, pointerId: 1 }); // в верхней зоне
        const first = model(w)[1]!.v;
        expect(frames.length).toBeGreaterThan(0);

        for (let i = 0; i < 10; i++) {
            now += 50;
            frames.shift()?.(now);
        }
        expect(model(w)[1]!.v).toBeGreaterThan(first);

        await dots(w)[1]!.trigger('pointerup', { pointerId: 1 });
        expect(frames).toHaveLength(0); // цикл остановлен
        w.unmount();
    });

    it('при заданных min и max вид стоит: значение упирается в границу', async () => {
        const w = mountCurve();
        await dots(w)[1]!.trigger('pointerdown', { clientX: x(0.5), clientY: y(1), pointerId: 1, button: 0 });
        await dots(w)[1]!.trigger('pointermove', { clientX: x(0.5), clientY: 4, pointerId: 1 });
        for (let i = 0; i < 10; i++) {
            now += 50;
            frames.shift()?.(now);
        }
        expect(model(w)[1]!.v).toBe(1);
        w.unmount();
    });
});

describe('TaoxCurveEditor: клавиатура', () => {
    let w: VueWrapper;
    afterEach(() => w?.unmount());

    it('в порядке табуляции только выбранная точка, фокус выбирает точку', async () => {
        w = mountCurve({ selected: 1 });
        expect(dots(w).map((d) => d.attributes('tabindex'))).toEqual(['-1', '0', '-1']);
        await dots(w)[2]!.trigger('focus');
        expect(last(w.emitted('update:selected')!)).toEqual([2]);
    });

    it('стрелки двигают на шаг сетки, Shift в пять раз крупнее, каждое нажатие это шаг истории', async () => {
        w = mountCurve({ selected: 1, max: undefined });
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowUp' });
        expect(model(w)[1]!.v).toBeCloseTo(1.05);
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowDown', shiftKey: true });
        expect(model(w)[1]!.v).toBeCloseTo(0.75);
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowLeft' });
        expect(model(w)[1]!.t).toBeCloseTo(0.45);
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
        expect(model(w)[1]!.t).toBeCloseTo(0.75);
        expect(w.emitted('commit')).toHaveLength(4);
    });

    it('границы и соседи не пускают: значение зажато, порядок точек сохраняется', async () => {
        w = mountCurve({ selected: 1 });
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowUp' });
        expect(model(w)[1]!.v).toBe(1); // max
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
        expect(model(w)[1]!.t).toBeCloseTo(0.75);
        w.unmount();

        w = mountCurve({ modelValue: [{ t: 0, v: 0 }, { t: 0.02, v: 0 }, { t: 1, v: 0 }], selected: 1 });
        await dots(w)[1]!.trigger('keydown', { key: 'ArrowLeft', shiftKey: true });
        expect(model(w)[1]!.t).toBe(0); // не левее соседа
    });

    it('Insert добавляет точку на кривой между выбранной и следующей, Delete убирает выбранную', async () => {
        w = mountCurve({ selected: 0 });
        await dots(w)[0]!.trigger('keydown', { key: 'Insert' });
        const next = model(w);
        expect(next.map((p) => p.t)).toEqual([0, 0.25, 0.5, 1]);
        expect(next[1]!.v).toBeCloseTo(0.5);
        expect(last(w.emitted('update:selected')!)).toEqual([1]);
        w.unmount();

        w = mountCurve({ selected: 1 });
        await dots(w)[1]!.trigger('keydown', { key: 'Delete' });
        expect(model(w)).toEqual([{ t: 0, v: 0 }, { t: 1, v: 0 }]);
        expect(last(w.emitted('update:selected')!)).toEqual([0]);
    });

    it('других клавиш не касается', async () => {
        w = mountCurve({ selected: 1 });
        await dots(w)[1]!.trigger('keydown', { key: 'a' });
        await dots(w)[1]!.trigger('keydown', { key: 'Tab' });
        expect(w.emitted('update:modelValue')).toBeUndefined();
    });
});

describe('TaoxCurveEditor: фокус после правки', () => {
    it('клавиша работает с той точкой, на которой фокус; после Insert и Delete фокус переходит на выбранную', async () => {
        const w = mountCurve({ selected: 0 });
        // клавиша приходит с точки 2, хотя выбрана 0 (родитель выбор не обновил): работаем с точкой под фокусом
        await dots(w)[2]!.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
        expect(model(w)[2]!.t).toBe(1); // последняя точка вправо не уходит
        await dots(w)[2]!.trigger('keydown', { key: 'ArrowUp' });
        expect(model(w)[2]!.v).toBeCloseTo(0.05);

        await dots(w)[0]!.trigger('keydown', { key: 'Insert' });
        await w.setProps({ modelValue: model(w), selected: 1 });
        await Promise.resolve();
        expect(document.activeElement).toBe(dots(w)[1]!.element);

        await dots(w)[1]!.trigger('keydown', { key: 'Delete' });
        await w.setProps({ modelValue: model(w), selected: 0 });
        await Promise.resolve();
        expect(document.activeElement).toBe(dots(w)[0]!.element);
        w.unmount();
    });
});
