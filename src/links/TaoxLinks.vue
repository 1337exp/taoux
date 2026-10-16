<script lang="ts" setup>
import type { LinkLine, LinkPreview } from './types';

defineProps<{
    lines: readonly LinkLine[];
    selectedId?: string | null;
    preview?: LinkPreview | null;
    /** Подсвечивать наведённую и выбранную связь размытым свечением. */
    glow?: boolean;
}>();

const colorStyle = (line: LinkLine) => (line.color ? { '--tx-link-line-color': line.color } : undefined);
</script>

<template>
    <svg class="tx-links" width="1" height="1">
        <g
            v-for="line in lines"
            :key="line.id"
            class="tx-link"
            :class="{ selected: selectedId === line.id }"
            :data-conn-id="line.id"
            :style="colorStyle(line)"
        >
            <path v-if="glow" class="tx-link-glow" :d="line.d" />
            <path class="tx-link-line" :d="line.d" />
            <path v-if="line.head" class="tx-link-head" :d="line.head" />
            <path class="tx-link-hit" :d="line.d" />
        </g>

        <g v-if="preview" class="tx-link tx-link-preview" :class="{ invalid: preview.invalid }" :style="colorStyle(preview)">
            <path class="tx-link-line" :d="preview.d" />
            <path v-if="preview.head" class="tx-link-head" :d="preview.head" />
        </g>
    </svg>
</template>

<style>
/*
 * Настройка через CSS-переменные на любом предке:
 *   --tx-link-color, --tx-link-hover-color, --tx-link-selected-color, --tx-link-preview-color, --tx-link-invalid-color,
 *   --tx-link-width, --tx-link-width-active, --tx-link-hit, --tx-link-hit-coarse, --tx-link-glow (непрозрачность свечения).
 */
.tx-links {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
}

.tx-links path {
    fill: none;
    stroke-linecap: round;
    /* толщина в экранных пикселях, не зависит от зума */
    vector-effect: non-scaling-stroke;
}

.tx-link {
    --tx-link-now: var(--tx-link-line-color, var(--tx-link-color, #9ca3af));
}

/* Своего цвета у связи нет: наведение красит её в hover-цвет. Свой цвет при наведении остаётся (утолщается и светится). */
.tx-link:hover {
    --tx-link-now: var(--tx-link-line-color, var(--tx-link-hover-color, #fff));
}

.tx-link.selected {
    --tx-link-now: var(--tx-link-selected-color, #f59e0b);
}

.tx-link-line {
    stroke: var(--tx-link-now);
    stroke-width: var(--tx-link-width, 2);
    pointer-events: none;
}

.tx-link:hover .tx-link-line,
.tx-link.selected .tx-link-line {
    stroke-width: var(--tx-link-width-active, 3);
}

.tx-link-head {
    fill: var(--tx-link-now);
    stroke: none;
    pointer-events: none;
}

.tx-link-glow {
    stroke: var(--tx-link-now);
    stroke-width: 9;
    opacity: 0;
    filter: blur(3px);
    pointer-events: none;
}

.tx-link:hover .tx-link-glow,
.tx-link.selected .tx-link-glow {
    opacity: var(--tx-link-glow, 0.35);
}

.tx-link-hit {
    stroke: transparent;
    stroke-width: var(--tx-link-hit, 14);
    pointer-events: stroke;
    cursor: pointer;
}

/* Палец толще курсора: зона попадания по связи шире. */
@media (pointer: coarse) {
    .tx-link-hit {
        stroke-width: var(--tx-link-hit-coarse, 30);
    }
}

.tx-link-preview {
    --tx-link-now: var(--tx-link-line-color, var(--tx-link-preview-color, #f59e0b));
    opacity: 0.85;
}

.tx-link-preview .tx-link-line {
    stroke-dasharray: 6 4;
}

.tx-link-preview.invalid {
    --tx-link-now: var(--tx-link-invalid-color, #ef4444);
}
</style>
