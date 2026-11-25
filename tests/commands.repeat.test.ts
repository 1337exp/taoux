import { afterEach, describe, expect, it } from 'vitest';
import { createCommands } from '../src/commands';

// A held key: some commands want the repeat (a nudge, an undo), some must run once per press (a save, a toggle). The choice is the command's.
// Зажатая клавиша: одним командам нужен повтор (сдвиг, отмена), другим нужен один запуск на нажатие (сохранить, переключатель). Выбор за командой.

const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach((stop) => stop()));

function press(repeat: boolean) {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, repeat, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
}

describe('repeat of a command', () => {
    it('runs again while the key is held by default', () => {
        let runs = 0;
        const commands = createCommands([{ id: 'nudge', label: 'Nudge', shortcut: 'Mod+S', run: () => runs++ }], { mac: false });
        stops.push(commands.bind(document));
        press(false);
        press(true);
        press(true);
        expect(runs).toBe(3);
    });

    it('`repeat: false` runs once per press, and the held key is still swallowed (no browser dialog)', () => {
        let runs = 0;
        const commands = createCommands([{ id: 'save', label: 'Save', shortcut: 'Mod+S', repeat: false, run: () => runs++ }], { mac: false });
        stops.push(commands.bind(document));
        press(false);
        const held = press(true);
        press(true);
        expect(runs).toBe(1);
        expect(held.defaultPrevented).toBe(true);
    });
});
