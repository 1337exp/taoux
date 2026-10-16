<script lang="ts" setup>
import { ref } from 'vue';
import { addStop, gradientCss, moveStop, pickFromStack, removeStop, stackAround, toSrgb, type GradientStop } from './ops';

const props = withDefaults(
    defineProps<{
        /** Остановки по возрастанию t (минимум одна). */
        modelValue: readonly GradientStop[];
        /** Индекс выбранной остановки. */
        selected?: number;
        /** Подсказка при наведении на полосу. */
        hint?: string;
    }>(),
    { selected: 0 },
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
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

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
    emit('update:modelValue', moveStop(props.modelValue, dragging, tAt(e)));
}

function onUp() {
    if (dragging < 0) return;
    const moved = pending === null;
    dragging = -1;
    pending = null;
    if (moved) emit('commit');
}

const stopColor = (s: GradientStop) => `rgb(${s.color.map((c) => Math.round(255 * toSrgb(Math.min(1, Math.max(0, c))))).join(' ')})`;

function onBarClick(e: MouseEvent) {
    if (e.target !== bar.value) return;
    const r = addStop(props.modelValue, tAt(e));
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
            @pointerdown.stop="onStopDown($event, i)"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
        >
            <!-- залитый треугольник цвета остановки, остриём к полосе: на светлом и тёмном фоне его видно по обводке -->
            <svg viewBox="0 0 12 12"><polygon points="6,0.5 11.5,11.5 0.5,11.5" /></svg>
        </span>
    </div>
</template>

<style>
/*
 * Настройка через CSS-переменные на любом предке:
 *   --tx-gradient-border, --tx-gradient-stop-border, --tx-gradient-accent.
 */
.tx-gradient {
    position: relative;
    height: 22px;
    margin-bottom: 14px; /* место под ручки остановок */
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

.tx-gradient-stop svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
}

.tx-gradient-stop polygon {
    fill: currentColor; /* цвет остановки задаёт сам компонент */
    stroke: var(--tx-gradient-stop-border, #8b929c);
    stroke-width: 1.5;
    stroke-linejoin: round;
}

/* выбранная выше остальных и в акцентной обводке: в стопке она не прячется под соседями */
.tx-gradient-stop.on {
    z-index: 1;
}

.tx-gradient-stop.on polygon {
    stroke: var(--tx-gradient-accent, #4fc3f7);
    stroke-width: 2;
}
</style>
