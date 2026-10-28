/**
 * Undo and redo by records, not by snapshots of the whole document. A step keeps only the records it touched, before
 * and after. For a list that is edited and synced (notes, tasks, contacts) that is what `History` cannot give:
 * a snapshot of the whole list costs the whole list per step, and an undo made after a sync would roll back what
 * another device has just changed. Here an undo touches only the records of its step.
 * Undo и redo по записям, а не по снимкам всего документа. Шаг хранит только затронутые им записи, до и после. Для
 * списка, который правят и синхронизируют (заметки, задачи, контакты), это то, чего не даёт `History`: снимок всего
 * списка стоит всего списка на шаг, а отмена после синхронизации откатила бы то, что только что изменило другое
 * устройство. Здесь отмена трогает только записи своего шага.
 *
 * Pure TypeScript, no Vue and no DOM. Records are immutable: an edit makes a new object, and `diffRecords` finds the
 * changed ones by identity.
 * Чистый TypeScript, без Vue и DOM. Записи неизменяемы: правка создаёт новый объект, а `diffRecords` находит
 * изменённые по тождеству.
 */

/**
 * Edits with the same key made faster than this many ms apart merge into one step (autosave while typing).
 * Правки с одним ключом, сделанные чаще чем раз в столько мс, склеиваются в один шаг (автосохранение при наборе).
 */
export const COALESCE_MS = 3000;

/**
 * What one step changed: the touched records before and after (`null`: the record did not exist / is gone).
 * Что изменил один шаг: затронутые записи до и после (`null`: записи не было / её больше нет).
 */
export interface UndoEntry<T> {
    before: Map<string, T | null>;
    after: Map<string, T | null>;
}

/**
 * The step between two lists, or null when nothing changed. Records are compared by identity, so an unchanged
 * record must stay the same object.
 * Шаг между двумя списками или null, если ничего не изменилось. Записи сравниваются по тождеству, поэтому
 * нетронутая запись должна остаться тем же объектом.
 */
export function diffRecords<T>(prev: readonly T[], next: readonly T[], id: (record: T) => string): UndoEntry<T> | null {
    const was = new Map(prev.map((r) => [id(r), r]));
    const is = new Map(next.map((r) => [id(r), r]));
    const entry: UndoEntry<T> = { before: new Map(), after: new Map() };

    for (const [key, record] of is) {
        if (was.get(key) !== record) {
            entry.before.set(key, was.get(key) ?? null);
            entry.after.set(key, record);
        }
    }
    for (const [key, record] of was) {
        if (!is.has(key)) {
            entry.before.set(key, record);
            entry.after.set(key, null);
        }
    }
    return entry.after.size === 0 ? null : entry;
}

export interface UndoOptions<T> {
    /** The id of a record. / Id записи. */
    id(record: T): string;
    /**
     * A record comes back from a step (an image). Stamp it as new, so that a sync does not take the undo for stale:
     * `{ ...image, updatedAt: now }`.
     * Запись возвращается из шага (образ). Пометьте её свежей, чтобы синхронизация не сочла отмену устаревшей.
     */
    revive(image: T, now: number): T;
    /**
     * A record that the step created (or removed) has to go away. Do not delete it from the list when the list is
     * synced: mark it gone, as a tombstone: `{ ...record, deletedAt: now, updatedAt: now }`. Without it the record
     * is dropped from the list.
     * Запись, которую шаг создал (или удалил), должна исчезнуть. В синхронизируемом списке не стирайте её, а пометьте
     * исчезнувшей, надгробием. Без этого запись просто убирается из списка.
     */
    vanish?(record: T, now: number): T;
    /** How many steps to keep. / Сколько шагов хранить. */
    limit?: number;
    /** The merge window of `record(entry, key)`, ms. / Окно склейки для `record(entry, key)`, мс. */
    coalesceMs?: number;
}

/**
 * The stack of steps and the pointer in it. It does not hold the list: `undo` and `redo` take the current list and
 * return the next one (or null when there is nothing to do), the app puts it where it keeps its records.
 * Стек шагов и указатель в нём. Список он не хранит: `undo` и `redo` принимают текущий список и возвращают следующий
 * (или null, если делать нечего), а приложение кладёт его туда, где хранит записи.
 */
export class UndoStack<T> {
    private entries: UndoEntry<T>[] = [];
    private index = 0;
    private lastKey: string | undefined;
    private lastTime = 0;
    private readonly limit: number;
    private readonly coalesceMs: number;

    constructor(private readonly options: UndoOptions<T>) {
        this.limit = options.limit ?? 50;
        this.coalesceMs = options.coalesceMs ?? COALESCE_MS;
    }

    get canUndo(): boolean {
        return this.index > 0;
    }

    get canRedo(): boolean {
        return this.index < this.entries.length;
    }

    /**
     * Records a step; it drops the "future" (redo). With the same `key` in a row and within `coalesceMs` the step
     * merges into the previous one: the first `before` stays, the last `after` wins.
     * Записывает шаг и отбрасывает «будущее» (redo). С одинаковым `key` подряд и в пределах `coalesceMs` шаг
     * склеивается с предыдущим: остаётся первый `before`, побеждает последний `after`.
     */
    record(entry: UndoEntry<T>, key?: string, now: number = Date.now()): void {
        const atTop = this.index > 0 && this.index === this.entries.length;
        if (key !== undefined && key === this.lastKey && atTop && now - this.lastTime <= this.coalesceMs) {
            const previous = this.entries[this.index - 1]!;
            for (const [id, record] of entry.before) if (!previous.before.has(id)) previous.before.set(id, record);
            for (const [id, record] of entry.after) previous.after.set(id, record);
        } else {
            this.entries.length = this.index;
            this.entries.push(entry);
            if (this.entries.length > this.limit) this.entries.shift();
            this.index = this.entries.length;
        }
        this.lastKey = key;
        this.lastTime = now;
    }

    undo(current: readonly T[], now: number = Date.now()): T[] | null {
        if (!this.canUndo) return null;
        this.lastKey = undefined;
        return this.apply(current, this.entries[--this.index]!.before, now);
    }

    redo(current: readonly T[], now: number = Date.now()): T[] | null {
        if (!this.canRedo) return null;
        this.lastKey = undefined;
        return this.apply(current, this.entries[this.index++]!.after, now);
    }

    clear(): void {
        this.entries = [];
        this.index = 0;
        this.lastKey = undefined;
    }

    /** Puts the images over the current list; the other records are not touched. / Кладёт образы поверх текущего списка. */
    private apply(current: readonly T[], images: Map<string, T | null>, now: number): T[] {
        const { id, revive, vanish } = this.options;
        const result = new Map(current.map((r) => [id(r), r]));
        for (const [key, image] of images) {
            if (image) {
                result.set(key, revive(image, now));
                continue;
            }
            const existing = result.get(key);
            if (!existing) continue;
            if (vanish) result.set(key, vanish(existing, now));
            else result.delete(key);
        }
        return [...result.values()];
    }
}
