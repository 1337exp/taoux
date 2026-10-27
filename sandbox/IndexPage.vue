<script lang="ts" setup>
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// A new demo page: add a row here and a pair of files <name>.html + <name>.ts.
// TaoUX modules on their own on top, everything that involves TaoUI below.
// Новая демо-страница: добавь строку сюда и пару файлов. Сверху модули TaoUX сами по себе, снизу всё, где участвует TaoUI.
const own = [
    { name: 'curveeditor', note: ['curve editor: grid, snapping, bounds, decimals, auto-scroll', 'редактор кривой: сетка, шаг, границы, знаки, автопрокрутка'] as const },
    { name: 'gradienteditor', note: ['gradient bar: stops, adding and removing', 'полоса градиента: остановки, добавление и удаление'] as const },
];
const withTaoui = [
    { name: 'curvefield', note: ['a curve with TaoUI fields: point, transition (ease), step, reset', 'кривая с полями на TaoUI: точка, переход (ease), шаг, сброс'] as const },
    { name: 'playback', note: ['usePlayback (TaoUX) drives the time, TaoScrubber (TaoUI) shows it: loop, speed, seeking', 'usePlayback (TaoUX) ведёт время, TaoScrubber (TaoUI) показывает: цикл, скорость, перемотка'] as const },
    { name: 'color', note: ['TaoColorPicker and TaoColorInput from TaoUI: palette, opacity, swatches, colorModel for your own storage', 'TaoColorPicker и TaoColorInput из TaoUI 3.1: палитра, прозрачность, образцы, colorModel для своего хранилища'] as const },
    { name: 'slider', note: ['TaoSlider and TaoRangeSlider from TaoUI: range, marks, steps, vertical, timeline', 'TaoSlider и TaoRangeSlider из TaoUI 3: диапазон, метки, ступени, вертикальный, таймлайн'] as const },
];
</script>

<template>
    <SandboxShell :title="tr('taoux · sandbox', 'taoux · песочница')" :note="tr('A demo and a testing ground for the modules. The pages take their code straight from src/ and run with TaoUI, so you can see how they work as a pair.', 'Демо и поле для проверки модулей. Страницы берут код прямо из src/ и показаны вместе с TaoUI: так видно, как они работают в паре.')">
        <ul>
            <li v-for="p in own" :key="p.name">
                <a :href="`./${p.name}.html`">{{ p.name }}</a> <span class="muted">{{ tr(p.note[0], p.note[1]) }}</span>
            </li>
        </ul>

        <div class="divider">{{ tr('Below: everything that involves TaoUI', 'Ниже всё, где участвует TaoUI') }}</div>

        <ul>
            <li v-for="p in withTaoui" :key="p.name">
                <a :href="`./${p.name}.html`">{{ p.name }}</a> <span class="muted">{{ tr(p.note[0], p.note[1]) }}</span>
            </li>
        </ul>
    </SandboxShell>
</template>

<style scoped>
.divider {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 4px;
    color: var(--tao-color-text-muted);
    font-size: 12px;
}

.divider::before,
.divider::after {
    content: '';
    flex: 1;
    border-top: 1px dashed var(--tao-color-border-strong);
}

.divider::before {
    flex: 0 0 12px;
}
</style>
