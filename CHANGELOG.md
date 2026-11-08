# Changelog

## 0.10.0

Nothing to migrate: two optional host members; a host without them works as before.

- **`canvas`: a press on a label, a link or an ARIA checkbox / radio / switch inside a node belongs to it.** The canvas passed presses to `input`, `textarea`, `select`, `button` and left the rest to the drag, so a checkbox drawn as a `label` (TaoUI's `TaoCheckbox`) could not be ticked with a mouse: the press started dragging the node and the click never came.
- **`links`: the arrowhead is filled.** `.tx-links path { fill: none }` is more specific than `.tx-link-head { fill }`, so an arrowhead was drawn with no fill and was never seen; the line, shortened to run into it, stopped short of the node. The head rule is as specific now.
- **`curve`: `linkPointAt(a, aSide, b, bSide, t = 0.5)`.** A point on the curve of `linkShape`: the middle of a link for a label, a handle or a marker.
- **`canvas`: a double click on a link tells what was under the pointer.** `ActivateTarget` of kind `link` has `element`, the element under the pointer, so an app that draws something on a link (a label) can tell a double click on it from one on the line (which puts a point).
- **New module `guides`: smart guides for dragging.** `snapToGuides(moving, others, threshold, options?)` compares the edges and the centre of the dragged rectangle with those of the other rectangles, per axis, and returns `{ dx, dy, lines }`: how far to shift it so that the nearest pair coincides (within the threshold, in world units; divide a screen threshold by the zoom) and the lines to draw, one per coinciding position, shared by every rectangle that lies on it. Edges and centres can be switched off in `options`. Plain numbers, no DOM and no Vue; collecting the rectangles, applying the shift and drawing stay with the app.
- **`sortable` in a scaled canvas.** The offsets were measured in screen px and drawn as CSS px, so a list inside a zoomed canvas (a checklist in a node) lagged or ran ahead of the pointer at any zoom but 100%. The scale is measured from the item (rect size over `offsetHeight`) when the drag starts and the offsets are divided by it; the scrolled distance of the list is multiplied by it. At zoom 1 nothing changes.
- **`camera`: `fitCamera(rect, size, padding?, limits?)`.** The camera that shows a whole rectangle in a view, centred, with air around, zoom clamped to the limits (with `max: 1`: fit but never enlarge). "Zoom to fit" of every canvas editor was a few lines each app wrote again.
- **`canvas`: a context menu hook.** A right click without dragging used to open the node palette and nothing else. `host.contextMenu(screen, world, target)` is asked first, with what lies under the pointer (`{ kind: 'node', nodeId }`, `{ kind: 'link', id }` or `{ kind: 'empty' }`); return true after showing your menu, false (or have no member) and the palette opens as before. A right button that was dragged still pans and asks nothing. On touch a finger held still on a node or a link (the long press) asks the same, with the same targets; held on an empty place it asks with `{ kind: 'empty' }` and opens the palette unless you return true. Without the member nothing changes (the palette on an empty place, nothing on a node).
- **`canvas`: a "place" tool.** A toolbar with "Note", "Frame", "Text" tools needs the canvas to say where the next click landed. `host.placing` (readonly boolean) arms it; while it is true, a left press on the canvas calls `host.placeAt(screen, world)` and does nothing else (no selection, no frame, no drag); it also lands over a node and over a field inside one (the tool was just chosen, a note under the cursor must not swallow the click); the right and middle buttons still pan. Disarming the tool (after one placement, on Esc) is the app's business. Both members are needed: without `placeAt` the flag is ignored.

## 0.9.0

Migrate: `curvefield` and `swiperow` now take their colours from the bridge like the other modules, so import `@1337exp/taoux/taoui.css` with them (`curvefield` drew the plot in TaoUI colours by itself, `swiperow` read the TaoUI tone tokens). Without it they use the built-in dark defaults. `swiperow` without the bridge has a 12px radius (it was the TaoUI panel radius).

- **The TaoUI bridge is a contract.** `theme/taoui.css` is the only file that names a `--tao-*` token; the modules read `--tx-*` with a fallback. `tests/bridge.test.ts` checks that no file in `src/` names `--tao-*`, that every themed variable (colour, tone, radius) the components read is mapped, and that the bridge points only at tokens the installed TaoUI defines.
- **Corner radius through the bridge.** New `--tx-curve-radius`, `--tx-gradient-radius`, `--tx-canvas-radius` (defaults 4px, 4px, 6px, as before) mapped to `--tao-radius-control`; `--tx-swipe-radius` is mapped to `--tao-radius-panel`.
- **`swiperow`: the action tone and the focus ring have variables.** `--tx-swipe-tone`, `--tx-swipe-tone-text`, `--tx-swipe-armed-text`, `--tx-swipe-accent`; the bridge maps the tone on the action element.
- **`curveeditor`: the label of zero stays bright.** The brightness of the end labels of the value axis was decided by their place in the list, so a new label below zero took the colour from it while the scale was rescaling; now zero keeps it.

## 0.8.0

Nothing to migrate: one new function; `downloadText` keeps its signature and result.

- **`file`: `downloadBlob(filename, data, mime?)`.** `downloadText` could only save a string, so an app that makes bytes (a ZIP, a PNG) wrote its own copy of the temporary-link dance. `downloadBlob` takes any `BlobPart` (`Uint8Array`, `Blob`, string); without `mime` a `Blob` keeps its own type and anything else is `application/octet-stream`. `downloadText` is now a thin call to it.
- **`file`: the download link is in the document while it is clicked.** Some browsers follow a link only if it is attached; the link is added to the body for the click and removed right after (`downloadText` gets this too).

## 0.7.1

Nothing to migrate: three options, all off by default; an app that does not pass them works as before.

- **`canvas`: a selection frame that picks only what lies wholly inside.** `options.marquee: 'contain'` (default `'intersect'`, as before). In a level editor a frame drawn over a few objects also touched the ground under them and picked it; with `contain` only the nodes inside the frame are selected (a container still counts by its strip).
- **`canvas` and `camera`: your own zoom range.** The wheel and the pinch were clamped to 0.2…2 by constants, too narrow for a world thousands of units long. `options.zoom: { min?, max? }` sets the range of the canvas; `zoomAt(cam, sx, sy, factor, limits?)` takes it too, and `zoomLimits(partial)` / `clampZoom(z, limits?)` / `ZOOM_LIMITS` are exported. `session` takes the same `zoom` so a loaded view is clamped to the same range.
- **`canvas`: the app can keep a key from the canvas.** The canvas listens to Delete, Backspace, Escape and Ctrl+Z / Y on the whole window, so a tool that used Backspace (drop the last point of a path) also deleted the selection. `host.claimsKey(event)` is asked first; returning true leaves the key to the app.

## 0.7.0

Nothing to migrate: a new module, nothing existing changes.

- **New module `undovue`: reactive `canUndo` / `canRedo` for `UndoStack` and `History`.** Both are plain classes whose flags are getters, so an app that wants the Undo and Redo items of a menu to switch on and off had to keep two refs and a `syncFlags()` by hand (every project that uses `undo` or `history` did). `useUndoStack(optionsOrStack)` and `useHistory(initialOrHistory)` wrap the class and keep `canUndo` / `canRedo` (read-only refs) in step after `record`, `undo`, `redo`, `clear`, `commit`, `reset`; `useHistory` also fits `historyCommands` as a source. For a stack you already made (a factory of yours, a store), `useUndoFlags(source)` gives the refs and `sync()`. The classes themselves are not touched.

## 0.6.0

- **New module `tour`: the model of a guided tour of a page.** `createTour({ steps, available, onEnd })` is a plain state machine without Vue: `start`, `next`, `prev`, `goTo`, `skip`, `finish`, `setSteps`, `subscribe`. A step is `{ id, ...yours }`; one that `available` refuses (its target is not on the page) is jumped over in both directions, and `first` / `last` say whether there is anywhere to go, and `position` / `total` count only the steps that can be shown (for a "2 of 4" that does not count the skipped ones). A tour ends once as `done` or `skipped`. `useTour` is the same with refs for a component, `createTourMemory(key)` remembers that a tour was seen. It draws nothing: the spotlight and the card belong to the app or to TaoUI.

## 0.5.6

- **`swiperow`: an open row does not click through.** The row that stayed open on its actions still had a live face: a tap on the sliver of it that is left opened the item, and the press outside that closed the row went on to a click on whatever lay under the finger (another row opened). Now a click on the open row only closes it and does not reach its content, and the click after a press outside is swallowed once (a mail app does the same). `:swallow-outside-click="false"` lets the outside click through after the row has closed. A press that gives no click (a scroll) lets go of the guard after 0.6 s. The action buttons work as before.
- **`swiperow`: a row mounted open** (`open` true from the start) closes on a press outside it too; the listener was only added when `open` changed.

## 0.5.5

- **`swiperow` stays under a floating bar.** The face of a row has `z-index: 1`, and the row had no stacking context of its own, so the faces took part in the stacking of the whole page and were drawn over a floating `TaoNav` (its glass pill included): the text of the rows showed over the menu. The row is `isolation: isolate` now, and the face counts inside it only.
- **`swiperow` `tabbable`.** `:tabbable="false"` takes the action buttons out of the Tab order (`tabindex="-1"`), for an app with its own keyboard path to the same actions (arrows, Delete, a menu key); they still run by a click or a swipe. On by default.

## 0.5.4

- **`swiperow`: Tab from the start action to an end one.** The start side stayed shown and won, so the end action that got the focus stayed hidden under the row (it came out only after the window lost and got back the focus). An action that gets the focus now shows its side and only its side; the focus on the row's own content shows neither.

## 0.5.3

- **`sortable` no longer gives a page a scroll.** Its live region stood absolute at the end of the body, so on a page exactly the window's height it hung a pixel below and the page scrolled by 1px. It is fixed at the corner of the window now.
- **`swiperow` takes its colour from `--tx-swipe-bg`.** The face of the row and the ground its actions are tinted on were the raised surface with no way to change them, so a row right on the page showed a lighter edge at its corners. `--tx-swipe-bg` (the raised surface by default) sets both: `var(--tao-color-bg)` for a row on the page. The TaoUI bridge (`taoui.css`) maps it. `--tx-swipe-radius` and `--tx-swipe-gap` now work from an element around the row too: they were set on the row itself, so a value on its list was overridden.
- **[docs/swiperow.md](docs/swiperow.md):** the variables of the row, and how to test a swipe automatically: synthetic pointer events go to `.tx-swipe__front`, in several moves (the first one past the slop only decides the swipe and becomes the zero point), with the window keeping the focus; a Playwright example with real touches.

## 0.5.2

- **`swiperow` without the full swipe.** `:full-swipe="false"` turned the long pull off, but the row hit a hard stop at one and a half times the open actions, and the middle actions still shrank as if the last were about to run. Now a pull past the open actions meets a spring (the row follows ever slower, up to half their width more), the actions grow side by side, and on release the row rests open: nothing runs.
- **`swiperow` selects nothing by accident.** The actions are buttons, so a press or a pull over them never selects their labels (nor opens the long-press callout on iOS); while a row is pulled nothing is selected, and with `mouse` a press-and-move on the row drags it instead of selecting its text.
- Sandbox: the task list has no full swipe.

## 0.5.1

- **`swiperow`: the actions show without a jump.** The icon and the label always stand where they end up (nothing pops into the layout, so the heights stay), and only their opacity follows the width of their block: the icon fades in first, the label later, once the block holds it. The start action is one line from the start edge, the icon first. A short fade covers the moment the row settles by itself. The `action` slot gets the block's `width`.
- **`swiperow`: nothing behind, nothing trailing.** On a long pull to the end the start action showed at the start edge: its panel kept a 6px padding and did not clip. The panel clips now and the gap is the button's margin, so at width 0 nothing of it is left (the keyboard still reaches it). Under the finger the actions trailed the row (their widths eased all the time the full swipe was armed, and the icons and labels faded with a delay): now they follow in the same frame, and only the moment the full swipe arms or disarms eases the widths.
- **`swiperow`: the middle actions give way instead of the widths jumping.** Up to the open width the end actions grow evenly, as before. Past it the actions between the row and the last one stop at their width and shrink back, smoothly, to slivers (`SWIPE_SLIVER_PX`, 32px) a fifth of the row past the full-swipe threshold, and the last action takes the room they give up; further on they stay slivers, a visible link, and a pull back opens them out the same way. `endWidths` is one continuous function of the pull (the `armed` argument is kept but no longer used), so the eased switch when the full swipe armed is gone too.
- **A held gesture lets go when the window loses the focus.** Alt-Tab or a screenshot tool often swallow the `pointerup` of a press that was held: a swipe row stayed pulled and a dragged list item stayed lifted when the user came back. `TaoxSwipeRow` and `useSortable` now end the gesture on a window blur, a hidden page or `pagehide`, and the row or the item goes back to rest, as TaoUI's carousel and slider do. The listener is exported as `listenFocusLoss` from `gestures`.
- `swiperow`: the icon and the label of an end action sit a little closer (gap 2px, icon 20px), not pressed to the edges of a short row.
- The sandbox has a second list with no start action: those rows go only to the left.
- The sandbox mail list sets the actions per row: a newsletter has More, Unsubscribe, Delete; a letter from a person only More and Delete.
- **Docs:** «Why TaoUX» tells what it is now (gestures and lists, undo by records, storage across tabs, the tiers, the skill), and the skill's description names the new modules. A `taoux-dev` skill for working in the repository (`.claude/skills`, now tracked).

## 0.5.0

- **New module `swiperow` (tier 2, Vue, on TaoUI): `TaoxSwipeRow`, a list row a finger slides sideways, as in a mail app.** To the start (right) one action is behind the row: a pull past its threshold (96px, or a third of a narrow row; or flung that way past half of it) runs it on release and the row comes back, as read / unread. To the end (left) the actions grow out evenly from slivers to their width and the row rests open on them (`v-model:open`), by the nearest stop or a fling; a pull back, a touch outside or an action closes it. Pulled far (60% of the width), the full swipe is armed: the last action takes nearly the whole row, the others shrink to slivers, and the release runs it (delete; `fullSwipe: false` turns it off). Armed actions buzz where the phone can. A vertical move stays the page's scroll; a mouse drags only with `mouse`; the click at the end of a swipe does not reach the row; Tab reaches the actions and opens their side. The gesture is `SwipeTracker` of `gestures`; the decisions are pure and exported (`swipeRowRelease`, `armedAt`, `endWidths`, `clampOffset`). Import `@1337exp/taoux/swiperow.css`. A sandbox page shows a mail list.
- The sandbox and the tests now run on TaoUI 5.6.2 (dev dependency; the peer range stays `^5.0.0`).

- **New module `sortable` (tier 1, Vue): reorder a list by a grip, with the pointer and the keyboard.** `useSortable(listRef, { onMove })` listens on the list; the markup is yours: `data-sortable-item` on each item, in order, and `data-sortable-handle` on a focusable grip inside it (a TaoButton with `icon="tao-grip"`). The pointer: press the grip, the item follows and the others make room (by its size and the gap), the list (or the page) scrolls at its edge through `edgescroll`, release drops it, Esc puts it back; past the ends it is drawn no further than the end (it would stretch the scrolled area and run away with the edge scroll) and lands in the last place. The keyboard: Space or Enter lifts, ↑ ↓ (← → with `axis: 'x'`) move one place, Space / Enter drop, Esc returns it where it started, Tab drops it where it is; a live region of its own says where the item is (`sortableTextsEn` / `sortableTextsRu`, or your `texts`, a function follows the language). The list stays the app's: `onMove(from, to)`, and `moveItem(list, from, to)` makes the moved copy. While moving, the item carries `data-sortable-dragging` or `data-sortable-lifted` for your styles. Pure helpers `sortTarget` and `sortShifts` are exported and tested. A sandbox page shows it with TaoUI.

## 0.4.0

- **New module `undo` (tier 0): undo and redo by records.** `UndoStack` keeps steps made of only the records they touched (`before` and `after` images), not snapshots of the whole document as `History` does, so a step costs what it changed, and an undo after a sync does not roll back what another device has just changed. `diffRecords(prev, next, id)` makes a step from two lists (records are immutable, found by identity); `record(entry, key?)` merges quick edits with one key within `coalesceMs` (3 s) into one step; `undo(current)` / `redo(current)` take the current list and return the next one. Two hooks carry what only the app knows: `revive(image, now)` stamps a returned record as new (`updatedAt: now`), and `vanish(record, now)` marks a record the step created as gone instead of erasing it (a tombstone; without it the record is dropped). A record that comes back takes its old place (a step keeps where its records stood, `beforeAt` / `afterAt`), so a note removed from the middle returns to the middle and «delete all» undone is the same list in the same order; the nearest place if the list changed meanwhile. The merge window slides with every edit, so typing without a pause stays one step; `coalesceMaxMs` caps how long a merged step may grow (no cap by default). It came out of Next Up's `core/undo.ts`; nothing else changes.

## 0.3.0

Additions for apps that are not canvas editors (a list of notes); everything that was there works as before, nothing to migrate.

- **`ids`: `uuid()`** — a random UUID v4 for records that are stored or synced. `crypto.randomUUID` where there is one; outside a secure context (plain http on a LAN address) the same v4 from `crypto.getRandomValues`. `uid()` stays for ids inside one document: its counter restarts on every load, which its comment now says.
- **`storage`:** `createSavedStorage` returns a `KeyStorage`, still a `SavedStorage` (it fits `createDocumentSession` as before), with `tryWrite(text)` → `{ ok: false, reason: 'quota' | 'denied' | 'unknown' }` (`write` stays a boolean), `remove()`, and `subscribe(listener)`: another tab of the site changed, removed or cleared the key. `storageFailure(error)` is exported too.
- **`session`:** `camera` is optional — a document without a canvas view (a list) gets `undefined` in `serialize`, and a `view` from `parse` is ignored. `countItems` is the new name of `countNodes`; the old name is still read.
- **`gestures`: `SwipeTracker` and `settleOpen`.** The tracker tells a swipe along its axis from a scroll across it (inside `SWIPE_SLOP_PX` nothing is decided, a diagonal goes to the page), follows the offset from where the row already stands without a jump by the slop, and measures the release speed over the last 100 ms. `settleOpen(release, { start?, end? })` says where a released row rests: a fling goes on one stop in its direction (an open row flung back closes rather than flying to the other side), otherwise the nearest stop.

## 0.2.2

- **`file`:** `downloadText(filename, text, mime?)` takes the type of the file (it was always `application/json`), and the new `readTextFile(file, limit?)` is its pair: it reads a picked file as text, refuses a file above `MAX_FILE_BYTES` before reading it, and returns `{ ok: false, error: 'tooLarge' | 'unreadable' }` instead of throwing. Nothing to migrate.

## 0.2.0

TaoUI 5.0 is out, and TaoUX follows it, with two new modules for the TaoUI menu bar.

### Modules

- **A skill for AI assistants** ships in the package: `skills/taoux/SKILL.md` (the modules, the TaoUI bridge, commands and hotkeys with the menu bar, the usual mistakes). `tests/skill.test.ts` keeps it naming every module.
- **New `hotkeys`** (tier 0): `parseHotkey` (`Mod+Shift+Z`, aliases, the plus key; a typo throws), `matchHotkey` (`Mod` is ⌘ on Apple and Ctrl elsewhere; a non-Latin layout and Option on a Mac match by the physical key, the digit row too), `formatHotkey` (`Ctrl+Shift+Z` / `⇧⌘Z` in Apple's ⌃⌥⇧⌘ order), `normalizeHotkey`, `isReservedHotkey` (⌘W, ⌘T, ⌘N, Ctrl+Tab; ⌘Q on a Mac, Alt+F4 elsewhere, ⌘R in Safari), `bindHotkeys` (on any element; text fields keep plain keys and text editing by default).
- **New `commands`** (tier 1): `createCommands` — a registry of commands with `label`, `shortcut`, `icon`, `enabled`, `checked`, `group`, `run`; `toMenu(layout)` builds the menu tree for `TaoMenubar`, `TaoDropdownMenu` and `TaoContextMenu` (the same shape as TaoUI's `TaoMenuItem`, held by a type test, with no dependency on TaoUI); `bind` listens to the shortcuts (a disabled command swallows its key); `check` lists reserved and duplicate shortcuts; `historyCommands` gives Undo / Redo that disable themselves (a document session fits as is).

### TaoUI

- **Built and tested against TaoUI 5.0.0** (peer range `^5.0.0`, optional). TaoUI 5 is ESM-only; its styles moved into `tokens/`, `themes/` and `contexts/`, and `TaoTimeline` is now `TaoScrubber`.
- **The bridge is unchanged for you:** the 13 `--tao-color-*` tokens it points at are the same. Its test no longer depends on one TaoUI file name: it reads every stylesheet of the installed TaoUI, so a future reshuffle cannot break it for the wrong reason.
- The sandbox, the docs and the consumer smoke test use `TaoScrubber`.
- `npm run smoke` accepts `TAOUI_TARBALL=<file.tgz>` to test against a TaoUI that is not published yet.

## 0.1.0

The first public release.

### Modules

- **Primitives:** `camera`, `history`, `storage`, `file`, `snap`, `wheel`, `edgescroll`, `gestures`, `touch`, `curve`, `ids`, `ease`, `num`, `i18n`.
- **Composite:** `session`, `palette`, `pins`, `playback` (`createPlayback`, `usePlayback`), and the Vue modules `links`, `canvas`, `curveeditor`, `gradienteditor`.
- **Tier 2, on TaoUI:** `curvefield` (`TaoxCurveField`): a curve with time, value, transition (`ease`), snapping, remove and reset fields.
- **Curve editor:** grid, snapping, bounds, decimals, auto-scroll at the edge, per-segment easing with Bezier handles, guides (`off`, `lines`, `values`), keyboard.

### TaoUI

- **The TaoUI bridge:** `import '@1337exp/taoux/taoui.css'` points every `--tx-*` colour variable at a `--tao-*` token, so the editors follow the TaoUI theme (dark, light, your own). Plain CSS, zero specificity, no dependency on TaoUI. `tests/bridge.test.ts` keeps it complete.
- Built and tested against TaoUI 3.3.1 (peer range `^3.2.1`, optional).

### Packaging

- `sideEffects` lists the CSS files, so bundlers keep `import '@1337exp/taoux/canvas.css'`.
- `npm run smoke` installs the packed tarball into a throwaway Vue + Vite app next to TaoUI, imports every module by its public path and builds it (also runs in CI).

### Sandbox

- English and Russian, a dark / light switch, relative paths for hosting in a sub-folder (`npm run sandbox:build`).
- `npm run media` captures the screenshots and clips in `docs/media` from the sandbox.
