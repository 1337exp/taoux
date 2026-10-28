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
    /**
     * Where a record stood in the list before / after the step (its index), so a record that comes back takes its old
     * place instead of the end. `diffRecords` fills them; a hand-made entry may leave them out.
     * Где запись стояла в списке до / после шага (её индекс), чтобы вернувшаяся запись встала на своё место, а не в
     * конец. `diffRecords` их заполняет; шаг, собранный вручную, может их не задавать.
     */
    beforeAt?: Map<string, number>;
    afterAt?: Map<string, number>;
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
    const wasAt = new Map(prev.map((r, i) => [id(r), i]));
    const isAt = new Map(next.map((r, i) => [id(r), i]));
    const entry: UndoEntry<T> = { before: new Map(), after: new Map(), beforeAt: new Map(), afterAt: new Map() };
    const place = (key: string) => {
        const before = wasAt.get(key);
        const after = isAt.get(key);
        if (before !== undefined) entry.beforeAt!.set(key, before);
        if (after !== undefined) entry.afterAt!.set(key, after);
    };

    for (const [key, record] of is) {
        if (was.get(key) !== record) {
            entry.before.set(key, was.get(key) ?? null);
            entry.after.set(key, record);
            place(key);
        }
    }
    for (const [key, record] of was) {
        if (!is.has(key)) {
            entry.before.set(key, record);
            entry.after.set(key, null);
            place(key);
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
    /**
     * The longest a merged step may grow, ms from its first edit. The window above slides with every edit, so typing
     * without a pause would otherwise stay one step however long it goes on (one undo would take a minute of text
     * away). No limit by default.
     * Сколько может расти склеенный шаг, мс от его первой правки. Окно выше сдвигается с каждой правкой, поэтому набор
     * без пауз иначе остаётся одним шагом сколь угодно долго (одна отмена унесла бы минуту текста). По умолчанию без
     * предела.
     */
    coalesceMaxMs?: number;
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
    // when the step on top began: the limit of a merged step counts from here / когда начался верхний шаг
    private firstTime = 0;
    private readonly limit: number;
    private readonly coalesceMs: number;
    private readonly coalesceMaxMs: number;

    constructor(private readonly options: UndoOptions<T>) {
        this.limit = options.limit ?? 50;
        this.coalesceMs = options.coalesceMs ?? COALESCE_MS;
        this.coalesceMaxMs = options.coalesceMaxMs ?? Infinity;
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
        const merge =
            key !== undefined &&
            key === this.lastKey &&
            atTop &&
            now - this.lastTime <= this.coalesceMs &&
            now - this.firstTime <= this.coalesceMaxMs;
        if (merge) {
            const previous = this.entries[this.index - 1]!;
            for (const [id, record] of entry.before) {
                if (previous.before.has(id)) continue;
                previous.before.set(id, record);
                const at = entry.beforeAt?.get(id);
                if (at !== undefined) (previous.beforeAt ??= new Map()).set(id, at);
            }
            for (const [id, record] of entry.after) {
                previous.after.set(id, record);
                const at = entry.afterAt?.get(id);
                if (at !== undefined) (previous.afterAt ??= new Map()).set(id, at);
                else previous.afterAt?.delete(id);
            }
        } else {
            this.entries.length = this.index;
            this.entries.push(entry);
            if (this.entries.length > this.limit) this.entries.shift();
            this.index = this.entries.length;
            this.firstTime = now;
        }
        this.lastKey = key;
        this.lastTime = now;
    }

    undo(current: readonly T[], now: number = Date.now()): T[] | null {
        if (!this.canUndo) return null;
        this.lastKey = undefined;
        const entry = this.entries[--this.index]!;
        return this.apply(current, entry.before, entry.beforeAt, now);
    }

    redo(current: readonly T[], now: number = Date.now()): T[] | null {
        if (!this.canRedo) return null;
        this.lastKey = undefined;
        const entry = this.entries[this.index++]!;
        return this.apply(current, entry.after, entry.afterAt, now);
    }

    clear(): void {
        this.entries = [];
        this.index = 0;
        this.lastKey = undefined;
    }

    /**
     * Puts the images over the current list; the other records are not touched. A record that is in the list keeps its
     * place; one that comes back goes to the place it had (the list may have changed since, so it is the nearest one),
     * and without a known place to the end.
     * Кладёт образы поверх текущего списка; остальные записи не трогает. Запись, которая есть в списке, остаётся на
     * месте; вернувшаяся встаёт туда, где стояла (список с тех пор мог измениться, поэтому — на ближайшее место), а без
     * известного места — в конец.
     */
    private apply(current: readonly T[], images: Map<string, T | null>, places: Map<string, number> | undefined, now: number): T[] {
        const { id, revive, vanish } = this.options;
        const result = new Map(current.map((r) => [id(r), r]));
        const back: [number, T][] = [];
        for (const [key, image] of images) {
            if (image) {
                if (result.has(key)) result.set(key, revive(image, now));
                else back.push([places?.get(key) ?? Infinity, revive(image, now)]);
                continue;
            }
            const existing = result.get(key);
            if (!existing) continue;
            if (vanish) result.set(key, vanish(existing, now));
            else result.delete(key);
        }
        const list = [...result.values()];
        // in order of their old places, so «delete all» undone is the same list again / по возрастанию старых мест
        back.sort((a, b) => a[0] - b[0]);
        for (const [at, record] of back) list.splice(Math.min(at, list.length), 0, record);
        return list;
    }
}
