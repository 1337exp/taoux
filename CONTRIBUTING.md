# Contributing to TaoUX

**English** · [Русский](CONTRIBUTING.ru.md)

TaoUX is a set of independent interaction modules for Vue apps. This page is the short version of how the project works.

## Setup

```bash
git clone https://github.com/1337exp/taoux.git
cd taoux
npm install
```

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm test` | Vitest |
| `npm run build` | `dist/` (Vite for JS and CSS, `vue-tsc` for declarations) |
| `npm run dev` | watch: rebuild JS and declarations |
| `npm run sandbox` | the demo pages, <http://localhost:5300>, reading `src/` directly |
| `npm run sandbox:build` | a static copy of the sandbox with relative paths (`sandbox/dist`) |
| `npm run smoke` | packs the library, installs it into a throwaway app next to TaoUI and builds it |
| `npm run media` | regenerates screenshots and clips, see [docs/media](docs/media/README.md) |

## Layout

```
src/            one module per file (src/<name>.ts) or folder (src/<name>/index.ts)
theme/          taoui.css: the TaoUI bridge (--tx-* → --tao-*)
tests/          Vitest; the logic of a module is pure and tested without a DOM where possible
sandbox/        demo pages; they become the public sandbox
docs/           guides; docs/media holds screenshots and clips
scripts/        repo tooling: media capture, the consumer smoke test
```

A new module is a file `src/<name>.ts` (or a folder with `index.ts`) and an entry in `exports` in `package.json`;
`tests/exports.test.ts` makes sure they match.

## Rules the code follows

- **Tiers.** Primitives know nothing about Vue or the DOM unless that is their job. Composite modules import only primitives.
  Tier 2 (`curvefield`) is the only place allowed to import `@1337exp/taoui`. `tests/tiers.test.ts` guards this.
- **A module lands here when a second project needs it.** No speculative modules.
- **Bring your own design.** Components expose `--tx-*` CSS variables with sensible dark defaults and no TaoUI dependency.
  When you add a colour variable, add it to [theme/taoui.css](theme/taoui.css) as well; `tests/bridge.test.ts` fails otherwise.
- **Every module is its own entry point** and tree-shakes on its own; Vue modules ship their CSS next to the JS and the
  consumer imports it explicitly.
- Texts shown to users come from the app (labels, `i18n`), not from the module.

## Pull requests

1. Branch from `main`.
2. `npm run typecheck && npm test && npm run build && npm run smoke`.
3. Update `README.md` / `README.ru.md`, the docs, the sandbox page and `CHANGELOG.md`.
4. Describe the *why* in the PR.

By contributing you agree that your work is licensed under the [MIT License](LICENSE).
