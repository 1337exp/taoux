import { describe, expect, it } from 'vitest';
import { COALESCE_MS, diffRecords, UndoStack } from '../src/undo';

interface Rec {
    id: string;
    text: string;
    updatedAt: number;
    gone?: number;
}

const rec = (id: string, text = id, updatedAt = 0): Rec => ({ id, text, updatedAt });
const id = (r: Rec) => r.id;

/** The app's rules for a synced list: a returned record is new, a created one is not erased but marked gone. */
const synced = () =>
    new UndoStack<Rec>({
        id,
        revive: (image, now) => ({ ...image, updatedAt: now }),
        vanish: (record, now) => ({ ...record, gone: now, updatedAt: now }),
    });

const find = (list: readonly Rec[] | null, key: string) => list!.find((r) => r.id === key);

describe('diffRecords', () => {
    it('keeps only what changed: edited, added and removed records', () => {
        const a = rec('a');
        const b = rec('b');
        const a2 = { ...a, text: 'new' };
        const c = rec('c');
        const entry = diffRecords([a, b], [a2, c], id)!;

        expect([...entry.before]).toEqual([['a', a], ['c', null], ['b', b]]);
        expect([...entry.after]).toEqual([['a', a2], ['c', c], ['b', null]]);
    });

    it('compares by identity: an untouched record is not part of the step', () => {
        const a = rec('a');
        const entry = diffRecords([a, rec('b')], [a, { ...rec('b'), text: 'x' }], id)!;
        expect([...entry.after.keys()]).toEqual(['b']);
    });

    it('is null when nothing changed', () => {
        const a = rec('a');
        expect(diffRecords([a], [a], id)).toBeNull();
        expect(diffRecords([], [], id)).toBeNull();
    });
});

describe('UndoStack: undo and redo', () => {
    it('undo and redo go through the recorded steps; there is nothing to do at the ends', () => {
        const stack = synced();
        const a = rec('a', 'one');
        const a2 = { ...a, text: 'two' };
        stack.record(diffRecords([a], [a2], id)!);

        expect(stack.canUndo).toBe(true);
        expect(stack.canRedo).toBe(false);
        expect(find(stack.undo([a2], 10), 'a')!.text).toBe('one');
        expect(stack.canUndo).toBe(false);
        expect(stack.undo([a], 11)).toBeNull();
        expect(find(stack.redo([a], 12), 'a')!.text).toBe('two');
        expect(stack.redo([a2], 13)).toBeNull();
    });

    it('touches only the records of the step: what came from elsewhere stays (a sync-safe undo)', () => {
        const stack = synced();
        const mine = rec('mine', 'before');
        stack.record(diffRecords([mine], [{ ...mine, text: 'after' }], id)!);

        // meanwhile a sync brought another device's record and changed another one
        const current = [{ ...mine, text: 'after' }, rec('theirs', 'from the other device', 99)];
        const undone = stack.undo(current, 100)!;

        expect(find(undone, 'mine')!.text).toBe('before');
        expect(find(undone, 'theirs')).toBe(current[1]);
    });

    it('revive stamps the returned record as new, so a sync takes the undo for fresh', () => {
        const stack = synced();
        const a = rec('a', 'x', 5);
        stack.record(diffRecords([a], [{ ...a, text: 'y', updatedAt: 6 }], id)!);
        expect(find(stack.undo([{ ...a, text: 'y', updatedAt: 6 }], 1000), 'a')).toMatchObject({ text: 'x', updatedAt: 1000 });
    });

    it('a record the step created is marked gone by undo, not erased (and comes back with redo)', () => {
        const stack = synced();
        const a = rec('a');
        stack.record(diffRecords([], [a], id)!);

        const undone = stack.undo([a], 50)!;
        expect(undone).toHaveLength(1);
        expect(undone[0]).toMatchObject({ gone: 50, updatedAt: 50 });

        const redone = stack.redo(undone, 60)!;
        expect(redone[0]).toMatchObject({ id: 'a', updatedAt: 60 });
        expect(redone[0]!.gone).toBeUndefined();
    });

    it('without `vanish` a created record is dropped from the list', () => {
        const stack = new UndoStack<Rec>({ id, revive: (image) => image });
        const a = rec('a');
        stack.record(diffRecords([], [a], id)!);
        expect(stack.undo([a, rec('b')], 1)!.map(id)).toEqual(['b']);
    });

    it('a removal is undone by putting the record back', () => {
        const stack = synced();
        const a = rec('a', 'x');
        stack.record(diffRecords([a], [], id)!);
        expect(find(stack.undo([], 5), 'a')).toMatchObject({ text: 'x', updatedAt: 5 });
    });

    it('a new step drops the redo; the limit drops the oldest steps', () => {
        const stack = new UndoStack<Rec>({ id, revive: (image) => image, limit: 2 });
        const v = (n: number) => rec('a', String(n));
        stack.record(diffRecords([v(0)], [v(1)], id)!);
        stack.record(diffRecords([v(1)], [v(2)], id)!);
        stack.record(diffRecords([v(2)], [v(3)], id)!);

        stack.undo([v(3)], 1);
        stack.undo([v(2)], 1);
        expect(stack.canUndo).toBe(false); // the first step is gone

        stack.redo([v(1)], 1);
        stack.record(diffRecords([v(2)], [v(9)], id)!);
        expect(stack.canRedo).toBe(false);
    });

    it('clear forgets everything', () => {
        const stack = synced();
        stack.record(diffRecords([], [rec('a')], id)!);
        stack.clear();
        expect(stack.canUndo).toBe(false);
        expect(stack.canRedo).toBe(false);
    });
});

describe('UndoStack: merging quick edits', () => {
    const v = (n: number) => rec('a', String(n));

    it('edits with one key merge into one step; another key or a pause starts a new one', () => {
        const stack = synced();
        stack.record(diffRecords([v(0)], [v(1)], id)!, 'k', 1000);
        stack.record(diffRecords([v(1)], [v(2)], id)!, 'k', 2000);
        stack.record(diffRecords([v(2)], [v(3)], id)!, 'other', 2500);
        stack.record(diffRecords([v(3)], [v(4)], id)!, 'other', 2500 + COALESCE_MS + 1);

        expect(find(stack.undo([v(4)], 1), 'a')!.text).toBe('3');
        expect(find(stack.undo([v(3)], 1), 'a')!.text).toBe('2');
        expect(find(stack.undo([v(2)], 1), 'a')!.text).toBe('0'); // the first two edits are one step
        expect(stack.canUndo).toBe(false);
    });

    it('the merged step redoes to the last state', () => {
        const stack = synced();
        stack.record(diffRecords([v(0)], [v(1)], id)!, 'k', 1000);
        stack.record(diffRecords([v(1)], [v(2)], id)!, 'k', 1500);
        stack.undo([v(2)], 1);
        expect(find(stack.redo([v(0)], 2), 'a')!.text).toBe('2');
    });

    it('records of different ids in merged steps are all kept', () => {
        const stack = synced();
        const [a, b] = [rec('a', '0'), rec('b', '0')];
        stack.record(diffRecords([a, b], [{ ...a, text: '1' }, b], id)!, 'k', 1000);
        stack.record(diffRecords([{ ...a, text: '1' }, b], [{ ...a, text: '1' }, { ...b, text: '1' }], id)!, 'k', 1100);

        const undone = stack.undo([{ ...a, text: '1' }, { ...b, text: '1' }], 5)!;
        expect([find(undone, 'a')!.text, find(undone, 'b')!.text]).toEqual(['0', '0']);
    });

    it('an undo ends the merging: the next edit with the same key is a new step', () => {
        const stack = synced();
        stack.record(diffRecords([v(0)], [v(1)], id)!, 'k', 1000);
        stack.undo([v(1)], 1);
        stack.record(diffRecords([v(0)], [v(5)], id)!, 'k', 1100);
        stack.record(diffRecords([v(5)], [v(6)], id)!, 'k', 1200); // merges with v(5), not with the undone one
        expect(find(stack.undo([v(6)], 1), 'a')!.text).toBe('0');
        expect(stack.canUndo).toBe(false);
    });

    it('the window is an option', () => {
        const stack = new UndoStack<Rec>({ id, revive: (image) => image, coalesceMs: 10 });
        stack.record(diffRecords([v(0)], [v(1)], id)!, 'k', 1000);
        stack.record(diffRecords([v(1)], [v(2)], id)!, 'k', 1100); // later than 10 ms: a new step
        expect(find(stack.undo([v(2)], 1), 'a')!.text).toBe('1');
        expect(stack.canUndo).toBe(true);
    });
});

describe('UndoStack: a record comes back to its place', () => {
    const plain = () => new UndoStack<Rec>({ id, revive: (image) => image });
    const ids = (list: readonly Rec[] | null) => list!.map(id).join('');

    it('a removed record from the middle comes back to the middle, not to the end', () => {
        const [a, b, c] = [rec('a'), rec('b'), rec('c')];
        const stack = plain();
        stack.record(diffRecords([a, b, c], [a, c], id)!);
        expect(ids(stack.undo([a, c], 1))).toBe('abc');
    });

    it('«delete all» undone is the same list in the same order', () => {
        const all = ['a', 'b', 'c', 'd'].map((k) => rec(k));
        const stack = plain();
        stack.record(diffRecords(all, [], id)!);
        expect(ids(stack.undo([], 1))).toBe('abcd');
    });

    it('redo puts an added record where it was added', () => {
        const [a, b, x] = [rec('a'), rec('b'), rec('x')];
        const stack = plain();
        stack.record(diffRecords([a, b], [a, x, b], id)!);
        const undone = stack.undo([a, x, b], 1)!;
        expect(ids(undone)).toBe('ab');
        expect(ids(stack.redo(undone, 2))).toBe('axb');
    });

    it('the list changed meanwhile: the nearest place, never past the end', () => {
        const [a, b, c] = [rec('a'), rec('b'), rec('c')];
        const stack = plain();
        stack.record(diffRecords([a, b, c], [a, b], id)!);
        // another tab removed a and b in the meantime / другая вкладка тем временем убрала a и b
        expect(ids(stack.undo([], 1))).toBe('c');
    });

    it('a hand-made step without places still works: the record goes to the end', () => {
        const [a, b] = [rec('a'), rec('b')];
        const stack = plain();
        stack.record({ before: new Map([['a', a]]), after: new Map([['a', null]]) });
        expect(ids(stack.undo([b], 1))).toBe('ba');
    });
});

describe('UndoStack: a merged step has a limit', () => {
    const typing = (options: { coalesceMaxMs?: number }) => {
        const stack = new UndoStack<Rec>({ id, revive: (image) => image, ...options });
        let current = [rec('a', '0')];
        for (let i = 1; i <= 30; i++) {
            const next = [{ ...current[0]!, text: String(i) }];
            stack.record(diffRecords(current, next, id)!, 'type', i * 2000); // an edit every 2 s for a minute
            current = next;
        }
        let steps = 0;
        while (stack.canUndo) {
            current = stack.undo(current, 0)!;
            steps++;
        }
        return steps;
    };

    it('without it typing with no pause stays one step (as before)', () => {
        expect(typing({})).toBe(1);
    });

    it('coalesceMaxMs starts a new step when the merged one grew that long', () => {
        // a step takes the edits of its first 10 s (6 of them, 2 s apart): 30 edits are 5 steps
        expect(typing({ coalesceMaxMs: 10_000 })).toBe(5);
    });

    it('a merged step keeps the first place of a record and the last one', () => {
        const [a, b] = [rec('a'), rec('b')];
        const stack = new UndoStack<Rec>({ id, revive: (image) => image });
        stack.record(diffRecords([a, b], [b], id)!, 'k', 1000);
        const b2 = { ...b, text: 'x' };
        stack.record(diffRecords([b], [b2], id)!, 'k', 1100);
        expect(stack.undo([b2], 1)!.map((r) => `${r.id}${r.text}`).join(' ')).toBe('aa bb');
    });
});
