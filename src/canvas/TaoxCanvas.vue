<script lang="ts" setup generic="P">
import { computed, ref } from 'vue';
import { GRID } from '../snap';
import type { CanvasHost, CanvasOptions } from './host';
import { useCanvasGestures } from './useCanvasGestures';

const props = withDefaults(
    defineProps<{
        /** Мост к приложению. Должен быть стабильным объектом: холст берёт его один раз. */
        host: CanvasHost<P>;
        options: CanvasOptions<P>;
        /** Шаг мелкой сетки на фоне, мировые единицы. */
        grid?: number;
    }>(),
    { grid: GRID },
);

const root = ref<HTMLElement | null>(null);
const { marquee, debug, debugText, handlers } = useCanvasGestures(root, props.host, props.options);

const world = computed(() => {
    const { x, y, z } = props.host.camera;
    return { transform: `translate(${x}px, ${y}px) scale(${z})` };
});

const gridStyle = computed(() => {
    const { x, y, z } = props.host.camera;
    const small = props.grid * z;
    const big = small * 5;
    return {
        backgroundSize: `${small}px ${small}px, ${small}px ${small}px, ${big}px ${big}px, ${big}px ${big}px`,
        backgroundPosition: `${x}px ${y}px`,
    };
});

const marqueeStyle = computed(() => {
    const m = marquee.value;
    const rect = root.value?.getBoundingClientRect();
    if (!m || !rect) return {};
    return {
        left: `${Math.min(m.x0, m.x1) - rect.left}px`,
        top: `${Math.min(m.y0, m.y1) - rect.top}px`,
        width: `${Math.abs(m.x1 - m.x0)}px`,
        height: `${Math.abs(m.y1 - m.y0)}px`,
    };
});

defineExpose({ root });
</script>

<template>
    <div
        ref="root"
        class="tx-canvas"
        :class="{ connecting: host.connect?.origin != null }"
        tabindex="0"
        :style="gridStyle"
        @pointerdown="handlers.onPointerDown"
        @pointermove="handlers.onPointerMove"
        @pointerup="handlers.onPointerUp"
        @pointercancel="handlers.onPointerCancel"
        @lostpointercapture="handlers.onLostCapture"
        @wheel="handlers.onWheel"
        @contextmenu.prevent
        @dblclick="handlers.onDblClick"
    >
        <!-- Мир: сюда приложение кладёт контейнеры, слой связей и ноды в нужном порядке. -->
        <div class="tx-canvas-world" :style="world">
            <slot />
        </div>

        <div v-if="marquee" class="tx-canvas-marquee" :style="marqueeStyle" />
        <div v-if="debug" class="tx-canvas-debug">{{ debugText }}</div>

        <!-- Поверх мира, в экранных координатах. -->
        <slot name="overlay" />
    </div>
</template>

<style>
/*
 * Настройка через CSS-переменные на холсте или предке:
 *   --tx-canvas-bg, --tx-canvas-grid-minor, --tx-canvas-grid-major, --tx-canvas-accent, --tx-canvas-accent-subtle.
 */
.tx-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    outline: none;
    background-color: var(--tx-canvas-bg, #1b1d21);
    background-image:
        linear-gradient(to right, var(--tx-canvas-grid-minor, rgba(255, 255, 255, 0.035)) 1px, transparent 1px),
        linear-gradient(to bottom, var(--tx-canvas-grid-minor, rgba(255, 255, 255, 0.035)) 1px, transparent 1px),
        linear-gradient(to right, var(--tx-canvas-grid-major, rgba(255, 255, 255, 0.07)) 1px, transparent 1px),
        linear-gradient(to bottom, var(--tx-canvas-grid-major, rgba(255, 255, 255, 0.07)) 1px, transparent 1px);
    touch-action: none;
    /* Сенсор: без выделения текста, лупы и подсветки тапа; в полях ввода текст выделяется как обычно. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
}

.tx-canvas textarea,
.tx-canvas input {
    -webkit-user-select: text;
    user-select: text;
}

.tx-canvas-world {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    transform-origin: 0 0;
}

.tx-canvas-marquee {
    position: absolute;
    border: 1px solid var(--tx-canvas-accent, #f59e0b);
    background: var(--tx-canvas-accent-subtle, rgba(245, 158, 11, 0.1));
    pointer-events: none;
}

.tx-canvas-debug {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font: 12px/1.3 monospace;
    pointer-events: none;
}
</style>
