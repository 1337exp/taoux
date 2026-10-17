# TaoUX and TaoUI: how to connect them

**English** · [Русский](taoui.ru.md)

**The main thing to know up front:** TaoUX and TaoUI are two separate packages, and there is no ready-made module that joins them. TaoUX has no TaoUI buttons, fields or sliders, and TaoUI knows nothing about TaoUX. Connecting them is up to you, and the connection is only two things:

1. **Colors and sizes.** TaoUX components are styled by their own `--tx-*` CSS variables. You map them to the TaoUI `--tao-*` tokens once.
2. **Values.** State from TaoUX (time, curve points, gradient stops) goes to TaoUI components through `v-model`.

That is all. TaoUX works without TaoUI (every variable has a dark default), and TaoUI works without TaoUX even more so.

## Who may depend on whom

TaoUI is tier 0: self-contained, it depends on nothing from this family. TaoUX is tier 1: its modules may use TaoUI, but never the other way round. That is why `@1337exp/taoui` is only in TaoUX's `devDependencies` (for the sandbox), and your project needs both packages side by side:

```bash
npm install @1337exp/taoux @1337exp/taoui
```

## Step 1. Styles

```ts
import '@1337exp/taoui/styles.css';          // TaoUI tokens and components
import '@1337exp/taoux/canvas.css';          // styles of TaoUX Vue modules are imported explicitly
import '@1337exp/taoux/links.css';
import '@1337exp/taoux/curveeditor.css';
import '@1337exp/taoux/gradienteditor.css';
```

Import the CSS only of the modules you use. Modules without components (`camera`, `history`, `playback` and others) have no styles.

## Step 2. Theme: map `--tx-*` to `--tao-*`

Put this into the project's global CSS. The variables are set on `:root`, so a TaoUI theme (for example `data-tao-theme="light"`) switches the TaoUX components too:

```css
:root {
    /* Canvas */
    --tx-canvas-bg: var(--tao-color-bg);
    --tx-canvas-grid-minor: color-mix(in srgb, var(--tao-color-text) 4%, transparent);
    --tx-canvas-grid-major: color-mix(in srgb, var(--tao-color-text) 8%, transparent);
    --tx-canvas-accent: var(--tao-color-accent);
    --tx-canvas-accent-subtle: var(--tao-color-accent-subtle);

    /* Links */
    --tx-link-color: var(--tao-color-text-muted);
    --tx-link-hover-color: var(--tao-color-text);
    --tx-link-selected-color: var(--tao-color-accent);
    --tx-link-preview-color: var(--tao-color-accent);
    --tx-link-invalid-color: var(--tao-color-danger);

    /* Curve editor */
    --tx-curve-bg: var(--tao-color-surface-sunken);
    --tx-curve-border: var(--tao-color-border);
    --tx-curve-grid: var(--tao-color-border);
    --tx-curve-label: var(--tao-color-text-muted);
    --tx-curve-text: var(--tao-color-text);
    --tx-curve-accent: var(--tao-color-accent);

    /* Gradient editor */
    --tx-gradient-border: var(--tao-color-border);
    --tx-gradient-stop-border: var(--tao-color-border-strong);
    --tx-gradient-accent: var(--tao-color-accent);
}
```

The full list of variables of each module is in the comment at the top of its styles (`src/<module>/*.vue`). Whatever you do not map keeps its default value.

## Step 3. Values: connection examples

### Playback: `usePlayback` and `TaoTimeline`

TaoUX drives the time, TaoUI shows it. The connection is two `v-model`s:

```vue
<script setup lang="ts">
import { TaoTimeline } from '@1337exp/taoui';
import { usePlayback } from '@1337exp/taoux/playback';

const clip = usePlayback({ length: 8, loop: true });
</script>

<template>
    <TaoTimeline v-model="clip.time.value" v-model:playing="clip.playing.value" :length="8" :marks="[0, 2, 4, 6]" />
</template>
```

`usePlayback` returns refs inside a plain object, so the template needs `.value`. Without Vue, `createPlayback` from the same module does the same.

### Curve: `TaoxCurveEditor` and TaoUI fields

TaoUX gives the plot (grid, snapping, bounds, auto-scroll at the edge); the «Time» and «Value» fields and everything else (snap switch, buttons) you assemble from TaoUI components:

```vue
<script setup lang="ts">
import { TaoInputNumber } from '@1337exp/taoui';
import { movePoint, TaoxCurveEditor, type CurvePoint } from '@1337exp/taoux/curveeditor';
import { ref } from 'vue';

const points = ref<CurvePoint[]>([{ t: 0, v: 0 }, { t: 1, v: 1 }]);
const selected = ref(0);

const set = (field: 't' | 'v', value: number | null) => {
    if (value === null) return;
    const p = points.value[selected.value]!;
    points.value = movePoint(points.value, selected.value, field === 't' ? value : p.t, field === 'v' ? value : p.v);
};
</script>

<template>
    <TaoxCurveEditor v-model="points" v-model:selected="selected" :min="0" :precision="2" />
    <TaoInputNumber :model-value="points[selected]!.t" @update:model-value="(v) => set('t', v)" />
    <TaoInputNumber :model-value="points[selected]!.v" @update:model-value="(v) => set('v', v)" />
</template>
```

### Gradient: `TaoxGradientEditor`, opacity from TaoUI

TaoUX draws the bar with handles, a `TaoSlider` sets the opacity. Change a stop through `patchStop`: it rounds `t`, opacity and color to a sensible number of decimals:

```vue
<script setup lang="ts">
import { TaoSlider } from '@1337exp/taoui';
import { patchStop, TaoxGradientEditor, type GradientStop } from '@1337exp/taoux/gradienteditor';
import { ref } from 'vue';

const stops = ref<GradientStop[]>([
    { t: 0, color: [1, 0.9, 0.4], alpha: 1 },
    { t: 1, color: [0.3, 0.05, 0.02], alpha: 0 },
]);
const selected = ref(0);
</script>

<template>
    <TaoxGradientEditor v-model="stops" v-model:selected="selected" />
    <TaoSlider
        :model-value="stops[selected]!.alpha"
        :min="0"
        :max="1"
        :step="0.01"
        @update:model-value="(a) => (stops = patchStop(stops, selected, { alpha: a }))"
    />
</template>
```

## Live examples

The TaoUX repository has a sandbox where all these connections are assembled on one page with a dark/light theme switch:

```bash
npm run sandbox     # http://localhost:5300
```

The pages are in `sandbox/` (`curveeditor`, `gradienteditor`, `slider`, `playback`); the shared token mapping is in `sandbox/SandboxShell.vue`. You can copy it as is.
