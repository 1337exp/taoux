<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { createEdgeScroller } from '../edgescroll';
import { clampTo, niceStep, roundTo, snapTo, ticks } from '../num';
import { addPoint, movePoint, removePoint, sampleSegment, setEase, valueBounds, type CurvePoint } from './ops';

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
        /** Подпись точки для скринридеров; по умолчанию «Point 1: t, v». */
        pointLabel?: (index: number, point: CurvePoint) => string;
        /** Подпись ручки Безье для скринридеров (n: 1 или 2); по умолчанию «Bezier handle n». */
        handleLabel?: (n: number, index: number) => string;
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
// Участки рисуются по своим переходам: у прямой два конца, у плавных десятки отрезков, у ступеньки угол
const path = computed(() => {
    const pts = points.value;
    const out: string[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        sampleSegment(pts[i]!, pts[i + 1]!).forEach((p, k) => out.push(`${i === 0 && k === 0 ? 'M' : 'L'} ${px(p.t).toFixed(1)} ${py(p.v).toFixed(1)}`));
    }
    return out.join(' ');
});
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

interface PointerSample {
    clientX: number;
    clientY: number;
    shiftKey: boolean;
}

/** Координаты указателя в единицах кривой, как есть: без прилипания, округления и границ. */
function rawCurve(e: PointerSample): { t: number; v: number } {
    const r = svg.value!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const { min, max } = bounds.value;
    return { t: (x - PAD_L) / PLOT_W, v: min + (1 - (y - PAD_T) / PLOT_H) * (max - min) };
}

/** Координаты указателя в единицах кривой; Shift временно меняет режим шага. */
function toCurve(e: PointerSample): { t: number; v: number } {
    let { t: tt, v } = rawCurve(e);
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
    try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
        // указатель уже ушёл или захват недоступен: тянуть можно и без него
    }
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

//--------------------------------------------------
// Ручки кубической кривой Безье у выбранного участка

/** Участок, который начинается в выбранной точке и идёт по Безье: ручки есть только у него (и только если у участка есть высота). */
const bezierSegment = computed(() => {
    const i = Math.min(props.selected, points.value.length - 1);
    const a = points.value[i];
    const b = points.value[i + 1];
    if (!a || !b || typeof a.ease !== 'object' || Math.abs(b.v - a.v) < 1e-9 || b.t - a.t <= 0) return null;
    return { i, a, b, bezier: a.ease.bezier };
});

/** Две ручки участка в координатах плота. */
const bezierHandles = computed(() => {
    const s = bezierSegment.value;
    if (!s) return [];
    const [x1, y1, x2, y2] = s.bezier;
    return [
        { n: 0, t: s.a.t + x1 * (s.b.t - s.a.t), v: s.a.v + y1 * (s.b.v - s.a.v), from: s.a },
        { n: 1, t: s.a.t + x2 * (s.b.t - s.a.t), v: s.a.v + y2 * (s.b.v - s.a.v), from: s.b },
    ];
});

/** Начала участков с Безье: над ними рисуется метка «B». */
const bezierMarks = computed(() => points.value.flatMap((p, i) => (typeof p.ease === 'object' && i < points.value.length - 1 ? [{ i, t: p.t, v: p.v }] : [])));

const round2 = (x: number) => Math.round(x * 100) / 100;
const BEZIER_STEP = 0.05;

/** Ручка `n` ставится в (x, y) нормализованного участка: x в 0…1, y свободный в разумных пределах (заступ). */
function setBezierHandle(n: 0 | 1, x: number, y: number, commitNow = false) {
    const s = bezierSegment.value;
    if (!s) return;
    const next: [number, number, number, number] = [...s.bezier];
    next[n * 2] = Math.min(1, Math.max(0, round2(x)));
    next[n * 2 + 1] = Math.min(3, Math.max(-2, round2(y)));
    emit('update:modelValue', setEase(points.value, s.i, { bezier: next }));
    if (commitNow) emit('commit');
}

let handleDrag = -1;

function onHandleDown(e: PointerEvent, n: number) {
    handleDrag = n;
    frozen.value = valueBounds(points.value, props.min, props.max);
    try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
        // указатель уже ушёл или захват недоступен: тянуть можно и без него
    }
}

function onHandleMove(e: PointerEvent) {
    const s = bezierSegment.value;
    if (handleDrag < 0 || !s) return;
    const { t, v } = rawCurve(e);
    setBezierHandle(handleDrag as 0 | 1, (t - s.a.t) / (s.b.t - s.a.t), (v - s.a.v) / (s.b.v - s.a.v));
}

function onHandleUp() {
    if (handleDrag < 0) return;
    handleDrag = -1;
    frozen.value = null;
    emit('commit');
}

/** Стрелки на ручке сдвигают её на шаг (Shift крупнее): влево и вправо по x, вверх и вниз по y. */
function onHandleKey(e: KeyboardEvent, n: number) {
    const s = bezierSegment.value;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = arrows[e.key];
    if (!s || !d) return;
    e.preventDefault();
    e.stopPropagation();
    const k = BEZIER_STEP * (e.shiftKey ? 5 : 1);
    setBezierHandle(n as 0 | 1, s.bezier[n * 2]! + d[0] * k, s.bezier[n * 2 + 1]! + d[1] * k, true);
}

/** Двойной клик по графику не должен выделять текст страницы вокруг. */
function noSelect(e: MouseEvent) {
    if (e.detail > 1) e.preventDefault();
}

function onDouble(e: MouseEvent) {
    const { t: tt, v } = toCurve(e);
    const r = addPoint(points.value, tt, v);
    emit('update:selected', r.index);
    emit('update:modelValue', r.points);
    emit('commit');
}

/** Шаг стрелки с Shift: во столько раз крупнее. */
const COARSE = 5;

/** Сдвигает точку `i` на `dx` шагов по времени и `dy` шагов по значению (шаги сетки), с прижатием, округлением и границами. */
function nudge(i: number, dx: number, dy: number, coarse: boolean) {
    const p = points.value[i];
    if (!p) return;
    const k = coarse ? COARSE : 1;
    const tt = roundTo(snapTo(p.t + dx * k * props.stepT, props.stepT), props.precision);
    const v = clampTo(roundTo(snapTo(p.v + dy * k * stepV.value, stepV.value), props.precision), props.min, props.max);
    emit('update:modelValue', movePoint(points.value, i, tt, v));
    emit('commit');
}

/** Insert добавляет точку между выбранной и следующей (у последней: между ней и предыдущей) на самой кривой. */
/** Фокус на точку `i` после перерисовки: клавиши идут к той точке, что выбрана, и фокус не должен оставаться на старой. */
function focusDot(i: number) {
    void nextTick(() => svg.value?.querySelectorAll<SVGElement>('.tx-curve-dot')[i]?.focus());
}

function insertAfter(i: number) {
    const a = points.value[i];
    const b = points.value[i + 1] ?? points.value[i - 1];
    if (!a || !b) return;
    const r = addPoint(points.value, roundTo((a.t + b.t) / 2, props.precision));
    emit('update:selected', r.index);
    emit('update:modelValue', r.points);
    emit('commit');
    focusDot(r.index);
}

function removeAt(i: number) {
    const next = Math.max(0, i - 1);
    emit('update:modelValue', removePoint(points.value, i));
    emit('update:selected', next);
    emit('commit');
    focusDot(next);
}

/** Клавиши точки (фокус на ней): стрелки двигают на шаг сетки, Shift крупнее; Insert добавляет, Delete убирает. */
function onKey(e: KeyboardEvent) {
    // точка, на которой фокус; если клавиша пришла с самого поля (после клика по нему), то выбранная
    const target = (e.target as Element | null)?.closest('.tx-curve-dot');
    const index = target ? Number(target.getAttribute('data-index')) : NaN;
    const i = Number.isInteger(index) ? index : Math.min(props.selected, points.value.length - 1);
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const move = arrows[e.key];
    if (move) {
        e.preventDefault();
        nudge(i, move[0], move[1], e.shiftKey);
    } else if (e.key === 'Insert') {
        e.preventDefault();
        insertAfter(i);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeAt(i);
    }
}

const labelOf = (i: number, p: CurvePoint) => (props.pointLabel ? props.pointLabel(i, p) : `Point ${i + 1}: ${fmt(p.t)}, ${fmt(p.v)}`);
</script>

<template>
    <svg ref="svg" class="tx-curve" :viewBox="`0 0 ${W} ${H}`" :title="hint" tabindex="-1" role="group" @dblclick.self="onDouble" @mousedown="noSelect" @keydown="onKey">
        <!-- мелкая сетка: те же шаги, что у прилипания -->
        <line v-for="x in gridT" :key="`gt${x}`" class="tx-curve-grid" :class="{ major: isMajorT(x) }" :x1="px(x)" :x2="px(x)" :y1="PAD_T" :y2="H - PAD_B" />
        <line v-for="v in gridV" :key="`gv${v}`" class="tx-curve-grid" :class="{ major: isMajorV(v) }" :x1="PAD_L" :x2="W - PAD_R" :y1="py(v)" :y2="py(v)" />

        <text v-for="v in labelsV" :key="`lv${v}`" class="tx-curve-label" :x="PAD_L - 4" :y="py(v)" text-anchor="end" dominant-baseline="middle">{{ fmt(v) }}</text>
        <text v-for="x in labelsT" :key="`lt${x}`" class="tx-curve-label" :x="px(x)" :y="H - 4" :text-anchor="x === 0 ? 'start' : x === 1 ? 'end' : 'middle'">{{ fmt(x) }}</text>

        <path class="tx-curve-line" :d="path" />

        <!-- Метка «B» над началом участка с Безье: видно, что у точки есть ручки, даже когда она не выбрана -->
        <text v-for="m in bezierMarks" :key="`b${m.i}`" class="tx-curve-mark" :x="px(m.t)" :y="py(m.v) - 8" text-anchor="middle" aria-hidden="true">B</text>

        <g v-if="bezierHandles.length" class="tx-curve-bezier">
            <template v-for="h in bezierHandles" :key="h.n">
                <line class="tx-curve-arm" :x1="px(h.from.t)" :y1="py(h.from.v)" :x2="px(h.t)" :y2="py(h.v)" />
                <circle
                    class="tx-curve-handle"
                    :cx="px(h.t)"
                    :cy="py(h.v)"
                    r="4"
                    tabindex="0"
                    role="slider"
                    :aria-label="handleLabel ? handleLabel(h.n + 1, bezierSegment!.i) : `Bezier handle ${h.n + 1}`"
                    @pointerdown.stop="onHandleDown($event, h.n)"
                    @pointermove="onHandleMove"
                    @pointerup="onHandleUp"
                    @pointercancel="onHandleUp"
                    @keydown="onHandleKey($event, h.n)"
                />
            </template>
        </g>
        <circle
            v-for="(p, i) in points"
            :key="i"
            class="tx-curve-dot"
            :class="{ on: i === selected }"
            :cx="px(p.t)"
            :cy="py(p.v)"
            r="5"
            :data-index="i"
            tabindex="0"
            role="button"
            :aria-label="labelOf(i, p)"
            @focus="emit('update:selected', i)"
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
    user-select: none;
    outline: none;
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

.tx-curve-mark {
    fill: var(--tx-curve-accent, #4fc3f7);
    font: 600 9px/1 system-ui, sans-serif;
    pointer-events: none;
    user-select: none;
}

.tx-curve-arm {
    stroke: var(--tx-curve-label, #8b929c);
    stroke-width: 1;
    stroke-dasharray: 3 2;
    pointer-events: none;
}

.tx-curve-handle {
    fill: var(--tx-curve-label, #8b929c);
    stroke: var(--tx-curve-bg, #15171b);
    stroke-width: 1.5;
    cursor: grab;
}

.tx-curve-handle:active {
    cursor: grabbing;
}

.tx-curve-handle:hover,
.tx-curve-handle:focus-visible {
    fill: var(--tx-curve-accent, #4fc3f7);
    outline: none;
}

.tx-curve-dot {
    fill: var(--tx-curve-bg, #15171b);
    stroke: var(--tx-curve-accent, #4fc3f7);
    stroke-width: 2;
    opacity: var(--tx-curve-dot-opacity, 0.3);
    cursor: grab;
}

.tx-curve-dot:active {
    cursor: grabbing;
}

.tx-curve-dot:focus {
    outline: none;
}

/* фокус с клавиатуры: утолщённая обводка и свечение (контур у SVG-форм браузеры рисуют по-разному) */
.tx-curve-dot:focus-visible {
    stroke-width: 3;
    filter: drop-shadow(0 0 3px var(--tx-curve-accent, #4fc3f7));
    opacity: 1;
}

.tx-curve-dot.on,
.tx-curve-dot:hover {
    fill: var(--tx-curve-accent, #4fc3f7);
    opacity: 1;
}
</style>
