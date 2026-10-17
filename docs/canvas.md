# The shared canvas: design

**English** · [Русский](canvas.ru.md)

Status: **implemented: session, palette, links, canvas, pins**. The goal: one canvas for three editors (A, B, C) instead of three copies, without growing into a "mega-framework".

## 1. What we found

A comparison of `EditorCanvas.vue` and the stores of two editors (A ≈ 800 + 590 lines, B ≈ 300 + 530).

**Common (≈85% of the behaviour):** the camera and the grid, the gesture machine (pan, drag, marquee, connect), selection, snapshot history, autosave, file import/export, notices, the node palette. In B this is an older version of the same code: A is its superset (plus touch, auto-scroll, resize, grid snapping, containers).

**Different:** the data model. A node with a size (A) versus a size taken from the DOM (B); pins as geometry (4 anchors per side) versus typed row pins whose position is measured from the DOM; link validation; the file format; the look of a node.

Editor **C** is closer to B by design (typed pins). It needs the same canvas.

The conclusion: what becomes shared is the **behaviour**, while the model, the node view and the link rules stay in the app. The boundary runs exactly along the methods the canvas currently calls on the store.

## 2. Layers and the tier rule

| Tier | What | May import |
|---|---|---|
| 0, primitives | `camera`, `history`, `snap`, `wheel`, `edgescroll`, `gestures`, `curve`, `ids`, `storage`, `file`, `i18n`, `touch` | nothing from taoux |
| 1, composite | `session`, `canvas`, `links`, `palette`, `pins`, `curveeditor`, `gradienteditor`, `playback` | tier 0 only, and not each other |

This keeps the answer about isolation honest: primitives are still self-contained, and composites assemble them explicitly. A test enforces the rule: it reads the imports and fails if tier 0 imports anything or tier 1 pulls in a neighbour of its own tier. (Tier 2, `curvefield`, is the only one allowed to import TaoUI.)

## 3. The new modules

### `canvas` (Vue)

The `TaoxCanvas` component and the `useCanvasGestures` composable. The canvas does not know the data model: it parses gestures and calls the methods of `CanvasHost`.

```vue
<TaoxCanvas :host="host" :options="options">
    <!-- the world: the app puts containers, the links layer and nodes here in the right order -->
    <NodeView v-for="n in containers" :node="n" />
    <TaoxLinks :lines="lines" :selected-id="..." :preview="preview" />
    <NodeView v-for="n in nodes" :node="n" />
    <template #overlay><!-- on top of the world, in screen coordinates --></template>
</TaoxCanvas>
```

What the canvas does: the world transform and the grid, the selection frame, the mouse, touch (tap, double tap, long press, pinch), the wheel, auto-scroll at the edge, the keys Delete/Esc/Ctrl+Z/Y (by physical key, so they work in non-Latin layouts), pointer capture and cancel, broken-off gestures.

### The `CanvasHost<P>` contract

`P` is a pin address. It is opaque to the canvas: only the app creates and understands it.

```ts
export type Point = [number, number]; // mutable: stores accept exactly such tuples

export interface CanvasHost<P = unknown> {
    // view
    readonly camera: Camera;
    setCamera(camera: Camera): void;
    setViewport(size: Size): void;

    // selection
    readonly selection: ReadonlySet<string>;
    setSelection(ids: Iterable<string>): void;
    toggleSelected(nodeId: string): void;
    selectConnection(id: string | null): void;

    // dragging (grid snapping and "travelling" containers are the app's business)
    raise?(nodeId: string): void;
    beginDrag(primary: string): void;
    moveSelected(dx: number, dy: number, snap: boolean): void;
    endDrag(): void;

    // history and deletion
    commit(): void;
    undo(): void;
    redo(): void;
    removeSelected(): void;

    // palette
    readonly paletteOpen: boolean;
    openPalette(screen: Point, world: Point, origin: P | null): void;
    closePalette(): void;

    // optional features: no member, no gesture
    connect?: ConnectHost<P>; // start / update / finish / cancel, origin
    resize?: ResizeHost; // rectOf / from
    activate?(target: ActivateTarget): void; // a double click on a link or a node strip
    readonly snapEnabled?: boolean;
    readonly selectMode?: boolean; // the touch "Select" mode
}

export interface CanvasOptions<P> {
    pinAt(target: EventTarget | null): P | null; // the pin under the pointer
    pinNear?(point: { clientX: number; clientY: number }): P | null; // the nearest pin (a node side)
}
```

The full text of the types, with `ConnectHost`, `ResizeHost`, `ActivateTarget`, `Rect` and `ResizeEdge`, is in `src/canvas/host.ts`.

**The DOM contract.** It is part of the canvas API, and the app's `NodeView` must keep it: `data-node-id` on the node root, `data-conn-id` on the link line, `data-resize="n|s|e|w|ne|nw|se|sw"` on the handles, `data-node-container` (a container node: only its strip counts for the selection frame) and `data-node-handle` (the strip a node is dragged by); pins are marked up by the app, and its `pinAt` knows how to read them.

### `links` (Vue)

`TaoxLinks`: only SVG rendering from ready geometry. Paths are built by the app (from `curve`: `curvePath` or `linkShape`).

```ts
interface LinkLine { id: string; d: string; head?: string | null; color?: string }
// props: lines, selectedId, preview?: LinkLine & { invalid?: boolean }
```

Thickness in screen px (`vector-effect`), a wide invisible hit area, highlighting of the selected link.

### `session` (logic on Vue refs)

The biggest piece, which used to be duplicated whole (≈200 lines in every store): history, autosave, import/export, restore, notices.

```ts
createDocumentSession<D>({
    document: { get, set },        // a reference to the document in the store
    camera: { get, set },
    storage,                       // createSavedStorage(...)
    codec: { serialize, parse },   // parse → { ok, doc, view, dropped } | { ok: false, error }
    empty: () => D,
    onReset: () => void,           // reset the selection, the drag and the palette
})
// → commit(key?), undo, redo, canUndo, canRedo, recorded(fn, key?),
//   notice, showNotice, startAutosave, flushSave, exportText, importText, restoreSaved, load
```

Messages (`file.loaded`, `file.error.saveFailed`, etc.) go as i18n keys: the app dictionary must contain them, and the type checks it.

### `palette` and `pins`

- `palette`: the pure `filterNodes` and `groupByCategory`. The popup stays in the app: it is tied to its i18n and its pin compatibility rules.
- `pins`: the `usePinMeasure` composable for editors with typed pins: it measures pin centres from the DOM in world units and reports them to the store.

## 4. What stays in the apps

The model and the file format, `NodeView` (the node view), the link rules and validation, pin geometry (anchors or measuring), the palette content and texts, everything about the theme.

## 5. How we checked the boundary is right

We wrote a draft of `CanvasHost`/`CanvasOptions` and **adapters to both real stores** (≈60 lines each), and checked them with `vue-tsc` (with a deliberate error, to make sure the check is real). Both converge without changes to the stores. What turned out:

- Points (`Point`) must be mutable tuples: the stores accept `[number, number]`, and `readonly` does not pass.
- Because of the different model, B has empty `beginDrag`/`endDrag`, and its `moveSelected` ignores `snap`. That is fine: the methods are required, the implementation may be empty.
- **B had no `cancelConnect`.** If the pointer is lost in the middle of dragging out a link, the link "hangs". The shared canvas fixes this (one line is added to the store).
- B gets touch, auto-scroll, grid snapping and resizing for free (if it wants them), and C starts with them at once.

## 6. Packaging the Vue components

Checked on a trial package: `vite build` in library mode with `cssCodeSplit: true` gives a separate `<module>.js` and `<module>.css` per entry point, shared pieces go to `chunks/`; `vue-tsc --emitDeclarationOnly` gives `.d.ts` for `.vue` as well. Tree-shaking by module works.

The consequence: **the JS does not import styles itself**, and the app adds one line, `import '@1337exp/taoux/canvas.css'`. The colours and sizes of the canvas go through `--tx-*` CSS variables with fallback values, so the app theme (TaoUI included, see the `taoui.css` bridge) overrides them without editing the library.

## 7. The migration plan (done)

Every step ended with green typecheck, tests and builds of all projects.

1. ~~The tier test and the Vue build scaffold~~.
2. ~~`session`~~: the stores of editors A and B became ≈130 lines shorter each.
3. ~~`links` and `palette`~~: `TaoxLinks` with `--tx-link-*` variables, checked in the browser.
4. ~~`canvas`~~: `EditorCanvas.vue` became 37 lines in A (was 803) and 26 in B (was 298); the gestures were checked in the browser; B got touch, auto-scroll and `cancelConnect`.
5. ~~Editor C~~: a store on `session`, a `NodeView` with typed pins, a palette filtered by compatibility, a preview next to it.

## 8. Decisions taken

1. The tier rule (composite modules may import primitives) and the test that guards it.
2. Styles as a separate `.css` per module + `--tx-*` variables (instead of injecting CSS from JS).
3. The order: `session` before `canvas`.
4. The wheel: it moves the canvas, Ctrl zooms (there is no `wheel` option in the API).
