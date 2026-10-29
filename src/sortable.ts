import { onBeforeUnmount, onMounted, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import { createEdgeScroller } from './edgescroll';

/**
 * Reordering a list by dragging a handle, and by the keyboard. The list belongs to the app: the composable only says
 * «move from → to», the app moves the item in its array, Vue redraws.
 * The pointer: press the handle, the item lifts and follows, the others make room, the list scrolls at its edge,
 * release drops it, Esc puts it back. The keyboard: Space or Enter on the handle lifts it, ↑ ↓ (← → on a row) move it
 * one place at a time, Space / Enter drops it, Esc returns it where it started; a live region tells a screen reader.
 * The markup is the app's: `data-sortable-item` on each item (in order) and `data-sortable-handle` on a focusable handle
 * inside it (a button with `tao-grip`). While dragging the item has `data-sortable-dragging`, while lifted by the
 * keyboard `data-sortable-lifted`: style them (a shadow, a lift).
 *
 * Перестановка списка перетаскиванием за ручку и с клавиатуры. Список принадлежит приложению: composable только
 * говорит «откуда → куда», приложение переставляет элемент в своём массиве, Vue перерисовывает.
 * Указатель: нажал на ручку — элемент поднимается и едет следом, остальные расступаются, у края список прокручивается,
 * отпустил — встал, Esc — вернулся. Клавиатура: Пробел или Enter на ручке поднимает, ↑ ↓ (← → в строке) двигают на
 * одно место, Пробел / Enter ставят, Esc возвращает туда, откуда начали; живой регион сообщает скринридеру.
 * Разметка приложения: `data-sortable-item` на каждом элементе (по порядку) и `data-sortable-handle` на фокусируемой
 * ручке внутри (кнопка с `tao-grip`). Во время перетаскивания у элемента `data-sortable-dragging`, при подъёме с
 * клавиатуры `data-sortable-lifted`: оформите их (тень, подъём).
 */

export type SortableAxis = 'y' | 'x';

/**
 * Where an item dragged from `from` lands: before the first other item whose middle is past the pointer. `starts` and
 * `sizes` are the items' positions and sizes along the axis, in the order of the list, measured before the drag.
 * Куда встаёт элемент, который тащат из `from`: перед первым другим элементом, чья середина дальше указателя.
 */
export function sortTarget(pointer: number, starts: readonly number[], sizes: readonly number[], from: number): number {
    let target = 0;
    for (let i = 0; i < starts.length; i++) {
        if (i === from) continue;
        if (pointer > starts[i]! + sizes[i]! / 2) target++;
    }
    return target;
}

/**
 * How far each other item shifts to make room: the items between `from` and `to` move by the dragged item's size and
 * the gap, the rest stay.
 * На сколько сдвигается каждый другой элемент, чтобы освободить место.
 */
export function sortShifts(count: number, from: number, to: number, size: number): number[] {
    return Array.from({ length: count }, (_, i) => {
        if (i === from) return 0;
        if (from < to && i > from && i <= to) return -size;
        if (to < from && i >= to && i < from) return size;
        return 0;
    });
}

/** A copy of the list with the item moved. / Копия списка с переставленным элементом. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const next = list.slice();
    if (from < 0 || from >= next.length) return next;
    const [item] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item!);
    return next;
}

/** The texts for a screen reader; `{item}` is the item's text, `{position}` / `{count}` its place. */
export interface SortableTexts {
    lifted: string;
    moved: string;
    dropped: string;
    canceled: string;
}

export const sortableTextsEn: SortableTexts = {
    lifted: 'Picked up {item}, position {position} of {count}. Use the arrow keys to move, Space to drop, Escape to cancel.',
    moved: '{item}, position {position} of {count}.',
    dropped: '{item} dropped at position {position} of {count}.',
    canceled: 'Move canceled. {item} is back at position {position} of {count}.',
};

export const sortableTextsRu: SortableTexts = {
    lifted: '{item} поднят, место {position} из {count}. Стрелки двигают, Пробел ставит, Escape отменяет.',
    moved: '{item}, место {position} из {count}.',
    dropped: '{item} поставлен на место {position} из {count}.',
    canceled: 'Перенос отменён. {item} снова на месте {position} из {count}.',
};

export interface SortableOptions {
    /**
     * The item moved: put it at `to` in your array (`list.value = moveItem(list.value, from, to)`).
     * Элемент переставлен: поставьте его на место `to` в своём массиве.
     */
    onMove(from: number, to: number): void;
    axis?: SortableAxis;
    /** Off while true (a filtered list, a read-only view). / Выключено, пока true. */
    disabled?: MaybeRefOrGetter<boolean>;
    /** The texts for a screen reader; a function is read each time, so it follows the language. / Тексты для скринридера. */
    texts?: SortableTexts | (() => SortableTexts);
    /** The text of an item for those messages; its text content by default. / Текст элемента для сообщений. */
    itemLabel?(element: HTMLElement, index: number): string;
}

const ITEM = '[data-sortable-item]';
const HANDLE = '[data-sortable-handle]';

function scrollParent(el: HTMLElement, axis: SortableAxis): HTMLElement | null {
    for (let p: HTMLElement | null = el; p; p = p.parentElement) {
        const style = getComputedStyle(p);
        const overflow = axis === 'y' ? style.overflowY : style.overflowX;
        if (/(auto|scroll)/.test(overflow) && (axis === 'y' ? p.scrollHeight > p.clientHeight : p.scrollWidth > p.clientWidth)) return p;
    }
    return null;
}

export function useSortable(container: Ref<HTMLElement | null>, options: SortableOptions) {
    const axis = options.axis ?? 'y';
    const dragging = ref<number | null>(null);
    const lifted = ref<number | null>(null);
    const texts = () => (typeof options.texts === 'function' ? options.texts() : options.texts) ?? sortableTextsEn;

    // a live region of our own, so a screen reader hears where the item is / свой живой регион для скринридера
    let live: HTMLElement | null = null;
    function announce(template: string, index: number) {
        if (!live) return;
        const els = items();
        const label = els[index] ? (options.itemLabel?.(els[index]!, index) ?? els[index]!.textContent?.trim() ?? '') : '';
        live.textContent = template
            .replace('{item}', label)
            .replace('{position}', String(index + 1))
            .replace('{count}', String(els.length));
    }

    const items = () => (container.value ? Array.from(container.value.querySelectorAll<HTMLElement>(ITEM)) : []);
    const along = (r: DOMRect) => (axis === 'y' ? r.top : r.left);
    const sizeOf = (r: DOMRect) => (axis === 'y' ? r.height : r.width);
    const pointerOf = (e: PointerEvent) => (axis === 'y' ? e.clientY : e.clientX);

    //---]>
    // the pointer / указатель

    let drag: {
        from: number;
        to: number;
        start: number;
        scroll0: number;
        starts: number[];
        sizes: number[];
        step: number;
        els: HTMLElement[];
        handle: HTMLElement;
        pointerId: number;
        last: [number, number];
        scroller: HTMLElement | null;
    } | null = null;

    const scrollPos = (s: HTMLElement | null) => (s ? (axis === 'y' ? s.scrollTop : s.scrollLeft) : axis === 'y' ? window.scrollY : window.scrollX);

    const edge = createEdgeScroller({
        bounds: () => {
            if (!drag) return null;
            if (drag.scroller) return drag.scroller.getBoundingClientRect();
            return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        },
        pointer: () => drag?.last ?? [0, 0],
        enabled: () => drag !== null,
        onScroll: (dx, dy) => {
            if (!drag) return;
            const d = axis === 'y' ? dy : dx;
            if (drag.scroller) {
                if (axis === 'y') drag.scroller.scrollTop += d;
                else drag.scroller.scrollLeft += d;
            } else {
                window.scrollBy(axis === 'y' ? 0 : d, axis === 'y' ? d : 0);
            }
            follow();
        },
    });

    function follow() {
        if (!drag) return;
        const pointer = (axis === 'y' ? drag.last[1] : drag.last[0]) + scrollPos(drag.scroller) - drag.scroll0;
        // the item stays within the list: past its ends it would make the scrolled area longer, the edge scroll would
        // follow it, and the two would run away together
        // элемент не выходит за пределы списка: за краями он удлинял бы прокручиваемую область, прокрутка у края шла бы
        // за ним, и они убегали бы вместе
        const { starts, sizes, from } = drag;
        const last = starts.length - 1;
        const min = starts[0]! - starts[from]!;
        const max = starts[last]! + sizes[last]! - (starts[from]! + sizes[from]!);
        // the place follows the pointer itself, only what is drawn is held in: past the end it is the last place
        // место следует за самим указателем, ограничено только то, что нарисовано: за краем — последнее место
        const raw = pointer - drag.start;
        const offset = Math.min(max, Math.max(min, raw));
        const to = sortTarget(starts[from]! + sizes[from]! / 2 + raw, starts, sizes, from);
        drag.to = to;
        const shifts = sortShifts(drag.els.length, drag.from, to, drag.step);
        drag.els.forEach((el, i) => {
            const value = i === drag!.from ? offset : shifts[i]!;
            el.style.transform = value ? (axis === 'y' ? `translateY(${value}px)` : `translateX(${value}px)`) : '';
        });
    }

    function onPointerDown(event: PointerEvent) {
        if (toValue(options.disabled) || event.button !== 0 || lifted.value !== null) return;
        const handle = (event.target as HTMLElement).closest<HTMLElement>(HANDLE);
        if (!handle || !container.value?.contains(handle)) return;
        const els = items();
        const from = els.findIndex((el) => el.contains(handle));
        if (from < 0) return;
        event.preventDefault();

        const rects = els.map((el) => el.getBoundingClientRect());
        const scroller = scrollParent(container.value, axis);
        // the others make room by the dragged item's size and the gap between items
        // остальные расступаются на размер перетаскиваемого элемента и зазор между элементами
        const gap = els.length > 1 ? Math.max(0, along(rects[1]!) - along(rects[0]!) - sizeOf(rects[0]!)) : 0;
        const step = sizeOf(rects[from]!) + gap;
        drag = {
            from,
            to: from,
            start: pointerOf(event),
            scroll0: scrollPos(scroller),
            starts: rects.map(along),
            sizes: rects.map(sizeOf),
            step,
            els,
            handle,
            pointerId: event.pointerId,
            last: [event.clientX, event.clientY],
            scroller,
        };
        try {
            // the moves come to the handle even off the list; optional, the document listens anyway
            // движения приходят на ручку и вне списка; не обязательно, документ всё равно слушает
            handle.setPointerCapture?.(event.pointerId);
        } catch {
            /* a pointer the browser does not know (a synthetic event) / указатель, неизвестный браузеру */
        }
        els.forEach((el, i) => {
            el.style.transition = i === from ? 'none' : 'transform 150ms ease';
            if (i === from) {
                el.style.position = 'relative';
                el.style.zIndex = '1';
                el.setAttribute('data-sortable-dragging', '');
            }
        });
        dragging.value = from;
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerCancel);
        document.addEventListener('keydown', onDragKey, true);
    }

    function onPointerMove(event: PointerEvent) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag.last = [event.clientX, event.clientY];
        follow();
        edge.kick();
    }

    function finish(commit: boolean) {
        if (!drag) return;
        const { from, to, els, handle, pointerId } = drag;
        drag = null;
        edge.stop();
        try {
            handle.releasePointerCapture?.(pointerId);
        } catch {
            /* already released / уже отпущен */
        }
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);
        document.removeEventListener('keydown', onDragKey, true);
        for (const el of els) {
            el.style.transform = '';
            el.style.transition = '';
            el.style.position = '';
            el.style.zIndex = '';
            el.removeAttribute('data-sortable-dragging');
        }
        dragging.value = null;
        if (commit && to !== from) options.onMove(from, to);
    }

    const onPointerUp = (event: PointerEvent) => {
        if (drag && event.pointerId === drag.pointerId) finish(true);
    };
    const onPointerCancel = () => finish(false);
    function onDragKey(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            finish(false);
        }
    }

    //---]>
    // the keyboard / клавиатура

    let liftedFrom = 0;

    function focusHandle(index: number) {
        // after the app moved the item and Vue redrew the list / после того как приложение переставило элемент
        requestAnimationFrame(() => items()[index]?.querySelector<HTMLElement>(HANDLE)?.focus());
    }

    function setLifted(index: number | null) {
        items().forEach((el, i) => {
            if (i === index) el.setAttribute('data-sortable-lifted', '');
            else el.removeAttribute('data-sortable-lifted');
        });
        lifted.value = index;
    }

    function onKeydown(event: KeyboardEvent) {
        if (toValue(options.disabled) || drag) return;
        const handle = (event.target as HTMLElement).closest<HTMLElement>(HANDLE);
        if (!handle || !container.value?.contains(handle)) return;
        const els = items();
        const index = els.findIndex((el) => el.contains(handle));
        if (index < 0) return;

        const pick = event.key === ' ' || event.key === 'Enter';
        if (lifted.value === null) {
            if (!pick) return;
            event.preventDefault();
            liftedFrom = index;
            setLifted(index);
            announce(texts().lifted, index);
            return;
        }

        const back = axis === 'y' ? 'ArrowUp' : 'ArrowLeft';
        const forward = axis === 'y' ? 'ArrowDown' : 'ArrowRight';
        if (event.key === back || event.key === forward) {
            event.preventDefault();
            const to = index + (event.key === forward ? 1 : -1);
            if (to < 0 || to >= els.length) return;
            options.onMove(index, to);
            requestAnimationFrame(() => {
                setLifted(to);
                announce(texts().moved, to);
            });
            focusHandle(to);
        } else if (pick) {
            event.preventDefault();
            setLifted(null);
            announce(texts().dropped, index);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (index !== liftedFrom) {
                options.onMove(index, liftedFrom);
                focusHandle(liftedFrom);
            }
            setLifted(null);
            requestAnimationFrame(() => announce(texts().canceled, liftedFrom));
        } else if (event.key === 'Tab') {
            // leaving the handle drops the item where it is / уход с ручки ставит элемент на месте
            setLifted(null);
        }
    }

    function onFocusOut(event: FocusEvent) {
        if (lifted.value === null) return;
        const next = event.relatedTarget as HTMLElement | null;
        // focus moving to the same item's handle after a move is not a leave / переход фокуса на ручку после переноса
        if (next?.closest(HANDLE) && container.value?.contains(next)) return;
        if (next) setLifted(null);
    }

    onMounted(() => {
        const el = container.value;
        if (!el) return;
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('keydown', onKeydown);
        el.addEventListener('focusout', onFocusOut);
        live = document.createElement('div');
        live.setAttribute('aria-live', 'assertive');
        live.setAttribute('aria-atomic', 'true');
        live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
        document.body.appendChild(live);
    });

    onBeforeUnmount(() => {
        finish(false);
        const el = container.value;
        el?.removeEventListener('pointerdown', onPointerDown);
        el?.removeEventListener('keydown', onKeydown);
        el?.removeEventListener('focusout', onFocusOut);
        live?.remove();
        live = null;
    });

    return {
        /** The index being dragged by the pointer, or null. / Индекс, который тащат указателем, или null. */
        dragging,
        /** The index lifted by the keyboard, or null. / Индекс, поднятый с клавиатуры, или null. */
        lifted,
        /** Stops a pointer drag without moving. / Прерывает перетаскивание без переноса. */
        cancel: () => finish(false),
    };
}
