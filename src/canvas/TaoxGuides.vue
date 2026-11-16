<script lang="ts" setup>
import type { GuideLine } from '../guides';

/**
 * The alignment guides of a drag, drawn: thin lines through the coinciding edges and centres that `snapToGuides` returns.
 * Put it in the world of the canvas, over the nodes (the lines are in world units); the thickness is in screen pixels
 * whatever the zoom, and clicks pass through. Nothing is drawn while the list is empty.
 * Направляющие переноса, нарисованные: тонкие линии через совпавшие края и центры, которые возвращает `snapToGuides`.
 * Кладите в мир холста поверх нод (линии в мировых единицах); толщина в пикселях экрана при любом масштабе, клики
 * проходят насквозь. Пока список пуст, ничего не рисуется.
 */
defineProps<{
    lines: readonly GuideLine[];
}>();
</script>

<template>
    <svg v-if="lines.length > 0" class="tx-guides" width="1" height="1" aria-hidden="true">
        <line
            v-for="(line, i) in lines"
            :key="`${line.axis}:${line.at}:${i}`"
            :x1="line.axis === 'x' ? line.at : line.from"
            :y1="line.axis === 'x' ? line.from : line.at"
            :x2="line.axis === 'x' ? line.at : line.to"
            :y2="line.axis === 'x' ? line.to : line.at"
        />
    </svg>
</template>

<style>
/*
 * Configured with CSS variables on any ancestor:
 * Настройка через CSS-переменные на любом предке:
 *   --tx-guide-color, --tx-guide-width (screen px, 1), --tx-guide-dash (a `stroke-dasharray`, `none` by default).
 */
.tx-guides {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
}

.tx-guides line {
    stroke: var(--tx-guide-color, #38bdf8);
    stroke-width: var(--tx-guide-width, 1);
    stroke-dasharray: var(--tx-guide-dash, none);
    vector-effect: non-scaling-stroke;
}
</style>
