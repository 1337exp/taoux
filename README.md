# @1337exp/taoux

**English** · [Русский](README.ru.md)

Building blocks for interaction and behavior in Vue apps: import only what you need, bring your own design.

**With TaoUI:** TaoUX and [TaoUI](https://www.npmjs.com/package/@1337exp/taoui) are two separate packages. There is no ready-made module that joins them, so you connect them yourself: map `--tx-*` to the `--tao-*` tokens and pass values through `v-model`. How, briefly and with code: [docs/taoui.md](docs/taoui.md).

Self-contained UX modules. Every module is its own subpath import, so only what you actually use ends up in the build:

```ts
import { zoomAt } from '@1337exp/taoux/camera';
import { History } from '@1337exp/taoux/history';
```

| Module | What it does | Depends on |
|---|---|---|
| `camera` | canvas camera: pan, zoom around the cursor, screen ↔ world | nothing |
| `history` | undo/redo on string snapshots, rapid edits merged into one step | nothing |
| `storage` | autosave to localStorage without exceptions | nothing |
| `file` | download text as a file, size limit | DOM |
| `snap` | soft snapping to a grid with a threshold that follows the camera zoom | nothing |
| `wheel` | wheel/trackpad → pan or zoom (like Figma) | nothing |
| `edgescroll` | auto-scroll speed near an edge and a ready loop, `createEdgeScroller` (canvas, curve editors, any drag) | nothing |
| `gestures` | touch gestures: tap, double tap, long press, pinch | nothing |
| `touch` | `coarse`: is there a coarse pointer (a finger) | vue (peer) |
| `curve` | link paths: bezier between pins, arrowheads of constant screen size | nothing |
| `ids` | `uid(prefix, taken)` | nothing |
| `num` | small numeric helpers: `clamp`, `roundTo`, `snapTo`, `niceStep`, `ticks` (shared by the curve, gradient and playback modules) | nothing |
| `session` | document lifecycle: history, autosave, files, restore, notices | vue (peer) |
| `palette` | search and groups of nodes for a palette | nothing |
| `links` (Vue) | links layer: SVG from ready geometry, `--tx-link-*` | vue (peer) |
| `canvas` (Vue) | canvas: mouse and touch gestures, wheel, auto-scroll, keys; the `CanvasHost` contract | vue (peer) |
| `curveeditor` (Vue) | curve editor plot: grid, snapping, bounds, decimals, auto-scroll at the edge; point operations; keyboard (Tab, arrows, Shift, Insert, Delete) | vue (peer) |
| `gradienteditor` (Vue) | gradient bar with stop handles; stop operations, `gradientCss`; keyboard (Tab, arrows, Home/End, Insert, Delete) | vue (peer) |
| `playback` | playback model: time, pause, loop, speed, seeking; `createPlayback` without Vue and `usePlayback` for a component | vue (peer, for `usePlayback`) |
| `pins` | row pin positions measured from the DOM: `usePinMeasure`, `createPinRegistry` | vue (peer) |
| `i18n` | typed i18n: `createI18n({ locales, fallback, storageKey })` | vue (peer, optional) |

Vue modules (`links`, `canvas`, `curveeditor`, `gradienteditor`) need their styles imported explicitly: `import '@1337exp/taoux/canvas.css'`. Composite modules (session, palette, links, canvas, pins, curveeditor, gradienteditor, playback) import only primitives, and the `tiers.test.ts` test guards that. The canvas contract is described in [docs/canvas.md](docs/canvas.md) (in Russian).

The rule: a module lands here when a second project needs it. A module's core knows nothing about Vue or the DOM unless that is its job.

## Development

```bash
npm install
npm test            # vitest
npm run typecheck
npm run build       # dist/ (vite + tsc declarations)
npm run sandbox     # sandbox: http://localhost:5300, pages from sandbox/
npm run dev         # watch: rebuild JS and declarations
```

A new module is a file `src/<name>.ts` (or a folder with `index.ts`) and an entry in `exports` in `package.json`; the `exports.test.ts` test makes sure they match.

## Using it from a project (before publishing)

In the project's `package.json`: `"@1337exp/taoux": "file:../taoux"`, then `npm install`. npm links the neighbouring folder, so edits in taoux are visible at once (after `npm run dev` here).

Link notes:

- The consumer's `vite.config.ts` needs `resolve: { dedupe: ['vue'] }`, and its `tsconfig.json` needs `"vue": ["./node_modules/vue"]` in `paths`. Otherwise the linked package gets its own copy of Vue and reactivity and types break (`ComputedRef` is not recognised as `Ref`).
- Classic `npm link` (through a global folder on drive C:) does not work on the author's machine: the C: → E: junction breaks ("mount point ... not attached"). So use `file:` or a junction inside E: only.

## Sandbox

The `sandbox/` folder is a demo and a testing ground for components: pages import modules straight from `src/`, with no build. A new component is `sandbox/<name>.html` + `.ts` + a demo `.vue` and a link in `sandbox/index.html`. Run it with `npm run sandbox`. It holds `curveeditor`, `gradienteditor`, `slider`, `color` and `playback` for now. The sandbox is built together with TaoUI (a dev dependency that does not ship in the package), so you can see how the modules work as a pair, and there is a dark/light theme switch. TaoUX itself does not depend on TaoUI.
