<script lang="ts" setup>
import { nextTick, ref } from 'vue';
import { addStop, DEFAULT_PRECISION, gradientCss, moveStop, pickFromStack, removeStop, stackAround, toSrgb, type GradientStop } from './ops';

const props = withDefaults(
    defineProps<{
        /** Остановки по возрастанию t (минимум одна). */
        modelValue: readonly GradientStop[];
        /** Индекс выбранной остановки. */
        selected?: number;
        /** Подсказка при наведении на полосу. */
        hint?: string;
        /** Знаков после запятой у t и непрозрачности в том, что компонент отдаёт; `null` не обрезает. По умолчанию три; компоненты цвета получают на два знака больше. */
        precision?: number | null;
        /** Шаг стрелки с клавиатуры по t (Shift: в 10 раз крупнее). */
        keyStep?: number;
        /** Подпись остановки для скринридеров; по умолчанию «Stop 1». */
        stopLabel?: (index: number, stop: GradientStop) => string;
    }>(),
    { selected: 0, precision: DEFAULT_PRECISION, keyStep: 0.01 },
);
const emit = defineEmits<{
    'update:modelValue': [value: GradientStop[]];
    'update:selected': [index: number];
    /** Правка закончена (отпустили, добавили, убрали): момент для записи в историю. */
    commit: [];
}>();

const bar = ref<HTMLElement | null>(null);

function tAt(e: PointerEvent | MouseEvent): number {
    const r = bar.value!.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
}

/** Ручки ближе этого расстояния (px) считаются наложенными друг на друга. */
const STACK_PX = 7;
/** Сдвиг указателя (px), после которого понятно, в какую сторону тащат стопку. */
const PICK_PX = 3;

let dragging = -1;
/** Нажали на стопку наложенных ручек: какую из них взять, решает первое движение. */
let pending: { cluster: number[]; x: number } | null = null;

function onStopDown(e: PointerEvent, i: number) {
    if (e.altKey) {
        emit('update:modelValue', removeStop(props.modelValue, i));
        emit('update:selected', 0);
        emit('commit');
        return;
    }
    emit('update:selected', i);
    try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
        // указатель уже ушёл или захват недоступен: тянуть можно и без него
    }

    const width = bar.value!.getBoundingClientRect().width;
    const cluster = stackAround(props.modelValue, i, width, STACK_PX);
    dragging = i;
    // Стопка наложенных ручек: какую из них взять, решит направление первого движения
    if (cluster.length > 1) pending = { cluster, x: e.clientX };
}

function onMove(e: PointerEvent) {
    if (dragging < 0) return;
    if (pending) {
        const dx = e.clientX - pending.x;
        if (Math.abs(dx) < PICK_PX) return;
        dragging = pickFromStack(pending.cluster, dx);
        pending = null;
        emit('update:selected', dragging);
    }
    emit('update:modelValue', moveStop(props.modelValue, dragging, tAt(e), props.precision));
}

function onUp() {
    if (dragging < 0) return;
    const moved = pending === null;
    dragging = -1;
    pending = null;
    if (moved) emit('commit');
}

const stopColor = (s: GradientStop) => `rgb(${s.color.map((c) => Math.round(255 * toSrgb(Math.min(1, Math.max(0, c))))).join(' ')})`;

/** Клавиши остановки (фокус на ней): стрелки двигают по t, Home/End в начало и конец, Insert добавляет, Delete убирает. */
function onStopKey(e: KeyboardEvent, i: number) {
    const stop = props.modelValue[i];
    if (!stop) return;
    const fine = props.keyStep * (e.shiftKey ? 10 : 1);

    let to: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = stop.t - fine;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = stop.t + fine;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = 1;

    if (to !== null) {
        e.preventDefault();
        emit('update:modelValue', moveStop(props.modelValue, i, to, props.precision));
        emit('commit');
    } else if (e.key === 'Insert') {
        // между этой остановкой и следующей (у последней: между ней и предыдущей), с цветом градиента в этой точке
        e.preventDefault();
        const other = props.modelValue[i + 1] ?? props.modelValue[i - 1];
        if (!other) return;
        const r = addStop(props.modelValue, (stop.t + other.t) / 2, props.precision);
        emit('update:modelValue', r.stops);
        emit('update:selected', r.index);
        emit('commit');
        focusStop(r.index);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const next = Math.max(0, i - 1);
        emit('update:modelValue', removeStop(props.modelValue, i));
        emit('update:selected', next);
        emit('commit');
        focusStop(next);
    }
}

/** Фокус на ручку `i` после перерисовки: клавиши идут к той, что выбрана, и фокус не должен оставаться на старой. */
function focusStop(i: number) {
    void nextTick(() => bar.value?.querySelectorAll<HTMLElement>('.tx-gradient-stop')[i]?.focus());
}

const labelOf = (i: number, s: GradientStop) => (props.stopLabel ? props.stopLabel(i, s) : `Stop ${i + 1}`);

function onBarClick(e: MouseEvent) {
    if (e.target !== bar.value) return;
    const r = addStop(props.modelValue, tAt(e), props.precision);
    emit('update:modelValue', r.stops);
    emit('update:selected', r.index);
    emit('commit');
}
</script>

<template>
    <div ref="bar" class="tx-gradient" :style="{ backgroundImage: gradientCss(modelValue) }" :title="hint" @click="onBarClick">
        <span
            v-for="(s, i) in modelValue"
            :key="i"
            class="tx-gradient-stop"
            :class="{ on: i === selected }"
            :style="{ left: `${s.t * 100}%`, color: stopColor(s) }"
            tabindex="0"
            role="slider"
            aria-orientation="horizontal"
            aria-valuemin="0"
            aria-valuemax="1"
            :aria-valuenow="s.t"
            :aria-valuetext="`${Math.round(s.t * 100)}%`"
            :aria-label="labelOf(i, s)"
            @focus="emit('update:selected', i)"
            @keydown="onStopKey($event, i)"
            @pointerdown.stop="onStopDown($event, i)"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
        >
            <!-- залитый треугольник цвета остановки, остриём к полосе: на светлом и тёмном фоне его видно по обводке -->
            <svg viewBox="0 0 12 12">
                <polygon class="tx-gradient-halo" points="6,0.5 11.5,11.5 0.5,11.5" />
                <polygon points="6,0.5 11.5,11.5 0.5,11.5" />
            </svg>
        </span>
    </div>
</template>

<style>
/*
 * Настройка через CSS-переменные на любом предке:
 *   --tx-gradient-border, --tx-gradient-stop-border, --tx-gradient-stop-outline, --tx-gradient-accent.
 */
.tx-gradient {
    position: relative;
    height: 22px;
    margin-bottom: 20px; /* место под ручки остановок и отметку выбранной */
    border: 1px solid var(--tx-gradient-border, #2a2d33);
    border-radius: 4px;
    /* шахматка под полосой показывает прозрачность */
    background-color: #fff;
    background-size: 100% 100%, 12px 12px;
    cursor: crosshair;
}

.tx-gradient-stop {
    position: absolute;
    top: calc(100% - 2px);
    width: 14px;
    height: 14px;
    margin-left: -7px;
    cursor: grab;
}

.tx-gradient-stop:active {
    cursor: grabbing;
}

.tx-gradient-stop:focus {
    outline: none;
}

/* фокус с клавиатуры: свечение акцентного цвета вокруг треугольника */
.tx-gradient-stop:focus-visible svg {
    filter: drop-shadow(0 0 3px var(--tx-gradient-accent, #4fc3f7));
}

.tx-gradient-stop svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
}

/* тёмная обводка в 1px снаружи основной: ручка видна и на светлых цветах полосы за ней */
.tx-gradient-stop .tx-gradient-halo {
    fill: none;
    stroke: var(--tx-gradient-stop-outline, rgba(0, 0, 0, 0.85));
    stroke-width: 3.5;
    stroke-linejoin: round;
}

.tx-gradient-stop polygon:not(.tx-gradient-halo) {
    fill: currentColor; /* цвет остановки задаёт сам компонент */
    stroke: var(--tx-gradient-stop-border, #5a606b);
    stroke-width: 1.5;
    stroke-linejoin: round;
}

/*
 * Выбранная ручка: выше остальных (в стопке не прячется), чуть крупнее и с акцентной черточкой под ней.
 * Заливка остаётся цветом остановки: акцент не должен спорить с ним, поэтому обводку не красим.
 */
.tx-gradient-stop.on {
    z-index: 1;
}

.tx-gradient-stop.on svg {
    transform: scale(1.25);
    transform-origin: 50% 0;
}

.tx-gradient-stop.on::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    width: 12px;
    height: 2px;
    margin-left: -6px;
    border-radius: 1px;
    background: var(--tx-gradient-accent, #4fc3f7);
}
</style>
