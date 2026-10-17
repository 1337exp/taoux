/**
 * Edits with the same key made faster than this many ms apart merge into one entry (typing a number into a field and the like).
 * Правки с одним ключом, сделанные чаще чем раз в столько мс, склеиваются в одну запись (набор числа в поле и т.п.).
 */
export const COALESCE_MS = 800;

/**
 * Undo/redo state history: a linear list of snapshots and a pointer to the current one.
 * Snapshots are strings (graph JSON): they are immutable, easy to compare and need no copying.
 * История состояний для undo/redo: линейный список снимков и указатель на текущий.
 * Снимки — строки (JSON графа): они неизменяемы, их легко сравнивать и не нужно копировать.
 */
export class History {
    private states: string[];
    private index = 0;
    private lastKey: string | undefined;
    private lastTime = 0;

    constructor(
        initial: string,
        private readonly limit = 100,
        private readonly now: () => number = Date.now,
    ) {
        this.states = [initial];
    }

    get canUndo(): boolean {
        return this.index > 0;
    }

    get canRedo(): boolean {
        return this.index < this.states.length - 1;
    }

    /**
     * Records a new state. If it does not differ from the current one, does nothing (returns false).
     * An edit discards the "future" (redo). With the same `key` in a row and within `COALESCE_MS`,
     * edits replace each other instead of piling up.
     * Записывает новое состояние. Если оно не отличается от текущего, ничего не делает (вернёт false).
     * Правка отбрасывает «будущее» (redo). С одинаковым `key` подряд и в пределах `COALESCE_MS`
     * правки заменяют друг друга, а не копятся.
     */
    commit(state: string, key?: string): boolean {
        if (state === this.states[this.index]) return false;

        const t = this.now();
        const atTop = this.index === this.states.length - 1;
        const coalesce = key !== undefined && key === this.lastKey && t - this.lastTime <= COALESCE_MS && this.index > 0 && atTop;

        if (coalesce) {
            this.states[this.index] = state;
            // Back to the state before the series of edits: no entry is needed.
            // Вернулись к состоянию до серии правок: запись не нужна.
            if (this.states[this.index - 1] === state) {
                this.states.pop();
                this.index--;
            }
        } else {
            this.states.length = this.index + 1;
            this.states.push(state);
            this.index++;
            if (this.states.length > this.limit + 1) {
                this.states.shift();
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
     * Start the history over (for example, after loading a file).
     * Начать историю заново (например, после загрузки файла).
     */
    reset(state: string): void {
        this.states = [state];
        this.index = 0;
        this.lastKey = undefined;
    }
}
