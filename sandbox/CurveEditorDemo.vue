<script lang="ts" setup>
import { TaoButton, TaoInputNumber, TaoSelect, TaoSwitch } from '@1337exp/taoui';
import { ref } from 'vue';
import { DEFAULT_BEZIER, EASE_NAMES, type EaseName } from '../src/ease';
import { movePoint, setEase, TaoxCurveEditor, type CurvePoint } from '../src/curveeditor';
import SandboxShell from './SandboxShell.vue';

interface Case {
    title: string;
    note: string;
    min?: number;
    max?: number;
    precision?: number;
    initial: CurvePoint[];
    value: CurvePoint[];
    selected: number;
}

const make = (title: string, note: string, initial: CurvePoint[], min?: number, max?: number, precision?: number): Case => ({
    title,
    note,
    min,
    max,
    precision,
    initial,
    value: initial.map((p) => ({ ...p })),
    selected: 0,
});

const snap = ref(true);

// Разные границы значений: именно на них держится сетка, зажим и автопрокрутка
const cases = ref<Case[]>([
    make('Размер, 0…∞', 'min 0, верх по данным', [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 1, v: 0 }], 0),
    make('Непрозрачность, 0…1', 'min 0, max 1: вид стоит', [{ t: 0, v: 1 }, { t: 1, v: 0 }], 0, 1),
    make('Скорость, −1…1', 'min −1, max 1', [{ t: 0, v: 0 }, { t: 0.5, v: 1 }, { t: 1, v: -1 }], -1, 1),
    make('Без границ', 'всё авто', [{ t: 0, v: 2 }, { t: 1, v: 2 }]),
    make('Два знака', 'precision 2, min 0: потяни точку к верхнему краю', [{ t: 0, v: 0 }, { t: 0.5, v: 1 }, { t: 1, v: 0 }], 0, undefined, 2),
]);

const current = (c: Case) => c.value[Math.min(c.selected, c.value.length - 1)]!;
const reset = (c: Case) => {
    c.value = c.initial.map((p) => ({ ...p }));
    c.selected = 0;
};
// Переход выбранной точки к следующей: имя из списка или «bezier» (ручки на графике)
const easeOptions = [...EASE_NAMES, 'bezier'].map((v) => ({ value: v, label: v }));
const easeOf = (c: Case) => {
    const e = current(c).ease;
    return e === undefined ? 'linear' : typeof e === 'object' ? 'bezier' : e;
};
const isLast = (c: Case) => c.selected >= c.value.length - 1;
function setTransition(c: Case, v: string | number | null) {
    if (typeof v !== 'string') return;
    c.value = setEase(c.value, c.selected, v === 'bezier' ? { bezier: DEFAULT_BEZIER } : (v as EaseName));
}
const changed = (c: Case) => JSON.stringify(c.value) !== JSON.stringify(c.initial);

function setField(c: Case, field: 't' | 'v', value: number | null) {
    if (value === null) return;
    const p = current(c);
    c.value = movePoint(c.value, c.selected, field === 't' ? value : p.t, field === 'v' ? value : p.v);
}
</script>

<template>
    <SandboxShell title="curveeditor" note="Двойной клик добавляет точку, Alt+клик или Delete убирает, Shift временно меняет режим шага, у края графика вид едет за точкой.">
        <TaoSwitch v-model="snap" label="Шаг сетки" />

        <div class="grid">
            <section v-for="c in cases" :key="c.title" class="case">
                <h2>{{ c.title }} <small>{{ c.note }}</small></h2>
                <TaoxCurveEditor v-model="c.value" v-model:selected="c.selected" :min="c.min" :max="c.max" :precision="c.precision" :snap="snap" />
                <div class="row">
                    <TaoInputNumber class="grow" size="small" :min="0" :max="1" :step="0.05" :precision="c.precision" :controls="false" :model-value="current(c).t" @update:model-value="(x) => setField(c, 't', x)" />
                    <TaoInputNumber class="grow" size="small" :min="c.min" :max="c.max" :step="0.1" :precision="c.precision" :controls="false" :model-value="current(c).v" @update:model-value="(x) => setField(c, 'v', x)" />
                    <TaoButton size="small" variant="ghost" :disabled="!changed(c)" @click="reset(c)">Сбросить</TaoButton>
                </div>
                <div class="row">
                    <TaoSelect class="grow" size="small" :clearable="false" :options="easeOptions" :disabled="isLast(c)" :model-value="easeOf(c)" @update:model-value="(v) => setTransition(c, v)" />
                </div>
                <pre>{{ JSON.stringify(c.value) }}</pre>
            </section>
        </div>
    </SandboxShell>
</template>
