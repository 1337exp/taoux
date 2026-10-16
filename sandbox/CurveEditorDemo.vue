<script lang="ts" setup>
import { ref } from 'vue';
import { TaoxCurveEditor, type CurvePoint } from '../src/curveeditor';

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

const reset = (c: Case) => {
    c.value = c.initial.map((p) => ({ ...p }));
    c.selected = 0;
};
const changed = (c: Case) => JSON.stringify(c.value) !== JSON.stringify(c.initial);
</script>

<template>
    <main class="page">
        <h1>curveeditor</h1>
        <p class="muted">Двойной клик добавляет точку, Alt+клик или Delete убирает, Shift временно меняет режим шага, у края графика вид едет за точкой.</p>
        <label class="bar"><input v-model="snap" type="checkbox" /> Шаг сетки</label>

        <div class="grid">
            <section v-for="c in cases" :key="c.title" class="case">
                <h2>{{ c.title }} <small>{{ c.note }}</small></h2>
                <TaoxCurveEditor v-model="c.value" v-model:selected="c.selected" :min="c.min" :max="c.max" :precision="c.precision" :snap="snap" />
                <div class="bar">
                    <button :disabled="!changed(c)" @click="reset(c)">Сбросить</button>
                    <span class="muted">точка {{ c.selected }}</span>
                </div>
                <pre>{{ JSON.stringify(c.value) }}</pre>
            </section>
        </div>
    </main>
</template>
