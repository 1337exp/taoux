<script lang="ts" setup>
import { ref } from 'vue';
import { addStop, gradientCss, moveStop, removeStop, type GradientStop } from './ops';

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

let dragging = -1;

function onStopDown(e: PointerEvent, i: number) {
    if (e.altKey) {
        emit('update:modelValue', removeStop(props.modelValue, i));
        emit('update:selected', 0);
        emit('commit');
        return;
    }
    emit('update:selected', i);
    dragging = i;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
}

function onMove(e: PointerEvent) {
    if (dragging >= 0) emit('update:modelValue', moveStop(props.modelValue, dragging, tAt(e)));
}

function onUp() {
    if (dragging < 0) return;
    dragging = -1;
    emit('commit');
}

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
            :style="{ left: `${s.t * 100}%` }"
            @pointerdown.stop="onStopDown($event, i)"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
        />
    </div>
</template>

<style>
/*
 * Настройка через CSS-переменные на любом предке:
 *   --tx-gradient-border, --tx-gradient-stop-bg, --tx-gradient-stop-border, --tx-gradient-accent.
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
    top: 14px;
    width: 10px;
    height: 12px;
    margin-left: -5px;
    border: 2px solid var(--tx-gradient-stop-border, #8b929c);
    border-radius: 2px;
    background: var(--tx-gradient-stop-bg, #15171b);
    cursor: grab;
}

.tx-gradient-stop.on {
    border-color: var(--tx-gradient-accent, #4fc3f7);
}
</style>
