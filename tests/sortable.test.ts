import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { moveItem, sortShifts, sortTarget, sortableTextsRu, useSortable } from '../src/sortable';

describe('sortTarget', () => {
    // four items 40px tall, 8px apart / четыре элемента по 40px с зазором 8px
    const starts = [0, 48, 96, 144];
    const sizes = [40, 40, 40, 40];

    it('stays put until the dragged item passes the middle of a neighbour', () => {
        expect(sortTarget(20, starts, sizes, 0)).toBe(0);
        expect(sortTarget(67, starts, sizes, 0)).toBe(0);
        expect(sortTarget(69, starts, sizes, 0)).toBe(1);
        expect(sortTarget(200, starts, sizes, 0)).toBe(3);
    });

    it('works upwards too, and past the ends', () => {
        expect(sortTarget(110, starts, sizes, 3)).toBe(2);
        expect(sortTarget(-50, starts, sizes, 3)).toBe(0);
    });
});

describe('sortShifts', () => {
    it('down: the items between make room upwards', () => {
        expect(sortShifts(4, 0, 2, 48)).toEqual([0, -48, -48, 0]);
    });

    it('up: the items between make room downwards; in place nothing moves', () => {
        expect(sortShifts(4, 3, 1, 48)).toEqual([0, 48, 48, 0]);
        expect(sortShifts(4, 1, 1, 48)).toEqual([0, 0, 0, 0]);
    });
});

describe('moveItem', () => {
    it('moves a copy, clamped to the list', () => {
        const list = ['a', 'b', 'c', 'd'];
        expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
        expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
        expect(moveItem(list, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
        expect(list).toEqual(['a', 'b', 'c', 'd']);
    });
});

/** A list of four with handles; its items get real-looking sizes, as happy-dom has no layout. */
function mountList(options: { disabled?: boolean } = {}) {
    const moves: [number, number][] = [];
    const Comp = defineComponent({
        setup() {
            const root = ref<HTMLElement | null>(null);
            const list = ref(['Alpha', 'Beta', 'Gamma', 'Delta']);
            const api = useSortable(root, {
                onMove(from, to) {
                    moves.push([from, to]);
                    list.value = moveItem(list.value, from, to);
                },
                disabled: () => options.disabled ?? false,
                texts: sortableTextsRu,
            });
            return { root, list, api };
        },
        render() {
            return h(
                'ul',
                { ref: 'root' },
                this.list.map((name: string) =>
                    h('li', { key: name, 'data-sortable-item': '' }, [h('button', { 'data-sortable-handle': '', 'aria-label': `Move ${name}` }), name]),
                ),
            );
        },
    });
    const w = mount(Comp, { attachTo: document.body });
    const place = () =>
        w.findAll('li').forEach((li, i) => {
            (li.element as HTMLElement).getBoundingClientRect = () => ({ top: i * 48, left: 0, width: 200, height: 40, right: 200, bottom: i * 48 + 40, x: 0, y: i * 48, toJSON: () => ({}) }) as DOMRect;
        });
    place();
    return { w, moves, place };
}

const pointer = (type: string, target: EventTarget, y: number) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: 10, clientY: y }));

const key = (target: HTMLElement, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('useSortable: the pointer', () => {
    it('drag a handle past a neighbour and release: the item moves; the others made room meanwhile', async () => {
        const { w, moves } = mountList();
        const items = w.findAll('li').map((li) => li.element as HTMLElement);
        const handle = items[0]!.querySelector('button')!;
        pointer('pointerdown', handle, 20);
        expect(items[0]!.hasAttribute('data-sortable-dragging')).toBe(true);
        pointer('pointermove', document, 20 + 100);
        expect(items[0]!.style.transform).toBe('translateY(100px)');
        expect(items[1]!.style.transform).toBe('translateY(-48px)');
        expect(items[2]!.style.transform).toBe('translateY(-48px)');
        pointer('pointerup', document, 120);
        await nextTick();
        expect(moves).toEqual([[0, 2]]);
        expect(items[0]!.hasAttribute('data-sortable-dragging')).toBe(false);
        expect(items[0]!.style.transform).toBe('');
        expect(w.findAll('li').map((li) => li.text())).toEqual(['Beta', 'Gamma', 'Alpha', 'Delta']);
    });

    it('past the end of the list: the last place, and the item is drawn no further than the end', async () => {
        const { w, moves } = mountList();
        const items = w.findAll('li').map((li) => li.element as HTMLElement);
        pointer('pointerdown', items[0]!.querySelector('button')!, 20);
        pointer('pointermove', document, 20 + 900);
        // three places down (3 × 48), not 900px: past the end it would stretch the scrolled area
        expect(items[0]!.style.transform).toBe('translateY(144px)');
        pointer('pointerup', document, 920);
        await nextTick();
        expect(moves).toEqual([[0, 3]]);
    });

    it('Esc during a drag puts it back; a press outside a handle does nothing; disabled does nothing', () => {
        const { w, moves } = mountList();
        const items = w.findAll('li').map((li) => li.element as HTMLElement);
        pointer('pointerdown', items[0]!.querySelector('button')!, 20);
        pointer('pointermove', document, 200);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        pointer('pointerup', document, 200);
        expect(moves).toEqual([]);
        expect(items[0]!.style.transform).toBe('');

        pointer('pointerdown', items[1]!, 70);
        expect(items[1]!.hasAttribute('data-sortable-dragging')).toBe(false);

        const off = mountList({ disabled: true });
        const first = off.w.find('li').element as HTMLElement;
        pointer('pointerdown', first.querySelector('button')!, 20);
        expect(first.hasAttribute('data-sortable-dragging')).toBe(false);
    });
});

describe('useSortable: the keyboard', () => {
    it('Space lifts, ↓ moves one place, Space drops; a live region says where it is', async () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 0;
        });
        const { w, moves } = mountList();
        const handle = () => w.findAll('li')[0]!.element.querySelector('button') as HTMLElement;
        key(handle(), ' ');
        expect(w.findAll('li')[0]!.attributes('data-sortable-lifted')).toBe('');
        const live = document.querySelector('[aria-live="assertive"]')!;
        expect(live.textContent).toContain('Alpha поднят, место 1 из 4');
        key(handle(), 'ArrowDown');
        await nextTick();
        expect(moves).toEqual([[0, 1]]);
        expect(w.findAll('li').map((li) => li.text())).toEqual(['Beta', 'Alpha', 'Gamma', 'Delta']);
        key(w.findAll('li')[1]!.element.querySelector('button') as HTMLElement, ' ');
        expect(live.textContent).toContain('поставлен на место 2 из 4');
        expect(w.find('[data-sortable-lifted]').exists()).toBe(false);
    });

    it('Esc returns it to where it started; ↑ at the top does nothing', async () => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 0;
        });
        const { w, moves } = mountList();
        const handleAt = (i: number) => w.findAll('li')[i]!.element.querySelector('button') as HTMLElement;
        key(handleAt(0), 'Enter');
        key(handleAt(0), 'ArrowUp');
        expect(moves).toEqual([]);
        key(handleAt(0), 'ArrowDown');
        await nextTick();
        key(handleAt(1), 'ArrowDown');
        await nextTick();
        key(handleAt(2), 'Escape');
        await nextTick();
        expect(moves).toEqual([
            [0, 1],
            [1, 2],
            [2, 0],
        ]);
        expect(w.findAll('li').map((li) => li.text())).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    });
});
