import { TaoButton, TaoInputNumber, TaoSegmented, TaoSelect } from '@1337exp/taoui';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { CurvePoint } from '../src/curveeditor';
import { TaoxCurveField } from '../src/curvefield';

const pts = (): CurvePoint[] => [
    { t: 0, v: 0 },
    { t: 0.5, v: 1 },
    { t: 1, v: 0 },
];

const last = <T,>(list: T[]): T => list[list.length - 1]!;
const model = (w: VueWrapper) => last(w.emitted('update:modelValue')!)[0] as CurvePoint[];

describe('TaoxCurveField', () => {
    let w: VueWrapper;
    afterEach(() => w?.unmount());

    const mountField = (props: Record<string, unknown> = {}) => mount(TaoxCurveField, { props: { modelValue: pts(), min: 0, ...props }, attachTo: document.body });
    const numbers = () => w.findAllComponents(TaoInputNumber);
    const kind = () => w.findComponent(TaoSelect);
    const buttons = () => w.findAllComponents(TaoButton);

    it('поля показывают выбранную точку, надписи английские по умолчанию и меняются через labels', () => {
        w = mountField();
        expect(numbers()[0]!.props('modelValue')).toBe(0);
        expect(w.text()).toContain('Snap to grid');
        w.unmount();
        w = mountField({ labels: { snap: 'Шаг сетки', time: 'Время' } });
        expect(w.text()).toContain('Шаг сетки');
        expect(w.text()).toContain('Время');
        expect(w.text()).toContain('Value'); // недостающие надписи остаются английскими
    });

    it('поле значения двигает точку, зажимая в границы и сохраняя правку', () => {
        w = mountField({ precision: 2 });
        numbers()[1]!.vm.$emit('update:modelValue', -5);
        expect(model(w)[0]).toEqual({ t: 0, v: 0 }); // min = 0
        expect(w.emitted('commit')).toHaveLength(1);
        numbers()[1]!.vm.$emit('update:modelValue', 0.333);
        expect(model(w)[0]!.v).toBe(0.33);
    });

    it('переход выбирается из списка и сохраняет направление при смене семейства', async () => {
        w = mountField();
        kind().vm.$emit('update:modelValue', 'cubic');
        expect(model(w)[0]!.ease).toBe('cubic-in-out');
        await w.setProps({ modelValue: model(w) });

        w.findComponent(TaoSegmented).vm.$emit('update:modelValue', 'out');
        expect(model(w)[0]!.ease).toBe('cubic-out');
        await w.setProps({ modelValue: model(w) });

        kind().vm.$emit('update:modelValue', 'elastic');
        expect(model(w)[0]!.ease).toBe('elastic-out');
        await w.setProps({ modelValue: model(w) });

        kind().vm.$emit('update:modelValue', 'bezier');
        expect(model(w)[0]!.ease).toEqual({ bezier: [0.25, 0.1, 0.25, 1] });
        await w.setProps({ modelValue: model(w) });

        kind().vm.$emit('update:modelValue', 'linear');
        expect(model(w)[0]).toEqual({ t: 0, v: 0 }); // linear убирает поле
    });

    it('направление недоступно у linear, step и Безье, а у последней точки нет и самого перехода', async () => {
        w = mountField();
        expect(w.findComponent(TaoSegmented).props('disabled')).toBe(true);
        await w.setProps({ modelValue: [{ t: 0, v: 0, ease: 'quad-in' }, { t: 1, v: 1 }] });
        expect(w.findComponent(TaoSegmented).props('disabled')).toBe(false);
        expect(w.findComponent(TaoSegmented).props('modelValue')).toBe('in');

        await w.setProps({ modelValue: [{ t: 0, v: 0, ease: { bezier: [0.2, 0.1, 0.8, 1] } }, { t: 1, v: 1 }] });
        expect(w.findComponent(TaoSegmented).props('disabled')).toBe(true);

        await w.find('.tx-curve-dot:last-of-type').trigger('focus');
        expect(kind().props('disabled')).toBe(true);
    });

    it('удалить точку можно, пока их больше двух; сброс появляется только с defaultValue', async () => {
        w = mountField();
        expect(buttons()).toHaveLength(1);
        expect(buttons()[0]!.props('disabled')).toBe(false);
        await buttons()[0]!.trigger('click');
        expect(model(w)).toHaveLength(2);
        expect(w.emitted('commit')).toHaveLength(1);

        await w.setProps({ modelValue: model(w), defaultValue: pts() });
        expect(buttons()[0]!.props('disabled')).toBe(true); // осталось две точки
        const reset = buttons()[1]!;
        expect(reset.props('disabled')).toBe(false); // кривая отличается от значения по умолчанию
        await reset.trigger('click');
        expect(model(w)).toEqual(pts());
    });
});
