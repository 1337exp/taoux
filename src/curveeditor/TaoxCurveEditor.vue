<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { createEdgeScroller } from '../edgescroll';
import { clampTo, niceStep, roundTo, snapTo, ticks } from '../num';
import { addPoint, movePoint, removePoint, valueBounds, type CurvePoint } from './ops';

const props = withDefaults(
    defineProps<{
        /** Точки кривой по возрастанию t (минимум две). */
        modelValue: readonly CurvePoint[];
        /** Индекс выбранной точки. */
        selected?: number;
        /** Допустимые значения: фиксируют вид графика и не дают утащить точку за границу. */
        min?: number;
        max?: number;
        /** Сколько знаков после запятой оставлять у t и v; не задано — не обрезать. */
        precision?: number;
        /** Прилипание к сетке (Shift на время меняет режим). */
        snap?: boolean;
        /** Шаг по времени и расстояние между подписанными линиями. */
        stepT?: number;
        majorT?: number;
        /** Подсказка при наведении на поле. */
        hint?: string;
    }>(),
    { selected: 0, snap: true, stepT: 0.05, majorT: 0.25 },
);
const emit = defineEmits<{
    'update:modelValue': [value: CurvePoint[]];
    'update:selected': [index: number];
    /** Правка закончена (отпустили точку, добавили, убрали): момент для записи в историю. */
    commit: [];
}>();

const W = 280;
const H = 132;
const PAD_L = 30;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 16;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const svg = ref<SVGSVGElement | null>(null);

const points = computed(() => props.modelValue);
// Пределы запоминаем на время перетаскивания: иначе график «плыл» бы под рукой
const frozen = ref<{ min: number; max: number } | null>(null);
// Сдвиг вида по значению: накапливает автопрокрутка у края, пока тянут точку
const shift = ref(0);
const bounds = computed(() => (frozen.value ? { min: frozen.value.min + shift.value, max: frozen.value.max + shift.value } : valueBounds(points.value, props.min, props.max)));
const span = computed(() => bounds.value.max - bounds.value.min);

const majorV = computed(() => niceStep(span.value, 4));
const stepV = computed(() => niceStep(span.value, 20));
const gridT = computed(() => ticks(0, 1, props.stepT));
const gridV = computed(() => ticks(bounds.value.min, bounds.value.max, stepV.value));
const labelsV = computed(() => ticks(bounds.value.min, bounds.value.max, majorV.value));
const labelsT = computed(() => ticks(0, 1, props.majorT));
const isMajorT = (x: number) => Math.abs(x / props.majorT - Math.round(x / props.majorT)) < 1e-6;
const isMajorV = (v: number) => Math.abs(v / majorV.value - Math.round(v / majorV.value)) < 1e-6;

const px = (tt: number) => PAD_L + tt * PLOT_W;
const py = (v: number) => PAD_T + (1 - (v - bounds.value.min) / span.value) * PLOT_H;
const path = computed(() => points.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.t).toFixed(1)} ${py(p.v).toFixed(1)}`).join(' '));
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

interface PointerSample {
    clientX: number;
    clientY: number;
    shiftKey: boolean;
}

/** Координаты указателя в единицах кривой; Shift временно меняет режим шага. */
function toCurve(e: PointerSample): { t: number; v: number } {
    const r = svg.value!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const { min, max } = bounds.value;
    let tt = (x - PAD_L) / PLOT_W;
    let v = min + (1 - (y - PAD_T) / PLOT_H) * (max - min);
    if (props.snap !== e.shiftKey) {
        tt = snapTo(tt, props.stepT);
        v = snapTo(v, stepV.value);
    }
    return { t: roundTo(tt, props.precision), v: clampTo(roundTo(v, props.precision), props.min, props.max) };
}

let dragging = -1;
let lastPointer: PointerSample = { clientX: 0, clientY: 0, shiftKey: false };

/** Точка идёт за указателем: и при его движении, и когда вид уехал под неподвижным указателем. */
function followPointer() {
    if (dragging < 0) return;
    const { t: tt, v } = toCurve(lastPointer);
    emit('update:modelValue', movePoint(points.value, dragging, tt, v));
}

// Тянем точку к верхнему/нижнему краю графика: вид по значению едет следом (по времени он всегда 0…1).
// Границы поля не пересекаем: при заданных min и max вид стоит.
const scroller = createEdgeScroller({
    bounds: () => svg.value?.getBoundingClientRect() ?? null,
    pointer: () => [lastPointer.clientX, lastPointer.clientY],
    enabled: () => dragging >= 0,
    zone: 18,
    maxSpeed: 240,
    onScroll: (_dx, dy) => {
        const base = frozen.value;
        const r = svg.value?.getBoundingClientRect();
        if (!base || !r) return;
        // Видимая область уехала вниз на dy px: значения вида уменьшились
        const dv = ((dy * H) / r.height / PLOT_H) * (base.max - base.min);
        const lo = props.min === undefined ? -Infinity : props.min - base.min;
        const hi = props.max === undefined ? Infinity : props.max - base.max;
        shift.value = Math.min(hi, Math.max(lo, shift.value - dv));
        followPointer();
    },
});
onBeforeUnmount(scroller.stop);

function onDown(e: PointerEvent, i: number) {
    emit('update:selected', i);
    if (e.altKey) {
        emit('update:modelValue', removePoint(points.value, i));
        emit('update:selected', 0);
        emit('commit');
        return;
    }
    dragging = i;
    lastPointer = e;
    shift.value = 0;
    frozen.value = valueBounds(points.value, props.min, props.max);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
}

function onMove(e: PointerEvent) {
    if (dragging < 0) return;
    lastPointer = e;
    followPointer();
    scroller.kick();
}

function onUp() {
    if (dragging < 0) return;
    dragging = -1;
    scroller.stop();
    frozen.value = null;
    shift.value = 0;
    emit('commit');
}

function onDouble(e: MouseEvent) {
    const { t: tt, v } = toCurve(e);
    const r = addPoint(points.value, tt, v);
    emit('update:selected', r.index);
    emit('update:modelValue', r.points);
    emit('commit');
}

function onKey(e: KeyboardEvent) {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    e.preventDefault();
    emit('update:modelValue', removePoint(points.value, props.selected));
    emit('update:selected', 0);
    emit('commit');
}
</script>

<template>
    <svg ref="svg" class="tx-curve" :viewBox="`0 0 ${W} ${H}`" :title="hint" tabindex="0" @dblclick.self="onDouble" @keydown="onKey">
        <!-- мелкая сетка: те же шаги, что у прилипания -->
        <line v-for="x in gridT" :key="`gt${x}`" class="tx-curve-grid" :class="{ major: isMajorT(x) }" :x1="px(x)" :x2="px(x)" :y1="PAD_T" :y2="H - PAD_B" />
        <line v-for="v in gridV" :key="`gv${v}`" class="tx-curve-grid" :class="{ major: isMajorV(v) }" :x1="PAD_L" :x2="W - PAD_R" :y1="py(v)" :y2="py(v)" />

        <text v-for="v in labelsV" :key="`lv${v}`" class="tx-curve-label" :x="PAD_L - 4" :y="py(v)" text-anchor="end" dominant-baseline="middle">{{ fmt(v) }}</text>
        <text v-for="x in labelsT" :key="`lt${x}`" class="tx-curve-label" :x="px(x)" :y="H - 4" :text-anchor="x === 0 ? 'start' : x === 1 ? 'end' : 'middle'">{{ fmt(x) }}</text>

        <path class="tx-curve-line" :d="path" />
        <circle
            v-for="(p, i) in points"
            :key="i"
            class="tx-curve-dot"
            :class="{ on: i === selected }"
            :cx="px(p.t)"
            :cy="py(p.v)"
            r="5"
            @pointerdown.stop="onDown($event, i)"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
        />
    </svg>
</template>

<style>
/*
 * Настройка через CSS-переменные на любом предке:
 *   --tx-curve-bg, --tx-curve-border, --tx-curve-grid, --tx-curve-label, --tx-curve-accent,
 *   --tx-curve-dot-opacity (непрозрачность невыбранных точек, по умолчанию 0.3).
 */
.tx-curve {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--tx-curve-border, #2a2d33);
    border-radius: 4px;
    background: var(--tx-curve-bg, #15171b);
    touch-action: none;
    outline: none;
}

.tx-curve:focus-visible {
    border-color: var(--tx-curve-accent, #4fc3f7);
}

.tx-curve-grid {
    pointer-events: none; /* иначе двойной клик попадает в линию сетки, а не в поле */
    stroke: var(--tx-curve-grid, #2a2d33);
    stroke-width: 0.5;
    opacity: 0.45;
}

.tx-curve-grid.major {
    stroke-width: 1;
    opacity: 1;
}

.tx-curve-label {
    fill: var(--tx-curve-label, #8b929c);
    font-size: 8px;
    pointer-events: none;
    user-select: none;
}

.tx-curve-line {
    fill: none;
    stroke: var(--tx-curve-accent, #4fc3f7);
    stroke-width: 2;
    pointer-events: none;
}

.tx-curve-dot {
    fill: var(--tx-curve-bg, #15171b);
    stroke: var(--tx-curve-accent, #4fc3f7);
    stroke-width: 2;
    opacity: var(--tx-curve-dot-opacity, 0.3);
    cursor: grab;
}

.tx-curve-dot.on,
.tx-curve-dot:hover {
    fill: var(--tx-curve-accent, #4fc3f7);
    opacity: 1;
}
</style>
