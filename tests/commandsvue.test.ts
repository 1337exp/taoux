import { mount } from '@vue/test-utils';
import { KeepAlive, defineComponent, effectScope, h, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { createCommands, type Command } from '../src/commands';
import { useCommands } from '../src/commandsvue';

// 0.18.0: the registry in a Vue app: commands live with the component, keys while it is mounted, the menu follows the state.
// 0.18.0: реестр в приложении на Vue: команды живут с компонентом, клавиши, пока он смонтирован, меню следует за состоянием.

const layout = [{ id: 'file', label: 'File', items: ['save', '-', 'bold'] }];

function setup(extra: Command[] = []) {
    const commands = createCommands([], { mac: false });
    const saved = vi.fn();
    const bold = ref(false);
    const target = document;
    const own: Command[] = [
        { id: 'save', label: 'Save', shortcut: 'Mod+S', run: saved },
        { id: 'bold', label: 'Bold', shortcut: 'Mod+B', checked: () => bold.value, run: () => (bold.value = !bold.value) },
        ...extra,
    ];
    return { commands, saved, bold, target, own };
}

describe('useCommands', () => {
    it('adds the commands now, so the menu can name them at once; the menu follows the state', () => {
        const s = setup();
        const scope = effectScope();
        scope.run(() => {
            const { menu } = useCommands(s.commands, { add: s.own, target: false });
            const bar = menu(layout);
            const items = () => (bar.value[0] as { items: { id: string; checked?: boolean }[] }).items;
            expect(items().map((i) => i.id)).toEqual(['save', undefined, 'bold']);
            expect(items()[2]!.checked).toBe(false);
            s.bold.value = true;
            expect(items()[2]!.checked).toBe(true);
        });
        scope.stop();
    });

    it('onSelect runs the command of the item (an object, as TaoUI 6 emits it) or of an id; a disabled one does not run', () => {
        const s = setup([{ id: 'off', label: 'Off', enabled: () => false, run: vi.fn() }]);
        const scope = effectScope();
        scope.run(() => {
            const { onSelect } = useCommands(s.commands, { add: s.own, target: false });
            expect(onSelect({ id: 'save' })).toBe(true);
            expect(onSelect('save')).toBe(true);
            expect(s.saved).toHaveBeenCalledTimes(2);
            expect(onSelect({ id: 'off' })).toBe(false);
            expect(onSelect({})).toBe(false);
            expect(onSelect({ id: 'nobody' })).toBe(false);
        });
        scope.stop();
    });

    it('in a component: the keys work while it is mounted, and commands and keys are gone after unmount', async () => {
        const s = setup();
        const Root = defineComponent({
            setup() {
                useCommands(s.commands, { add: s.own, target: s.target });
                return () => h('div');
            },
        });
        const wrapper = mount(Root);
        expect(s.commands.has('save')).toBe(true);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(s.saved).toHaveBeenCalledTimes(1);
        wrapper.unmount();
        expect(s.commands.has('save')).toBe(false);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(s.saved).toHaveBeenCalledTimes(1);
    });

    it('the menu is made again when commands come and go', async () => {
        const s = setup();
        const commands = s.commands;
        const scope = effectScope();
        let menu!: ReturnType<ReturnType<typeof useCommands>['menu']>;
        scope.run(() => {
            const outer = useCommands(commands, { add: [s.own[0]!], target: false });
            menu = outer.menu(['save']) as never;
            expect((menu as never as { value: unknown[] }).value).toHaveLength(1);
        });
        scope.stop();
        // after the scope stops its commands are removed, so a menu naming them would throw: the registry's own rule (a typo is an error)
        expect(() => commands.toMenu(['save'])).toThrow(/not registered/);
        await nextTick();
    });
});

describe('useCommands in a <KeepAlive>', () => {
    it('a hidden page lets go of its commands and its keys; coming back takes them again', async () => {
        const commands = createCommands([], { mac: false });
        const saved = vi.fn();
        // the ids differ: Vue sets the new page up before the old one is deactivated, so the same id on both would meet in the registry
        const page = (name: string) =>
            defineComponent({
                name,
                setup() {
                    useCommands(commands, { add: [{ id: `save-${name}`, label: name, shortcut: 'Mod+S', run: () => saved(name) }], target: document });
                    return () => h('div', name);
                },
            });
        const A = page('A');
        const B = page('B');
        const which = ref<'A' | 'B'>('A');
        const Root = defineComponent({ setup: () => () => h(KeepAlive, null, [h(which.value === 'A' ? A : B)]) });
        const w = mount(Root, { attachTo: document.body });
        const press = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
        const settle = async () => {
            await nextTick();
            await nextTick();
        };
        press();
        expect(saved.mock.calls).toEqual([['A']]);
        which.value = 'B';
        await settle();
        expect(commands.has('save-A')).toBe(false);
        press();
        // only the visible page answers the keyboard
        expect(saved.mock.calls).toEqual([['A'], ['B']]);
        which.value = 'A';
        await settle();
        expect(commands.has('save-B')).toBe(false);
        expect(commands.has('save-A')).toBe(true);
        press();
        expect(saved.mock.calls).toEqual([['A'], ['B'], ['A']]);
        w.unmount();
        expect(commands.list()).toEqual([]);
    });
});
