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

    it('масштаб колеса держится в пределах из опции zoom', () => {
        const { host, state } = createHost();
        const canvas = mount(host, { ...options, zoom: { min: 0.05 } });
        for (let i = 0; i < 40; i++) {
            const out = new WheelEvent('wheel', { deltaY: 200, bubbles: true, cancelable: true });
            Object.defineProperty(out, 'ctrlKey', { value: true });
            canvas.dispatchEvent(out);
        }
        expect(state.camera.z).toBeCloseTo(0.05);
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

    it('рамка в режиме contain берёт только ноды, целиком лежащие внутри', () => {
        const { host, state } = createHost();
        const canvas = mount(host, { ...options, marquee: 'contain' });
        const rects: Record<string, DOMRect> = {
            'node-a': { left: 100, right: 200, top: 100, bottom: 200 } as DOMRect,
            'node-b': { left: 220, right: 400, top: 100, bottom: 200 } as DOMRect,
        };
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
            const key = [...this.classList].find((c) => c in rects);
            return (key ? rects[key] : { left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600 }) as DOMRect;
        });

        canvas.dispatchEvent(pointer('pointerdown', { clientX: 50, clientY: 50 }));
        canvas.dispatchEvent(pointer('pointermove', { clientX: 300, clientY: 250, buttons: 1 }));
        expect([...state.selection]).toEqual(['a']); // b задета, но не внутри
        canvas.dispatchEvent(pointer('pointermove', { clientX: 450, clientY: 250, buttons: 1 }));
        expect([...state.selection].sort()).toEqual(['a', 'b']);
        canvas.dispatchEvent(pointer('pointerup', { clientX: 450, clientY: 250 }));
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

    it('клавишу, которую забрало приложение (claimsKey), холст не трогает', () => {
        const { host, calls } = createHost({ claimsKey: (e) => e.key === 'Backspace' });
        mount(host);
        key({ key: 'Backspace' });
        expect(calls.some((c) => c.startsWith('removeSelected'))).toBe(false);
        key({ key: 'Delete' });
        expect(calls).toContain('removeSelected()');
    });

    it('в полях ввода горячие клавиши не перехватываются', () => {
        const { host, calls } = createHost();
        const canvas = mount(host);
        canvas.querySelector('.field-a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        expect(calls.some((c) => c.startsWith('removeSelected'))).toBe(false);
    });
});

describe('TaoxCanvas: контекстное меню', () => {
    /** happy-dom не считает раскладку: «что под указателем» подставляем сами. */
    const under = (el: Element | null) => {
        (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () => el;
    };
    const rightClick = (canvas: HTMLElement, at = { clientX: 50, clientY: 60 }) => {
        canvas.dispatchEvent(pointer('pointerdown', { button: 2, ...at }));
        canvas.dispatchEvent(pointer('pointerup', { button: 2, ...at }));
    };

    it('правый клик без сдвига зовёт contextMenu с целью: нода, связь, пусто', () => {
        const contextMenu = vi.fn<NonNullable<CanvasHost<Pin>['contextMenu']>>(() => true);
        const { host, calls } = createHost({ contextMenu });
        const canvas = mount(host);

        under(canvas.querySelector('.node-b'));
        rightClick(canvas);
        under(canvas.querySelector('.link'));
        rightClick(canvas);
        under(canvas);
        rightClick(canvas);

        expect(contextMenu.mock.calls.map((c) => c[2])).toEqual([{ kind: 'node', nodeId: 'b' }, { kind: 'link', id: 'c1' }, { kind: 'empty' }]);
        expect(contextMenu.mock.calls[0]![0]).toHaveLength(2); // экранная точка
        expect(contextMenu.mock.calls[0]![1]).toHaveLength(2); // мировая точка
        expect(calls.some((c) => c.startsWith('openPalette'))).toBe(false); // меню показано: палитра не нужна
    });

    it('false от приложения оставляет прежнее: открывается палитра', () => {
        const { host, calls } = createHost({ contextMenu: () => false });
        const canvas = mount(host);
        under(canvas);
        rightClick(canvas);
        expect(calls.some((c) => c.startsWith('openPalette'))).toBe(true);
    });

    it('правая кнопка, которой водили, двигает холст и меню не зовёт; без члена всё как раньше', () => {
        const contextMenu = vi.fn(() => true);
        const { host, state } = createHost({ contextMenu });
        const canvas = mount(host);
        under(canvas);
        canvas.dispatchEvent(pointer('pointerdown', { button: 2, clientX: 50, clientY: 60 }));
        canvas.dispatchEvent(pointer('pointermove', { clientX: 90, clientY: 80, buttons: 2 }));
        canvas.dispatchEvent(pointer('pointerup', { button: 2, clientX: 90, clientY: 80 }));
        expect(contextMenu).not.toHaveBeenCalled();
        expect(state.camera.x).toBe(40);
    });
});

describe('TaoxCanvas: долгое нажатие пальцем', () => {
    const touch = (type: string, init: PointerEventInit = {}) => pointer(type, { pointerType: 'touch', isPrimary: true, ...init });
    const hold = (ms = 800) => vi.advanceTimersByTime(ms);

    afterEach(() => vi.useRealTimers());

    function setup(extra: Partial<CanvasHost<Pin>> = {}) {
        vi.useFakeTimers();
        const made = createHost(extra);
        return { ...made, canvas: mount(made.host) };
    }

    it('на ноде: удержание без движения открывает контекстное меню этой ноды, палитра не открывается', () => {
        const contextMenu = vi.fn<NonNullable<CanvasHost<Pin>['contextMenu']>>(() => true);
        const { canvas, calls } = setup({ contextMenu });

        canvas.querySelector('.node-b')!.dispatchEvent(touch('pointerdown', { clientX: 40, clientY: 50 }));
        hold();

        expect(contextMenu).toHaveBeenCalledTimes(1);
        expect(contextMenu.mock.calls[0]![2]).toEqual({ kind: 'node', nodeId: 'b' });
        expect(contextMenu.mock.calls[0]![0]).toHaveLength(2);
        expect(calls.some((c) => c.startsWith('openPalette'))).toBe(false);
        expect(calls.some((c) => c.startsWith('beginDrag'))).toBe(false); // это не перетаскивание
    });

    it('на связи: меню связи', () => {
        const contextMenu = vi.fn<NonNullable<CanvasHost<Pin>['contextMenu']>>(() => true);
        const { canvas } = setup({ contextMenu });
        canvas.querySelector('.link')!.dispatchEvent(touch('pointerdown'));
        hold();
        expect(contextMenu.mock.calls[0]![2]).toEqual({ kind: 'link', id: 'c1' });
    });

    it('если палец пошёл тянуть до срока, меню не открывается', () => {
        const contextMenu = vi.fn<NonNullable<CanvasHost<Pin>['contextMenu']>>(() => true);
        const { canvas } = setup({ contextMenu });

        canvas.querySelector('.node-b')!.dispatchEvent(touch('pointerdown', { clientX: 40, clientY: 50 }));
        canvas.dispatchEvent(touch('pointermove', { clientX: 90, clientY: 90 }));
        hold();
        expect(contextMenu).not.toHaveBeenCalled();
    });

    it('на пустом месте приложение спрашивают тоже; false оставляет палитру', () => {
        const contextMenu = vi.fn<NonNullable<CanvasHost<Pin>['contextMenu']>>(() => false);
        const { canvas, calls } = setup({ contextMenu });
        canvas.dispatchEvent(touch('pointerdown'));
        hold();
        expect(contextMenu.mock.calls[0]![2]).toEqual({ kind: 'empty' });
        expect(calls.some((c) => c.startsWith('openPalette'))).toBe(true);
    });

    it('без contextMenu всё как раньше: на пустом месте палитра, на ноде ничего', () => {
        const a = setup();
        a.canvas.dispatchEvent(touch('pointerdown'));
        hold();
        expect(a.calls.some((c) => c.startsWith('openPalette'))).toBe(true);
        a.canvas.remove();
    });

    it('на ноде без contextMenu удержание ничего не открывает', () => {
        const { canvas, calls } = setup();
        canvas.querySelector('.node-b')!.dispatchEvent(touch('pointerdown'));
        hold();
        expect(calls.some((c) => c.startsWith('openPalette'))).toBe(false);
    });

    it('в поле ввода внутри ноды удержание меню не открывает: там выделяют текст', () => {
        const contextMenu = vi.fn<NonNullable<CanvasHost<Pin>['contextMenu']>>(() => true);
        const { canvas } = setup({ contextMenu });
        canvas.querySelector('.field-a')!.dispatchEvent(touch('pointerdown'));
        hold();
        expect(contextMenu).not.toHaveBeenCalled();
    });
});

describe('TaoxCanvas: нажатие на управляющие элементы внутри ноды', () => {
    it('метка (так рисуют самодельный чекбокс), ссылка и ARIA-переключатель получают нажатие сами: нода не тащится', () => {
        const { host, calls } = createHost();
        const canvas = mount(host);
        const node = canvas.querySelector('.node-b')!;
        const label = document.createElement('label');
        const link = document.createElement('a');
        link.setAttribute('href', '#');
        const sw = document.createElement('span');
        sw.setAttribute('role', 'switch');
        node.append(label, link, sw);

        for (const el of [label, link, sw]) el.dispatchEvent(pointer('pointerdown'));
        expect(calls.some((c) => c.startsWith('beginDrag'))).toBe(false);

        // Сама нода по-прежнему тащится.
        node.dispatchEvent(pointer('pointerdown'));
        expect(calls.some((c) => c.startsWith('beginDrag'))).toBe(true);
    });
});

describe('TaoxCanvas: инструмент «поставить»', () => {
    it('пока он включён, нажатие зовёт placeAt с экранной и мировой точкой и больше ничего не делает', () => {
        const placeAt = vi.fn();
        const { host, state, calls } = createHost({ placing: true, placeAt });
        state.camera = { x: 100, y: 50, z: 2 };
        const canvas = mount(host);

        canvas.dispatchEvent(pointer('pointerdown', { clientX: 300, clientY: 250 }));
        canvas.dispatchEvent(pointer('pointerup', { clientX: 300, clientY: 250 }));

        expect(placeAt).toHaveBeenCalledTimes(1);
        const [screen, world] = placeAt.mock.calls[0]!;
        expect(world).toEqual([(screen[0] - 100) / 2, (screen[1] - 50) / 2]);
        expect(calls.some((c) => /^(setSelection|beginDrag|toggle)/.test(c))).toBe(false);
    });

    it('на ноде и на поле ввода внутри неё тоже ставит', () => {
        const placeAt = vi.fn();
        const { host } = createHost({ placing: true, placeAt });
        const canvas = mount(host);

        canvas.querySelector('.node-b')!.dispatchEvent(pointer('pointerdown'));
        expect(placeAt).toHaveBeenCalledTimes(1);

        canvas.querySelector('.field-a')!.dispatchEvent(pointer('pointerdown'));
        expect(placeAt).toHaveBeenCalledTimes(2);
    });

    it('правая кнопка и выключенный флаг работают как раньше', () => {
        const placeAt = vi.fn();
        const off = createHost({ placing: false, placeAt });
        mount(off.host).querySelector('.node-b')!.dispatchEvent(pointer('pointerdown'));
        expect(placeAt).not.toHaveBeenCalled();
        expect(off.calls.some((c) => c.startsWith('beginDrag'))).toBe(true);
    });

    it('без placeAt флаг игнорируется', () => {
        const { host, calls } = createHost({ placing: true });
        mount(host).querySelector('.node-b')!.dispatchEvent(pointer('pointerdown'));
        expect(calls.some((c) => c.startsWith('beginDrag'))).toBe(true);
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

        expect(activate).toHaveBeenNthCalledWith(1, { kind: 'link', id: 'c1', at: [5, 6], element: canvas.querySelector('.link') });
        expect(activate).toHaveBeenNthCalledWith(2, { kind: 'handle', nodeId: 'b' });
        vi.restoreAllMocks();
    });
});
