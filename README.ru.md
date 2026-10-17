<h1 align="center">TaoUX</h1>

<p align="center">
  <b>Блоки взаимодействия для Vue-приложений.</b><br>
  Импортируйте только нужное, дизайн приносите свой.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@1337exp/taoux"><img src="https://img.shields.io/npm/v/@1337exp/taoux?color=cb3837&logo=npm" alt="npm"></a>
  <a href="https://github.com/1337exp/taoux/actions/workflows/ci.yml"><img src="https://github.com/1337exp/taoux/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/1337exp/taoux/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@1337exp/taoux" alt="license"></a>
  <img src="https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white" alt="Vue 3">
  <img src="https://img.shields.io/badge/types-included-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <a href="https://github.com/1337exp/taoux/blob/main/README.md">English</a> · <b>Русский</b> ·
  <a href="#с-taoui">С TaoUI</a> ·
  <a href="#модули">Модули</a> ·
  <a href="#песочница">Песочница</a> ·
  <a href="CHANGELOG.md">Список изменений</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/screenshots/overview-dark.webp" alt="Редакторы кривой TaoUX в тёмной теме" width="860">
</p>

## Почему TaoUX

- **Платите только за используемое.** Каждый модуль это свой subpath-импорт и своя точка входа: `import { zoomAt } from '@1337exp/taoux/camera'`. `sideEffects` объявлен, остальное режется tree-shaking'ом.
- **Сначала логика.** Ядро модуля (математика камеры, история, easing, воспроизведение) это обычный TypeScript без Vue и DOM, если это не его задача, и тесты написаны именно так. Компоненты тонкая оболочка сверху.
- **Ваш дизайн.** Компоненты настраиваются CSS-переменными `--tx-*` с разумными тёмными значениями по умолчанию. Дизайн-система не обязательна.
- **С TaoUI в одну строку.** `import '@1337exp/taoux/taoui.css'`, и редакторы следуют теме TaoUI. [Подробности ниже.](#с-taoui)
- **Типизированный i18n, undo/redo, автосохранение, воспроизведение** и остальное, что каждое приложение-редактор пишет заново.

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/curveeditor.webp" alt="Редактор кривой: перетаскивание и добавление точек"><br><sub><b>curveeditor</b> — сетка, шаг, границы, ручки Безье, клавиатура</sub></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/gradienteditor.webp" alt="Редактор градиента: добавление и перемещение остановок"><br><sub><b>gradienteditor</b> — остановки, ручки, <code>gradientCss</code></sub></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/playback.webp" alt="Воспроизведение: TaoTimeline ведёт usePlayback"><br><sub><b>playback</b> — время, цикл, скорость, перемотка; <code>usePlayback</code> + <code>TaoTimeline</code> из TaoUI</sub></td>
    <td><img src="https://raw.githubusercontent.com/1337exp/taoux/main/docs/media/clips/curvefield.webp" alt="TaoxCurveField: кривая с полями TaoUI"><br><sub><b>curvefield</b> — кривая с полями TaoUI в одном компоненте</sub></td>
  </tr>
</table>

## Установка

```bash
npm install @1337exp/taoux
npm install @1337exp/taoui   # по желанию: только для curvefield и моста к TaoUI
```

Peer-зависимости: `vue ^3.4` (для Vue-модулей) и, по желанию, `@1337exp/taoui ^3.2.1`. Модулям без Vue ничего не нужно.
Только ESM. Импорт по subpath; корневой точки входа нет намеренно, чтобы в сборку не попало ничего неимпортированного.

## С TaoUI

TaoUX и [TaoUI](https://www.npmjs.com/package/@1337exp/taoui) это два отдельных пакета: у TaoUX нет своих кнопок и полей, а TaoUI ничего не знает про TaoUX. Связать их это две вещи, и первая делается одной строкой:

```ts
import '@1337exp/taoui/styles.css';
import '@1337exp/taoux/taoui.css';          // мост: --tx-* → --tao-*, редакторы следуют теме TaoUI
import '@1337exp/taoux/curveeditor.css';    // стили Vue-модуля подключаются явно
```

`taoui.css` это обычный CSS с нулевой специфичностью и без зависимости от TaoUI, поэтому любое ваше правило главнее. Дальше значения ходят через `v-model`: `usePlayback` ведёт `TaoTimeline`, поле TaoUI правит точку кривой, слайдер TaoUI задаёт прозрачность остановки градиента. С кодом: [docs/taoui.ru.md](docs/taoui.ru.md). Без моста редакторы остаются с тёмными значениями по умолчанию; `TaoxCurveField` (собран из компонентов TaoUI) подстраивается под тему сам.

<a id="модули"></a>

## Модули

Каждый модуль — отдельный subpath-импорт, поэтому в сборку попадает только то, что реально используется:

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
| `ease` | функции движения между точками кривой: 8 семейств × in / out / in-out, `linear`, `step`, кубический Безье; `easeValue`, `isEase` (редактор рисует ими, рантайм считает ими же) | нет |
| `num` | мелкая числовая математика: `clamp`, `roundTo`, `snapTo`, `niceStep`, `ticks` (общая для кривой, градиента и воспроизведения) | нет |
| `session` | жизненный цикл документа: история, автосохранение, файлы, восстановление, уведомления | vue (peer) |
| `palette` | поиск и группы нод для палитры | нет |
| `links` (Vue) | слой связей: SVG из готовой геометрии, `--tx-link-*` | vue (peer) |
| `canvas` (Vue) | холст: жесты мыши и сенсора, колесо, автопрокрутка, клавиши; контракт `CanvasHost` | vue (peer) |
| `curveeditor` (Vue) | поле редактора кривой: сетка, шаг, границы, знаки, автопрокрутка у края; операции над точками; переходы между точками с ручками Безье; клавиатура (Tab, стрелки, Shift, Insert, Delete) | vue (peer) |
| `curvefield` (Vue, ярус 2) | `TaoxCurveField`: кривая с полями на компонентах TaoUI: время и значение точки, переход к следующей точке (`ease`), шаг, удаление и сброс; надписи задаёт приложение | vue, **@1337exp/taoui** (peer) |
| `gradienteditor` (Vue) | полоса градиента с ручками остановок; операции над остановками, `gradientCss`; клавиатура (Tab, стрелки, Home/End, Insert, Delete) | vue (peer) |
| `playback` | модель воспроизведения: время, пауза, цикл, скорость, перемотка; `createPlayback` без Vue и `usePlayback` для компонента | vue (peer, для `usePlayback`) |
| `pins` | позиции пинов-строк, измеренные по DOM: `usePinMeasure`, `createPinRegistry` | vue (peer) |
| `i18n` | типизированный i18n: `createI18n({ locales, fallback, storageKey })` | vue (peer, опционально) |

Vue-модули (`links`, `canvas`, `curveeditor`, `curvefield`, `gradienteditor`) требуют явного импорта стилей: `import '@1337exp/taoux/canvas.css'`. Составные модули (session, palette, links, canvas, pins, curveeditor, gradienteditor, playback) импортируют только примитивы. Ярус 2, поля (`curvefield`), собирает составные модули в готовое поле на компонентах TaoUI: только ему можно импортировать TaoUI, поэтому `@1337exp/taoui` это необязательная peer-зависимость. Для `curvefield` нужны оба файла стилей, `curveeditor.css` и `curvefield.css`. Всё это охраняет тест `tiers.test.ts`; контракт холста описан в [docs/canvas.md](docs/canvas.md), переходы между точками кривой в [docs/ease.md](docs/ease.md).

Правило: модуль попадает сюда, когда он понадобился во втором проекте. Ядро модулей не знает про Vue и DOM, если это не их задача.

## Разработка

```bash
npm install
npm test            # vitest
npm run typecheck
npm run build       # dist/ (vite + tsc declarations)
npm run smoke       # упаковать, поставить во временное приложение рядом с TaoUI, собрать
npm run sandbox     # песочница: http://localhost:5300, страницы из sandbox/
npm run dev         # watch: пересборка JS и деклараций
```

Новый модуль: файл `src/<имя>.ts` (или папка с `index.ts`) и запись в `exports` в `package.json`; тест `exports.test.ts` следит, чтобы они совпадали. Подробнее: [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md).

Работа с локальной копией вместо npm: в `package.json` проекта `"@1337exp/taoux": "file:../taoux"` (правки видны сразу после `npm run dev` здесь). Тогда в `vite.config.ts` потребителя нужен `resolve: { dedupe: ['vue'] }`, а в `tsconfig.json` в `paths` строка `"vue": ["./node_modules/vue"]`: иначе у слинкованного пакета своя копия Vue и реактивность ломается. Обычной установке из npm ничего из этого не нужно.

<a id="песочница"></a>

## Песочница

Папка `sandbox/` это демо и поле для проверки: страницы подключают модули прямо из `src/`, без сборки. Сейчас там `curveeditor`, `curvefield`, `gradienteditor`, `slider`, `color` и `playback`, с переключателем языка (EN / RU) и темы (тёмная / светлая: тема TaoUI через мост). Новая страница = `sandbox/<имя>.html` + `.ts` + демо `.vue` и ссылка в `sandbox/index.html`. `npm run sandbox:build` собирает статическую копию с относительными путями, её можно положить в любую папку (например, `/sandbox/taoux/`).

Скриншоты и ролики в этом README сняты с песочницы: см. [docs/media](docs/media/README.md).

## Участие в проекте

Issues и pull request'ы приветствуются, см. [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md). Об уязвимостях: [SECURITY.md](SECURITY.md).

## Лицензия

[MIT](LICENSE) © 2026 1337exp
