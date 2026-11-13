---
name: taoux
description: Build interaction in Vue 3 apps with @1337exp/taoux (TaoUX) — subpath modules for gestures (tap, long press, pinch, swipe), reorderable lists (sortable), swipe rows with actions (swiperow), undo by snapshots or by records, document sessions, autosave across tabs, commands and hotkeys, playback, canvas, curve and gradient editors, and joining them to TaoUI. Use when code imports @1337exp/taoux/*, uses Taox* components or --tx-* variables, or the user asks for TaoUX.
---

# TaoUX

Behaviour building blocks for apps and editors: the logic is plain TypeScript (tested without a DOM), the few Vue modules are
thin shells, and TaoUX has **no buttons or fields of its own** outside the two TaoUI-based fields. Pair it with TaoUI for the
controls, or with your own design.

## Rules

1. **Import by subpath**, there is no root entry: `import { History } from '@1337exp/taoux/history'`. Only what you import
   reaches the bundle. ESM only.
2. **A Vue module's styles are imported explicitly**: `import '@1337exp/taoux/curveeditor.css'` (also `canvas.css`,
   `links.css`, `gradienteditor.css`, `curvefield.css`, `swiperow.css`; `curvefield` needs `curveeditor.css` too).
3. **With TaoUI, add the bridge**: `import '@1337exp/taoux/taoui.css'` points every `--tx-*` colour, tone and corner radius at a `--tao-*` token (the bridge is the only file that names
   `--tao-*`; a module that needs a new one gets a `--tx-*` variable and a line there), so
   the editors follow the TaoUI theme and palettes. Zero specificity: your rules win. Without it the editors stay dark.
4. **Values travel through `v-model`**; TaoUX never renders a TaoUI control itself, except the tier-2 fields `curvefield` and `swiperow`.
5. **Pre-1.0**: breaking changes happen between minors; read `CHANGELOG.md`.

## Modules

| Import | What for |
|---|---|
| `camera` | pan, zoom around the cursor, screen ↔ world (`zoomAt`; the range is 0.2…2 unless you pass `ZoomLimits`), `fitCamera(rect, size, padding?, limits?)` for "zoom to fit" |
| `history` | `new History(snapshot)`: undo / redo on string snapshots, rapid edits with one `key` merged into one step; `save()` / `restore(state)` take a whole history out and put it back (one per document in a tabbed editor) |
| `undo` | `new UndoStack({ id, revive, vanish? })`: undo / redo of a list of records by steps that keep only the touched ones (`diffRecords(prev, next, id)` makes a step; a returned record takes its old place); right for a list that is edited and synced, where `History` would store the whole list per step and an undo would roll back a sync. `coalesceMaxMs` caps a merged step of typing |
| `swiperow` | `<TaoxSwipeRow :start="{ id, label, icon, tone }" :end="[{ id, label, icon, tone }]" v-model:open @action="run">` around a list row: a pull to the start runs `start` past a threshold, to the end opens the actions, a long pull runs the last one (`fullSwipe`, on by default); a mouse drags only with `mouse`; `:tabbable="false"` takes the actions out of the Tab order when the app has its own keys for them; an open row closes on a click on it or a press outside, and that click does not go on (once; `:swallow-outside-click="false"` lets the outside one through); `--tx-swipe-bg` for a row right on the page (see docs/swiperow.md); import `@1337exp/taoux/swiperow.css`. Needs TaoUI (tier 2) |
| `sortable` | `useSortable(listRef, { onMove: (from, to) => (list.value = moveItem(list.value, from, to)) })`; mark each item `data-sortable-item` and a focusable grip inside it `data-sortable-handle` (a TaoButton with `icon="tao-grip"` and an aria-label); style `[data-sortable-dragging]` / `[data-sortable-lifted]`. Keyboard: Space lifts, arrows move, Space drops, Esc returns; `texts: sortableTextsRu` for Russian; works inside a zoomed (scaled) canvas too |
| `session` | `createDocumentSession(...)`: history + autosave + files + restore + notices for one document; `canUndo` / `canRedo` refs; `dirty` ref + `markSaved()` for an "unsaved" mark (a flag, not a history position); `saveHistory()` / `restoreHistory(state)` give each of several documents its own undo (`load` the next with `resetHistory`, then restore its history). `camera` is optional (a list, not a canvas); count with `countItems` (`countNodes` is its old name); `zoom` clamps a loaded view to the canvas range |
| `commands` | `createCommands([...])`: one registry for menus, shortcuts and palettes (see below) |
| `hotkeys` | `parseHotkey('Mod+Shift+Z')`, `matchHotkey`, `formatHotkey` (`Ctrl+Shift+Z` / `⇧⌘Z`), `isReservedHotkey`, `bindHotkeys(element, map)` |
| `storage` | autosave to localStorage that never throws; `tryWrite` gives the reason (`quota` / `denied`), `remove`, `subscribe` for changes from other tabs |
| `file` | `downloadBlob(name, data, mime?)` saves bytes or a `Blob`; `downloadText(name, text, mime?)`; `readTextFile(file, limit?)` reads a picked file, refusing a big one; `readBytesFile(file, limit?)` the same as bytes (an archive, an image) |
| `guides` | `snapToGuides(movingRect, otherRects, thresholdInWorldUnits)` → `{ dx, dy, lines }`: smart guides while dragging (edges and centres of the other nodes); you apply the shift and draw the lines; divide a screen threshold by the zoom |
| `snap` | soft snapping to a grid, threshold follows the zoom |
| `wheel` | wheel / trackpad → pan or zoom, like Figma (zoom only with Ctrl / ⌘ or a pinch) |
| `zip` | `await createZip([{ name: 'a/b.png', data }])` and `await readZip(bytes, limits?)`: a project of several files in one `.zip`. Reading an archive from outside is defensive (unsafe names, CRC, size limits against zip bombs); catch `ZipError` and show text by its `code`. `looksLikeZip(bytes)` tells an archive from JSON. Needs `CompressionStream` (any current browser, Node 18+) |
| `edgescroll` | auto-scroll near an edge while dragging (`createEdgeScroller`) |
| `gestures` | tap, double tap, long press, pinch; `SwipeTracker` (swipe vs scroll) + `settleOpen` (where a released row rests); `listenFocusLoss(cancel)` while a press is held, as Alt-Tab swallows the pointerup |
| `touch` | `coarse`: is the pointer a finger |
| `curve` | link paths: Bezier between pins, arrowheads of constant screen size |
| `ids` | `uuid()` for stored / synced records; `uid(prefix, taken)` restarts from zero on every load, only for ids inside one document |
| `ease` | easing between curve points (8 families × in / out / in-out, `linear`, `step`, cubic Bezier), `easeValue` |
| `num` | `clamp`, `roundTo`, `snapTo`, `niceStep`, `ticks` |
| `palette` | search and groups for a palette of nodes |
| `pins` | row pin positions measured from the DOM (`usePinMeasure`, `createPinRegistry`) |
| `playback` | time, pause, loop, speed, seeking: `createPlayback` (no Vue), `usePlayback` (drives TaoUI `TaoScrubber`) |
| `tour` | a guided tour of the page, step by step: `createTour` (no Vue; jumps over steps whose target is gone, `done` / `skipped`), `useTour`, `createTourMemory` (shown once); the drawing is up to you or TaoUI |
| `undovue` | `undo` and `history` for Vue: `useUndoStack`, `useHistory` (the same classes with `canUndo` / `canRedo` as refs, so the Undo / Redo menu items follow), `useUndoFlags(existing)` + `sync()` |
| `i18n` | typed i18n: `createI18n({ locales, fallback, storageKey })` |
| `links` (Vue) | `TaoxLinks`: an SVG layer of links from ready geometry |
| `canvas` (Vue) | `TaoxCanvas`: pan / zoom canvas with mouse, touch, wheel, auto-scroll, keys; the `CanvasHost` contract; prop `background: 'grid' | 'dots' | 'none'`; options `marquee: 'contain'` (only nodes wholly inside the frame), `zoom: { min, max }`; host `claimsKey(e)` keeps a key from the canvas while a tool uses it; host `placing` + `placeAt(screen, world)` is a "place a node" tool (the next left press only says where); host `contextMenu(screen, world, target)` shows the app's menu on a right click (true) or leaves the palette (false) |
| `curveeditor` (Vue) | `TaoxCurveEditor`: points, snapping, bounds, per-segment easing with Bezier handles, keyboard; time is 0…1, `formatT(t)` writes it as years, seconds… on the axis and tag |
| `gradienteditor` (Vue) | `TaoxGradientEditor`: stops on a bar, `gradientCss`, keyboard |
| `curvefield` (Vue, needs TaoUI) | `TaoxCurveField`: a curve editor with TaoUI fields for time, value, easing, snapping |

## Commands, hotkeys and the TaoUI menu bar

```ts
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { createCommands, historyCommands } from '@1337exp/taoux/commands';

const commands = createCommands([
    { id: 'save', label: () => t('save'), shortcut: 'Mod+S', enabled: () => dirty.value, run: save },
    { id: 'grid', label: () => t('grid'), shortcut: "Mod+'", checked: () => grid.value, run: () => (grid.value = !grid.value) },
    ...historyCommands(session),   // Undo / Redo, disabled when there is nothing to undo
]);

// in computed: labels, enabled and checked follow the refs they read
const menu = computed(() => commands.toMenu([
    { id: 'file', label: t('file'), items: ['save'] },
    { id: 'edit', label: t('edit'), items: ['undo', 'redo', '-', 'grid'] },
]));

let unbind = () => {};
onMounted(() => (unbind = commands.bind(document)));
onBeforeUnmount(() => unbind());
```

```vue
<TaoMenubar :items="menu" @select="commands.run" />
```

- `Mod` is ⌘ on Apple and Ctrl elsewhere; the menu shows the platform's label by itself.
- A disabled command swallows its key, so Mod+S never opens the browser's «Save page».
- In a text field, plain keys and text editing (Mod+Z / C / V / A) stay with the field.
- `commands.check()` in a test lists shortcuts the browser keeps (⌘W, ⌘T, ⌘Q, ⌘R in Safari) and duplicates.
- `toMenu` returns the same shape as TaoUI's `TaoMenuItem[]` (a type test holds it), so it also feeds `TaoContextMenu`
  and `TaoDropdownMenu`.

## Mistakes to avoid

- Importing from `@1337exp/taoux` (no root entry) or from `dist/` paths.
- Forgetting the module CSS (`curveeditor.css`…) or the bridge `taoui.css`: the editor renders unstyled or dark.
- Calling `toMenu` outside `computed`: the menu does not follow the state.
- Using `History` for a list of records that is synced: its snapshots are the whole list, and an undo after a sync rolls back the other device's edits. Use `undo` (`UndoStack`), and stamp a returned record as new in `revive`.
- Keeping editor state outside `history` / `session` and then wondering why Undo skips it: commit a snapshot after
  every edit (`session.commit(key)` or `recorded(fn)`).
- Offering a reserved shortcut (⌘W, ⌘T, ⌘N, Ctrl+Tab): the browser takes it before the page.
