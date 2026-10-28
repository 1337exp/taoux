# Changelog

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
