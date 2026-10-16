# @1337exp/taoux

Самодостаточные UX-модули для наших проектов. Каждый модуль — отдельный subpath-импорт, поэтому в сборку попадает только то, что реально используется:

```ts
import { zoomAt } from '@1337exp/taoux/camera';
import { History } from '@1337exp/taoux/history';
```

| Модуль | Что делает | Зависимости |
|---|---|---|
| `camera` | камера холста: pan, zoom вокруг курсора, экран ↔ мир | нет |
| `history` | undo/redo на снимках-строках со склейкой частых правок | нет |
| `storage` | автосохранение в localStorage без исключений | нет |
| `file` | скачивание текста как файла, лимит размера | DOM |
| `snap` | мягкая привязка к сетке с порогом по масштабу камеры | нет |
| `wheel` | колесо/тачпад → pan или zoom (как в Figma) | нет |
| `edgescroll` | скорость автопрокрутки у края и готовый цикл `createEdgeScroller` (холст, редакторы кривых и любое перетаскивание) | нет |
| `gestures` | сенсорные жесты: тап, двойной тап, долгое нажатие, щипок | нет |
| `touch` | `coarse` — есть ли грубый указатель (палец) | vue (peer) |
| `curve` | пути связей: безье между пинами, стрелки постоянного экранного размера | нет |
| `ids` | `uid(prefix, taken)` | нет |
| `session` | жизненный цикл документа: история, автосохранение, файлы, восстановление, уведомления | vue (peer) |
| `palette` | поиск и группы нод для палитры | нет |
| `links` (Vue) | слой связей: SVG из готовой геометрии, `--tx-link-*` | vue (peer) |
| `canvas` (Vue) | холст: жесты мыши и сенсора, колесо, автопрокрутка, клавиши; контракт `CanvasHost` | vue (peer) |
| `curveeditor` (Vue) | поле редактора кривой: сетка, шаг, границы, знаки, автопрокрутка у края; операции над точками | vue (peer) |
| `gradienteditor` (Vue) | полоса градиента с ручками остановок; операции над остановками, `gradientCss` | vue (peer) |
| `playback` | модель воспроизведения: время, пауза, цикл, скорость, перемотка; `createPlayback` без Vue и `usePlayback` для компонента | vue (peer, для `usePlayback`) |
| `pins` | позиции пинов-строк, измеренные по DOM: `usePinMeasure`, `createPinRegistry` | vue (peer) |
| `i18n` | типизированный i18n: `createI18n({ locales, fallback, storageKey })` | vue (peer, опционально) |

Vue-модули (`links`, `canvas`, `curveeditor`, `gradienteditor`) требуют явного импорта стилей: `import '@1337exp/taoux/canvas.css'`. Составные модули (session, palette, links, canvas, pins, curveeditor, gradienteditor, playback) импортируют только примитивы, и тест `tiers.test.ts` это охраняет; контракт холста описан в [docs/canvas.md](docs/canvas.md).

Правило: модуль попадает сюда, когда он понадобился во втором проекте. Ядро модулей не знает про Vue и DOM, если это не их задача.

## Разработка

```bash
npm install
npm test            # vitest
npm run typecheck
npm run build       # dist/ (vite + tsc declarations)
npm run sandbox     # песочница: http://localhost:5300, страницы из sandbox/
npm run dev         # watch: пересборка JS и деклараций
```

Новый модуль: файл `src/<имя>.ts` и запись в `exports` в `package.json` (тест `exports.test.ts` следит, чтобы они совпадали).

## Подключение к проекту (без публикации)

В `package.json` проекта: `"@1337exp/taoux": "file:../taoux"`, затем `npm install`. npm сделает ссылку на соседнюю папку, правки в taoux видны сразу (после `npm run dev` здесь).

Нюансы линка:

- В `vite.config.ts` потребителя нужен `resolve: { dedupe: ['vue'] }`, а в `tsconfig.json` в `paths` строка `"vue": ["./node_modules/vue"]`. Иначе у слинкованного пакета своя копия Vue: реактивность и типы (`ComputedRef` не распознаётся как `Ref`) ломаются.
- Классический `npm link` (через глобальную папку на C:) на этой машине не работает: junction C: → E: ломается ("mount point ... not attached"). Поэтому только `file:` или junction внутри E:.

## Sandbox

Папка `sandbox/` это демо и поле для проверки компонентов: страницы подключают модули прямо из `src/`, без сборки. Новый компонент = `sandbox/<имя>.html` + `.ts` + демо `.vue` и ссылка в `sandbox/index.html`. Запуск: `npm run sandbox`. Сейчас там `curveeditor`, `gradienteditor`, `slider` и `playback`. Песочница собрана вместе с TaoUI (dev-зависимость, в пакет не попадает): видно, как модули работают в паре, есть переключатель тёмной и светлой темы. Сам taoux от TaoUI не зависит.
