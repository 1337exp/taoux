<script lang="ts" setup>
import SandboxShell from './SandboxShell.vue';

// Новая демо-страница: добавь строку сюда и пару файлов <имя>.html + <имя>.ts
// Сверху модули TaoUX сами по себе, снизу всё, где участвует TaoUI.
const own = [
    { name: 'curveeditor', note: 'редактор кривой: сетка, шаг, границы, знаки, автопрокрутка' },
    { name: 'gradienteditor', note: 'полоса градиента: остановки, добавление и удаление' },
];
const withTaoui = [
    { name: 'curvefield', note: 'кривая с полями на TaoUI: точка, переход (ease), шаг, сброс' },
    { name: 'playback', note: 'usePlayback (TaoUX) ведёт время, TaoTimeline (TaoUI) показывает: цикл, скорость, перемотка' },
    { name: 'color', note: 'TaoColorPicker и TaoColorInput из TaoUI 3.1: палитра, прозрачность, образцы, colorModel для своего хранилища' },
    { name: 'slider', note: 'TaoSlider и TaoRangeSlider из TaoUI 3: диапазон, метки, ступени, вертикальный, таймлайн' },
];
</script>

<template>
    <SandboxShell title="taoux · sandbox" note="Демо и поле для проверки модулей. Страницы берут код прямо из src/ и показаны вместе с TaoUI: так видно, как они работают в паре.">
        <ul>
            <li v-for="p in own" :key="p.name">
                <a :href="`./${p.name}.html`">{{ p.name }}</a> <span class="muted">{{ p.note }}</span>
            </li>
        </ul>

        <div class="divider">Ниже всё, где участвует TaoUI</div>

        <ul>
            <li v-for="p in withTaoui" :key="p.name">
                <a :href="`./${p.name}.html`">{{ p.name }}</a> <span class="muted">{{ p.note }}</span>
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
