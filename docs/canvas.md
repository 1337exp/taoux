# Общий холст: дизайн

Статус: **реализовано и подключено в workspace и graph-up: session, palette, links, canvas**. `pins` тоже готов (graph-up на нём), taofx получил редактор на этом холсте. Цель: один холст на трёх потребителей (workspace, graph-up, taofx) вместо трёх копий, без разрастания в «мега-фреймворк».

## 1. Что нашли

Сравнение `EditorCanvas.vue` и сторов двух проектов (workspace ≈ 800 + 590 строк, graph-up ≈ 300 + 530).

**Общее (≈85% поведения):** камера и сетка, машина жестов (pan, drag, marquee, connect), выделение, история снимков, автосохранение, импорт/экспорт файла, уведомления, палитра нод. В graph-up это старая версия того же кода: workspace его надмножество (плюс touch, автопрокрутка, resize, привязка к сетке, контейнеры).

**Разное:** модель данных. Нода с размером (workspace) против автоматического размера по DOM (graph-up); пины как геометрия (4 якоря на грань) против пинов-строк с типами, чьё положение измеряется по DOM; проверка связи; формат файла; внешний вид ноды.

**taofx** по устройству ближе к graph-up (типизированные пины), но без exec. Ему нужен тот же холст.

Вывод: общим должно стать **поведение**, а модель, вид ноды и правила связей остаются в приложении. Граница проходит ровно по тем методам, которые холст сейчас вызывает у стора.

## 2. Слои и правило ярусов

| Ярус | Что | Может импортировать |
|---|---|---|
| 0, примитивы | `camera`, `history`, `snap`, `wheel`, `edgescroll`, `gestures`, `curve`, `ids`, `storage`, `file`, `i18n`, `touch` | ничего из taoux |
| 1, составные | `session`, `canvas`, `links`, `palette`, `pins`, `curveeditor` | только ярус 0, и не друг друга |

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

Полный текст типов с `ConnectHost`, `ResizeHost`, `ActivateTarget`, `Rect`, `ResizeEdge` войдёт в `canvas/host.ts` при реализации.

**DOM-контракт.** Это часть API холста, `NodeView` приложения обязан его соблюдать: `data-node-id` на корне ноды, `data-conn-id` на линии связи, `data-resize="n|s|e|w|ne|nw|se|sw"` на ручках, `data-node-container` (нода-контейнер: в рамку выделения попадает только её полоса) и `data-node-handle` (полоса, за которую тянут), а пины размечает приложение; как их читать, знает его `pinAt`.

### `links` (Vue)

`TaoxLinks`: только отрисовка SVG из готовой геометрии. Пути строит приложение (из `curve`: `curvePath` или `linkShape`).

```ts
interface LinkLine { id: string; d: string; head?: string | null; color?: string }
// props: lines, selectedId, preview?: LinkLine & { invalid?: boolean }
```

Толщина в экранных px (`vector-effect`), широкая невидимая зона попадания, подсветка выбранной связи.

### `session` (логика на Vue-рефах)

Самый большой кусок, который сейчас дублируется целиком (≈200 строк в каждом сторе): история, автосохранение, импорт/экспорт, восстановление, уведомления.

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

- `palette`: чистые `filterNodes` и `groupByCategory` (сейчас в graph-up). Всплывающее окно остаётся в приложении: оно завязано на его i18n и правила совместимости пинов.
- `pins`: композабл `usePinMeasure` для проектов с типизированными пинами (graph-up, taofx): измеряет центры пинов по DOM в мировых единицах и сообщает их стору.

## 4. Остаётся в приложениях

Модель и формат файла, `NodeView` (вид ноды), правила и проверка связей, геометрия пинов (якоря или измерение), содержимое палитры и тексты, всё про тему.

## 5. Как проверили, что граница верна

Написан черновик `CanvasHost`/`CanvasOptions` и **адаптеры к обоим реальным сторам** (≈60 строк каждый), проверены `vue-tsc` (с контрольной ошибкой, чтобы убедиться, что проверка настоящая). Оба сходятся без правок сторов. Что выяснилось:

- Точки (`Point`) должны быть изменяемыми кортежами: сторы принимают `[number, number]`, `readonly` не проходит.
- Из-за разной модели у graph-up `beginDrag`/`endDrag` пустые, а `moveSelected` игнорирует `snap`. Это нормально: методы обязательные, реализация может быть пустой.
- **В graph-up нет `cancelConnect`.** Если указатель потерян посреди протягивания, связь «зависает». Общий холст это исправит (в стор добавится одна строка).
- graph-up бесплатно получит touch, автопрокрутку, привязку к сетке и изменение размера (если захочет), taofx сразу стартует с ними.

## 6. Упаковка Vue-компонентов

Проверено на пробном пакете: `vite build` в режиме библиотеки с `cssCodeSplit: true` даёт отдельные `<модуль>.js` и `<модуль>.css` на каждую точку входа, общие куски уходят в `chunks/`; `vue-tsc --emitDeclarationOnly` даёт `.d.ts` и для `.vue`. Tree-shaking по модулям работает.

Следствие: **JS не подключает стили сам**, приложение добавляет одну строку `import '@1337exp/taoux/canvas.css'`. Цвета и размеры холста идут через CSS-переменные `--tx-*` с запасными значениями, чтобы тема приложения (в том числе TaoUI) подменяла их без правки библиотеки. `typescript` держим `~6.0.x`: с более новым `vue-tsc` не запускается.

## 7. План миграции

Каждый шаг заканчивается зелёными typecheck, тестами и сборкой всех проектов.

1. ~~Тест ярусов и каркас сборки Vue~~ (готово).
2. ~~`session`~~ (готово: workspace и graph-up переведены, store короче на ≈130 строк у каждого).
3. ~~`links` и `palette`~~ (готово: `TaoxLinks` с переменными `--tx-link-*`, проверено в браузере в обоих проектах).
4. ~~`canvas`~~ (готово: `EditorCanvas.vue` стал 37 строк у workspace (было 803) и 26 у graph-up (было 298); жесты проверены в браузере; у graph-up появились touch, автопрокрутка и `cancelConnect`).
5. ~~taofx~~ (готово: стор на `session`, `NodeView` с типизированными пинами, палитра с фильтром по совместимости, предпросмотр рядом).

## 8. Решения, которые нужны от человека

1. Правило ярусов (составные модули могут импортировать примитивы) и тест, который его охраняет.
2. Стили отдельным `.css` на модуль + переменные `--tx-*` (вместо внедрения CSS из JS).
3. Порядок: `session` раньше `canvas`.
4. Колесо у graph-up/taofx: решено как в workspace: колесо двигает, Ctrl масштабирует (опции `wheel` в API нет).
