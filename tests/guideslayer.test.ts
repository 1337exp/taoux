import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import { TaoxGuides } from '../src/canvas';
import { snapToGuides, type GuideLine } from '../src/guides';

let app: App | null = null;
let host: HTMLElement | null = null;

function mount(lines: GuideLine[]) {
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp({ render: () => h(TaoxGuides, { lines }) });
    app.mount(host);
    return host;
}

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = host = null;
});

describe('TaoxGuides', () => {
    it('рисует линию на каждую направляющую: вертикальную для оси x, горизонтальную для оси y', () => {
        const el = mount([
            { axis: 'x', at: 40, from: 10, to: 90 },
            { axis: 'y', at: 70, from: 5, to: 55 },
        ]);
        const lines = [...el.querySelectorAll('line')];
        expect(lines).toHaveLength(2);
        expect(lines[0]!.getAttribute('x1')).toBe('40');
        expect(lines[0]!.getAttribute('x2')).toBe('40');
        expect(lines[0]!.getAttribute('y1')).toBe('10');
        expect(lines[0]!.getAttribute('y2')).toBe('90');
        expect(lines[1]!.getAttribute('y1')).toBe('70');
        expect(lines[1]!.getAttribute('y2')).toBe('70');
        expect(lines[1]!.getAttribute('x1')).toBe('5');
        expect(lines[1]!.getAttribute('x2')).toBe('55');
    });

    it('пока список пуст, ничего не рисует; скрыт от скринридера', () => {
        expect(mount([]).querySelector('svg')).toBeNull();
        app?.unmount();
        host?.remove();
        const el = mount([{ axis: 'x', at: 1, from: 0, to: 2 }]);
        expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('принимает то, что вернул snapToGuides', () => {
        const res = snapToGuides({ x: 5, y: 0, w: 100, h: 50 }, [{ x: 0, y: 200, w: 100, h: 50 }], 8);
        const el = mount(res.lines);
        expect(el.querySelectorAll('line').length).toBe(res.lines.length);
        expect(res.lines.length).toBeGreaterThan(0);
    });
});
