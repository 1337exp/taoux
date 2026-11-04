import { effectScope, watchEffect } from 'vue';
import { describe, expect, it } from 'vitest';
import { createCommands, historyCommands } from '../src/commands';
import { History } from '../src/history';
import { diffRecords, UndoStack } from '../src/undo';
import { useHistory, useUndoFlags, useUndoStack } from '../src/undovue';

// 0.7.0: the flags of a stack or a history as refs, so the Undo and Redo items of a menu follow them.
// 0.7.0: флаги стека или истории как ref, чтобы пункты Undo и Redo в меню шли за ними.

interface Note {
    id: string;
    text: string;
}
const options = { id: (n: Note) => n.id, revive: (n: Note) => n };
const a: Note = { id: 'a', text: 'one' };
const b: Note = { id: 'a', text: 'two' };

describe('useUndoStack', () => {
    it('the flags follow every move: record, undo, redo, clear', () => {
        const u = useUndoStack<Note>(options);
        expect([u.canUndo.value, u.canRedo.value]).toEqual([false, false]);
        u.record(diffRecords([a], [b], options.id)!);
        expect([u.canUndo.value, u.canRedo.value]).toEqual([true, false]);
        expect(u.undo([b])).toEqual([a]);
        expect([u.canUndo.value, u.canRedo.value]).toEqual([false, true]);
        expect(u.redo([a])).toEqual([b]);
        expect([u.canUndo.value, u.canRedo.value]).toEqual([true, false]);
        u.clear();
        expect([u.canUndo.value, u.canRedo.value]).toEqual([false, false]);
    });

    it('nothing to undo: null, and the flags stay', () => {
        const u = useUndoStack<Note>(options);
        expect(u.undo([a])).toBeNull();
        expect(u.redo([a])).toBeNull();
        expect(u.canUndo.value).toBe(false);
    });

    it('takes a stack you already have, and shows what it already holds', () => {
        const stack = new UndoStack<Note>(options);
        stack.record(diffRecords([a], [b], options.id)!);
        const u = useUndoStack(stack);
        expect(u.stack).toBe(stack);
        expect(u.canUndo.value).toBe(true);
    });

    it('a reactive effect hears the change', () => {
        const u = useUndoStack<Note>(options);
        const seen: boolean[] = [];
        const scope = effectScope();
        scope.run(() => watchEffect(() => seen.push(u.canUndo.value), { flush: 'sync' }));
        u.record(diffRecords([a], [b], options.id)!);
        u.undo([b]);
        scope.stop();
        expect(seen).toEqual([false, true, false]);
    });

    it('the flags are read-only', () => {
        const u = useUndoStack<Note>(options);
        expect(() => {
            (u.canUndo as { value: boolean }).value = true;
        }).not.toThrow();
        expect(u.canUndo.value).toBe(false);
    });
});

describe('useUndoFlags', () => {
    it('follows a stack that moves on its own, when told to sync', () => {
        const stack = new UndoStack<Note>(options);
        const flags = useUndoFlags(stack);
        stack.record(diffRecords([a], [b], options.id)!);
        expect(flags.canUndo.value).toBe(false);
        flags.sync();
        expect(flags.canUndo.value).toBe(true);
    });
});

describe('useHistory', () => {
    it('commit, undo, redo and reset keep the flags right; an unchanged state is not a step', () => {
        const h = useHistory('one');
        expect(h.commit('one')).toBe(false);
        expect(h.canUndo.value).toBe(false);
        expect(h.commit('two')).toBe(true);
        expect([h.canUndo.value, h.canRedo.value]).toEqual([true, false]);
        expect(h.undo()).toBe('one');
        expect([h.canUndo.value, h.canRedo.value]).toEqual([false, true]);
        expect(h.redo()).toBe('two');
        h.reset('fresh');
        expect([h.canUndo.value, h.canRedo.value]).toEqual([false, false]);
    });

    it('takes a history you already have', () => {
        const history = new History('x');
        history.commit('y');
        const h = useHistory(history);
        expect(h.history).toBe(history);
        expect(h.canUndo.value).toBe(true);
    });
});

describe('with commands', () => {
    it('the Undo and Redo commands switch on and off by themselves', () => {
        const h = useHistory('one');
        const commands = createCommands(historyCommands(h));
        expect(commands.get('undo')?.enabled?.()).toBe(false);
        h.commit('two');
        expect(commands.get('undo')?.enabled?.()).toBe(true);
        expect(commands.get('redo')?.enabled?.()).toBe(false);
        h.undo();
        expect(commands.get('redo')?.enabled?.()).toBe(true);
    });
});
