import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { TaoxGradientEditor, type GradientStop } from '../src/gradienteditor';

const stop = (t: number, alpha = 1): GradientStop => ({ t, color: [t, 0.5, 0.2], alpha });
const last = <T,>(list: T[]): T => list[list.length - 1]!;

// Полоса шириной 200 px: clientX совпадает с t · 200
function mountBar(stops: GradientStop[], props: Record<string, unknown> = {}) {
    const w = mount(TaoxGradientEditor, { props: { modelValue: stops, selected: 0, ...props }, attachTo: document.body });
    w.find('.tx-gradient').element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 22, right: 200, bottom: 22, x: 0, y: 0, toJSON: () => ({}) });
    return w;
}

const handles = (w: VueWrapper) => w.findAll('.tx-gradient-stop');
const model = (w: VueWrapper) => last(w.emitted('update:modelValue')!)[0] as GradientStop[];
const ts = (w: VueWrapper) => model(w).map((s) => s.t);

describe('TaoxGradientEditor: мышь', () => {
    let w: VueWrapper;
    afterEach(() => w?.unmount());

    it('клик по полосе добавляет остановку с цветом градиента в этой точке и выбирает её', async () => {
        w = mountBar([stop(0), stop(1)]);
        await w.find('.tx-gradient').trigger('click', { clientX: 50 });
        expect(ts(w)).toEqual([0, 0.25, 1]);
        expect(model(w)[1]!.color[0]).toBeCloseTo(0.25);
        expect(last(w.emitted('update:selected')!)).toEqual([1]);
        expect(w.emitted('commit')).toHaveLength(1);
    });

    it('клик по ручке полосу не трогает', async () => {
        w = mountBar([stop(0), stop(1)]);
        await handles(w)[0]!.trigger('click', { clientX: 0 });
        expect(w.emitted('update:modelValue')).toBeUndefined();
    });

    it('ручка тянется за указателем, t округляется до трёх знаков, правка закрывается при отпускании', async () => {
        w = mountBar([stop(0), stop(0.5), stop(1)]);
        await handles(w)[1]!.trigger('pointerdown', { clientX: 100, pointerId: 1, button: 0 });
        expect(last(w.emitted('update:selected')!)).toEqual([1]);
        await handles(w)[1]!.trigger('pointermove', { clientX: 123.4567, pointerId: 1 });
        expect(ts(w)[1]).toBe(0.617);
        expect(w.emitted('commit')).toBeUndefined();
        await handles(w)[1]!.trigger('pointerup', { pointerId: 1 });
        expect(w.emitted('commit')).toHaveLength(1);
    });

    it('precision=null не округляет', async () => {
        w = mountBar([stop(0), stop(0.5), stop(1)], { precision: null });
        await handles(w)[1]!.trigger('pointerdown', { clientX: 100, pointerId: 1, button: 0 });
        await handles(w)[1]!.trigger('pointermove', { clientX: 123.4567, pointerId: 1 });
        expect(ts(w)[1]).toBeCloseTo(0.6172835, 6);
    });

    it('ручка не перепрыгивает соседей', async () => {
        w = mountBar([stop(0), stop(0.5), stop(1)]);
        await handles(w)[1]!.trigger('pointerdown', { clientX: 100, pointerId: 1, button: 0 });
        await handles(w)[1]!.trigger('pointermove', { clientX: 400, pointerId: 1 });
        expect(ts(w)[1]).toBe(1);
        await handles(w)[1]!.trigger('pointermove', { clientX: -50, pointerId: 1 });
        expect(ts(w)[1]).toBe(0);
    });

    it('Alt+нажатие убирает ручку, последнюю убрать нельзя', async () => {
        w = mountBar([stop(0), stop(0.5), stop(1)]);
        await handles(w)[1]!.trigger('pointerdown', { clientX: 100, pointerId: 1, button: 0, altKey: true });
        expect(ts(w)).toEqual([0, 1]);
        w.unmount();

        w = mountBar([stop(0.3)]);
        await handles(w)[0]!.trigger('pointerdown', { clientX: 60, pointerId: 1, button: 0, altKey: true });
        expect(model(w)).toHaveLength(1);
    });

    it('стопка: потянув влево вынимается первая из стопки, потянув вправо последняя', async () => {
        w = mountBar([stop(0), stop(1), stop(1), stop(1)]);
        await handles(w)[3]!.trigger('pointerdown', { clientX: 200, pointerId: 1, button: 0 });
        expect(last(w.emitted('update:selected')!)).toEqual([3]); // пока не ясно, какую берут: выбрана та, на которую нажали
        await handles(w)[3]!.trigger('pointermove', { clientX: 120, pointerId: 1 });
        expect(last(w.emitted('update:selected')!)).toEqual([1]);
        expect(ts(w)).toEqual([0, 0.6, 1, 1]);
        await handles(w)[3]!.trigger('pointerup', { pointerId: 1 });
        w.unmount();

        w = mountBar([stop(0), stop(0), stop(0), stop(1)]);
        await handles(w)[0]!.trigger('pointerdown', { clientX: 0, pointerId: 1, button: 0 });
        await handles(w)[0]!.trigger('pointermove', { clientX: 80, pointerId: 1 });
        expect(last(w.emitted('update:selected')!)).toEqual([2]);
        expect(ts(w)).toEqual([0, 0, 0.4, 1]);
    });

    it('стопка без движения: ничего не меняется и в историю ничего не пишется', async () => {
        w = mountBar([stop(0), stop(1), stop(1)]);
        await handles(w)[2]!.trigger('pointerdown', { clientX: 200, pointerId: 1, button: 0 });
        await handles(w)[2]!.trigger('pointermove', { clientX: 199, pointerId: 1 }); // меньше порога в 3 px
        await handles(w)[2]!.trigger('pointerup', { pointerId: 1 });
        expect(w.emitted('update:modelValue')).toBeUndefined();
        expect(w.emitted('commit')).toBeUndefined();
    });
});

describe('TaoxGradientEditor: клавиатура', () => {
    let w: VueWrapper;
    afterEach(() => w?.unmount());

    it('каждая ручка в порядке табуляции (стрелки двигают значение, поэтому переходить между ручками можно только Tab), роль и значения для скринридеров', async () => {
        w = mountBar([stop(0), stop(0.5), stop(1)], { selected: 1 });
        expect(handles(w).map((h) => h.attributes('tabindex'))).toEqual(['0', '0', '0']);
        expect(handles(w)[1]!.attributes('role')).toBe('slider');
        expect(handles(w)[1]!.attributes('aria-valuenow')).toBe('0.5');
        expect(handles(w)[1]!.attributes('aria-valuetext')).toBe('50%');
        expect(handles(w)[1]!.attributes('aria-label')).toBe('Stop 2');
        await handles(w)[2]!.trigger('focus');
        expect(last(w.emitted('update:selected')!)).toEqual([2]);

        w.unmount();
        w = mountBar([stop(0), stop(1)], { stopLabel: (i: number) => `Остановка ${i + 1}` });
        expect(handles(w)[0]!.attributes('aria-label')).toBe('Остановка 1');
    });

    it('стрелки двигают по t на keyStep, Shift в десять раз крупнее, каждое нажатие это шаг истории', async () => {
        w = mountBar([stop(0), stop(0.5), stop(1)], { selected: 1 });
        await handles(w)[1]!.trigger('keydown', { key: 'ArrowRight' });
        expect(ts(w)[1]).toBe(0.51);
        await handles(w)[1]!.trigger('keydown', { key: 'ArrowLeft', shiftKey: true });
        expect(ts(w)[1]).toBe(0.4);
        expect(w.emitted('commit')).toHaveLength(2);
        w.unmount();

        w = mountBar([stop(0), stop(0.5), stop(1)], { selected: 1, keyStep: 0.05 });
        await handles(w)[1]!.trigger('keydown', { key: 'ArrowUp' });
        expect(ts(w)[1]).toBe(0.55);
    });

    it('Home и End ставят в начало и конец, соседи не пускают дальше', async () => {
        w = mountBar([stop(0.1), stop(0.5), stop(0.9)], { selected: 1 });
        await handles(w)[1]!.trigger('keydown', { key: 'Home' });
        expect(ts(w)[1]).toBe(0.1); // упёрлась в левого соседа
        w.unmount();

        w = mountBar([stop(0), stop(0.5), stop(0.9)], { selected: 2 });
        await handles(w)[2]!.trigger('keydown', { key: 'End' });
        expect(ts(w)[2]).toBe(1);
    });

    it('Insert добавляет остановку между выбранной и следующей, Delete убирает выбранную (но не последнюю)', async () => {
        w = mountBar([stop(0), stop(1)], { selected: 0 });
        await handles(w)[0]!.trigger('keydown', { key: 'Insert' });
        expect(ts(w)).toEqual([0, 0.5, 1]);
        expect(last(w.emitted('update:selected')!)).toEqual([1]);
        w.unmount();

        w = mountBar([stop(0), stop(0.5), stop(1)], { selected: 1 });
        await handles(w)[1]!.trigger('keydown', { key: 'Delete' });
        expect(ts(w)).toEqual([0, 1]);
        expect(last(w.emitted('update:selected')!)).toEqual([0]);
        w.unmount();

        w = mountBar([stop(0.4)]);
        await handles(w)[0]!.trigger('keydown', { key: 'Backspace' });
        expect(model(w)).toHaveLength(1);
    });

    it('других клавиш не касается', async () => {
        w = mountBar([stop(0), stop(1)]);
        await handles(w)[0]!.trigger('keydown', { key: 'a' });
        await handles(w)[0]!.trigger('keydown', { key: 'Tab' });
        expect(w.emitted('update:modelValue')).toBeUndefined();
    });
});

describe('TaoxGradientEditor: фокус после правки', () => {
    it('после Insert и Delete фокус переходит на выбранную ручку', async () => {
        const w = mountBar([stop(0), stop(1)], { selected: 0 });
        await handles(w)[0]!.trigger('keydown', { key: 'Insert' });
        await w.setProps({ modelValue: model(w), selected: 1 });
        await Promise.resolve();
        expect(document.activeElement).toBe(handles(w)[1]!.element);

        await handles(w)[1]!.trigger('keydown', { key: 'Delete' });
        await w.setProps({ modelValue: model(w), selected: 0 });
        await Promise.resolve();
        expect(document.activeElement).toBe(handles(w)[0]!.element);
        w.unmount();
    });
});
