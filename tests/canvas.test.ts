import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, reactive, type App } from 'vue';
import { TaoxCanvas, type CanvasHost, type CanvasOptions } from '../src/canvas';

interface Pin {
    node: string;
    side: string;
}

/** Хост, который записывает вызовы холста. Состояние реактивное, как у настоящего стора. */
function createHost(extra: Partial<CanvasHost<Pin>> = {}) {
    const state = reactive({ camera: { x: 0, y: 0, z: 1 }, selection: new Set<string>(), paletteOpen: false, origin: null as Pin | null });
    const calls: string[] = [];
    const log = (name: string) => (...args: unknown[]) => {
        calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(',')})`);
    };

    const host: CanvasHost<Pin> = {
        get camera() {
            return state.camera;
        },
        setCamera: (c) => {
            state.camera = c;
            calls.push('setCamera');
        },
        setViewport: log('setViewport'),
        get selection() {
            return state.selection;
        },
        setSelection: (ids) => {
            state.selection.clear();
            for (const id of ids) state.selection.add(id);
            calls.push(`setSelection(${[...ids]})`);
        },
        toggleSelected: (id) => {
            if (!state.selection.delete(id)) state.selection.add(id);
            calls.push(`toggle(${id})`);
        },
        selectConnection: log('selectConnection'),
        raise: log('raise'),
        beginDrag: log('beginDrag'),
        moveSelected: log('moveSelected'),
        endDrag: log('endDrag'),
        commit: log('commit'),
        undo: log('undo'),
        redo: log('redo'),
        removeSelected: log('removeSelected'),
        get paletteOpen() {
            return state.paletteOpen;
        },
        openPalette: (screen, world, origin) => {
            state.paletteOpen = true;
            calls.push(`openPalette(${screen},${world},${JSON.stringify(origin)})`);
        },
        closePalette: () => {
            state.paletteOpen = false;
        },
        connect: {
            get origin() {
                return state.origin;
            },
            start: (pin, cursor) => {
                state.origin = pin;
                calls.push(`connect.start(${pin.node}.${pin.side},${cursor})`);
            },
            update: (_cursor, target) => calls.push(`connect.update(${target ? target.node : 'null'})`),
            finish: (target) => {
                state.origin = null;
                calls.push(`connect.finish(${target ? target.node : 'null'})`);
                return target !== null;
            },
            cancel: () => {
                state.origin = null;
                calls.push('connect.cancel');
            },
        },
        ...extra,
    };
    return { host, state, calls };
}

const options: CanvasOptions<Pin> = {
    pinAt(target) {
        const pin = (target as Element | null)?.closest<HTMLElement>('[data-pin]');
        const node = pin?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId;
        return pin && node ? { node, side: pin.dataset.pin! } : null;
    },
};

let app: App | null = null;
let el: HTMLElement | null = null;

function mount(host: CanvasHost<Pin>, opts: CanvasOptions<Pin> = options) {
    el = document.createElement('div');
    document.body.appendChild(el);
    app = createApp({
        render: () =>
            h(TaoxCanvas as never, { host, options: opts }, {
                default: () => [
                    h('div', { class: 'node-a', 'data-node-id': 'a' }, [h('span', { class: 'pin-a', 'data-pin': 'right' }), h('input', { class: 'field-a' })]),
                    h('div', { class: 'node-b', 'data-node-id': 'b' }),
                    h('svg', {}, [h('path', { class: 'link', 'data-conn-id': 'c1' })]),
                ],
            }),
    });
    app.mount(el);
    return el.querySelector('.tx-canvas') as HTMLElement;
}

afterEach(() => {
    app?.unmount();
    el?.remove();
    app = el = null;
    document.body.innerHTML = '';
});

const pointer = (type: string, init: PointerEventInit = {}) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10, ...init });

describe('TaoxCanvas: вид', () => {
    it('сообщает размер, ставит transform мира и класс connecting при протягивании', async () => {
        const { host, state, calls } = createHost();
        const canvas = mount(host);
        expect(calls.some((c) => c.startsWith('setViewport'))).toBe(true);

        state.camera = { x: 30, y: 40, z: 2 };
        await Promise.resolve();
        expect((canvas.querySelector('.tx-canvas-world') as HTMLElement).style.transform).toBe('translate(30px, 40px) scale(2)');

        expect(canvas.classList.contains('connecting')).toBe(false);
        state.origin = { node: 'a', side: 'right' };
        await Promise.resolve();
        expect(canvas.classList.contains('connecting')).toBe(true);
    });
});

describe('TaoxCanvas: колесо', () => {
    it('колесо двигает холст, Ctrl масштабирует', () => {
        const { host, state } = createHost();
        const canvas = mount(host);

        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, deltaX: 10, bubbles: true, cancelable: true }));
        expect(state.camera).toEqual({ x: -10, y: -50, z: 1 });

        const zoom = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
        Object.defineProperty(zoom, 'ctrlKey', { value: true }); // happy-dom не переносит модификаторы из init колеса
        canvas.dispatchEvent(zoom);
        expect(state.camera.z).toBeGreaterThan(1);
    });
});

describe('TaoxCanvas: ноды', () => {
    it('нажатие на ноду выделяет её и поднимает, сдвиг двигает, отпускание завершает шагом истории', () => {
        const { host, calls } = createHost();
        const canvas = mount(host);
        const node = canvas.querySelector('.node-a')!;

        node.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
        canvas.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 25, buttons: 1 }));
        canvas.dispatchEvent(pointer('pointerup', { clientX: 30, clientY: 25 }));

        expect(calls).toContain('raise("a")');
        expect(calls).toContain('setSelection(a)');
        expect(calls).toContain('beginDrag("a")');
        expect(calls).toContain('moveSelected(20,15,false)'); // привязки нет: хост не объявил snapEnabled
        expect(calls.slice(-2)).toEqual(['endDrag()', 'commit()']);
    });

    it('Ctrl+нажатие добавляет ноду в выделение и не сбрасывает остальные', () => {
        const { host, state } = createHost();
        const canvas = mount(host);
        state.selection.add('b');
        canvas.querySelector('.node-a')!.dispatchEvent(pointer('pointerdown', { ctrlKey: true }));
        expect([...state.selection].sort()).toEqual(['a', 'b']);
    });

    it('нажатие на поле ввода внутри ноды выделяет ноду, но не начинает перетаскивание', () => {
        const { host, calls } = createHost();
        const canvas = mount(host);
        canvas.querySelector('.field-a')!.dispatchEvent(pointer('pointerdown'));
        expect(calls).toContain('setSelection(a)');
        expect(calls.some((c) => c.startsWith('beginDrag'))).toBe(false);
    });

    it('нажатие на связь выбирает её и снимает выделение нод', () => {
        const { host, calls } = createHost();
        const canvas = mount(host);
        canvas.querySelector('.link')!.dispatchEvent(pointer('pointerdown'));
        expect(calls).toContain('selectConnection("c1")');
        expect(calls).toContain('setSelection()');
    });
});

describe('TaoxCanvas: пустое место', () => {
    it('правый клик без сдвига открывает палитру, а со сдвигом двигает камеру', () => {
        const { host, calls, state } = createHost();
        const canvas = mount(host);

        canvas.dispatchEvent(pointer('pointerdown', { button: 2, clientX: 50, clientY: 60 }));
        canvas.dispatchEvent(pointer('pointerup', { button: 2, clientX: 50, clientY: 60 }));
        expect(calls.some((c) => c.startsWith('openPalette'))).toBe(true);

        state.paletteOpen = false;
        canvas.dispatchEvent(pointer('pointerdown', { button: 2, clientX: 50, clientY: 60 }));
        canvas.dispatchEvent(pointer('pointermove', { clientX: 90, clientY: 80, buttons: 2 }));
        canvas.dispatchEvent(pointer('pointerup', { button: 2, clientX: 90, clientY: 80 }));
        expect(state.camera).toEqual({ x: 40, y: 20, z: 1 });
        expect(calls.filter((c) => c.startsWith('openPalette'))).toHaveLength(1);
    });

    it('рамка выделения собирает ноды, которые она задевает, и учитывает базовое выделение', () => {
        const { host, state } = createHost();
        const canvas = mount(host);
        const rects: Record<string, DOMRect> = {
            'node-a': { left: 100, right: 200, top: 100, bottom: 200 } as DOMRect,
            'node-b': { left: 400, right: 500, top: 400, bottom: 500 } as DOMRect,
        };
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
            const key = [...this.classList].find((c) => c in rects);
            return (key ? rects[key] : { left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600 }) as DOMRect;
        });

        canvas.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 50 }));
        canvas.dispatchEvent(pointer('pointermove', { clientX: 250, clientY: 250, buttons: 1 }));
        expect([...state.selection]).toEqual(['a']);
        canvas.dispatchEvent(pointer('pointerup', { clientX: 250, clientY: 250 }));
        vi.restoreAllMocks();
    });
});

describe('TaoxCanvas: связи', () => {
    it('тянет связь от пина и завершает на цели, найденной хостом приложения', () => {
        const { host, calls } = createHost();
        const canvas = mount(host, { ...options, pinNear: () => ({ node: 'b', side: 'left' }) });

        canvas.querySelector('.pin-a')!.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
        canvas.dispatchEvent(pointer('pointermove', { clientX: 60, clientY: 10, buttons: 1 }));
        canvas.dispatchEvent(pointer('pointerup', { clientX: 60, clientY: 10 }));

        expect(calls).toContain('connect.start(a.right,0,0)'.replace('0,0', '10,10'));
        expect(calls).toContain('connect.update(b)');
        expect(calls).toContain('connect.finish(b)');
        expect(calls.some((c) => c.startsWith('beginDrag'))).toBe(false);
    });

    it('без поддержки connect нажатие на пин ничего не протягивает', () => {
        const { host, calls } = createHost({ connect: undefined });
        const canvas = mount(host);
        canvas.querySelector('.pin-a')!.dispatchEvent(pointer('pointerdown'));
        expect(calls.some((c) => c.startsWith('connect'))).toBe(false);
    });

    it('оборванный жест (потеря фокуса окна) отменяет протягивание', () => {
        const { host, calls, state } = createHost();
        const canvas = mount(host);
        canvas.querySelector('.pin-a')!.dispatchEvent(pointer('pointerdown'));
        expect(state.origin).not.toBeNull();

        window.dispatchEvent(new Event('blur'));
        expect(calls).toContain('connect.cancel');
        expect(state.origin).toBeNull();
    });
});

describe('TaoxCanvas: клавиши', () => {
    const key = (init: KeyboardEventInit) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

    it('Delete удаляет, Ctrl+Z и Ctrl+Y (и Ctrl+Shift+Z) — история, Escape закрывает палитру', () => {
        const { host, calls, state } = createHost();
        mount(host);

        key({ key: 'Delete' });
        key({ code: 'KeyZ', ctrlKey: true });
        key({ code: 'KeyY', ctrlKey: true });
        key({ code: 'KeyZ', ctrlKey: true, shiftKey: true });
        expect(calls.filter((c) => /^(removeSelected|undo|redo)/.test(c))).toEqual(['removeSelected()', 'undo()', 'redo()', 'redo()']);

        state.paletteOpen = true;
        key({ key: 'Escape' });
        expect(state.paletteOpen).toBe(false);
    });

    it('в полях ввода горячие клавиши не перехватываются', () => {
        const { host, calls } = createHost();
        const canvas = mount(host);
        canvas.querySelector('.field-a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        expect(calls.some((c) => c.startsWith('removeSelected'))).toBe(false);
    });
});

describe('TaoxCanvas: двойной клик', () => {
    it('зовёт activate для связи и для полосы ноды, если хост это умеет', () => {
        const activate = vi.fn();
        const { host } = createHost({ activate });
        const canvas = mount(host);

        const handle = document.createElement('header');
        handle.setAttribute('data-node-handle', '');
        canvas.querySelector('.node-b')!.appendChild(handle);

        vi.spyOn(document, 'elementFromPoint').mockReturnValueOnce(canvas.querySelector('.link')).mockReturnValueOnce(handle);
        canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 5, clientY: 6 }));
        canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 5, clientY: 6 }));

        expect(activate).toHaveBeenNthCalledWith(1, { kind: 'link', id: 'c1', at: [5, 6] });
        expect(activate).toHaveBeenNthCalledWith(2, { kind: 'handle', nodeId: 'b' });
        vi.restoreAllMocks();
    });
});
