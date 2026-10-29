<h1 align="center">TaoUX</h1>

<p align="center">
  <b>Interaction building blocks for Vue apps.</b><br>
  Import only what you need, bring your own design.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@1337exp/taoux"><img src="https://img.shields.io/npm/v/@1337exp/taoux?color=cb3837&logo=npm" alt="npm"></a>
  <a href="https://github.com/1337exp/taoux/actions/workflows/ci.yml"><img src="https://github.com/1337exp/taoux/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/1337exp/taoux/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@1337exp/taoux?style=flat" alt="license"></a>
  <img src="https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <b>English</b> · <a href="https://github.com/1337exp/taoux/blob/main/README.ru.md">Русский</a> ·
  <a href="#with-taoui">With TaoUI</a> ·
  <a href="#modules">Modules</a> ·
  <a href="#sandbox">Sandbox</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/screenshots/overview-dark.webp" alt="TaoUX curve editors in the dark theme" width="860">
</p>

## Why TaoUX

- **Pay for what you use.** Every module is its own subpath import with its own entry point: `import { zoomAt } from '@1337exp/taoux/camera'`. `sideEffects` is declared, the rest tree-shakes; there is no root entry, so nothing you did not import reaches the bundle.
- **Logic first, tested without a browser.** The core of a module (camera maths, undo, easing, playback, where a swiped row comes to rest) is plain TypeScript, unit-tested with no DOM. The Vue parts are thin shells on top.
- **Fingers and keys alike.** Taps, long presses, pinches and swipes that tell a swipe from a scroll; lists reordered by a grip (`sortable`) and rows slid aside for their actions (`swiperow`), each with a keyboard path and a live region for a screen reader.
- **For apps, not only editors.** Undo by records that is safe next to a sync (`undo`), autosave that never throws and hears other tabs (`storage`), UUIDs for stored records, typed i18n, commands and hotkeys that build the menus.
- **Your design, or TaoUI in one line.** Components take `--tx-*` CSS variables with dark defaults; `import '@1337exp/taoux/taoui.css'` makes them follow the TaoUI theme and palettes. [Details below.](#with-taoui)
- **Layers you can rely on.** Primitives import nothing, composites only primitives, and only the fields (`curvefield`, `swiperow`) touch TaoUI: a test reads the imports and keeps it so.
- **Ready for AI assistants.** The package ships a skill that names every module and the usual mistakes, so an assistant writes TaoUX code instead of guessing.

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/curveeditor.webp" alt="Curve editor: dragging and adding points"><br><sub><b>curveeditor</b> — grid, snapping, bounds, Bezier handles, keyboard</sub></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/gradienteditor.webp" alt="Gradient editor: adding and moving stops"><br><sub><b>gradienteditor</b> — stops, handles, <code>gradientCss</code></sub></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/playback.webp" alt="Playback: TaoScrubber driven by usePlayback"><br><sub><b>playback</b> — time, loop, speed, seeking; <code>usePlayback</code> + TaoUI <code>TaoScrubber</code></sub></td>
    <td><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/curvefield.webp" alt="TaoxCurveField: a curve with TaoUI fields"><br><sub><b>curvefield</b> — a curve with TaoUI fields in one component</sub></td>
  </tr>
</table>

## Install

```bash
npm install @1337exp/taoux
npm install @1337exp/taoui   # optional: only for curvefield, swiperow and the TaoUI bridge
```

Peers: `vue ^3.4` (for the Vue modules) and, optionally, `@1337exp/taoui ^5.0.0`. Modules without Vue need nothing.
ESM only. Import by subpath; there is no root entry on purpose, so nothing you do not import can end up in your bundle.

## With TaoUI

TaoUX and [TaoUI](https://www.npmjs.com/package/@1337exp/taoui) are two separate packages: TaoUX has no buttons or fields of its own, TaoUI knows nothing about TaoUX. Joining them takes two things, and the first is one line:

```ts
import '@1337exp/taoui/styles.css';
import '@1337exp/taoux/taoui.css';          // the bridge: --tx-* → --tao-*, the editors follow the TaoUI theme
import '@1337exp/taoux/curveeditor.css';    // styles of a Vue module are imported explicitly
```

`taoui.css` is plain CSS with zero specificity and no dependency on TaoUI, so any rule of yours wins. Values then travel through `v-model`: `usePlayback` drives `TaoScrubber`, a TaoUI field edits a curve point, a TaoUI slider sets the opacity of a gradient stop. With code: [docs/taoui.md](docs/taoui.md). Without the bridge the editors keep their dark defaults; `TaoxCurveField` (built from TaoUI components) follows the theme by itself.

<a id="modules"></a>

## Modules

Every module is its own subpath import, so only what you actually use ends up in the build:

```ts
import { zoomAt } from '@1337exp/taoux/camera';
import { History } from '@1337exp/taoux/history';
```

| Module | What it does | Depends on |
|---|---|---|
| `camera` | canvas camera: pan, zoom around the cursor, screen ↔ world | nothing |
| `history` | undo/redo on string snapshots, rapid edits merged into one step | nothing |
| `undo` | undo/redo by records, not snapshots: a step keeps only the records it touched, so it is small and an undo after a sync does not roll back another device's edits; quick edits merge (`UndoStack`, `diffRecords`) | nothing |
| `hotkeys` | shortcuts: `parseHotkey('Mod+Shift+Z')`, `matchHotkey` (Mod = ⌘ / Ctrl, non-Latin layouts by the physical key), `formatHotkey` (`Ctrl+Shift+Z` / `⇧⌘Z`), `isReservedHotkey` (⌘W, ⌘T, ⌘Q…), `bindHotkeys` on an element | DOM (for `bindHotkeys`) |
| `storage` | autosave to localStorage without exceptions; `tryWrite` (why it failed: quota / denied), `remove`, `subscribe` (another tab changed the key) | nothing |
| `file` | download text as a file (any `mime`), read a picked file as text with a size limit | DOM |
| `snap` | soft snapping to a grid with a threshold that follows the camera zoom | nothing |
| `wheel` | wheel/trackpad → pan or zoom (like Figma) | nothing |
| `edgescroll` | auto-scroll speed near an edge and a ready loop, `createEdgeScroller` (canvas, curve editors, any drag) | nothing |
| `gestures` | touch gestures: tap, double tap, long press, pinch, swipe (`SwipeTracker` + `settleOpen` for a row that slides open); `listenFocusLoss` ends a held gesture when the window loses the focus | nothing |
| `touch` | `coarse`: is there a coarse pointer (a finger) | vue (peer) |
| `curve` | link paths: bezier between pins, arrowheads of constant screen size | nothing |
| `ids` | `uuid()` for records that are stored or synced; `uid(prefix, taken)` for ids inside one document | nothing |
| `ease` | easing functions between curve points: 8 families × in / out / in-out, `linear`, `step`, cubic Bezier; `easeValue`, `isEase` (the editor draws with it, a runtime evaluates with it) | nothing |
| `num` | small numeric helpers: `clamp`, `roundTo`, `snapTo`, `niceStep`, `ticks` (shared by the curve, gradient and playback modules) | nothing |
| `sortable` (Vue) | reorder a list by a grip and by the keyboard: `useSortable(listRef, { onMove })`, `data-sortable-item` / `data-sortable-handle`; the others make room, the list scrolls at its edge, Esc puts it back, a live region tells a screen reader; `moveItem` | vue (peer) |
| `session` | document lifecycle: history, autosave, files, restore, notices; a canvas camera is optional (`countItems`) | vue (peer) |
| `commands` | a registry of commands (label, shortcut, `enabled`, `checked`, `run`): `toMenu(layout)` builds a `TaoMenuItem[]` tree for `TaoMenubar` / `TaoContextMenu`, `bind` listens to the same shortcuts, `historyCommands` gives Undo / Redo that disable themselves, `check` finds reserved and duplicate shortcuts | DOM (for `bind`) |
| `palette` | search and groups of nodes for a palette | nothing |
| `links` (Vue) | links layer: SVG from ready geometry, `--tx-link-*` | vue (peer) |
| `canvas` (Vue) | canvas: mouse and touch gestures, wheel, auto-scroll, keys; the `CanvasHost` contract | vue (peer) |
| `curveeditor` (Vue) | curve editor plot: grid, snapping, bounds, decimals, auto-scroll at the edge; point operations; per-segment transitions with Bezier handles; keyboard (Tab, arrows, Shift, Insert, Delete) | vue (peer) |
| `swiperow` (Vue, tier 2) | `TaoxSwipeRow`: a list row a finger slides sideways, as in a mail app: to the start one action that runs past a threshold (read / unread), to the end actions that grow out and stay open, a long pull runs the last one (delete); TaoUI icons and tones, `@action="id => …"`; Tab reaches the actions | vue, **@1337exp/taoui** (peer) |
| `curvefield` (Vue, tier 2) | `TaoxCurveField`: a curve with fields on TaoUI components: point time and value, transition to the next point (`ease`), snapping, remove and reset; labels come from the app | vue, **@1337exp/taoui** (peer) |
| `gradienteditor` (Vue) | gradient bar with stop handles; stop operations, `gradientCss`; keyboard (Tab, arrows, Home/End, Insert, Delete) | vue (peer) |
| `playback` | playback model: time, pause, loop, speed, seeking; `createPlayback` without Vue and `usePlayback` for a component | vue (peer, for `usePlayback`) |
| `pins` | row pin positions measured from the DOM: `usePinMeasure`, `createPinRegistry` | vue (peer) |
| `i18n` | typed i18n: `createI18n({ locales, fallback, storageKey })` | vue (peer, optional) |

Vue modules (`links`, `canvas`, `curveeditor`, `curvefield`, `gradienteditor`, `swiperow`) need their styles imported explicitly: `import '@1337exp/taoux/canvas.css'`. Composite modules (session, commands, palette, links, canvas, pins, curveeditor, gradienteditor, playback) import only primitives. Tier 2, fields (`curvefield`, `swiperow`), assemble composites into a ready field on TaoUI components: it is the only tier allowed to import TaoUI, which is why `@1337exp/taoui` is an optional peer dependency. `curvefield` needs both `curveeditor.css` and `curvefield.css`. The `tiers.test.ts` test guards all of that. The canvas contract is described in [docs/canvas.md](docs/canvas.md) ([Русский](docs/canvas.ru.md)); transitions between curve points are in [docs/ease.md](docs/ease.md) ([Русский](docs/ease.ru.md)).

The rule: a module lands here when a second project needs it. A module's core knows nothing about Vue or the DOM unless that is its job.

**For AI assistants:** the package ships a skill, `skills/taoux/SKILL.md`: how the modules fit together and the mistakes to avoid. Point your assistant at it (Claude Code: copy the folder into `.claude/skills/`).

## Development

```bash
npm install
npm test            # vitest
npm run typecheck
npm run build       # dist/ (vite + tsc declarations)
npm run smoke       # pack, install into a throwaway app next to TaoUI, build it
npm run sandbox     # the sandbox: http://localhost:5300, pages from sandbox/
npm run dev         # watch: rebuild JS and declarations
```

A new module is a file `src/<name>.ts` (or a folder with `index.ts`) and an entry in `exports` in `package.json`; the `exports.test.ts` test makes sure they match. More in [CONTRIBUTING.md](CONTRIBUTING.md).

Working against a local checkout instead of npm: put `"@1337exp/taoux": "file:../taoux"` into the project's `package.json` (edits are visible at once after `npm run dev` here). Then the consumer's `vite.config.ts` needs `resolve: { dedupe: ['vue'] }` and its `tsconfig.json` needs `"vue": ["./node_modules/vue"]` in `paths`, otherwise the linked package gets its own copy of Vue and reactivity breaks. A normal install from npm needs none of this.

## Sandbox

The `sandbox/` folder is a demo and a testing ground: pages import the modules straight from `src/`, with no build. It holds `curveeditor`, `curvefield`, `gradienteditor`, `slider`, `color`, `playback`, `sortable` and `swiperow`, with an EN / RU switch and a dark / light switch (the TaoUI theme, through the bridge). A new page is `sandbox/<name>.html` + `.ts` + a demo `.vue` and a link in `sandbox/index.html`. `npm run sandbox:build` makes a static copy with relative paths, ready for any folder (for example `/sandbox/taoux/`).

Screenshots and clips in this README come from the sandbox: see [docs/media](docs/media/README.md).

## Contributing

Issues and pull requests are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 1337exp
