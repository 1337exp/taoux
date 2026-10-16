# TaoUX и TaoUI: как подключить друг к другу

**Главное, что нужно знать сразу:** TaoUX и TaoUI это два отдельных пакета, и между ними нет готового модуля-связки. В TaoUX нет кнопок, полей и слайдеров TaoUI, а TaoUI ничего не знает про TaoUX. Связывать их вам, и связка состоит всего из двух вещей:

1. **Цвета и размеры.** Компоненты TaoUX настраиваются своими CSS-переменными `--tx-*`. Вы один раз привязываете их к токенам TaoUI `--tao-*`.
2. **Значения.** Состояние из TaoUX (время, точки кривой, остановки градиента) отдаёте компонентам TaoUI через `v-model`.

Ничего больше. TaoUX работает и без TaoUI (у каждой переменной есть тёмная тема по умолчанию), TaoUI без TaoUX тем более.

## Кто от кого может зависеть

TaoUI это ярус 0: он самодостаточный и не зависит ни от чего из этой семьи. TaoUX это ярус 1: его модули могут использовать TaoUI, но никогда наоборот. Поэтому `@1337exp/taoui` в TaoUX стоит только в `devDependencies` (для песочницы), а в вашем проекте нужны оба пакета рядом:

```bash
npm install @1337exp/taoux @1337exp/taoui
```

## Шаг 1. Стили

```ts
import '@1337exp/taoui/styles.css';          // токены и компоненты TaoUI
import '@1337exp/taoux/canvas.css';          // стили Vue-модулей TaoUX подключаются явно
import '@1337exp/taoux/links.css';
import '@1337exp/taoux/curveeditor.css';
import '@1337exp/taoux/gradienteditor.css';
```

Подключайте CSS только тех модулей, которыми пользуетесь. Модули без компонентов (`camera`, `history`, `playback` и другие) стилей не имеют.

## Шаг 2. Тема: привязка `--tx-*` к `--tao-*`

Положите это в глобальный CSS проекта. Переменные задаются на `:root`, поэтому тема TaoUI (например, `data-tao-theme="light"`) переключает и компоненты TaoUX:

```css
:root {
    /* Холст */
    --tx-canvas-bg: var(--tao-color-bg);
    --tx-canvas-grid-minor: color-mix(in srgb, var(--tao-color-text) 4%, transparent);
    --tx-canvas-grid-major: color-mix(in srgb, var(--tao-color-text) 8%, transparent);
    --tx-canvas-accent: var(--tao-color-accent);
    --tx-canvas-accent-subtle: var(--tao-color-accent-subtle);

    /* Связи */
    --tx-link-color: var(--tao-color-text-muted);
    --tx-link-hover-color: var(--tao-color-text);
    --tx-link-selected-color: var(--tao-color-accent);
    --tx-link-preview-color: var(--tao-color-accent);
    --tx-link-invalid-color: var(--tao-color-danger);

    /* Редактор кривой */
    --tx-curve-bg: var(--tao-color-surface-sunken);
    --tx-curve-border: var(--tao-color-border);
    --tx-curve-grid: var(--tao-color-border);
    --tx-curve-label: var(--tao-color-text-muted);
    --tx-curve-accent: var(--tao-color-accent);

    /* Редактор градиента */
    --tx-gradient-border: var(--tao-color-border);
    --tx-gradient-stop-border: var(--tao-color-border-strong);
    --tx-gradient-accent: var(--tao-color-accent);
}
```

Полные списки переменных каждого модуля написаны в комментарии в начале его стилей (`src/<модуль>/*.vue`). Что не привязали, остаётся со значением по умолчанию.

## Шаг 3. Значения: примеры склейки

### Воспроизведение: `usePlayback` и `TaoTimeline`

TaoUX ведёт время, TaoUI его показывает. Связь это два `v-model`:

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

`usePlayback` возвращает `ref`-ы внутри обычного объекта, поэтому в шаблоне нужен `.value`. Без Vue то же самое делает `createPlayback` из того же модуля.

### Кривая: `TaoxCurveEditor` и поля TaoUI

TaoUX даёт поле графика (сетка, шаг, границы, автопрокрутка у края), а поля «Время» и «Значение» и всё остальное (переключатель шага, кнопки) вы собираете из компонентов TaoUI:

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

### Градиент: `TaoxGradientEditor`, цвет и прозрачность из TaoUI

Полосу с ручками рисует TaoUX, прозрачность задаёт `TaoSlider`. Правки остановки делайте через `patchStop`: он округляет `t`, прозрачность и цвет до разумного числа знаков:

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

## Живые примеры

В репозитории TaoUX есть песочница, где все эти связки собраны на одной странице с переключателем тёмной и светлой темы:

```bash
npm run sandbox     # http://localhost:5300
```

Страницы лежат в `sandbox/` (`curveeditor`, `gradienteditor`, `slider`, `playback`); общая привязка токенов находится в `sandbox/SandboxShell.vue`. Её можно скопировать как есть.
