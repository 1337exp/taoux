import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue';
import { createPinRegistry, measurePins, pinKey, samePinOffsets, usePinMeasure, type PinOffsets } from '../src/pins';

function rect(left: number, top: number, width: number, height: number): DOMRect {
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
}

/** Нода 200x100 в точке (100, 50) с двумя пинами; getBoundingClientRect подменён. */
function buildNode() {
    const root = document.createElement('div');
    const input = document.createElement('span');
    input.dataset.pin = 'a';
    input.dataset.dir = 'in';
    const output = document.createElement('span');
    output.dataset.pin = 'result';
    output.dataset.dir = 'out';
    const stray = document.createElement('span'); // пин без направления не измеряется
    stray.dataset.pin = 'x';
    root.append(input, output, stray);

    root.getBoundingClientRect = () => rect(100, 50, 200, 100);
    input.getBoundingClientRect = () => rect(104, 70, 10, 10); // центр (109, 75)
    output.getBoundingClientRect = () => rect(286, 70, 10, 10); // центр (291, 75)
    return root;
}

describe('measurePins', () => {
    it('считает центры пинов относительно угла ноды и делит на масштаб', () => {
        const root = buildNode();
        expect(measurePins(root, 1)).toEqual({ 'in:a': [9, 25], 'out:result': [191, 25] });
        expect(measurePins(root, 2)).toEqual({ 'in:a': [4.5, 12.5], 'out:result': [95.5, 12.5] });
    });
});

describe('samePinOffsets', () => {
    const a: PinOffsets = { 'in:a': [1, 2] };

    it('равны с допуском, различаются по значению и по набору ключей', () => {
        expect(samePinOffsets(a, { 'in:a': [1.005, 2] })).toBe(true);
        expect(samePinOffsets(a, { 'in:a': [1.5, 2] })).toBe(false);
        expect(samePinOffsets(a, { 'in:a': [1, 2], 'out:b': [0, 0] })).toBe(false);
        expect(samePinOffsets(a, { 'in:b': [1, 2] })).toBe(false);
        expect(samePinOffsets(undefined, a)).toBe(false);
    });
});

describe('createPinRegistry', () => {
    it('хранит позиции, переводит в мировые координаты и забывает ноду', () => {
        const reg = createPinRegistry();
        const node = { id: 'n1', x: 100, y: 50 };
        expect(reg.world(node, 'in', 'a')).toBeNull();

        reg.set('n1', { [pinKey('in', 'a')]: [9, 25] });
        expect(reg.world(node, 'in', 'a')).toEqual([109, 75]);
        expect(reg.world(node, 'out', 'a')).toBeNull();
        expect(reg.world(undefined, 'in', 'a')).toBeNull();

        reg.clear('n1');
        expect(reg.world(node, 'in', 'a')).toBeNull();
    });

    it('не пересоздаёт запись, если позиции не изменились (нет лишних обновлений)', () => {
        const reg = createPinRegistry();
        reg.set('n1', { 'in:a': [1, 1] });
        const first = reg.offsets.n1;
        reg.set('n1', { 'in:a': [1.001, 1] });
        expect(reg.offsets.n1).toBe(first);
        reg.set('n1', { 'in:a': [5, 1] });
        expect(reg.offsets.n1).not.toBe(first);
    });
});

describe('usePinMeasure', () => {
    let app: App | null = null;
    afterEach(() => {
        app?.unmount();
        app = null;
    });

    it('измеряет при монтировании и перерисовке и забывает при размонтировании', async () => {
        const report = vi.fn();
        const clear = vi.fn();
        const tick = ref(0);

        const Node = defineComponent({
            setup() {
                const el = ref<HTMLElement | null>(null);
                usePinMeasure(el, { zoom: () => 2, report, clear });
                return () => {
                    void tick.value;
                    return h('div', { ref: el }, [h('span', { 'data-pin': 'a', 'data-dir': 'in' })]);
                };
            },
        });

        // у jsdom-подобного окружения нет раскладки: подменяем измерение на заглушку
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
            return this.hasAttribute('data-pin') ? rect(10, 10, 4, 4) : rect(0, 0, 100, 50);
        });
        vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

        const host = document.createElement('div');
        document.body.appendChild(host);
        app = createApp(Node);
        app.mount(host);
        expect(report).toHaveBeenLastCalledWith({ 'in:a': [6, 6] }); // центр (12,12) / zoom 2

        const calls = report.mock.calls.length;
        tick.value++;
        await nextTick();
        expect(report.mock.calls.length).toBeGreaterThan(calls);

        app.unmount();
        app = null;
        expect(clear).toHaveBeenCalledTimes(1);
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
});
