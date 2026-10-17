<script lang="ts" setup>
import { TaoButton, TaoInputNumber, TaoSegmented, TaoSegmentedOption, TaoSelect, TaoSwitch } from '@1337exp/taoui';
import { computed, ref } from 'vue';
import { movePoint, removePoint, setEase, TaoxCurveEditor, valueBounds, type CurvePoint } from '../curveeditor';
import { DEFAULT_BEZIER, EASE_DIRECTIONS, EASE_FAMILIES, easeName, easeParts, type Ease, type EaseDirection, type EaseFamily } from '../ease';
import { clampTo, niceStep, roundTo } from '../num';
import type { CurveFieldLabels } from './labels';

// Кривая с полями: график (TaoxCurveEditor), поля выбранной точки, переход к следующей точке, шаг сетки, удаление и сброс.
// Первый модуль taoux поверх TaoUI: график и логика остаются в taoux, поля и кнопки это компоненты TaoUI.
const props = withDefaults(
    defineProps<{
        /** Точки кривой. */
        modelValue: readonly CurvePoint[];
        /** Допустимые значения: фиксируют вид графика и не дают утащить точку за границу. */
        min?: number;
        max?: number;
        /** Кривая «по умолчанию»: без неё кнопки сброса нет. */
        defaultValue?: readonly CurvePoint[];
        /** Сколько знаков после запятой оставлять у времени и значения; не задано — не обрезать. */
        precision?: number;
        /** Шаг по времени у сетки и у поля времени. */
        stepT?: number;
        /** Прилипание к сетке при старте. */
        snap?: boolean;
        /** Надписи на языке приложения; недостающие берутся английские. */
        labels?: Partial<CurveFieldLabels>;
        /** Подписи для скринридеров: см. TaoxCurveEditor. */
        pointLabel?: (index: number, point: CurvePoint) => string;
        handleLabel?: (n: number, index: number) => string;
    }>(),
    { stepT: 0.05, snap: true },
);
const emit = defineEmits<{ 'update:modelValue': [value: CurvePoint[]]; commit: [] }>();

const DEFAULT_LABELS: CurveFieldLabels = {
    time: 'Time',
    value: 'Value',
    transition: 'Transition to the next point',
    snap: 'Snap to grid',
    remove: 'Remove',
    reset: 'Reset',
    hint: 'Double-click adds a point, Alt+click or Delete removes it, Shift disables snapping',
};
const text = computed(() => ({ ...DEFAULT_LABELS, ...props.labels }));

const selected = ref(0);
const snapOn = ref(props.snap);

const points = computed(() => props.modelValue.map((p) => ({ ...p })));
const current = computed(() => points.value[Math.min(selected.value, points.value.length - 1)]!);
const stepV = computed(() => {
    const b = valueBounds(points.value, props.min, props.max);
    return niceStep(b.max - b.min, 20);
});
const canReset = computed(() => props.defaultValue !== undefined && JSON.stringify(points.value) !== JSON.stringify(props.defaultValue));

function change(next: CurvePoint[]) {
    emit('update:modelValue', next);
}

function removeSelected() {
    change(removePoint(points.value, selected.value));
    selected.value = 0;
    emit('commit');
}

function setField(field: 't' | 'v', value: number | null) {
    if (value === null || !Number.isFinite(value)) return;
    const p = current.value;
    const tt = field === 't' ? roundTo(value, props.precision) : p.t;
    const v = field === 'v' ? clampTo(roundTo(value, props.precision), props.min, props.max) : p.v;
    change(movePoint(points.value, selected.value, tt, v));
    emit('commit');
}

function reset() {
    if (props.defaultValue === undefined) return;
    selected.value = 0;
    change(props.defaultValue.map((p) => ({ ...p })));
    emit('commit');
}

//--------------------------------------------------
// Переход от выбранной точки к следующей: вид (linear, step, семейство или bezier) и направление.
// Названия функций не переводятся: их знают по CSS и библиотекам анимации, по переводу не найдут.

const isLast = computed(() => selected.value >= points.value.length - 1);
const kind = computed(() => {
    const e = current.value.ease;
    if (e === undefined || e === 'linear') return 'linear';
    if (typeof e === 'object') return 'bezier';
    return easeParts(e)?.family ?? e;
});
const direction = computed<EaseDirection>(() => {
    const e = current.value.ease;
    return typeof e === 'string' ? (easeParts(e)?.direction ?? 'in-out') : 'in-out';
});
// У linear, step и Безье направления нет: переключатель остаётся на месте неактивным, чтобы было видно, как это устроено
const hasDirection = computed(() => !isLast.value && typeof current.value.ease === 'string' && easeParts(current.value.ease) !== null);
const kindOptions = ['linear', 'step', ...EASE_FAMILIES, 'bezier'].map((v) => ({ value: v, label: v }));

function applyEase(next: Ease) {
    change(setEase(points.value, selected.value, next));
    emit('commit');
}

function setKind(v: string | number | null) {
    if (typeof v !== 'string') return;
    if (v === 'linear' || v === 'step') applyEase(v);
    else if (v === 'bezier') applyEase({ bezier: DEFAULT_BEZIER });
    else applyEase(easeName(v as EaseFamily, direction.value));
}

function setDirection(v: unknown) {
    const e = current.value.ease;
    const parts = typeof e === 'string' ? easeParts(e) : null;
    if (parts && typeof v === 'string' && (EASE_DIRECTIONS as readonly string[]).includes(v)) applyEase(easeName(parts.family, v as EaseDirection));
}
</script>

<template>
    <div class="tx-curve-field">
        <TaoxCurveEditor
            :model-value="points"
            v-model:selected="selected"
            :min="min"
            :max="max"
            :precision="precision"
            :snap="snapOn"
            :step-t="stepT"
            :hint="text.hint"
            :point-label="pointLabel"
            :handle-label="handleLabel"
            @update:model-value="change"
            @commit="emit('commit')"
        />

        <div class="tx-curve-field__fields">
            <label>{{ text.time }}<TaoInputNumber size="small" :min="0" :max="1" :step="stepT" :precision="precision" :controls="false" :model-value="current.t" @update:model-value="(x) => setField('t', x)" /></label>
            <label>{{ text.value }}<TaoInputNumber size="small" :min="min" :max="max" :step="stepV" :precision="precision" :controls="false" :model-value="current.v" @update:model-value="(x) => setField('v', x)" /></label>
        </div>

        <div class="tx-curve-field__ease">
            <span class="tx-curve-field__title" aria-hidden="true">{{ text.transition }}</span>
            <div class="tx-curve-field__ease-row" role="group" :aria-label="text.transition">
                <TaoSelect class="tx-curve-field__kind" size="small" :clearable="false" :options="kindOptions" :disabled="isLast" :model-value="kind" @update:model-value="setKind" />
                <TaoSegmented size="small" :disabled="!hasDirection" :model-value="hasDirection ? direction : undefined" @update:model-value="setDirection">
                    <TaoSegmentedOption v-for="d in EASE_DIRECTIONS" :key="d" :value="d" :label="d" />
                </TaoSegmented>
            </div>
        </div>

        <div class="tx-curve-field__bar">
            <TaoSwitch v-model="snapOn" :label="text.snap" />
            <span class="tx-curve-field__spacer" />
            <TaoButton size="small" variant="ghost" :disabled="points.length <= 2" @click="removeSelected">{{ text.remove }}</TaoButton>
            <TaoButton v-if="defaultValue !== undefined" size="small" variant="ghost" :disabled="!canReset" @click="reset">{{ text.reset }}</TaoButton>
        </div>
    </div>
</template>

<style scoped>
.tx-curve-field {
    --tx-curve-bg: var(--tao-color-surface-sunken);
    --tx-curve-border: var(--tao-color-border);
    --tx-curve-grid: var(--tao-color-border);
    --tx-curve-label: var(--tao-color-text-muted);
    --tx-curve-text: var(--tao-color-text);
    --tx-curve-accent: var(--tao-color-accent);

    display: flex;
    flex-direction: column;
    gap: 8px;
}

.tx-curve-field__fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.tx-curve-field__fields > label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--tao-color-text-muted);
    font-size: 11px;
}

.tx-curve-field__ease {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.tx-curve-field__title {
    color: var(--tao-color-text-muted);
    font-size: 11px;
}

/* Список и направление в одну строку: список забирает остаток, переключатель держит свою ширину */
.tx-curve-field__ease-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.tx-curve-field__kind {
    flex: 1;
    min-width: 0;
}

.tx-curve-field__ease-row > :last-child {
    flex: none;
}

.tx-curve-field__bar {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
}

.tx-curve-field__spacer {
    flex: 1;
}
</style>
