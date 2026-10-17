# TaoUX and TaoUI: how to connect them

**English** · [Русский](taoui.ru.md)

**The short version.** TaoUX and TaoUI are two separate packages: TaoUX has no buttons, fields or sliders of its own, and TaoUI knows nothing about TaoUX. Joining them is two things, and the first is one line:

1. **Look.** `import '@1337exp/taoux/taoui.css'`: the editors follow the TaoUI theme (dark, light, yours).
2. **Values.** State from TaoUX (time, curve points, gradient stops) goes to TaoUI components through `v-model`.

That is all. TaoUX works without TaoUI (every variable has a dark default), and TaoUI works without TaoUX even more so.

**Without the bridge** the editors keep their dark defaults, so on a light page `TaoxCurveEditor` and `TaoxGradientEditor` look like dark islands with a blue accent. `TaoxCurveField` (it is built from TaoUI components) follows the theme by itself.

## Who may depend on whom

TaoUI is tier 0: self-contained, it depends on nothing from this family. TaoUX is tier 1: its modules may use TaoUI, but never the other way round. That is why `@1337exp/taoui` is in TaoUX's `devDependencies` (for the sandbox) and an optional peer dependency, and your project needs both packages side by side:

```bash
npm install @1337exp/taoux @1337exp/taoui
```

## Step 1. Styles

```ts
import '@1337exp/taoui/styles.css';          // TaoUI tokens and components
import '@1337exp/taoux/taoui.css';           // the bridge: TaoUX variables → TaoUI tokens (see Step 2)
import '@1337exp/taoux/curveeditor.css';     // styles of TaoUX Vue modules are imported explicitly
import '@1337exp/taoux/gradienteditor.css';
```

Import the CSS only of the modules you use (`canvas`, `links`, `curveeditor`, `gradienteditor`; `curvefield` needs `curveeditor.css` and `curvefield.css`). Modules without components (`camera`, `history`, `playback` and others) have no styles.

Installing from npm needs no bundler tweaks: a normal `npm install @1337exp/taoux @1337exp/taoui`. Only when you link a neighbouring folder with `file:` do you need `resolve.dedupe: ['vue']` (see the README).

## Step 2. Theme: the bridge

`@1337exp/taoux/taoui.css` sets every colour variable of the TaoUX modules to a TaoUI token (canvas, links, curve and gradient editors). It is plain CSS with zero specificity (`:where(:root)`) and no dependency on the TaoUI package, so a TaoUI theme switch (`data-tao-theme="light"`) re-colours the editors too, and any rule of yours wins.

Change one variable on `:root` or on any ancestor of the component:

```css
:root {
    --tx-curve-accent: var(--tao-color-info);   /* blue curve in an otherwise pink app */
}
```

The full list of variables of each module is in the comment at the top of its styles (`src/<module>/*.vue`). What you do not map keeps its default. The bridge itself is [theme/taoui.css](../theme/taoui.css); a test checks that it covers every colour variable the components read and only points at tokens TaoUI defines.

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

The pages are in `sandbox/` (`curveeditor`, `curvefield`, `gradienteditor`, `slider`, `color`, `playback`); they use the bridge from Step 2 as is.
