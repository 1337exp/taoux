import { bindHotkeys, type BindOptions, formatHotkey, type HotkeyHandler, isApplePlatform, isReservedHotkey, normalizeHotkey, type PlatformOptions, type ReservedOptions } from './hotkeys';

/**
 * A registry of commands: one source for the menu bar, a context menu, a toolbar, a command palette and the keyboard.
 * A command knows its label, its shortcut, whether it can run now and whether it is checked; the menus only show that.
 * Реестр команд: один источник для полосы меню, контекстного меню, панели инструментов, палитры команд и клавиатуры.
 * Команда знает подпись, сочетание, можно ли её сейчас выполнить и отмечена ли она; меню это только показывают.
 */

type Text = string | (() => string);

export interface Command {
    id: string;
    /** A function is read every time: a label from `i18n` follows the language. / Функция читается каждый раз: подпись из `i18n` следует за языком. */
    label: Text;
    /**
     * `Mod+S`, or several (the first one is shown). `Mod` is ⌘ on Apple and Ctrl elsewhere.
     * `Mod+S` или несколько (показывается первое). `Mod` — ⌘ у Apple и Ctrl у остальных.
     */
    shortcut?: string | readonly string[];
    /** Icon name for the menu. / Имя иконки для меню. */
    icon?: string;
    /** Can it run now. Default: always. / Можно ли выполнить сейчас. По умолчанию всегда. */
    enabled?: () => boolean;
    /** Makes it a checkbox (a toggle) in the menu. / Делает её чекбоксом (переключателем) в меню. */
    checked?: () => boolean;
    /** With `checked`: a radio of this group. / Вместе с `checked`: радио этой группы. */
    group?: string;
    run: () => void;
}

/**
 * The menu entries `toMenu` builds. The same shape as `TaoMenuItem` of TaoUI (a test holds it), declared here,
 * so TaoUX does not depend on TaoUI: pass the result to `TaoMenubar`, `TaoDropdownMenu`, `TaoContextMenu` as is.
 * Пункты меню, которые строит `toMenu`. Та же форма, что у `TaoMenuItem` из TaoUI (это держит тест), объявлена здесь,
 * чтобы TaoUX не зависел от TaoUI: результат передаётся в `TaoMenubar`, `TaoDropdownMenu`, `TaoContextMenu` как есть.
 */
export type CommandMenuItem =
    | { type?: 'item'; id: string; label: string; icon?: string; shortcut?: string; disabled?: boolean; items?: CommandMenuItem[] }
    | { type: 'checkbox'; id: string; label: string; checked: boolean; shortcut?: string; disabled?: boolean }
    | { type: 'radio'; id: string; group: string; label: string; checked: boolean; shortcut?: string; disabled?: boolean }
    | { type: 'label'; label: string }
    | { type: 'separator' };

/**
 * What a menu is made of: a command id, `'-'` for a separator, a submenu, a group caption.
 * Из чего состоит меню: id команды, `'-'` для разделителя, подменю, подпись группы.
 */
export type MenuLayoutEntry = string | { id?: string; label: Text; icon?: string; items: MenuLayout } | { type: 'label'; label: Text };
export type MenuLayout = readonly MenuLayoutEntry[];

export interface ShortcutProblem {
    id: string;
    shortcut: string;
    /** `reserved`: the browser keeps it; `duplicate`: another command has it too (`other`). */
    problem: 'reserved' | 'duplicate';
    other?: string;
}

const text = (value: Text) => (typeof value === 'function' ? value() : value);
const shortcuts = (command: Command) => (command.shortcut === undefined ? [] : typeof command.shortcut === 'string' ? [command.shortcut] : [...command.shortcut]);

/**
 * Creates the registry. Nothing is reactive by itself: `toMenu` reads `label`, `enabled` and `checked` when called,
 * so in Vue call it inside `computed` and read refs in those functions, and the menu follows the state.
 * Создаёт реестр. Сам по себе ничего не реактивно: `toMenu` читает `label`, `enabled` и `checked` в момент вызова,
 * так что во Vue вызывайте его внутри `computed` и читайте ref-ы в этих функциях, и меню будет следовать за состоянием.
 */
export function createCommands(initial: readonly Command[] = [], options: PlatformOptions = {}) {
    const mac = options.mac ?? isApplePlatform();
    const commands = new Map<string, Command>();

    /**
     * Adds commands; an id taken twice is an error. Returns the function that removes them again.
     * Добавляет команды; занятый id — ошибка. Возвращает функцию, которая их убирает.
     */
    function add(command: Command | readonly Command[]): () => void {
        const list = Array.isArray(command) ? (command as readonly Command[]) : [command as Command];
        for (const c of list) {
            if (commands.has(c.id)) throw new Error(`commands: "${c.id}" is already registered`);
        }
        list.forEach((c) => commands.set(c.id, c));
        return () => list.forEach((c) => commands.get(c.id) === c && commands.delete(c.id));
    }

    const get = (id: string) => commands.get(id);
    const isEnabled = (id: string) => {
        const command = commands.get(id);
        return !!command && (command.enabled?.() ?? true);
    };

    /**
     * Runs the command if it exists and is enabled. Returns whether it ran. Give it to `@select` of a menu.
     * Выполняет команду, если она есть и доступна. Возвращает, выполнилась ли. Отдайте его в `@select` меню.
     */
    function run(id: string): boolean {
        if (!isEnabled(id)) return false;
        commands.get(id)!.run();
        return true;
    }

    /** The shortcut label for this platform (`⇧⌘Z` / `Ctrl+Shift+Z`), or undefined. / Подпись сочетания для этой платформы. */
    function shortcutLabel(id: string): string | undefined {
        const first = shortcuts(commands.get(id) ?? ({} as Command))[0];
        return first === undefined ? undefined : formatHotkey(first, { mac });
    }

    function item(command: Command): CommandMenuItem {
        const base = { id: command.id, label: text(command.label), shortcut: shortcutLabel(command.id), disabled: !isEnabled(command.id) };
        if (command.checked && command.group !== undefined) return { type: 'radio', group: command.group, checked: command.checked(), ...base };
        if (command.checked) return { type: 'checkbox', checked: command.checked(), ...base };
        return { ...base, icon: command.icon };
    }

    /**
     * Builds the menu tree from a layout. An unknown id is an error (a typo would silently lose a menu entry).
     * For a menu bar the top level is submenus: `[{ id: 'file', label: 'File', items: ['save', '-', 'undo'] }]`.
     * Строит дерево меню по раскладке. Незнакомый id — ошибка (опечатка тихо потеряла бы пункт).
     * Для полосы меню верхний уровень — подменю: `[{ id: 'file', label: 'File', items: ['save', '-', 'undo'] }]`.
     */
    function toMenu(layout: MenuLayout, path = 'menu'): CommandMenuItem[] {
        return layout.map((entry, index): CommandMenuItem => {
            if (entry === '-') return { type: 'separator' };
            if (typeof entry === 'string') {
                const command = commands.get(entry);
                if (!command) throw new Error(`commands: the menu names "${entry}", which is not registered`);
                return item(command);
            }
            if ('type' in entry) return { type: 'label', label: text(entry.label) };
            const id = entry.id ?? `${path}-${index}`;
            return { id, label: text(entry.label), icon: entry.icon, items: toMenu(entry.items, id) };
        });
    }

    /**
     * Listens to the shortcuts of every registered command on the target (commands added later count too).
     * A disabled command swallows its key and does nothing, so Mod+S never opens the browser's "Save page".
     * Returns the function that stops listening.
     * Слушает сочетания всех зарегистрированных команд на цели (добавленные позже тоже).
     * Недоступная команда глотает свою клавишу и ничего не делает, так что Mod+S не откроет «Сохранить страницу» браузера.
     * Возвращает функцию, которая перестаёт слушать.
     */
    function bind(target: EventTarget, bindOptions: Omit<BindOptions, 'mac'> = {}): () => void {
        const bindings = () => {
            const map: Record<string, HotkeyHandler> = {};
            for (const command of commands.values()) {
                for (const combo of shortcuts(command)) {
                    map[combo] ??= () => {
                        run(command.id);
                    };
                }
            }
            return map;
        };
        return bindHotkeys(target, bindings, { ...bindOptions, mac });
    }

    /**
     * Shortcuts that will not work: kept by the browser, or given to two commands. Handy in a test of your app.
     * Сочетания, которые не сработают: их держит браузер или они даны двум командам. Удобно в тесте приложения.
     */
    function check(reservedOptions: Omit<ReservedOptions, 'mac'> = {}): ShortcutProblem[] {
        const problems: ShortcutProblem[] = [];
        const seen = new Map<string, string>();
        for (const command of commands.values()) {
            for (const shortcut of shortcuts(command)) {
                if (isReservedHotkey(shortcut, { ...reservedOptions, mac })) problems.push({ id: command.id, shortcut, problem: 'reserved' });
                const key = normalizeHotkey(shortcut, { mac });
                const other = seen.get(key);
                if (other !== undefined && other !== command.id) problems.push({ id: command.id, shortcut, problem: 'duplicate', other });
                else seen.set(key, command.id);
            }
        }
        return problems;
    }

    add(initial);

    return {
        add,
        get,
        has: (id: string) => commands.has(id),
        list: () => [...commands.values()],
        isEnabled,
        run,
        label: (id: string) => {
            const command = commands.get(id);
            return command ? text(command.label) : undefined;
        },
        shortcutLabel,
        toMenu,
        bind,
        check,
    };
}

export type Commands = ReturnType<typeof createCommands>;

type Flag = boolean | { readonly value: boolean } | (() => boolean);
const flag = (value: Flag) => (typeof value === 'function' ? value() : typeof value === 'boolean' ? value : value.value);

/**
 * What undo/redo needs from a history: a document session (`canUndo` refs) fits as is, a `History` with an `apply` wrapper.
 * Что undo/redo нужно от истории: сессия документа (ref-ы `canUndo`) подходит как есть, `History` — с обёрткой `apply`.
 */
export interface UndoSource {
    readonly canUndo: Flag;
    readonly canRedo: Flag;
    undo(): unknown;
    redo(): unknown;
}

export interface HistoryCommandOptions {
    labels?: { undo?: Text; redo?: Text };
}

/**
 * Undo and Redo as commands (`undo`, `redo`; Mod+Z, Mod+Shift+Z and Mod+Y): they are disabled by themselves when
 * there is nothing to undo or redo, in the menu and on the keyboard.
 * Undo и Redo как команды (`undo`, `redo`; Mod+Z, Mod+Shift+Z и Mod+Y): сами становятся недоступными, когда
 * откатывать или возвращать нечего, и в меню, и на клавиатуре.
 *
 * ```ts
 * commands.add(historyCommands(session, { labels: { undo: () => t('undo'), redo: () => t('redo') } }));
 * ```
 */
export function historyCommands(source: UndoSource, options: HistoryCommandOptions = {}): Command[] {
    return [
        { id: 'undo', label: options.labels?.undo ?? 'Undo', shortcut: 'Mod+Z', enabled: () => flag(source.canUndo), run: () => void source.undo() },
        { id: 'redo', label: options.labels?.redo ?? 'Redo', shortcut: ['Mod+Shift+Z', 'Mod+Y'], enabled: () => flag(source.canRedo), run: () => void source.redo() },
    ];
}
