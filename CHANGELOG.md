# Changelog

## 0.5.2

- **`swiperow` without the full swipe.** `:full-swipe="false"` turned the long pull off, but the row hit a hard stop at one and a half times the open actions, and the middle actions still shrank as if the last were about to run. Now a pull past the open actions meets a spring (the row follows ever slower, up to half their width more), the actions grow side by side, and on release the row rests open: nothing runs.
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
