import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import TaoxSwipeRow from '../src/swiperow/TaoxSwipeRow.vue';
import { armedAt, clampOffset, endWidths, fullThreshold, startThreshold, SWIPE_SLIVER_PX, swipeRowRelease, type SwipeRowGeometry } from '../src/swiperow/model';

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
        // without the full swipe: a spring past the open actions, never past half their width more
        const soft = { ...g, fullSwipe: false };
        expect(clampOffset(-200, soft)).toBe(-200);
        expect(clampOffset(-228, soft)).toBe(-228);
        expect(clampOffset(-300, soft)).toBeGreaterThan(-300);
        expect(clampOffset(-300, soft)).toBeLessThan(-228);
        expect(clampOffset(-999, soft)).toBeGreaterThan(-342);
        expect(clampOffset(-999, soft)).toBeLessThan(clampOffset(-500, soft));
        expect(armedAt(clampOffset(-999, soft), soft)).toBeNull();
        expect(swipeRowRelease({ offset: -999, velocity: -2 }, soft)).toEqual({ kind: 'rest', open: true });
        // and the actions grow side by side, none shrinks
        expect(endWidths(300, soft)).toEqual([94, 94, 94]);
        expect(clampOffset(-999, g)).toBe(-360);
    });

    it('up to the open width the end actions share the pull evenly', () => {
        expect(endWidths(0, g)).toEqual([0, 0, 0]);
        expect(endWidths(114, g)).toEqual([32, 32, 32]);
        expect(endWidths(228, g)).toEqual([70, 70, 70]);
    });

    it('past it the middle ones shrink back to slivers (a fifth of the row past the full threshold) and the last takes their room', () => {
        expect(endWidths(240, g)).toEqual([65.25, 65.25, 91.5]);
        expect(endWidths(276, g)).toEqual([51, 51, 156]);
        expect(endWidths(324, g)).toEqual([SWIPE_SLIVER_PX, SWIPE_SLIVER_PX, 306 - 64]);
        expect(endWidths(340, g)).toEqual([32, 32, 322 - 64]);
    });

    it('one continuous function: no jump anywhere, the widths always fill the pull, the last never shrinks', () => {
        let prev = endWidths(1, g);
        for (let d = 2; d <= 360; d++) {
            const w = endWidths(d, g);
            expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.max(0, d - 18), 6);
            w.forEach((x, i) => expect(Math.abs(x - prev[i]!)).toBeLessThan(2));
            expect(w[2]!).toBeGreaterThanOrEqual(prev[2]! - 1e-9);
            prev = w;
        }
    });

    it('a single end action takes the whole pull', () => {
        expect(endWidths(100, { ...g, endCount: 1 })).toEqual([94]);
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

    it('the keyboard: Tab from the start action to an end one shows the end, not the start', async () => {
        const w = mountRow();
        const front = w.find('.tx-swipe__front').element as HTMLElement;
        (w.find('.tx-swipe__action--start').element as HTMLElement).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await nextTick();
        expect(front.style.transform).not.toBe('translate3d(0px, 0, 0)');
        expect(front.style.transform).not.toMatch(/translate3d\(-/);
        const endAction = w.findAll('.tx-swipe__end .tx-swipe__action')[0]!.element as HTMLElement;
        endAction.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await nextTick();
        expect(front.style.transform).toMatch(/translate3d\(-\d/);
        // and the focus on the row's own content shows neither side
        w.find('.item').element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await nextTick();
        expect(front.style.transform).toBe('translate3d(0px, 0, 0)');
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

describe('TaoxSwipeRow: the actions show without a jump', () => {
    it('the icon and the label are always laid out; only their opacity follows the width, the icon first', async () => {
        const w = mountRow();
        const labels = w.findAll('.tx-swipe__end .tx-swipe__label');
        expect(labels).toHaveLength(3);
        expect((labels[0]!.element as HTMLElement).style.opacity).toBe('0');
        const front = w.find('.tx-swipe__front').element;
        pointer(front, 'pointerdown', 300, 0);
        pointer(front, 'pointermove', 280, 200);
        pointer(front, 'pointermove', 170, 600); // ~130px for three: about 37px each
        await nextTick();
        const action = w.find('.tx-swipe__end .tx-swipe__action');
        const icon = +((action.find('.tao-icon').element as HTMLElement).style.opacity || 0);
        const label = +((action.find('.tx-swipe__label').element as HTMLElement).style.opacity || 0);
        expect(icon).toBeGreaterThan(0);
        expect(label).toBe(0);
        pointer(front, 'pointercancel', 170, 700);
    });
});

describe('TaoxSwipeRow: nothing shows behind, nothing trails', () => {
    it('the start panel is clipped and keeps no padding, so at width 0 nothing of it is left', async () => {
        const sfc = ((await import('../src/swiperow/TaoxSwipeRow.vue?raw')).default as string).replace(/\r\n/g, '\n');
        const start = /\n\.tx-swipe__start \{([^}]*)\}/.exec(sfc)?.[1] ?? '';
        expect(start).toContain('overflow: hidden');
        expect(start).not.toContain('padding');
    });

    it('under the finger the widths and the fades follow at once', async () => {
        const sfc = ((await import('../src/swiperow/TaoxSwipeRow.vue?raw')).default as string).replace(/\r\n/g, '\n');
        expect(sfc).toMatch(/\.tx-swipe--dragging \.tx-swipe__end \.tx-swipe__action \{\s*transition: background-color/);
        // the widths are continuous, so no moment needs easing / ширины непрерывны, сглаживать нечего
        expect(sfc).not.toContain('tx-swipe--morph');
        expect(sfc).toMatch(/\.tx-swipe--dragging \.tx-swipe__label,\s*\.tx-swipe--dragging \.tx-swipe__action \.tao-icon \{\s*transition: none/);
        expect(sfc).not.toMatch(/\.tx-swipe--armed-full \.tx-swipe__end \.tx-swipe__action \{\s*transition/);
    });

    it('a row without a start action does not move to the start', async () => {
        const w = mountRow({ start: undefined });
        const front = w.find('.tx-swipe__front').element as HTMLElement;
        pointer(front, 'pointerdown', 10, 0);
        pointer(front, 'pointermove', 30, 200);
        pointer(front, 'pointermove', 200, 400);
        await nextTick();
        expect(front.style.transform).toBe('translate3d(0px, 0, 0)');
        expect(w.find('.tx-swipe__start').exists()).toBe(false);
        pointer(front, 'pointercancel', 200, 500);
    });
});

describe('TaoxSwipeRow: the window loses the focus mid-pull', () => {
    it('the row lets go and goes back to rest; a late move does nothing', async () => {
        const w = mountRow();
        const front = w.find('.tx-swipe__front').element as HTMLElement;
        pointer(front, 'pointerdown', 300, 0);
        pointer(front, 'pointermove', 280, 200);
        pointer(front, 'pointermove', 150, 400);
        await nextTick();
        expect(front.style.transform).not.toBe('translate3d(0px, 0, 0)');
        window.dispatchEvent(new Event('blur'));
        await nextTick();
        expect(front.style.transform).toBe('translate3d(0px, 0, 0)');
        expect(w.find('.tx-swipe').classes()).not.toContain('tx-swipe--dragging');
        pointer(front, 'pointermove', 60, 600);
        pointer(front, 'pointerup', 60, 700);
        await nextTick();
        expect(w.emitted('action')).toBeUndefined();
    });
});

describe('swiperow background', () => {
    it('the face and the tint of the actions come from --tx-swipe-bg', async () => {
        const source = ((await import('../src/swiperow/TaoxSwipeRow.vue?raw')).default as string).replace(/\r\n/g, '\n');
        // the public names stand only in var() with a default, so a value on an ancestor reaches the row
        expect(source).toContain('--_tx-swipe-bg: var(--tx-swipe-bg, var(--tao-color-surface-raised, #1f1f1f));');
        expect(source).not.toMatch(/^\s*--tx-swipe-[a-z]+:/m);
        expect(source).toMatch(/\.tx-swipe__front \{[^}]*background: var\(--_tx-swipe-bg\);/);
        expect(source.match(/var\(--tao-color-surface-raised/g)).toHaveLength(1);
    });
});
