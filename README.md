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
| `i18n` | типизированный i18n: `createI18n({ locales, fallback, storageKey })` | vue (peer, опционально) |

Правило: модуль попадает сюда, когда он понадобился во втором проекте. Ядро модулей не знает про Vue и DOM, если это не их задача.

## Разработка

```bash
npm install
npm test            # vitest
npm run typecheck
npm run build       # dist/ (vite + tsc declarations)
npm run dev         # watch: пересборка JS и деклараций
```

Новый модуль: файл `src/<имя>.ts` и запись в `exports` в `package.json` (тест `exports.test.ts` следит, чтобы они совпадали).

## Подключение к проекту через npm link

```bash
npm link                      # один раз, в taoux
npm link @1337exp/taoux       # в проекте-потребителе
npm run dev                   # в taoux, пока правим модули
```

В `vite.config.ts` потребителя нужно `resolve: { dedupe: ['vue'] }`, иначе у слинкованного пакета будет своя копия Vue и реактивность сломается.
