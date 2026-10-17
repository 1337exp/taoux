<script lang="ts" setup>
import { colorModel, TaoButton, TaoColorInput, TaoSlider } from '@1337exp/taoui';
import { computed, ref } from 'vue';
import { patchStop, removeStop, TaoxGradientEditor, type GradientStop } from '../src/gradienteditor';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

const stops = ref<GradientStop[]>([
    { t: 0, color: [1, 0.9, 0.4], alpha: 1 },
    { t: 0.5, color: [1, 0.35, 0.05], alpha: 0.8 },
    { t: 1, color: [0.3, 0.05, 0.02], alpha: 0 },
]);
const selected = ref(0);
const initial = JSON.stringify(stops.value);

const stop = computed(() => stops.value[Math.min(selected.value, stops.value.length - 1)]!);
// The stop colour is a linear 0…1 array, TaoColorInput speaks sRGB hex: colorModel converts both ways / Цвет остановки хранится линейным массивом 0…1, TaoColorInput говорит hex в sRGB: colorModel переводит туда и обратно
const color = computed({ get: () => stop.value.color as number[], set: (c) => patch({ color: c as GradientStop['color'] }) });
const hex = colorModel(color, { format: 'array', range: 1, space: 'linear' });

function patch(p: Partial<GradientStop>) {
    stops.value = patchStop(stops.value, selected.value, p); // alpha and t are cut to three decimals / альфа и t обрезаются до трёх знаков
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
    <SandboxShell title="gradienteditor" :note="tr('A click on the bar adds a stop, Alt+click on a handle removes it, handles can be dragged. Colours are linear; the bar shows them in sRGB.', 'Клик по полосе добавляет остановку, Alt+клик по ручке убирает, ручки тянутся. Цвета линейные, полоса показывает их в sRGB.')">
        <section class="case" style="max-width: 380px">
            <TaoxGradientEditor v-model="stops" v-model:selected="selected" :hint="tr('A click on the bar adds a stop', 'Клик по полосе добавляет остановку')" />
            <div class="row">
                <TaoColorInput v-model="hex" size="small" />
                <TaoSlider class="grow" variant="thin" size="small" :min="0" :max="1" :step="0.01" :model-value="stop.alpha" @update:model-value="(v) => patch({ alpha: Number(v) })" />
                <TaoButton size="small" variant="ghost" :disabled="stops.length <= 1" @click="remove">{{ tr('Remove', 'Убрать') }}</TaoButton>
                <TaoButton size="small" variant="ghost" @click="reset">{{ tr('Reset', 'Сбросить') }}</TaoButton>
            </div>
            <pre>{{ JSON.stringify(stops) }}</pre>
        </section>
    </SandboxShell>
</template>
