<script lang="ts" setup>
import type { LinkDash, LinkLine, LinkPreview } from './types';

defineProps<{
    lines: readonly LinkLine[];
    selectedId?: string | null;
    preview?: LinkPreview | null;
    /**
     * Highlight the hovered and selected link with a blurred glow.
     * Подсвечивать наведённую и выбранную связь размытым свечением.
     */
    glow?: boolean;
}>();

// Own colour and thickness go as variables: a link without them renders as before.
// Свои цвет и толщина идут переменными: связь без них рисуется как раньше.
function lineStyle(line: LinkLine) {
    const style: Record<string, string> = {};
    if (line.color) style['--tx-link-line-color'] = line.color;
    if (typeof line.width === 'number' && Number.isFinite(line.width) && line.width > 0) {
        style['--tx-link-line-width'] = String(line.width);
        style['--tx-link-line-width-active'] = String(line.width + 1);
    }
    return Object.keys(style).length ? style : undefined;
}

const dashClass = (dash: LinkDash | undefined) => (dash === 'dashed' ? 'tx-link-dashed' : dash === 'dotted' ? 'tx-link-dotted' : undefined);
</script>

<template>
    <svg class="tx-links" width="1" height="1">
        <g
            v-for="line in lines"
            :key="line.id"
            class="tx-link"
            :class="[{ selected: selectedId === line.id }, dashClass(line.dash)]"
            :data-conn-id="line.id"
            :style="lineStyle(line)"
        >
            <path v-if="glow" class="tx-link-glow" :d="line.d" />
            <path class="tx-link-line" :d="line.d" />
            <path v-if="line.head" class="tx-link-head" :d="line.head" />
            <path class="tx-link-hit" :d="line.d" />
        </g>

        <g v-if="preview" class="tx-link tx-link-preview" :class="[{ invalid: preview.invalid }, dashClass(preview.dash)]" :style="lineStyle(preview)">
            <path class="tx-link-line" :d="preview.d" />
            <path v-if="preview.head" class="tx-link-head" :d="preview.head" />
        </g>
    </svg>
</template>

<style>
/*
 * Configured with CSS variables on any ancestor:
 * Настройка через CSS-переменные на любом предке:
 *   --tx-link-color, --tx-link-hover-color, --tx-link-selected-color, --tx-link-preview-color, --tx-link-invalid-color,
 * --tx-link-width, --tx-link-width-active, --tx-link-hit, --tx-link-hit-coarse, --tx-link-glow (opacity of the glow).
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
    /* thickness in screen pixels, independent of zoom / толщина в экранных пикселях, не зависит от зума */
    vector-effect: non-scaling-stroke;
}

.tx-link {
    --tx-link-now: var(--tx-link-line-color, var(--tx-link-color, #9ca3af));
}

/* A link without its own colour turns the hover colour on hover. An own colour stays on hover (it gets thicker and glows). / Своего цвета у связи нет: наведение красит её в hover-цвет. Свой цвет при наведении остаётся (утолщается и светится). */
.tx-link:hover {
    --tx-link-now: var(--tx-link-line-color, var(--tx-link-hover-color, #fff));
}

.tx-link.selected {
    --tx-link-now: var(--tx-link-selected-color, #f59e0b);
}

.tx-link-line {
    stroke: var(--tx-link-now);
    stroke-width: var(--tx-link-line-width, var(--tx-link-width, 2));
    pointer-events: none;
}

.tx-link:hover .tx-link-line,
.tx-link.selected .tx-link-line {
    stroke-width: var(--tx-link-line-width-active, var(--tx-link-width-active, 3));
}

/*
 * Line styles. The pattern is in line widths (`--tx-link-width` is a plain number, as the width is), in screen pixels
 * because of non-scaling-stroke. The round caps add half a width to both ends of a dash: dashes 4w long with gaps 2w,
 * and dots of one width with a gap of one width. The hover width does not change the pattern.
 * Стили линии. Узор в толщинах линии (`--tx-link-width` — просто число, как и толщина), в экранных пикселях из-за
 * non-scaling-stroke. Круглые концы прибавляют полтолщины с обеих сторон штриха: штрихи длиной 4w с пропусками 2w
 * и точки в одну толщину с пропуском в одну толщину. Толщина при наведении узор не меняет.
 */
.tx-link-dashed .tx-link-line {
    stroke-dasharray: calc(var(--tx-link-line-width, var(--tx-link-width, 2)) * 3px) calc(var(--tx-link-line-width, var(--tx-link-width, 2)) * 3px);
}

.tx-link-dotted .tx-link-line {
    stroke-dasharray: 0 calc(var(--tx-link-line-width, var(--tx-link-width, 2)) * 2px);
}

/* The selector is as specific as `.tx-links path` above: with a shorter one `fill: none` won and the arrowhead was invisible. / Селектор той же специфичности, что у `.tx-links path` выше: с коротким побеждал `fill: none`, и наконечник не был виден. */
.tx-links .tx-link-head {
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

/* A finger is thicker than a cursor: the hit area of a link is wider. / Палец толще курсора: зона попадания по связи шире. */
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

.tx-link-preview.tx-link-dashed .tx-link-line {
    stroke-dasharray: calc(var(--tx-link-line-width, var(--tx-link-width, 2)) * 3px) calc(var(--tx-link-line-width, var(--tx-link-width, 2)) * 3px);
}

.tx-link-preview.tx-link-dotted .tx-link-line {
    stroke-dasharray: 0 calc(var(--tx-link-line-width, var(--tx-link-width, 2)) * 2px);
}

.tx-link-preview.invalid {
    --tx-link-now: var(--tx-link-invalid-color, #ef4444);
}
</style>
