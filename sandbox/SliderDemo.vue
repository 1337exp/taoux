<script lang="ts" setup>
import { TaoButton, TaoInputNumber, TaoRangeSlider, TaoSlider } from '@1337exp/taoui';
import { computed, onBeforeUnmount, ref } from 'vue';
import SandboxShell from './SandboxShell.vue';

// Страница показывает слайдеры TaoUI 3 в тех сочетаниях, из которых строятся фильтры, таймлайны и параметры.

const single = ref(35);
const volume = ref(70);

//--- Цена и карат: диапазон с числовыми полями
const price = ref<[number, number]>([200, 5000]);
const money = (v: number) => `$${v.toLocaleString('en-US')}`;
const carat = ref<[number, number]>([1, 30]);

//--- Ступенчатые шкалы с подписями (Color, Clarity, Cut)
const color = ref<[number, number]>([3, 7]);
const colorMarks = ['K', 'J', 'I', 'H', 'G', 'F', 'E', 'D'].map((label, value) => ({ value, label }));
const clarity = ref<[number, number]>([2, 6]);
const clarityMarks = ['SI2', 'SI1', 'VS2', 'VS1', 'VVS2', 'VVS1', 'IF', 'FL'].map((label, value) => ({ value, label }));
const cut = ref(2);
const cutMarks = ['Good', 'Very Good', 'Ideal', 'Astor ideal'].map((label, value) => ({ value, label }));

//--- Вертикальные
const level = ref(60);
const band = ref<[number, number]>([20, 70]);

//--- Таймлайн: тонкий слайдер с метками событий и подписью времени
const LENGTH = 8;
const time = ref(1.25);
const playing = ref(false);
const events = [0, 2, 4, 6].map((value) => ({ value, label: `${value} с` }));
let frame = 0;
let last = 0;
function tick(now: number) {
    time.value = (time.value + (now - last) / 1000) % LENGTH;
    last = now;
    frame = requestAnimationFrame(tick);
}
function toggle() {
    playing.value = !playing.value;
    cancelAnimationFrame(frame);
    if (playing.value) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
    }
}
onBeforeUnmount(() => cancelAnimationFrame(frame));
const timeText = computed(() => `${time.value.toFixed(2)} / ${LENGTH.toFixed(1)} с`);

const json = computed(() => JSON.stringify({ single: single.value, price: price.value, carat: carat.value, color: color.value, clarity: clarity.value, cut: cut.value, level: level.value, band: band.value }));
</script>

<template>
    <SandboxShell title="slider" note="TaoSlider (одна ручка) и TaoRangeSlider (две) из TaoUI 3: метки, ступени с подписями, вертикальная ориентация. Ручки двигаются мышью, стрелками, Home/End; клик по подписи метки переносит ручку.">
        <div class="grid">
            <section class="case">
                <h2>TaoSlider <small>bar, thin, showValue, wheel</small></h2>
                <TaoSlider v-model="single" show-value />
                <TaoSlider v-model="volume" variant="thin" :wheel="5" />
                <p class="muted">{{ single }} · {{ volume }} (колёсико над нижним меняет на 5)</p>
            </section>

            <section class="case">
                <h2>Price <small>TaoRangeSlider + два поля</small></h2>
                <div class="row">
                    <TaoInputNumber class="grow" size="small" :min="0" :max="price[1]" :step="100" :controls="false" :model-value="price[0]" @update:model-value="(v) => v !== null && (price = [v, price[1]])" />
                    <TaoInputNumber class="grow" size="small" :min="price[0]" :max="5000000" :step="100" :controls="false" :model-value="price[1]" @update:model-value="(v) => v !== null && (price = [price[0], v])" />
                </div>
                <TaoRangeSlider v-model="price" :min="0" :max="5000" :step="100" :format="money" :marks="[0, 1000, 2500, 5000]" />
            </section>

            <section class="case">
                <h2>Carat <small>диапазон, зазор 0.5, шаг 0.1</small></h2>
                <TaoRangeSlider v-model="carat" :min="0.5" :max="30" :step="0.1" :min-gap="0.5" marks show-value :format="(v) => v.toFixed(2)" />
            </section>

            <section class="case">
                <h2>Color <small>ступени с подписями, диапазон</small></h2>
                <TaoRangeSlider v-model="color" :min="0" :max="7" :marks="colorMarks" discrete />
            </section>

            <section class="case">
                <h2>Color flat <small>сведи диапазон в точку: верхний слайдер её не показывает</small></h2>
                <TaoRangeSlider v-model="color" :min="0" :max="7" :marks="colorMarks" discrete flat />
                <TaoRangeSlider v-model="color" :min="0" :max="7" :marks="colorMarks" discrete flat collapsed-mark />
                <p class="muted">нижний с collapsedMark: в точке виден штрих (по умолчанию его нет)</p>
            </section>

            <section class="case">
                <h2>Clarity <small>ступени, диапазон</small></h2>
                <TaoRangeSlider v-model="clarity" :min="0" :max="7" :marks="clarityMarks" discrete />
            </section>

            <section class="case">
                <h2>Cut <small>ступени, одна ручка</small></h2>
                <TaoSlider v-model="cut" :min="0" :max="3" :marks="cutMarks" discrete />
            </section>

            <section class="case">
                <h2>vertical <small>с метками, thin, без меток, flat</small></h2>
                <div class="row" style="gap: 40px; padding: 8px 12px">
                    <TaoSlider v-model="level" vertical marks />
                    <TaoRangeSlider v-model="band" vertical marks />
                    <TaoSlider v-model="level" vertical variant="thin" :marks="[0, 50, 100]" />
                    <TaoSlider v-model="level" vertical />
                    <TaoRangeSlider v-model="band" vertical flat />
                </div>
            </section>

            <section class="case">
                <h2>Flat <small>без круглых ручек: плоская полоса</small></h2>
                <TaoSlider v-model="single" flat />
                <TaoRangeSlider v-model="price" :min="0" :max="5000" :step="100" flat marks :format="money" />
            </section>

            <section class="case">
                <h2>Таймлайн (средняя) <small>bar + метки событий + кнопка</small></h2>
                <div class="row" style="align-items: flex-start">
                    <TaoButton size="small" variant="secondary" @click="toggle">{{ playing ? '❚❚' : '▶' }}</TaoButton>
                    <TaoSlider v-model="time" class="grow" style="margin-top: 5px" size="small" :min="0" :max="LENGTH" :step="0.01" :marks="events" />
                    <span class="muted" style="margin-top: 4px">{{ timeText }}</span>
                </div>
            </section>

            <section class="case">
                <h2>Таймлайн (тонкая) <small>thin + метки событий + кнопка</small></h2>
                <div class="row" style="align-items: flex-start">
                    <TaoButton size="small" variant="secondary" @click="toggle">{{ playing ? '❚❚' : '▶' }}</TaoButton>
                    <TaoSlider v-model="time" class="grow" style="margin-top: 5px" variant="thin" size="small" :min="0" :max="LENGTH" :step="0.01" :marks="events" />
                    <span class="muted" style="margin-top: 4px">{{ timeText }}</span>
                </div>
            </section>
        </div>
        <pre class="muted" style="margin-top: 16px; font-size: 11px">{{ json }}</pre>
    </SandboxShell>
</template>
