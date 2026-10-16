<script lang="ts" setup>
import { computed, ref } from 'vue';
import { removeStop, TaoxGradientEditor, toLinear, toSrgb, type GradientStop } from '../src/gradienteditor';

// В песочнице поля стопа (цвет, альфа) сделаны на нативных элементах; в проектах их делают тем UI-китом, какой там принят.
const stops = ref<GradientStop[]>([
    { t: 0, color: [1, 0.9, 0.4], alpha: 1 },
    { t: 0.5, color: [1, 0.35, 0.05], alpha: 0.8 },
    { t: 1, color: [0.3, 0.05, 0.02], alpha: 0 },
]);
const selected = ref(0);
const initial = JSON.stringify(stops.value);

const stop = computed(() => stops.value[Math.min(selected.value, stops.value.length - 1)]!);
const hex = computed(
    () =>
        '#' +
        stop.value.color
            .map((c) =>
                Math.round(toSrgb(c) * 255)
                    .toString(16)
                    .padStart(2, '0'),
            )
            .join(''),
);

function patch(p: Partial<GradientStop>) {
    stops.value = stops.value.map((s, i) => (i === selected.value ? { ...s, ...p } : s));
}
function onColor(e: Event) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((e.target as HTMLInputElement).value);
    if (m) patch({ color: [m[1]!, m[2]!, m[3]!].map((h) => toLinear(parseInt(h, 16) / 255)) as GradientStop['color'] });
}
function onAlpha(e: Event) {
    patch({ alpha: Number((e.target as HTMLInputElement).value) });
}
function remove() {
    stops.value = removeStop(stops.value, selected.value);
    selected.value = 0;
}
function reset() {
    stops.value = JSON.parse(initial) as GradientStop[];
    selected.value = 0;
}
</script>

<template>
    <main class="page">
        <h1>gradienteditor</h1>
        <p class="muted">Клик по полосе добавляет остановку, Alt+клик по ручке убирает, ручки тянутся. Цвета линейные, полоса показывает их в sRGB.</p>

        <section class="case" style="max-width: 360px">
            <TaoxGradientEditor v-model="stops" v-model:selected="selected" hint="Клик по полосе добавляет остановку" />
            <div class="bar">
                <input type="color" :value="hex" @input="onColor" />
                <label class="bar">alpha <input type="range" min="0" max="1" step="0.01" :value="stop.alpha" @input="onAlpha" /></label>
                <button :disabled="stops.length <= 1" @click="remove">Убрать</button>
                <button @click="reset">Сбросить</button>
            </div>
            <pre>{{ JSON.stringify(stops) }}</pre>
        </section>
    </main>
</template>
