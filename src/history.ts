/**
 * Edits with the same key made faster than this many ms apart merge into one entry (typing a number into a field and the like).
 * Правки с одним ключом, сделанные чаще чем раз в столько мс, склеиваются в одну запись (набор числа в поле и т.п.).
 */
export const COALESCE_MS = 800;

/**
 * A history taken out of a `History` to be put back later: for an editor with several documents, each keeps its own.
 * It is plain data (strings and a number), so it can be stored anywhere.
 * История, вынутая из `History`, чтобы вернуть её позже: у редактора с несколькими документами у каждого своя.
 * Это простые данные (строки и число), их можно хранить где угодно.
 */
export interface HistoryState {
    states: readonly string[];
    index: number;
    /**
     * The label of the step that made each snapshot (the first has none), when the history has labels. A history saved before labels existed has none: it is put back unlabelled.
     * Подпись шага, который сделал каждый снимок (у первого её нет), если в истории есть подписи. История, сохранённая до подписей, их не имеет: возвращается без подписей.
     */
    labels?: readonly (string | undefined)[];
}

export interface HistoryOptions {
    /**
     * How long, ms, edits with one key merge. `Infinity`: until `seal()` or another key, however long the pause (an editor that ends a drag itself). Default `COALESCE_MS`.
     * Сколько мс правки с одним ключом склеиваются. `Infinity`: до `seal()` или другого ключа, как бы долго ни длилась пауза (редактор, который сам заканчивает перетаскивание). По умолчанию `COALESCE_MS`.
     */
    coalesceMs?: number;
}

/**
 * Undo/redo state history: a linear list of snapshots and a pointer to the current one.
 * Snapshots are strings (graph JSON): they are immutable, easy to compare and need no copying.
 * История состояний для undo/redo: линейный список снимков и указатель на текущий.
 * Снимки — строки (JSON графа): они неизменяемы, их легко сравнивать и не нужно копировать.
 */
export class History {
    private states: string[];
    private labels: (string | undefined)[] = [undefined];
    private index = 0;
    private lastKey: string | undefined;
    private lastTime = 0;
    private saved: string;
    private readonly coalesceMs: number;

    constructor(
        initial: string,
        private readonly limit = 100,
        private readonly now: () => number = Date.now,
        options: HistoryOptions = {},
    ) {
        this.states = [initial];
        this.saved = initial;
        this.coalesceMs = options.coalesceMs ?? COALESCE_MS;
    }

    get canUndo(): boolean {
        return this.index > 0;
    }

    get canRedo(): boolean {
        return this.index < this.states.length - 1;
    }

    /**
     * The label of the step an undo would take back, or undefined (nothing to undo, or the step has no label).
     * Подпись шага, который отменит undo, или undefined (отменять нечего или у шага нет подписи).
     */
    get undoLabel(): string | undefined {
        return this.canUndo ? this.labels[this.index] : undefined;
    }

    /**
     * The label of the step a redo would bring back.
     * Подпись шага, который вернёт redo.
     */
    get redoLabel(): string | undefined {
        return this.canRedo ? this.labels[this.index + 1] : undefined;
    }

    /**
     * Whether the current snapshot differs from the one marked by `markSaved()` (the start, or the one `reset` began from). It follows the history: undoing back to the saved
     * snapshot is clean again.
     * Отличается ли текущий снимок от отмеченного `markSaved()` (начального или того, с которого начал `reset`). Следует за историей: откат до сохранённого снимка снова чист.
     */
    get dirty(): boolean {
        return this.states[this.index] !== this.saved;
    }

    /**
     * Marks the current snapshot as the saved one.
     * Отмечает текущий снимок сохранённым.
     */
    markSaved(): void {
        this.saved = this.states[this.index]!;
    }

    /**
     * Ends a series of merged edits: the next edit with the same key is a new step. An editor that knows where a gesture ends (a pointer was released, a field lost focus) calls it
     * there; one that does not leaves it to the time window.
     * Заканчивает серию склеенных правок: следующая правка с тем же ключом это новый шаг. Редактор, который знает, где кончается жест (отпустили указатель, поле потеряло фокус),
     * зовёт его там; тот, кто не знает, оставляет это окну времени.
     */
    seal(): void {
        this.lastKey = undefined;
    }

    /**
     * Records a new state. If it does not differ from the current one, does nothing (returns false).
     * An edit discards the "future" (redo). With the same `key` in a row and within `COALESCE_MS`,
     * edits replace each other instead of piling up.
     * Записывает новое состояние. Если оно не отличается от текущего, ничего не делает (вернёт false).
     * Правка отбрасывает «будущее» (redo). С одинаковым `key` подряд и в пределах `COALESCE_MS`
     * правки заменяют друг друга, а не копятся. `label` называет шаг (для «Отменить: …»); у склеенной серии подпись первой правки.
     * The `label` names the step (for "Undo: …"); a merged series keeps the label of its first edit.
     */
    commit(state: string, key?: string, label?: string): boolean {
        if (state === this.states[this.index]) return false;

        const t = this.now();
        const atTop = this.index === this.states.length - 1;
        const coalesce = key !== undefined && key === this.lastKey && t - this.lastTime <= this.coalesceMs && this.index > 0 && atTop;

        if (coalesce) {
            this.states[this.index] = state;
            // Back to the state before the series of edits: no entry is needed.
            // Вернулись к состоянию до серии правок: запись не нужна.
            if (this.states[this.index - 1] === state) {
                this.states.pop();
                this.labels.pop();
                this.index--;
            }
        } else {
            this.states.length = this.index + 1;
            this.labels.length = this.index + 1;
            this.states.push(state);
            this.labels.push(label);
            this.index++;
            if (this.states.length > this.limit + 1) {
                this.states.shift();
                this.labels.shift();
                this.index--;
            }
        }

        this.lastKey = key;
        this.lastTime = t;
        return true;
    }

    /**
     * Returns the previous state, or null if there is nothing to undo.
     * Возвращает предыдущее состояние или null, если отменять нечего.
     */
    undo(): string | null {
        if (!this.canUndo) return null;
        this.lastKey = undefined;
        return this.states[--this.index]!;
    }

    redo(): string | null {
        if (!this.canRedo) return null;
        this.lastKey = undefined;
        return this.states[++this.index]!;
    }

    /**
     * A copy of the whole history (the snapshots and the position), to put back with `restore`.
     * Копия всей истории (снимки и положение), чтобы вернуть её через `restore`.
     */
    save(): HistoryState {
        const state: HistoryState = { states: [...this.states], index: this.index };
        // only a history that has labels carries them, so one without is the plain data it always was / подписи несёт только история, у которой они есть, так что без них это те же простые данные, что и раньше
        return this.labels.some(l => l !== undefined) ? { ...state, labels: [...this.labels] } : state;
    }

    /**
     * Puts a saved history back. The current snapshot of it should be the state of the document the app shows now;
     * what is not (an index out of range, no snapshots) is refused with an error. A series of merged edits is not
     * continued across a restore.
     * Возвращает сохранённую историю. Текущий снимок в ней должен быть состоянием документа, который приложение показывает
     * сейчас; негодное (положение вне списка, нет снимков) отклоняется ошибкой. Серия склеенных правок через возврат не продолжается.
     */
    restore(state: HistoryState): void {
        if (!Number.isInteger(state.index) || state.index < 0 || state.index >= state.states.length) {
            throw new RangeError('History.restore: the position is outside the saved snapshots');
        }
        this.states = [...state.states];
        this.labels = state.states.map((_, i) => state.labels?.[i]);
        this.index = state.index;
        this.lastKey = undefined;
    }

    /**
     * Start the history over (for example, after loading a file).
     * Начать историю заново (например, после загрузки файла).
     */
    reset(state: string): void {
        this.states = [state];
        this.labels = [undefined];
        this.saved = state;
        this.index = 0;
        this.lastKey = undefined;
    }
}
