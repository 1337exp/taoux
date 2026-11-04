import { readonly, ref, type Ref } from 'vue';
import { History } from './history';
import { UndoStack, type UndoEntry, type UndoOptions } from './undo';

/**
 * Undo and redo for Vue: the flags of a stack or a history as refs, so that the Undo and Redo items of a menu
 * (`historyCommands`, `TaoMenubar`) switch on and off by themselves. `UndoStack` and `History` are plain classes: their
 * `canUndo` is a getter that Vue cannot see, so each of these keeps the refs in step after every move.
 * Undo и redo для Vue: флаги стека или истории как ref, чтобы пункты «Отменить» и «Повторить» в меню (`historyCommands`,
 * `TaoMenubar`) включались и гасли сами. `UndoStack` и `History` — обычные классы: их `canUndo` — геттер, которого Vue
 * не видит, поэтому здесь ref-ы выравниваются после каждого хода.
 */

/** Anything with the two flags: an `UndoStack`, a `History`, your own. / Всё, у чего есть два флага: `UndoStack`, `History`, своё. */
export interface UndoFlagsSource {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

export interface UndoFlags {
    readonly canUndo: Readonly<Ref<boolean>>;
    readonly canRedo: Readonly<Ref<boolean>>;
    /**
     * Reads the source again. Call it after a move you made on the source itself, behind the back of the wrapper.
     * Читает источник заново. Зовите после хода, сделанного на самом источнике, мимо обёртки.
     */
    sync(): void;
}

/**
 * Refs for a stack or a history you already have (made by a factory of yours, kept in a store). Nothing is moved by it:
 * call `sync()` after every `record`, `undo`, `redo`, `commit`, `clear`.
 * Ref-ы для стека или истории, которые у вас уже есть (сделаны вашей фабрикой, лежат в хранилище). Сам ничего не двигает:
 * зовите `sync()` после каждого `record`, `undo`, `redo`, `commit`, `clear`.
 */
export function useUndoFlags(source: UndoFlagsSource): UndoFlags {
    const canUndo = ref(source.canUndo);
    const canRedo = ref(source.canRedo);
    function sync() {
        canUndo.value = source.canUndo;
        canRedo.value = source.canRedo;
    }
    return { canUndo: readonly(canUndo), canRedo: readonly(canRedo), sync };
}

export interface UseUndoStack<T> extends UndoFlags {
    /** The stack itself, for what the wrapper does not cover. / Сам стек, для того, что обёртка не покрывает. */
    stack: UndoStack<T>;
    /** `UndoStack.record`, then the flags. / `UndoStack.record`, затем флаги. */
    record(entry: UndoEntry<T>, key?: string, now?: number): void;
    /** `UndoStack.undo`: the next list or null; the flags follow. / `UndoStack.undo`: следующий список или null; флаги следуют. */
    undo(current: readonly T[], now?: number): T[] | null;
    redo(current: readonly T[], now?: number): T[] | null;
    clear(): void;
}

/**
 * An `UndoStack` with reactive flags: options make a new one, or pass a stack you already have. The moves go through
 * the wrapper, so the flags are always right.
 * `UndoStack` с реактивными флагами: опции создают новый, либо передайте готовый стек. Ходы идут через обёртку,
 * поэтому флаги всегда верны.
 */
export function useUndoStack<T>(from: UndoOptions<T> | UndoStack<T>): UseUndoStack<T> {
    const stack = from instanceof UndoStack ? from : new UndoStack<T>(from);
    const flags = useUndoFlags(stack);
    return {
        ...flags,
        stack,
        record(entry, key, now) {
            stack.record(entry, key, now);
            flags.sync();
        },
        undo(current, now) {
            const next = stack.undo(current, now);
            flags.sync();
            return next;
        },
        redo(current, now) {
            const next = stack.redo(current, now);
            flags.sync();
            return next;
        },
        clear() {
            stack.clear();
            flags.sync();
        },
    };
}

export interface UseHistory extends UndoFlags {
    /** The history itself. / Сама история. */
    history: History;
    /** `History.commit`: false when the state did not change; the flags follow. / `History.commit`: false, если состояние не изменилось. */
    commit(state: string, key?: string): boolean;
    /** The previous state or null. It also fits `historyCommands` as a source. / Предыдущее состояние или null. */
    undo(): string | null;
    redo(): string | null;
    /** Starts the history over (a file was loaded). / Начинает историю заново (загружен файл). */
    reset(state: string): void;
}

/**
 * A `History` with reactive flags: an initial state makes a new one, or pass a history you already have.
 * `History` с реактивными флагами: начальное состояние создаёт новую, либо передайте готовую историю.
 */
export function useHistory(from: string | History, limit?: number): UseHistory {
    const history = from instanceof History ? from : new History(from, limit);
    const flags = useUndoFlags(history);
    return {
        ...flags,
        history,
        commit(state, key) {
            const changed = history.commit(state, key);
            flags.sync();
            return changed;
        },
        undo() {
            const state = history.undo();
            flags.sync();
            return state;
        },
        redo() {
            const state = history.redo();
            flags.sync();
            return state;
        },
        reset(state) {
            history.reset(state);
            flags.sync();
        },
    };
}
