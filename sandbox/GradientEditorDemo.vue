<script lang="ts" setup>
import { TaoButton, TaoSlider } from '@1337exp/taoui';
import { computed, ref } from 'vue';
import { removeStop, TaoxGradientEditor, toLinear, toSrgb, type GradientStop } from '../src/gradienteditor';
import SandboxShell from './SandboxShell.vue';

const stops = ref<GradientStop[]>([
    { t: 0, color: [1, 0.9, 0.4], alpha: 1 },
    { t: 0.5, color: [1, 0.35, 0.05], alpha: 0.8 },
    { t: 1, color: [0.3, 0.05, 0.02], alpha: 0 },
]);
const selected = ref(0);
const initial = JSON.stringify(stops.value);

const stop = computed(() => stops.value[Math.min(selected.value, stops.value.length - 1)]!);
const hex = computed(() => '#' + stop.value.color.map((c) => Math.round(toSrgb(c) * 255).toString(16).padStart(2, '0')).join(''));

function patch(p: Partial<GradientStop>) {
    stops.value = stops.value.map((s, i) => (i === selected.value ? { ...s, ...p } : s));
}
function onColor(e: Event) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec((e.target as HTMLInputElement).value);
    if (m) patch({ color: [m[1]!, m[2]!, m[3]!].map((h) => toLinear(parseInt(h, 16) / 255)) as GradientStop['color'] });
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
    <SandboxShell title="gradienteditor" note="Клик по полосе добавляет остановку, Alt+клик по ручке убирает, ручки тянутся. Цвета линейные, полоса показывает их в sRGB.">
        <section class="case" style="max-width: 380px">
            <TaoxGradientEditor v-model="stops" v-model:selected="selected" hint="Клик по полосе добавляет остановку" />
            <div class="row">
                <input type="color" :value="hex" @input="onColor" />
                <TaoSlider class="grow" variant="thin" size="small" :min="0" :max="1" :step="0.01" :model-value="stop.alpha" @update:model-value="(v) => patch({ alpha: Number(v) })" />
                <TaoButton size="small" variant="ghost" :disabled="stops.length <= 1" @click="remove">Убрать</TaoButton>
                <TaoButton size="small" variant="ghost" @click="reset">Сбросить</TaoButton>
            </div>
            <pre>{{ JSON.stringify(stops) }}</pre>
        </section>
    </SandboxShell>
</template>
