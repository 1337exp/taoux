import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import TaoxSwipeRow from '../src/swiperow/TaoxSwipeRow.vue';
import { armedAt, clampOffset, endWidths, fullThreshold, startThreshold, swipeRowRelease, type SwipeRowGeometry } from '../src/swiperow/model';

const g: SwipeRowGeometry = { width: 360, actionWidth: 76, endCount: 3, hasStart: true, fullSwipe: true };

describe('swipe row model', () => {
    it('a pull to the start runs its action past the threshold; short of it the row comes back', () => {
        expect(startThreshold(g)).toBe(96);
        expect(swipeRowRelease({ offset: 120, velocity: 0 }, g)).toEqual({ kind: 'start' });
        expect(swipeRowRelease({ offset: 60, velocity: 0 }, g)).toEqual({ kind: 'rest', open: false });
        // flung that way past half of it / брошено туда дальше половины порога
        expect(swipeRowRelease({ offset: 60, velocity: 1 }, g)).toEqual({ kind: 'start' });
    });

    it('a pull to the end opens or closes by the nearest stop and a fling', () => {
        expect(swipeRowRelease({ offset: -150, velocity: 0 }, g)).toEqual({ kind: 'rest', open: true });
        expect(swipeRowRelease({ offset: -60, velocity: 0 }, g)).toEqual({ kind: 'rest', open: false });
        expect(swipeRowRelease({ offset: -60, velocity: -1 }, g)).toEqual({ kind: 'rest', open: true });
        expect(swipeRowRelease({ offset: -228, velocity: 1 }, g)).toEqual({ kind: 'rest', open: false });
    });

    it('pulled far to the end, the release runs the last action; without fullSwipe it only opens', () => {
        expect(fullThreshold(g)).toBe(252);
        expect(armedAt(-260, g)).toBe('full');
        expect(swipeRowRelease({ offset: -300, velocity: 0 }, g)).toEqual({ kind: 'full' });
        const noFull = { ...g, fullSwipe: false };
        expect(armedAt(-300, noFull)).toBeNull();
        expect(swipeRowRelease({ offset: -300, velocity: 0 }, noFull)).toEqual({ kind: 'rest', open: true });
    });

    it('the row moves no further than there is something behind it', () => {
        expect(clampOffset(200, { ...g, hasStart: false })).toBe(0);
        expect(clampOffset(-200, { ...g, endCount: 0 })).toBe(0);
        expect(clampOffset(-999, { ...g, fullSwipe: false })).toBe(-342);
        expect(clampOffset(-999, g)).toBe(-360);
    });

    it('the end actions share the pull evenly; armed, the last takes nearly all of it', () => {
        expect(endWidths(0, g, false)).toEqual([0, 0, 0]);
        expect(endWidths(246, g, false)).toEqual([76, 76, 76]);
        const armed = endWidths(300, g, true);
        expect(armed.slice(0, 2)).toEqual([28, 28]);
        expect(armed[2]).toBe(300 - 18 - 56);
    });
});

/** A row with real-looking width; happy-dom has no layout. */
function mountRow(props: Record<string, unknown> = {}) {
    const w = mount(TaoxSwipeRow, {
        props: {
            start: { id: 'read', label: 'Read', icon: 'tao-check' },
            end: [
                { id: 'more', label: 'More', icon: 'tao-more-horizontal' },
                { id: 'mute', label: 'Unsubscribe' },
                { id: 'delete', label: 'Delete', icon: 'tao-trash', tone: 'danger' },
            ],
            ...props,
        },
        slots: { default: '<div class="item">Finam: investors take profit</div>' },
        attachTo: document.body,
    });
    return w;
}

let clock = 0;
const pointer = (target: Element, type: string, x: number, t = (clock += 16)) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: 100, timeStamp: t } as PointerEventInit));

afterEach(() => {
    document.body.innerHTML = '';
});

describe('TaoxSwipeRow', () => {
    it('a pull to the start runs the start action and the row comes back', async () => {
        const w = mountRow();
        const front = w.find('.tx-swipe__front').element;
        pointer(front, 'pointerdown', 10, 0);
        pointer(front, 'pointermove', 30, 200);
        pointer(front, 'pointermove', 150, 400);
        await nextTick();
        expect(w.find('.tx-swipe__action--start').classes()).toContain('tx-swipe__action--armed');
        pointer(front, 'pointerup', 150, 600);
        await nextTick();
        expect(w.emitted('action')).toEqual([['read']]);
        expect((front as HTMLElement).style.transform).toBe('translate3d(0px, 0, 0)');
    });

    it('a pull to the end opens the actions; a button runs one and closes the row', async () => {
        const w = mountRow();
        const front = w.find('.tx-swipe__front').element;
        pointer(front, 'pointerdown', 300, 0);
        pointer(front, 'pointermove', 280, 200);
        pointer(front, 'pointermove', 130, 600);
        pointer(front, 'pointerup', 130, 1000);
        await nextTick();
        expect(w.emitted('update:open')?.[0]).toEqual([true]);
        await w.setProps({ open: true });
        expect((front as HTMLElement).style.transform).toBe('translate3d(-228px, 0, 0)');
        await w.findAll('.tx-swipe__end .tx-swipe__action')[1]!.trigger('click');
        expect(w.emitted('action')).toEqual([['mute']]);
        expect(w.emitted('update:open')?.at(-1)).toEqual([false]);
    });

    it('a long pull to the end runs the last action by itself', async () => {
        vi.useFakeTimers();
        const w = mountRow();
        const front = w.find('.tx-swipe__front').element;
        pointer(front, 'pointerdown', 340, 0);
        pointer(front, 'pointermove', 320, 200);
        pointer(front, 'pointermove', 20, 600);
        await nextTick();
        expect(w.find('.tx-swipe').classes()).toContain('tx-swipe--armed-full');
        pointer(front, 'pointerup', 20, 1000);
        await nextTick();
        expect(w.emitted('action')).toEqual([['delete']]);
        vi.useRealTimers();
    });

    it('a vertical move is the page scrolling: the row does not move; a mouse does nothing unless allowed', async () => {
        const w = mountRow();
        const front = w.find('.tx-swipe__front').element as HTMLElement;
        front.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 }));
        front.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 104, clientY: 160 }));
        await nextTick();
        expect(front.style.transform).toBe('translate3d(0px, 0, 0)');
        front.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 104, clientY: 160 }));

        front.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, pointerType: 'mouse', button: 0, clientX: 300, clientY: 100 }));
        front.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, pointerType: 'mouse', clientX: 100, clientY: 100 }));
        await nextTick();
        expect(front.style.transform).toBe('translate3d(0px, 0, 0)');
    });

    it('the keyboard: an end action that gets the focus opens the row', async () => {
        const w = mountRow();
        (w.findAll('.tx-swipe__end .tx-swipe__action')[0]!.element as HTMLElement).focus();
        await nextTick();
        expect(w.emitted('update:open')?.[0]).toEqual([true]);
    });

    it('a click at the end of a swipe does not reach the row content', async () => {
        const onClick = vi.fn();
        const w = mountRow();
        w.find('.item').element.addEventListener('click', onClick);
        const front = w.find('.tx-swipe__front').element;
        pointer(front, 'pointerdown', 300, 0);
        pointer(front, 'pointermove', 200, 300);
        pointer(front, 'pointerup', 200, 600);
        (w.find('.item').element as HTMLElement).click();
        expect(onClick).not.toHaveBeenCalled();
        (w.find('.item').element as HTMLElement).click();
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
