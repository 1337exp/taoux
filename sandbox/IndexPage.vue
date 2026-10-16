<script lang="ts" setup>
import SandboxShell from './SandboxShell.vue';

// Новая демо-страница: добавь строку сюда и пару файлов <имя>.html + <имя>.ts
const pages = [
    { name: 'curveeditor', note: 'редактор кривой: сетка, шаг, границы, знаки, автопрокрутка' },
    { name: 'gradienteditor', note: 'полоса градиента: остановки, добавление и удаление' },
    { name: 'slider', note: 'TaoSlider и TaoRangeSlider из TaoUI 3: диапазон, метки, ступени, вертикальный, таймлайн' },
];
</script>

<template>
    <SandboxShell title="taoux · sandbox" note="Демо и поле для проверки модулей. Страницы берут код прямо из src/ и показаны вместе с TaoUI: так видно, как они работают в паре.">
        <ul>
            <li v-for="p in pages" :key="p.name">
                <a :href="`./${p.name}.html`">{{ p.name }}</a> <span class="muted">{{ p.note }}</span>
            </li>
        </ul>
    </SandboxShell>
</template>
