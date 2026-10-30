<script lang="ts" setup>
import { TaoIcon, toneClass } from '@1337exp/taoui';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { listenFocusLoss, SwipeTracker, type Sample } from '../gestures';
import { armedAt, clampOffset, endOpenWidth, endWidths, startThreshold, swipeRowRelease, type SwipeRowAction, type SwipeRowGeometry } from './model';

// A row of a list that a finger slides sideways, as in a mail app. To the start (right): one action behind it, run on
// release past its threshold, and the row comes back (read / unread). To the end (left): the actions grow out and the
// row stays open on them; pulled far, the last one takes the row and runs on release (delete). The gesture (a swipe or
// a scroll, the release speed, where to rest) is TaoUX's gestures; the actions are TaoUI icons and tones.
// Строка списка, которую палец сдвигает вбок, как в почте. Вправо: одно действие позади, выполняется при отпускании
// дальше порога, строка возвращается (прочитано / не прочитано). Влево: действия вырастают, и строка остаётся открытой
// на них; если тянуть далеко, последнее занимает строку и выполняется при отпускании (удалить).
const props = withDefaults(
    defineProps<{
        /** The action behind the row on a pull to the start. / Действие позади строки при свайпе вправо. */
        start?: SwipeRowAction;
        /** The actions on a pull to the end, in order; the last one is the full swipe. / Действия при свайпе влево; последнее — длинный свайп. */
        end?: SwipeRowAction[];
        /** The width of each end action when the row is open, px. / Ширина каждого действия справа в открытой строке. */
        actionWidth?: number;
        /** Pulling far to the end runs the last action. / Длинный свайп влево выполняет последнее действие. */
        fullSwipe?: boolean;
        /** A mouse can drag it too (a touch screen always can). / Тянуть можно и мышью (палец может всегда). */
        mouse?: boolean;
        disabled?: boolean;
        /**
         * The action buttons are Tab stops (each shows its side when it gets the focus). Turn it off when the app has
         * its own keyboard path to the same actions (arrows, Delete, a menu key): the buttons leave the Tab order and
         * still work by a click or a swipe.
         * Кнопки действий — остановки Tab (каждая показывает свою сторону при фокусе). Выключите, когда у приложения
         * свой путь к тем же действиям с клавиатуры (стрелки, Delete, клавиша меню): кнопки уходят из порядка Tab и
         * по-прежнему работают нажатием и свайпом.
         */
        tabbable?: boolean;
    }>(),
    { start: undefined, end: () => [], actionWidth: 76, fullSwipe: true, mouse: false, disabled: false, tabbable: true },
);

const emit = defineEmits<{
    /** An action was chosen: by a button, a pull past the threshold, or the full swipe. / Выбрано действие. */
    action: [id: string];
}>();

/** The end actions are shown. / Действия справа открыты. */
const open = defineModel<boolean>('open', { default: false });

defineSlots<{
    default?(): unknown;
    /** Your own face of an action. / Свой вид действия. */
    action?(props: { action: SwipeRowAction; armed: boolean; side: 'start' | 'end'; width: number }): unknown;
}>();

const root = ref<HTMLElement | null>(null);
const width = ref(320);
const dragging = ref(false);
const drag = ref(0);
// a moment after a full swipe: the row stays off to the side while the app removes it
// миг после длинного свайпа: строка остаётся сдвинутой, пока приложение её убирает
const gone = ref(false);
const startShown = ref(false);

const geometry = computed<SwipeRowGeometry>(() => ({
    width: width.value,
    actionWidth: props.actionWidth,
    endCount: props.end.length,
    hasStart: Boolean(props.start),
    fullSwipe: props.fullSwipe,
}));

const rest = computed(() => {
    if (gone.value) return -width.value;
    if (startShown.value) return startThreshold(geometry.value);
    return open.value ? -endOpenWidth(geometry.value) : 0;
});
const offset = computed(() => (dragging.value ? drag.value : rest.value));
const armed = computed(() => (dragging.value ? armedAt(drag.value, geometry.value) : null));
// gone (the full swipe ran): the last action holds the whole row while the app removes it / последнее держит всю строку
const widths = computed(() => endWidths(gone.value ? width.value : Math.max(0, -offset.value), geometry.value));
const lastEnd = computed(() => props.end[props.end.length - 1]);

// a short buzz where the phone can, when an action becomes armed / короткая вибрация там, где телефон умеет
watch(armed, (next) => {
    if (next && typeof navigator !== 'undefined') navigator.vibrate?.(8);
});

//---]>
// the gesture / жест

const tracker = new SwipeTracker('x');
let pointerId: number | null = null;
let swiped = false;
const sample = (e: PointerEvent): Sample => ({ x: e.clientX, y: e.clientY, t: e.timeStamp });

// the window lost the focus while the press was held (Alt-Tab, a screenshot): its pointerup may never come, so the row
// lets go and settles where it rested, instead of staying stuck to a finger that is gone
// окно потеряло фокус во время нажатия: pointerup может не прийти, поэтому строка отпускается и встаёт на место
let stopFocusLoss: (() => void) | undefined;

function release() {
    stopFocusLoss?.();
    stopFocusLoss = undefined;
    pointerId = null;
    dragging.value = false;
}

function onDown(e: PointerEvent) {
    if (props.disabled || pointerId !== null || (e.pointerType === 'mouse' && (!props.mouse || e.button !== 0))) return;
    pointerId = e.pointerId;
    swiped = false;
    startShown.value = false;
    tracker.down(sample(e), rest.value);
    stopFocusLoss = listenFocusLoss(() => {
        tracker.cancel();
        release();
    });
}

function onMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    const step = tracker.move(sample(e));
    if (step.intent !== 'swipe') return;
    if (!dragging.value) {
        dragging.value = true;
        try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
            /* a pointer the browser does not know / неизвестный браузеру указатель */
        }
    }
    swiped = true;
    drag.value = clampOffset(step.offset, geometry.value);
}

function onUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    const result = tracker.up(sample(e));
    release();
    if (!result) return;
    const outcome = swipeRowRelease(result, geometry.value);
    if (outcome.kind === 'start' && props.start) {
        open.value = false;
        emit('action', props.start.id);
    } else if (outcome.kind === 'full' && lastEnd.value) {
        gone.value = true;
        emit('action', lastEnd.value.id);
        // the app removes the row; if it keeps it (an archive that failed), it comes back
        // приложение убирает строку; если оставит, она вернётся
        setTimeout(() => {
            gone.value = false;
            open.value = false;
        }, 400);
    } else if (outcome.kind === 'rest') {
        open.value = outcome.open;
    }
}

function onCancel(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    tracker.cancel();
    release();
}

// the end of a swipe also fires a click on the row: it must not open the item
// конец свайпа даёт и click по строке: он не должен открывать элемент
function onClickCapture(e: MouseEvent) {
    if (swiped) {
        e.stopPropagation();
        e.preventDefault();
        swiped = false;
    }
}

function run(action: SwipeRowAction) {
    open.value = false;
    startShown.value = false;
    emit('action', action.id);
}

//---]>
// the keyboard: an action button that gets the focus shows its side and only its side (Tab from the start action to an
// end one used to keep the start shown, which wins, and the focused button stayed hidden under the row); the focus on
// the row's own content shows neither
// клавиатура: кнопка действия, получившая фокус, показывает свою сторону и только её (Tab с левого действия на правое
// оставлял показанной левую сторону, а она главнее, и кнопка с фокусом пряталась под строкой); фокус на содержимом
// строки не показывает ни одну

function onFocusIn(e: FocusEvent) {
    const side = (e.target as HTMLElement).closest<HTMLElement>('[data-side]')?.dataset.side;
    startShown.value = side === 'start';
    open.value = side === 'end';
}

function onFocusOut(e: FocusEvent) {
    if (root.value?.contains(e.relatedTarget as Node | null)) return;
    startShown.value = false;
    open.value = false;
}

// an open row closes on a touch outside it / открытая строка закрывается касанием вне её
function onOutside(e: PointerEvent) {
    if (!root.value?.contains(e.target as Node)) open.value = false;
}
watch(open, (isOpen) => {
    if (isOpen) document.addEventListener('pointerdown', onOutside, true);
    else document.removeEventListener('pointerdown', onOutside, true);
});

let resize: ResizeObserver | undefined;
onMounted(() => {
    if (!root.value) return;
    width.value = root.value.clientWidth || width.value;
    if (typeof ResizeObserver !== 'undefined') {
        resize = new ResizeObserver(() => (width.value = root.value?.clientWidth || width.value));
        resize.observe(root.value);
    }
});
onBeforeUnmount(() => {
    stopFocusLoss?.();
    resize?.disconnect();
    document.removeEventListener('pointerdown', onOutside, true);
});

const startWidth = computed(() => Math.max(0, offset.value));

/*
 * The icon and the label always stand where they end up, so nothing pops in and the heights never jump; only their
 * opacity follows the width of their block. The icon comes first, the label later, when the block is wide enough to
 * hold it.
 * Иконка и подпись всегда стоят на своих итоговых местах, поэтому ничего не выскакивает и высоты не прыгают; от ширины
 * блока зависит только их прозрачность. Иконка проявляется раньше, подпись позже, когда блок уже вмещает её.
 */
const fade = (width: number, from: number, span: number) => Math.min(1, Math.max(0, (width - from) / span));
const endIcon = (w: number) => fade(w, 22, 20);
const endLabel = (w: number) => fade(w, 50, 18);
const startIcon = (w: number) => fade(w, 36, 24);
const startLabel = (w: number) => fade(w, 84, 28);
</script>

<template>
    <div
        ref="root"
        class="tx-swipe"
        :class="{ 'tx-swipe--dragging': dragging, 'tx-swipe--armed-full': armed === 'full' || gone, 'tx-swipe--mouse': mouse }"
        @focusin="onFocusIn"
        @focusout="onFocusOut"
    >
        <div v-if="start" class="tx-swipe__start" data-side="start" :style="{ width: `${startWidth}px` }">
            <button
                type="button"
                class="tx-swipe__action tx-swipe__action--start"
                :class="[toneClass(start.tone ?? 'neutral'), { 'tx-swipe__action--armed': armed === 'start' }]"
                :tabindex="tabbable ? undefined : -1"
                :aria-label="start.label"
                @click="run(start)"
            >
                <slot name="action" :action="start" :armed="armed === 'start'" side="start" :width="startWidth">
                    <TaoIcon v-if="start.icon" :name="start.icon" :size="20" :style="{ opacity: startIcon(startWidth) }" />
                    <span class="tx-swipe__label" :style="{ opacity: startLabel(startWidth) }">{{ start.label }}</span>
                </slot>
            </button>
        </div>

        <div v-if="end.length" class="tx-swipe__end" data-side="end">
            <button
                v-for="(action, i) in end"
                :key="action.id"
                type="button"
                class="tx-swipe__action"
                :class="[toneClass(action.tone ?? 'neutral'), { 'tx-swipe__action--armed': i === end.length - 1 && (armed === 'full' || gone) }]"
                :style="{ width: `${widths[i]}px` }"
                :tabindex="tabbable ? undefined : -1"
                :aria-label="action.label"
                @click="run(action)"
            >
                <slot name="action" :action="action" :armed="i === end.length - 1 && armed === 'full'" side="end" :width="widths[i] ?? 0">
                    <TaoIcon v-if="action.icon" :name="action.icon" :size="20" :style="{ opacity: endIcon(widths[i] ?? 0) }" />
                    <span class="tx-swipe__label" :style="{ opacity: endLabel(widths[i] ?? 0) }">{{ action.label }}</span>
                </slot>
            </button>
        </div>

        <div
            class="tx-swipe__front"
            :style="{ transform: `translate3d(${offset}px, 0, 0)` }"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onCancel"
            @click.capture="onClickCapture"
        >
            <slot />
        </div>
    </div>
</template>

<style>
/*
 * Variables, on the row or on any element around it (the defaults stand in var(), so an ancestor's value reaches here):
 *   --tx-swipe-bg      the face of the row and the ground its actions are tinted on (the raised surface; a row right on
 *                      the page: var(--tao-color-bg))
 *   --tx-swipe-radius  the corners of the row (the panel radius)
 *   --tx-swipe-gap     the gap between the end actions (6px)
 * Переменные — на строке или на любом элементе вокруг неё (значения по умолчанию стоят в var(), поэтому значение предка
 * доходит сюда): --tx-swipe-bg — лицо строки и основа подкраски действий; --tx-swipe-radius — углы; --tx-swipe-gap —
 * зазор между действиями справа.
 */
.tx-swipe {
    /* a stacking context of its own: the z-index of the face counts inside the row only, so a floating bar or a glass
       panel over the list stays over its rows
       свой контекст наложения: z-index лица действует только внутри строки, поэтому плавающая панель или стекло над
       списком остаются поверх его строк */
    isolation: isolate;
    --_tx-swipe-gap: var(--tx-swipe-gap, 6px);
    --_tx-swipe-radius: var(--tx-swipe-radius, var(--tao-radius-panel, 12px));
    --_tx-swipe-bg: var(--tx-swipe-bg, var(--tao-color-surface-raised, #1f1f1f));
    position: relative;
    overflow: hidden;
    border-radius: var(--_tx-swipe-radius);
}

.tx-swipe__front {
    position: relative;
    z-index: 1;
    /* the page keeps the vertical scroll, the tracker takes the sideways pull / вертикаль — странице, вбок — трекеру */
    touch-action: pan-y;
    border-radius: inherit;
    background: var(--_tx-swipe-bg);
    transition: transform 0.22s ease;
}

.tx-swipe--dragging .tx-swipe__front {
    transition: none;
}

/* a pull is not a selection: while it runs nothing is selected; with `mouse` the mouse drags the row, so its text is
   not selected by a press-and-move at all (a finger selects with a long press, which a swipe is not)
   протяжка — не выделение: пока она идёт, ничего не выделяется; с `mouse` мышь тянет строку, поэтому её текст не
   выделяется нажатием с движением вовсе (палец выделяет долгим нажатием, а свайп им не является) */
.tx-swipe--dragging,
.tx-swipe--mouse .tx-swipe__front {
    -webkit-user-select: none;
    user-select: none;
}

.tx-swipe__start,
.tx-swipe__end {
    position: absolute;
    inset-block: 0;
    display: flex;
    gap: var(--_tx-swipe-gap);
}

/* clipped, with the gap as the button's margin: at width 0 nothing of it is left, while the keyboard can still reach it
   (a padding kept a 6px box, and the button showed at the start edge of a row pulled the other way)
   с обрезкой, а зазор — поле кнопки: при ширине 0 от неё ничего не остаётся, а клавиатура всё равно до неё доходит
   (padding оставлял коробку в 6px, и кнопка виднелась у начального края строки, которую тянули в другую сторону) */
.tx-swipe__start {
    inset-inline-start: 0;
    overflow: hidden;
    transition: width 0.22s ease;
}

.tx-swipe__end {
    inset-inline-end: 0;
    justify-content: flex-end;
}

.tx-swipe--dragging .tx-swipe__start {
    transition: none;
}

.tx-swipe__action {
    /* a button, not text: a press or a pull over it selects nothing and calls no callout
       кнопка, а не текст: нажатие или протяжка по ней ничего не выделяет и не вызывает меню */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    display: inline-flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* the icon and the label read as one: a small gap, not pressed to the edges of a short row
       иконка и подпись читаются вместе: небольшой зазор, а не прижаты к краям невысокой строки */
    gap: 2px;
    min-width: 0;
    height: 100%;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--_tx-swipe-radius);
    background: color-mix(in srgb, var(--tao-tone) 22%, var(--_tx-swipe-bg));
    color: var(--tao-tone-text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    transition:
        width 0.15s ease,
        background-color 0.15s ease;
}

/* under the finger the actions follow the row in the same frame: no width easing, or they trail behind it
   под пальцем действия идут за строкой в том же кадре: без сглаживания ширины, иначе они отстают */
.tx-swipe--dragging .tx-swipe__end .tx-swipe__action {
    transition: background-color 0.15s ease;
}

/* the start action is one line, from the start edge: the icon at a fixed place, the label after it
   действие слева — одна строка от начального края: иконка на постоянном месте, подпись за ней */
.tx-swipe__action--start {
    flex: 1;
    flex-direction: row;
    justify-content: flex-start;
    gap: 10px;
    min-width: 0;
    margin-inline-end: var(--_tx-swipe-gap);
    padding-inline-start: 22px;
}

.tx-swipe__action--armed {
    background: color-mix(in srgb, var(--tao-tone) 45%, var(--_tx-swipe-bg));
    color: var(--tao-color-text-strong);
}

.tx-swipe__action:focus-visible {
    outline: 2px solid var(--tao-color-accent);
    outline-offset: -2px;
}

/* never squeezed or cut with «…»: a label wider than its block stays whole and centred, the block clips it, and it is
   still transparent then; so the line never changes as the block grows
   подпись не сжимается и не обрезается «…»: шире блока — остаётся целой и по центру, блок её обрезает, а она в это
   время ещё прозрачна; поэтому строка не меняется, пока блок растёт */
.tx-swipe__label {
    flex: none;
    white-space: nowrap;
    line-height: 1.2;
}

.tx-swipe__action :is(svg, .tao-icon) {
    flex: none;
}

/* a short fade, so a row settling by itself shows them softly too; under the finger none
   короткий переход: строка, доезжающая сама, тоже их проявляет мягко; под пальцем без него */
.tx-swipe__label,
.tx-swipe__action .tao-icon {
    transition: opacity 0.12s ease;
}

.tx-swipe--dragging .tx-swipe__label,
.tx-swipe--dragging .tx-swipe__action .tao-icon {
    transition: none;
}

@media (prefers-reduced-motion: reduce) {
    .tx-swipe__front,
    .tx-swipe__start,
    .tx-swipe__action,
    .tx-swipe__label,
    .tx-swipe__action .tao-icon {
        transition: none;
    }
}
</style>
