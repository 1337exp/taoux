# Общий холст: дизайн

[English](canvas.md) · **Русский**

Статус: **реализовано: session, palette, links, canvas, pins**. Цель: один холст на трёх редакторов (A, B, C) вместо трёх копий, без разрастания в «мега-фреймворк».

## 1. Что нашли

Сравнение `EditorCanvas.vue` и сторов двух редакторов (A ≈ 800 + 590 строк, B ≈ 300 + 530).

**Общее (≈85% поведения):** камера и сетка, машина жестов (pan, drag, marquee, connect), выделение, история снимков, автосохранение, импорт/экспорт файла, уведомления, палитра нод. У B это старая версия того же кода: A его надмножество (плюс touch, автопрокрутка, resize, привязка к сетке, контейнеры).

**Разное:** модель данных. Нода с размером (A) против автоматического размера по DOM (B); пины как геометрия (4 якоря на грань) против пинов-строк с типами, чьё положение измеряется по DOM; проверка связи; формат файла; внешний вид ноды.

Редактор **C** по устройству ближе к B (типизированные пины). Ему нужен тот же холст.

Вывод: общим должно стать **поведение**, а модель, вид ноды и правила связей остаются в приложении. Граница проходит ровно по тем методам, которые холст сейчас вызывает у стора.

## 2. Слои и правило ярусов

| Ярус | Что | Может импортировать |
|---|---|---|
| 0, примитивы | `camera`, `history`, `undo`, `snap`, `wheel`, `edgescroll`, `gestures`, `curve`, `ids`, `storage`, `file`, `i18n`, `touch` | ничего из taoux |
| 1, составные | `session`, `commands`, `canvas`, `links`, `palette`, `pins`, `curveeditor`, `gradienteditor`, `playback`, `sortable` | только ярус 0, и не друг друга |

Так ответ на вопрос про изоляцию остаётся честным: примитивы по-прежнему самодостаточны, а составные явно собирают их. Правило проверяет тест: он читает импорты и падает, если ярус 0 что-то импортирует или ярус 1 тянет соседа из своего яруса.

## 3. Новые модули

### `canvas` (Vue)

Компонент `TaoxCanvas` и композабл `useCanvasGestures`. Холст не знает модель данных: он разбирает жесты и зовёт методы `CanvasHost`.

```vue
<TaoxCanvas :host="host" :options="options">
    <!-- мир: сюда приложение кладёт контейнеры, слой связей и ноды в нужном порядке -->
    <NodeView v-for="n in containers" :node="n" />
    <TaoxLinks :lines="lines" :selected-id="..." :preview="preview" />
    <NodeView v-for="n in nodes" :node="n" />
    <template #overlay><!-- поверх мира, в экранных координатах --></template>
</TaoxCanvas>
```

Что делает холст: transform мира и сетка, рамка выделения, мышь, сенсор (тап, двойной тап, долгое нажатие, щипок), колесо, автопрокрутка у края, клавиши Delete/Esc/Ctrl+Z/Y (по физической клавише, работает в русской раскладке), захват и отмена указателя, оборванные жесты.

### Контракт `CanvasHost<P>`

`P` — адрес пина. Для холста он непрозрачный: его создаёт и понимает только приложение.

```ts
export type Point = [number, number]; // изменяемый: сторы принимают именно такие кортежи

export interface CanvasHost<P = unknown> {
    // вид
    readonly camera: Camera;
    setCamera(camera: Camera): void;
    setViewport(size: Size): void;

    // выделение
    readonly selection: ReadonlySet<string>;
    setSelection(ids: Iterable<string>): void;
    toggleSelected(nodeId: string): void;
    selectConnection(id: string | null): void;

    // перетаскивание (привязка к сетке и «едущие» контейнеры: забота приложения)
    raise?(nodeId: string): void;
    beginDrag(primary: string): void;
    moveSelected(dx: number, dy: number, snap: boolean): void;
    endDrag(): void;

    // история и удаление
    commit(): void;
    undo(): void;
    redo(): void;
    removeSelected(): void;

    // палитра
    readonly paletteOpen: boolean;
    openPalette(screen: Point, world: Point, origin: P | null): void;
    closePalette(): void;

    // необязательные возможности: нет члена, нет и жеста
    connect?: ConnectHost<P>; // start / update / finish / cancel, origin
    resize?: ResizeHost; // rectOf / from
    activate?(target: ActivateTarget): void; // двойной клик по связи или по полосе ноды
    readonly snapEnabled?: boolean;
    readonly selectMode?: boolean; // сенсорный режим «Выделение»
}

export interface CanvasOptions<P> {
    pinAt(target: EventTarget | null): P | null; // пин под указателем
    pinNear?(point: { clientX: number; clientY: number }): P | null; // ближайший пин (сторона ноды)
}
```

Полный текст типов с `ConnectHost`, `ResizeHost`, `ActivateTarget`, `Rect`, `ResizeEdge` лежит в `src/canvas/host.ts`.

**DOM-контракт.** Это часть API холста, `NodeView` приложения обязан его соблюдать: `data-node-id` на корне ноды, `data-conn-id` на линии связи, `data-resize="n|s|e|w|ne|nw|se|sw"` на ручках, `data-node-container` (нода-контейнер: в рамку выделения попадает только её полоса) и `data-node-handle` (полоса, за которую тянут), а пины размечает приложение; как их читать, знает его `pinAt`.

### `links` (Vue)

`TaoxLinks`: только отрисовка SVG из готовой геометрии. Пути строит приложение (из `curve`: `curvePath` или `linkShape`).

```ts
interface LinkLine { id: string; d: string; head?: string | null; color?: string }
// props: lines, selectedId, preview?: LinkLine & { invalid?: boolean }
```

Толщина в экранных px (`vector-effect`), широкая невидимая зона попадания, подсветка выбранной связи.

### `session` (логика на Vue-рефах)

Самый большой кусок, который дублировался целиком (≈200 строк в каждом сторе): история, автосохранение, импорт/экспорт, восстановление, уведомления.

```ts
createDocumentSession<D>({
    document: { get, set },        // ссылка на документ в сторе
    camera: { get, set },
    storage,                       // createSavedStorage(...)
    codec: { serialize, parse },   // parse → { ok, doc, view, dropped } | { ok: false, error }
    empty: () => D,
    onReset: () => void,           // сбросить выделение, протягивание и палитру
})
// → commit(key?), undo, redo, canUndo, canRedo, recorded(fn, key?),
//   notice, showNotice, startAutosave, flushSave, exportText, importText, restoreSaved, load
```

Сообщения (`file.loaded`, `file.error.saveFailed` и т.д.) идут ключами i18n: словарь приложения обязан их содержать, тип это проверит.

### `palette` и `pins`

- `palette`: чистые `filterNodes` и `groupByCategory`. Всплывающее окно остаётся в приложении: оно завязано на его i18n и правила совместимости пинов.
- `pins`: композабл `usePinMeasure` для редакторов с типизированными пинами: измеряет центры пинов по DOM в мировых единицах и сообщает их стору.

## 4. Остаётся в приложениях

Модель и формат файла, `NodeView` (вид ноды), правила и проверка связей, геометрия пинов (якоря или измерение), содержимое палитры и тексты, всё про тему.

## 5. Как проверили, что граница верна

Написан черновик `CanvasHost`/`CanvasOptions` и **адаптеры к обоим реальным сторам** (≈60 строк каждый), проверены `vue-tsc` (с контрольной ошибкой, чтобы убедиться, что проверка настоящая). Оба сходятся без правок сторов. Что выяснилось:

- Точки (`Point`) должны быть изменяемыми кортежами: сторы принимают `[number, number]`, `readonly` не проходит.
- Из-за разной модели у B `beginDrag`/`endDrag` пустые, а `moveSelected` игнорирует `snap`. Это нормально: методы обязательные, реализация может быть пустой.
- **У B не было `cancelConnect`.** Если указатель потерян посреди протягивания, связь «зависает». Общий холст это исправляет (в стор добавляется одна строка).
- B бесплатно получает touch, автопрокрутку, привязку к сетке и изменение размера (если захочет), C сразу стартует с ними.

## 6. Упаковка Vue-компонентов

Проверено на пробном пакете: `vite build` в режиме библиотеки с `cssCodeSplit: true` даёт отдельные `<модуль>.js` и `<модуль>.css` на каждую точку входа, общие куски уходят в `chunks/`; `vue-tsc --emitDeclarationOnly` даёт `.d.ts` и для `.vue`. Tree-shaking по модулям работает.

Следствие: **JS не подключает стили сам**, приложение добавляет одну строку `import '@1337exp/taoux/canvas.css'`. Цвета и размеры холста идут через CSS-переменные `--tx-*` с запасными значениями, чтобы тема приложения (в том числе TaoUI, см. мост `taoui.css`) подменяла их без правки библиотеки.

## 7. План миграции (выполнен)

Каждый шаг заканчивался зелёными typecheck, тестами и сборкой всех проектов.

1. ~~Тест ярусов и каркас сборки Vue~~.
2. ~~`session`~~: сторы редакторов A и B стали короче на ≈130 строк каждый.
3. ~~`links` и `palette`~~: `TaoxLinks` с переменными `--tx-link-*`, проверено в браузере.
4. ~~`canvas`~~: `EditorCanvas.vue` стал 37 строк у A (было 803) и 26 у B (было 298); жесты проверены в браузере; у B появились touch, автопрокрутка и `cancelConnect`.
5. ~~Редактор C~~: стор на `session`, `NodeView` с типизированными пинами, палитра с фильтром по совместимости, предпросмотр рядом.

## 8. Принятые решения

1. Правило ярусов (составные модули могут импортировать примитивы) и тест, который его охраняет.
2. Стили отдельным `.css` на модуль + переменные `--tx-*` (вместо внедрения CSS из JS).
3. Порядок: `session` раньше `canvas`.
4. Колесо: колесо двигает холст, Ctrl масштабирует (опции `wheel` в API нет).
