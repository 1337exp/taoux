# Changelog

## 0.2.0

TaoUI 5.0 is out, and TaoUX follows it. Nothing in the TaoUX API changed; what changed is what it sits on.

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
