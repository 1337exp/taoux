import { computed, getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, ref, type ComputedRef } from 'vue';

/**
 * The registry of commands (`createCommands`) in a Vue app: the commands live as long as the component does, the keys are
 * listened to while it is mounted, a menu is a `computed` that follows the state, and the `select` of a menu runs the command.
 * It takes the registry by its shape, not by import, so a composite module stays independent of another one.
 * Реестр команд (`createCommands`) в приложении на Vue: команды живут, пока жив компонент, клавиши слушаются, пока он
 * смонтирован, меню это `computed`, который следует за состоянием, а `select` меню выполняет команду. Реестр берётся по
 * форме, а не импортом, чтобы составной модуль не зависел от другого.
 *
 * ```ts
 * const commands = createCommands()                       // once, in a module of the app
 * // in the root component:
 * const { menu, onSelect } = useCommands(commands, { add: [...appCommands] })
 * const bar = menu(layout)                                // a ComputedRef of menu items
 * ```
 * ```vue
 * <TaoMenubar :items="bar" @select="onSelect" />
 * ```
 */

/** What `useCommands` needs from a registry: `createCommands()` fits as it is. / Что `useCommands` нужно от реестра: `createCommands()` подходит как есть. */
export interface CommandRegistry<C, L, I> {
    add(command: C | readonly C[]): () => void;
    bind(target: EventTarget): () => void;
    toMenu(layout: L): I[];
    run(id: string): boolean;
}

export interface UseCommandsOptions<C> {
    /** Commands of this component: added now, removed when it goes. / Команды этого компонента: добавляются сразу, убираются вместе с ним. */
    add?: readonly C[];
    /** Where the shortcuts are listened to. Default: `window`. `false`: do not listen (the menu only). / Где слушать сочетания. По умолчанию `window`. `false`: не слушать (только меню). */
    target?: EventTarget | false;
}

export interface UseCommands<L, I> {
    /** A menu from a layout, as a `computed`: it is made again when a state that a label, `enabled` or `checked` reads changes. / Меню по раскладке как `computed`: пересобирается, когда меняется состояние, которое читают подпись, `enabled` или `checked`. */
    menu(layout: L): ComputedRef<I[]>;
    /**
     * For `@select` of a menu: runs the command named by the item. It takes the item that TaoUI 6 emits (not a bare id); returns whether
     * it ran (a disabled command does not).
     * Для `@select` меню: выполняет команду, названную пунктом. Берёт пункт, который отдаёт TaoUI 6 (не голый id); возвращает,
     * выполнилась ли команда (недоступная — нет).
     */
    onSelect(item: { id?: string } | string): boolean;
    run(id: string): boolean;
}

export function useCommands<C, L, I>(registry: CommandRegistry<C, L, I>, options: UseCommandsOptions<C> = {}): UseCommands<L, I> {
    // the registry is not reactive: this one number is what a menu waits for when commands come or go
    // реестр не реактивен: это число и ждёт меню, когда команды приходят или уходят
    const version = ref(0);
    const stops: (() => void)[] = [];

    if (options.add?.length) {
        const remove = registry.add(options.add);
        version.value += 1;
        stops.push(() => {
            remove();
            version.value += 1;
        });
    }

    const listen = () => {
        if (options.target === false || typeof window === 'undefined') {
            return;
        }
        stops.push(registry.bind(options.target ?? window));
    };
    if (getCurrentInstance()) {
        onMounted(listen);
    } else {
        listen();
    }
    if (getCurrentScope()) {
        onScopeDispose(() => stops.splice(0).forEach((stop) => stop()));
    }

    return {
        menu: (layout) =>
            computed(() => {
                void version.value;
                return registry.toMenu(layout);
            }),
        onSelect: (item) => {
            const id = typeof item === 'string' ? item : item.id;
            return id === undefined ? false : registry.run(id);
        },
        run: (id) => registry.run(id),
    };
}
