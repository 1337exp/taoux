import type { TaoMenuItem } from '@1337exp/taoui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { type Command, type CommandMenuItem, createCommands, historyCommands } from '../src/commands';
import { History } from '../src/history';

const pc = { mac: false };

function editor() {
    const state = { grid: true, tool: 'move', saved: 0, dirty: ref(false) };
    const list: Command[] = [
        { id: 'save', label: 'Save', shortcut: 'Mod+S', icon: 'tao-check', enabled: () => state.dirty.value, run: () => state.saved++ },
        { id: 'grid', label: () => (state.grid ? 'Grid (on)' : 'Grid'), shortcut: "Mod+'", checked: () => state.grid, run: () => (state.grid = !state.grid) },
        { id: 'move', label: 'Move', shortcut: 'V', group: 'tool', checked: () => state.tool === 'move', run: () => (state.tool = 'move') },
        { id: 'rotate', label: 'Rotate', shortcut: 'R', group: 'tool', checked: () => state.tool === 'rotate', run: () => (state.tool = 'rotate') },
    ];
    return { state, commands: createCommands(list, pc) };
}

describe('the registry', () => {
    it('adds, finds, lists, removes; an id taken twice is an error', () => {
        const { commands } = editor();
        expect(commands.has('save')).toBe(true);
        expect(commands.list().map((c) => c.id)).toEqual(['save', 'grid', 'move', 'rotate']);
        expect(() => commands.add({ id: 'save', label: 'Again', run: () => {} })).toThrow(/already registered/);
        const remove = commands.add([{ id: 'a', label: 'A', run: () => {} }, { id: 'b', label: 'B', run: () => {} }]);
        expect(commands.has('b')).toBe(true);
        remove();
        expect(commands.has('a') || commands.has('b')).toBe(false);
    });

    it('run: only an existing, enabled command runs, and it says so', () => {
        const { state, commands } = editor();
        expect(commands.run('save')).toBe(false);
        state.dirty.value = true;
        expect(commands.run('save')).toBe(true);
        expect(state.saved).toBe(1);
        expect(commands.run('nope')).toBe(false);
    });

    it('labels are read every time; the shortcut label follows the platform', () => {
        const { state, commands } = editor();
        expect(commands.label('grid')).toBe('Grid (on)');
        state.grid = false;
        expect(commands.label('grid')).toBe('Grid');
        expect(commands.shortcutLabel('save')).toBe('Ctrl+S');
        expect(createCommands([{ id: 'x', label: 'X', shortcut: ['Mod+Shift+Z', 'Mod+Y'], run: () => {} }], { mac: true }).shortcutLabel('x')).toBe('⇧⌘Z');
    });
});

describe('toMenu', () => {
    it('builds a menu bar tree: submenus, items, separators, captions, checkboxes, radios', () => {
        const { commands } = editor();
        const menu = commands.toMenu([
            { id: 'file', label: 'File', items: ['save'] },
            { label: () => 'View', items: ['grid', '-', { type: 'label', label: 'Tool' }, 'move', 'rotate'] },
        ]);
        expect(menu).toEqual([
            { id: 'file', label: 'File', icon: undefined, items: [{ id: 'save', label: 'Save', shortcut: 'Ctrl+S', disabled: true, icon: 'tao-check' }] },
            {
                id: 'menu-1',
                label: 'View',
                icon: undefined,
                items: [
                    { type: 'checkbox', id: 'grid', label: 'Grid (on)', checked: true, shortcut: "Ctrl+'", disabled: false },
                    { type: 'separator' },
                    { type: 'label', label: 'Tool' },
                    { type: 'radio', id: 'move', group: 'tool', label: 'Move', checked: true, shortcut: 'V', disabled: false },
                    { type: 'radio', id: 'rotate', group: 'tool', label: 'Rotate', checked: false, shortcut: 'R', disabled: false },
                ],
            },
        ]);
    });

    it('reflects the state at the time of the call', () => {
        const { state, commands } = editor();
        state.dirty.value = true;
        commands.run('rotate');
        const [save, , , move, rotate] = commands.toMenu(['save', '-', 'grid', 'move', 'rotate']) as Extract<CommandMenuItem, { id: string }>[];
        expect(save!.disabled).toBe(false);
        expect((move as { checked: boolean }).checked).toBe(false);
        expect((rotate as { checked: boolean }).checked).toBe(true);
    });

    it('an unknown id in the layout is an error', () => {
        expect(() => editor().commands.toMenu(['save', 'sve'])).toThrow(/"sve"/);
    });

    it('nested submenus get ids from their path', () => {
        const { commands } = editor();
        const [outer] = commands.toMenu([{ label: 'Outer', items: [{ label: 'Inner', items: ['save'] }] }]) as { id: string; items: { id: string }[] }[];
        expect(outer!.id).toBe('menu-0');
        expect(outer!.items[0]!.id).toBe('menu-0-0');
    });

    it('the tree is a TaoMenuItem[] of TaoUI, both ways (checked by the type checker)', () => {
        const menu: TaoMenuItem[] = editor().commands.toMenu(['save', '-', 'grid', 'move']);
        const back: CommandMenuItem[] = menu;
        expect(back).toBe(menu);
    });
});

describe('bind', () => {
    const stops: (() => void)[] = [];
    afterEach(() => stops.splice(0).forEach((stop) => stop()));
    const key = (init: KeyboardEventInit) => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
        document.body.dispatchEvent(event);
        return event;
    };

    it('the same commands answer the keyboard; a disabled one swallows its key and does nothing', () => {
        const { state, commands } = editor();
        stops.push(commands.bind(document));
        expect(key({ key: 's', ctrlKey: true }).defaultPrevented).toBe(true);
        expect(state.saved).toBe(0);
        state.dirty.value = true;
        key({ key: 's', ctrlKey: true });
        expect(state.saved).toBe(1);
        key({ key: 'r' });
        expect(state.tool).toBe('rotate');
    });

    it('commands added after bind are heard too, every shortcut of a command works', () => {
        const { commands } = editor();
        stops.push(commands.bind(document));
        const redo = vi.fn();
        commands.add({ id: 'redo', label: 'Redo', shortcut: ['Mod+Shift+Z', 'Mod+Y'], run: redo });
        key({ key: 'Z', ctrlKey: true, shiftKey: true });
        key({ key: 'y', ctrlKey: true });
        expect(redo).toHaveBeenCalledTimes(2);
    });
});

describe('check', () => {
    it('finds shortcuts kept by the browser and shortcuts given twice', () => {
        const commands = createCommands(
            [
                { id: 'close', label: 'Close', shortcut: 'Mod+W', run: () => {} },
                { id: 'a', label: 'A', shortcut: 'Mod+D', run: () => {} },
                { id: 'b', label: 'B', shortcut: 'Ctrl+D', run: () => {} },
            ],
            pc,
        );
        expect(commands.check({ safari: false })).toEqual([
            { id: 'close', shortcut: 'Mod+W', problem: 'reserved' },
            { id: 'b', shortcut: 'Ctrl+D', problem: 'duplicate', other: 'a' },
        ]);
        expect(editor().commands.check({ safari: false })).toEqual([]);
    });
});

describe('historyCommands', () => {
    it('Undo / Redo are disabled when there is nothing to undo or redo (a History with an apply wrapper)', () => {
        const history = new History('a', 100, () => 0);
        let doc = 'a';
        const commands = createCommands(
            historyCommands({
                get canUndo() {
                    return history.canUndo;
                },
                get canRedo() {
                    return history.canRedo;
                },
                undo: () => (doc = history.undo() ?? doc),
                redo: () => (doc = history.redo() ?? doc),
            }),
            pc,
        );
        const flags = () => (commands.toMenu(['undo', 'redo']) as { disabled: boolean }[]).map((i) => i.disabled);
        expect(flags()).toEqual([true, true]);
        history.commit('b');
        expect(flags()).toEqual([false, true]);
        expect(commands.run('undo')).toBe(true);
        expect(doc).toBe('a');
        expect(flags()).toEqual([true, false]);
        expect(commands.run('undo')).toBe(false);
        commands.run('redo');
        expect(doc).toBe('b');
    });

    it('a session with canUndo refs fits as is; labels can be functions', () => {
        const canUndo = ref(false);
        const undo = vi.fn();
        const commands = createCommands(historyCommands({ canUndo, canRedo: () => false, undo, redo: () => {} }, { labels: { undo: () => 'Отменить' } }), pc);
        expect(commands.label('undo')).toBe('Отменить');
        expect(commands.label('redo')).toBe('Redo');
        expect(commands.shortcutLabel('redo')).toBe('Ctrl+Shift+Z');
        expect(commands.run('undo')).toBe(false);
        canUndo.value = true;
        expect(commands.run('undo')).toBe(true);
        expect(undo).toHaveBeenCalledOnce();
    });
});
