<script lang="ts" setup>
import { computed, ref } from 'vue';
import { tr } from './lang';
import SandboxShell from './SandboxShell.vue';

// A new demo page: add a card to `demos` and a pair of files <name>.html + <name>.ts. A module without a page goes to `logic`.
// Новая демо-страница: добавьте карточку в `demos` и пару файлов <имя>.html + <имя>.ts. Модуль без страницы — в `logic`.

interface Demo {
    name: string;
    /** Does the page use TaoUI components? / Использует ли страница компоненты TaoUI? */
    taoui: boolean;
    /** The page is about TaoUI components, not about a TaoUX module of the same name. / Страница про компоненты TaoUI, а не про модуль TaoUX с таким именем. */
    module?: false;
    note: [string, string];
}

const demos: Demo[] = [
    { name: 'curveeditor', taoui: false, note: ['Curve editor: grid, snapping, bounds, decimals, auto-scroll at the edge', 'Редактор кривой: сетка, шаг, границы, знаки, автопрокрутка у края'] },
    { name: 'gradienteditor', taoui: false, note: ['Gradient bar: stops, adding and removing', 'Полоса градиента: остановки, добавление и удаление'] },
    { name: 'curvefield', taoui: true, note: ['A curve with TaoUI fields: point, transition (ease), step, reset', 'Кривая с полями на TaoUI: точка, переход (ease), шаг, сброс'] },
    { name: 'playback', taoui: true, note: ['usePlayback drives the time, TaoScrubber shows it: loop, speed, seeking', 'usePlayback ведёт время, TaoScrubber показывает: цикл, скорость, перемотка'] },
    { name: 'swiperow', taoui: true, note: ['A mail list: read / unread to the right, three actions to the left, a long pull deletes', 'Список писем: прочитано / нет вправо, три действия влево, длинный свайп удаляет'] },
    { name: 'tour', taoui: true, note: ['useTour keeps the steps, TaoTour draws them: skipped targets, interactive step, seen once', 'useTour ведёт шаги, TaoTour рисует: пропуск шагов без цели, интерактивный шаг, показ один раз'] },
    { name: 'sortable', taoui: true, note: ['Reorder a list by a grip: pointer, keyboard, edge scroll', 'Перестановка списка за ручку: мышь, клавиатура, автопрокрутка у края'] },
    { name: 'slider', taoui: true, module: false, note: ['TaoSlider and TaoRangeSlider: range, marks, steps, vertical, timeline', 'TaoSlider и TaoRangeSlider: диапазон, метки, шаги, вертикаль, таймлайн'] },
    { name: 'color', taoui: true, module: false, note: ['TaoColorPicker and TaoColorInput: palette, opacity, swatches, colorModel', 'TaoColorPicker и TaoColorInput: палитра, прозрачность, образцы, colorModel'] },
];

// The modules that are logic first and have no page of their own: the tests are their demo.
// Модули, где главное логика и своей страницы нет: их демо — тесты.
const logic: { title: [string, string]; items: { name: string; note: [string, string] }[] }[] = [
    {
        title: ['Documents and state', 'Документы и состояние'],
        items: [
            { name: 'session', note: ['History, autosave, files, restore, notices', 'История, автосохранение, файлы, восстановление, уведомления'] },
            { name: 'undo', note: ['Undo by records, not snapshots; safe next to a sync', 'Отмена по записям, а не по снимкам; безопасна рядом с синхронизацией'] },
            { name: 'undovue', note: ['canUndo / canRedo as refs for the menu', 'canUndo / canRedo как ref для меню'] },
            { name: 'history', note: ['Undo / redo on string snapshots', 'Undo / redo по строковым снимкам'] },
            { name: 'storage', note: ['Autosave that never throws, hears other tabs', 'Автосохранение без исключений, слышит другие вкладки'] },
            { name: 'file', note: ['Download text, read a picked file', 'Скачать текст, прочитать выбранный файл'] },
            { name: 'ids', note: ['uuid() and uid() for records', 'uuid() и uid() для записей'] },
            { name: 'i18n', note: ['Typed i18n with a fallback', 'Типизированный i18n с запасным языком'] },
        ],
    },
    {
        title: ['Commands and guidance', 'Команды и подсказки'],
        items: [
            { name: 'commands', note: ['A registry: menus, shortcuts, enabled / checked', 'Реестр: меню, сочетания, enabled / checked'] },
            { name: 'hotkeys', note: ['Mod+Shift+Z, any layout, per platform', 'Mod+Shift+Z, любая раскладка, по платформам'] },
        ],
    },
    {
        title: ['Space and input', 'Пространство и ввод'],
        items: [
            { name: 'canvas', note: ['Gestures, wheel, auto-scroll, keys', 'Жесты, колесо, автопрокрутка, клавиши'] },
            { name: 'camera', note: ['Pan, zoom around the cursor', 'Сдвиг и зум вокруг курсора'] },
            { name: 'gestures', note: ['Tap, long press, pinch, swipe', 'Тап, долгое нажатие, щипок, свайп'] },
            { name: 'wheel', note: ['Wheel / trackpad → pan or zoom', 'Колесо / трекпад → сдвиг или зум'] },
            { name: 'snap', note: ['Soft snapping that follows the zoom', 'Мягкая привязка, идущая за зумом'] },
            { name: 'edgescroll', note: ['Auto-scroll near an edge', 'Автопрокрутка у края'] },
            { name: 'touch', note: ['Is the pointer coarse (a finger)', 'Грубый ли указатель (палец)'] },
        ],
    },
    {
        title: ['Graphs and curves', 'Графы и кривые'],
        items: [
            { name: 'curve', note: ['Link paths and arrowheads', 'Пути связей и стрелки'] },
            { name: 'links', note: ['A links layer: SVG from geometry', 'Слой связей: SVG из геометрии'] },
            { name: 'pins', note: ['Pin positions measured from the DOM', 'Позиции пинов, измеренные по DOM'] },
            { name: 'palette', note: ['Search and groups of nodes', 'Поиск и группы нод'] },
            { name: 'ease', note: ['8 easing families, cubic Bezier', '8 семейств плавности, кубический Безье'] },
            { name: 'num', note: ['clamp, roundTo, snapTo, ticks', 'clamp, roundTo, snapTo, ticks'] },
        ],
    },
];

const filter = ref<'all' | 'own' | 'taoui'>('all');
const shown = computed(() => demos.filter((d) => filter.value === 'all' || (filter.value === 'taoui') === d.taoui));
const moduleCount = logic.reduce((sum, g) => sum + g.items.length, 0) + demos.filter((d) => d.module !== false).length;
</script>

<template>
    <SandboxShell :title="tr('taoux · sandbox', 'taoux · песочница')">
        <p class="lead">
            {{ tr('Interaction building blocks for Vue apps: import only what you need, bring your own design.', 'Строительные блоки взаимодействия для приложений на Vue: берите только нужное, дизайн ваш.') }}
        </p>
        <p class="muted small">
            {{ tr(`${moduleCount} modules and ${demos.length} live pages. The pages take their code straight from src/, no build; the theme and the language are shared.`, `${moduleCount} модулей и ${demos.length} живых страниц. Страницы берут код прямо из src/, без сборки; тема и язык общие.`) }}
        </p>

        <div class="bar">
            <h2>{{ tr('Live pages', 'Живые страницы') }}</h2>
            <div class="chips" role="group" :aria-label="tr('Filter', 'Фильтр')">
                <button type="button" :class="{ on: filter === 'all' }" :aria-pressed="filter === 'all'" @click="filter = 'all'">{{ tr('All', 'Все') }}</button>
                <button type="button" :class="{ on: filter === 'own' }" :aria-pressed="filter === 'own'" @click="filter = 'own'">{{ tr('TaoUX alone', 'Только TaoUX') }}</button>
                <button type="button" :class="{ on: filter === 'taoui' }" :aria-pressed="filter === 'taoui'" @click="filter = 'taoui'">{{ tr('With TaoUI', 'С TaoUI') }}</button>
            </div>
        </div>

        <ul class="cards">
            <li v-for="d in shown" :key="d.name">
                <a class="card" :href="`./${d.name}.html`">
                    <span class="card__top">
                        <code class="card__name">{{ d.name }}</code>
                        <span class="tag" :class="{ 'tag--taoui': d.taoui }">{{ d.taoui ? 'TaoUI' : 'TaoUX' }}</span>
                    </span>
                    <span class="card__note">{{ tr(d.note[0], d.note[1]) }}</span>
                    <span class="card__go" aria-hidden="true">→</span>
                </a>
            </li>
        </ul>

        <h2 class="more">{{ tr('Logic first, no page', 'Прежде всего логика, без страницы') }}</h2>
        <p class="muted small">{{ tr('Plain TypeScript, tested without a browser: the tests are the demo.', 'Чистый TypeScript, проверяется без браузера: демо здесь — тесты.') }}</p>

        <section v-for="group in logic" :key="group.title[0]" class="group">
            <h3>{{ tr(group.title[0], group.title[1]) }}</h3>
            <ul class="pills">
                <li v-for="item in group.items" :key="item.name" class="pill">
                    <code>{{ item.name }}</code>
                    <span class="muted">{{ tr(item.note[0], item.note[1]) }}</span>
                </li>
            </ul>
        </section>
    </SandboxShell>
</template>

<style scoped>
.lead {
    margin: 4px 0 4px;
    font-size: 18px;
    line-height: 1.35;
}

.small {
    margin: 0 0 8px;
    font-size: 12px;
}

h2 {
    margin: 0;
    font-size: 15px;
}

.bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-top: 24px;
}

.chips {
    display: inline-flex;
    gap: 4px;
}

.chips button {
    padding: 4px 12px;
    border: 1px solid var(--tao-color-border);
    border-radius: 999px;
    background: transparent;
    color: var(--tao-color-text-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
}

.chips button:hover {
    color: var(--tao-color-text);
    border-color: var(--tao-color-border-strong);
}

.chips button.on {
    border-color: var(--tao-color-accent);
    color: var(--tao-color-accent);
}

.chips button:focus-visible,
.card:focus-visible {
    outline: 2px solid var(--tao-color-accent);
    outline-offset: 2px;
}

.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
}

.card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    padding: 14px 16px 16px;
    border: 1px solid var(--tao-color-border);
    border-radius: 12px;
    background: var(--tao-color-surface);
    color: inherit;
    text-decoration: none;
    transition:
        border-color 0.15s,
        transform 0.15s;
}

.card:hover {
    border-color: var(--tao-color-accent);
    transform: translateY(-2px);
}

.card__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.card__name {
    font-size: 15px;
    font-weight: 600;
}

.card__note {
    color: var(--tao-color-text-muted);
    font-size: 12px;
    line-height: 1.4;
}

.card__go {
    margin-top: auto;
    padding-top: 6px;
    color: var(--tao-color-accent);
    opacity: 0;
    transition: opacity 0.15s;
}

.card:hover .card__go,
.card:focus-visible .card__go {
    opacity: 1;
}

.tag {
    padding: 1px 8px;
    border: 1px solid var(--tao-color-border);
    border-radius: 999px;
    color: var(--tao-color-text-muted);
    font-size: 10px;
    letter-spacing: 0.04em;
}

.tag--taoui {
    border-color: var(--tao-color-accent);
    color: var(--tao-color-accent);
}

.more {
    margin-top: 32px;
}

.group h3 {
    margin: 16px 0 6px;
    color: var(--tao-color-text-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.pills {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 6px 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.pill {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    border-left: 2px solid var(--tao-color-border);
    font-size: 12px;
}

.pill code {
    color: var(--tao-color-text);
    font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
    .card,
    .card__go {
        transition: none;
    }

    .card:hover {
        transform: none;
    }
}
</style>
