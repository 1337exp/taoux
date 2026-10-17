<script lang="ts" setup>
import { colorModel, TaoColorInput, TaoColorPicker } from '@1337exp/taoui';
import { computed, ref } from 'vue';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// The component speaks a hex string; your own formats (numbers, linear colour) go through colorModel. / Компонент говорит строкой hex; свои форматы (числа, линейный цвет) подключает colorModel.
const swatches = ['#ff5252', '#ff9800', '#ffd740', '#69f0ae', '#40c4ff', '#7c4dff', '#e040fb', '#ffffff', '#9e9e9e', '#000000'];

const plain = ref('#ff8800');
const withAlpha = ref('#40c4ff80');
const inline = ref('#7c4dff');

//--- свои хранилища цвета
const rgb = ref({ r: 255, g: 136, b: 0 });
const rgbHex = colorModel(rgb);

const linear = ref<number[]>([1, 0.2, 0.05]);
const linearHex = colorModel(linear, { format: 'array', range: 1, space: 'linear' });

const rgba = ref({ r: 64, g: 196, b: 255, a: 0.5 });
const rgbaHex = colorModel(rgba, { alpha: true });

const css = ref('rgb(124 77 255 / 0.8)');
const cssHex = colorModel(css, { format: 'css', alpha: true });

const state = computed(() => JSON.stringify({ plain: plain.value, withAlpha: withAlpha.value, rgb: rgb.value, linear: linear.value, rgba: rgba.value, css: css.value }));
</script>

<template>
    <SandboxShell title="color" :note="tr('TaoColorPicker (a palette) and TaoColorInput (a field with the palette in a popover) from TaoUI. The value is a hex string; colorModel converts it to your storage: object, array, css, 0…255 or 0…1, sRGB or linear colour.', 'TaoColorPicker (палитра) и TaoColorInput (поле с палитрой во всплывающем окне) из TaoUI. Значение это строка hex; colorModel переводит её в ваше хранилище: объект, массив, css, 0…255 или 0…1, sRGB или линейный цвет.')">
        <div class="grid">
            <section class="case">
                <h2>TaoColorInput <small>{{ tr('colour field, swatches', 'поле цвета, образцы') }}</small></h2>
                <div class="row">
                    <TaoColorInput v-model="plain" :swatches="swatches" />
                    <TaoColorInput v-model="plain" size="small" :swatches="swatches" />
                </div>
                <p class="muted">{{ tr('Press it: the palette opens. Esc closes, Tab walks through the parts.', 'Нажми: откроется палитра. Esc закрывает, Tab ходит по частям.') }}</p>
            </section>

            <section class="case">
                <h2>{{ tr('With opacity', 'С прозрачностью') }} <small>alpha, #rrggbbaa</small></h2>
                <TaoColorInput v-model="withAlpha" alpha :swatches="swatches" />
                <p class="muted">{{ withAlpha }}</p>
            </section>

            <section class="case">
                <h2>TaoColorPicker <small>{{ tr('an inline palette', 'встроенная палитра') }}</small></h2>
                <TaoColorPicker v-model="inline" :swatches="swatches" />
                <p class="muted">{{ inline }}</p>
            </section>

            <section class="case">
                <h2>colorModel <small>{{ tr('your own storage', 'свои хранилища') }}</small></h2>
                <div class="row"><TaoColorInput v-model="rgbHex" size="small" /> <span class="muted">{{ tr('object 0…255', 'объект 0…255') }}</span></div>
                <div class="row"><TaoColorInput v-model="linearHex" size="small" /> <span class="muted">{{ tr('array 0…1, linear colour (like the gradient editor)', 'массив 0…1, линейный цвет (как у редактора градиента)') }}</span></div>
                <div class="row"><TaoColorInput v-model="rgbaHex" size="small" alpha /> <span class="muted">{{ tr('object with alpha', 'объект с alpha') }}</span></div>
                <div class="row"><TaoColorInput v-model="cssHex" size="small" alpha /> <span class="muted">{{ tr('css string', 'строка css') }}</span></div>
            </section>
        </div>
        <pre class="muted" style="margin-top: 16px; font-size: 11px">{{ state }}</pre>
    </SandboxShell>
</template>
