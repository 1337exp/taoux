---
name: taoux-dev
description: Work inside the TaoUX repository (E:\job\git\taoux) — the module tiers and the tests that guard them, how a module is added (exports, styles, skill, sandbox page), the full check, versions, and what never to do without the owner. Use for any edit to TaoUX's modules, sandbox or docs.
---

# Working in the TaoUX repository

TaoUX is a set of behaviour modules for Vue 3 apps, imported by subpath (`@1337exp/taoux/<module>`), pre-1.0. The guide for
using it is [skills/taoux/SKILL.md](../../../skills/taoux/SKILL.md) (it ships in the package). Its controls come from TaoUI
(`E:\job\git\taoui`, its own `.claude/skills/taoui-dev`).

## Never without the owner saying so

- `npm publish`, `git push`, tags. Merge locally into `main` (`git merge --no-ff <branch>`).
- Committing the owner's regenerated `docs/media` files unless asked.

## Tiers (docs/canvas.md, guarded by tests/tiers.test.ts)

| Tier | What | May import |
|---|---|---|
| 0, primitives | single files: `camera`, `history`, `undo`, `gestures`, `storage`, `ids`, … | nothing from TaoUX |
| 1, composites | `session`, `commands`, `canvas`, `sortable`, … (listed in `COMPOSITES`) | tier 0 only, not each other |
| 2, fields | `curvefield`, `swiperow` (listed in `FIELDS`) | tiers 0–1 and **TaoUI**, the only tier that may |

A new composite or field must be added to the set in `tests/tiers.test.ts`, otherwise it counts as a primitive and fails.

## A new module

1. `src/<name>.ts`, or `src/<name>/index.ts` for a folder (a Vue module is a folder). Pure decisions in a `.ts` file
   with tests; the component only moves things and draws them.
2. `package.json` `exports`: `"./<name>": { "types": "./dist/<name>[/index].d.ts", "import": "./dist/<name>.js" }`, and
   `"./<name>.css": "./dist/<name>.css"` for a module with Vue components (`tests/exports.test.ts` checks both ways).
   The build finds entries by itself (`vite.config.ts`).
3. `skills/taoux/SKILL.md` names it as `| \`<name>\` |` (`tests/skill.test.ts`), with the css import if it has one.
4. Both READMEs (the module table, the same row in EN and RU), `CHANGELOG.md`, the tier table in `docs/canvas.md` when
   the tier list changes.
5. A sandbox page when it can be seen: `sandbox/<name>.html` + `<name>.ts` + `<Name>Demo.vue` and a row in
   `sandbox/IndexPage.vue`. Pages import from `src/` directly.

## The full check

```bash
npm run typecheck    # vue-tsc, strict (noUncheckedIndexedAccess: index with `!` or `??`)
npx vitest run
npm run build
npm run smoke        # the packed tarball in a fresh app; TAOUI_TARBALL=<file.tgz> tests against an unpublished TaoUI
```

Next Up (`E:\job\git\next-up`) links `file:../taoux`: its `npx vitest run` and `npm run typecheck` are a quick acceptance
check of a change to a module it uses.

## Versions

Read what is published first (`npm view @1337exp/taoux version`) and the top of `CHANGELOG.md`: a version already on npm
is never reused; unpublished changes go into the open section. Set the version with a check, not a blind replace.
The TaoUI dev dependency may be raised freely (the peer range stays `^5.0.0`); after raising it restart the sandbox, Vite
keeps the old TaoUI in its dependency cache.

## Checking in a browser

The sandbox runs with `npm run sandbox` (port 5300). From the TaoUI session it is opened through a temporary
`taoux-sandbox` entry in TaoUI's `.claude/launch.json` (`npm --prefix ../taoux run sandbox -- --port 5300 --strictPort`),
removed afterwards. Synthetic pointer events: pass `pointerType: 'touch'` for touch-only gestures; `setPointerCapture`
throws for an unknown pointer, so keep it in `try`. Reactive styles update on the next tick: read them after a pause.

## Conventions

- Comments in English and Russian, the English first, in the style of the file.
- Components are styled by `--tx-*` variables (or TaoUI roles in a field); the bridge `theme/taoui.css` maps `--tx-*` to the
  13 contract `--tao-color-*` roles (`tests/bridge.test.ts` reads every stylesheet of the installed TaoUI).
- Git checks files out with CRLF on Windows: a test that reads a source file as text normalises `\r\n` first.
