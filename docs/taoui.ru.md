# TaoUX и TaoUI: как подключить друг к другу

[English](taoui.md) · **Русский**

**Коротко.** TaoUX и TaoUI это два отдельных пакета: у TaoUX нет своих кнопок, полей и слайдеров, а TaoUI ничего не знает про TaoUX. Связать их это две вещи, и первая делается одной строкой:

1. **Вид.** `import '@1337exp/taoux/taoui.css'`: редакторы следуют теме TaoUI (тёмной, светлой, вашей).
2. **Значения.** Состояние TaoUX (время, точки кривой, остановки градиента) уходит в компоненты TaoUI через `v-model`.

Это всё. TaoUX работает без TaoUI (у каждой переменной есть тёмное значение по умолчанию), а TaoUI без TaoUX тем более.

**Без моста** редакторы остаются с тёмными значениями по умолчанию: на светлой странице `TaoxCurveEditor` и `TaoxGradientEditor` выглядят тёмными островками с синим акцентом. `TaoxCurveField` (он собран из компонентов TaoUI) подстраивается под тему сам.

## Кто от кого может зависеть

TaoUI это ярус 0: он самодостаточный и не зависит ни от чего из этой семьи. TaoUX это ярус 1: его модули могут использовать TaoUI, но никогда наоборот. Поэтому `@1337exp/taoui` в TaoUX стоит в `devDependencies` (для песочницы) и как необязательная peer-зависимость, а в вашем проекте нужны оба пакета рядом:

```bash
npm install @1337exp/taoux @1337exp/taoui
```

## Шаг 1. Стили

```ts
import '@1337exp/taoui/styles.css';          // токены и компоненты TaoUI
import '@1337exp/taoux/taoui.css';           // мост: переменные TaoUX → токены TaoUI (см. шаг 2)
import '@1337exp/taoux/curveeditor.css';     // стили Vue-модулей TaoUX подключаются явно
import '@1337exp/taoux/gradienteditor.css';
```

Подключайте CSS только тех модулей, что используете (`canvas`, `links`, `curveeditor`, `gradienteditor`; для `curvefield` нужны `curveeditor.css` и `curvefield.css`). У модулей без компонентов (`camera`, `history`, `playback` и других) стилей нет.

Из npm ставится без настроек сборщика: обычный `npm install @1337exp/taoux @1337exp/taoui`. `resolve.dedupe: ['vue']` нужен только когда соседняя папка подключена через `file:` (см. README).

## Шаг 2. Тема: мост

`@1337exp/taoux/taoui.css` ставит каждой цветовой переменной модулей TaoUX токен TaoUI (холст, связи, редакторы кривой и градиента). Это обычный CSS с нулевой специфичностью (`:where(:root)`) и без зависимости от пакета TaoUI: переключение темы TaoUI (`data-tao-theme="light"`) перекрашивает и редакторы, а любое ваше правило главнее.

Поменять одну переменную можно на `:root` или на любом предке компонента:

```css
:root {
    --tx-curve-accent: var(--tao-color-info);   /* синяя кривая в остальном розовом приложении */
}
```

Полный список переменных каждого модуля написан в комментарии в начале его стилей (`src/<модуль>/*.vue`). Что не привязали, остаётся со значением по умолчанию. Сам мост: [theme/taoui.css](../theme/taoui.css); тест проверяет, что он покрывает каждую цветовую переменную компонентов и ссылается только на токены, которые есть в TaoUI.

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

Страницы лежат в `sandbox/` (`curveeditor`, `curvefield`, `gradienteditor`, `slider`, `color`, `playback`); они используют мост из шага 2 как есть.
