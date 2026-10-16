import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import { TaoxLinks, type LinkLine, type LinkPreview } from '../src/links';

let app: App | null = null;
let host: HTMLElement | null = null;

function mount(props: { lines: LinkLine[]; selectedId?: string | null; preview?: LinkPreview | null; glow?: boolean }) {
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp({ render: () => h(TaoxLinks, props) });
    app.mount(host);
    return host;
}

afterEach(() => {
    app?.unmount();
    host?.remove();
    app = host = null;
});

const lines: LinkLine[] = [
    { id: 'c1', d: 'M 0 0 L 10 10' },
    { id: 'c2', d: 'M 0 0 L 20 20', head: 'M 20 20 L 15 15 Z', color: '#ff0000' },
];

describe('TaoxLinks', () => {
    it('рисует группу на каждую связь с data-conn-id, линией и зоной попадания', () => {
        const el = mount({ lines });
        const groups = el.querySelectorAll('g.tx-link');
        expect([...groups].map((g) => (g as HTMLElement).dataset.connId)).toEqual(['c1', 'c2']);
        for (const g of groups) {
            expect(g.querySelector('path.tx-link-line')).not.toBeNull();
            expect(g.querySelector('path.tx-link-hit')).not.toBeNull();
        }
    });

    it('наконечник только у связей, у которых он задан', () => {
        const el = mount({ lines });
        const [first, second] = el.querySelectorAll('g.tx-link');
        expect(first!.querySelector('.tx-link-head')).toBeNull();
        expect(second!.querySelector('.tx-link-head')?.getAttribute('d')).toBe('M 20 20 L 15 15 Z');
    });

    it('собственный цвет связи идёт переменной, а не жёстким stroke', () => {
        const el = mount({ lines });
        const [first, second] = el.querySelectorAll<HTMLElement>('g.tx-link');
        expect(first!.style.getPropertyValue('--tx-link-line-color')).toBe('');
        expect(second!.style.getPropertyValue('--tx-link-line-color')).toBe('#ff0000');
    });

    it('выбранная связь получает класс selected', () => {
        const el = mount({ lines, selectedId: 'c2' });
        const [first, second] = el.querySelectorAll('g.tx-link');
        expect(first!.classList.contains('selected')).toBe(false);
        expect(second!.classList.contains('selected')).toBe(true);
    });

    it('свечение рисуется только по запросу', () => {
        expect(mount({ lines }).querySelector('.tx-link-glow')).toBeNull();
        app?.unmount();
        host?.remove();
        expect(mount({ lines, glow: true }).querySelectorAll('.tx-link-glow')).toHaveLength(2);
    });

    it('предпросмотр рисуется отдельно, без data-conn-id, и краснеет при недопустимой цели', () => {
        const el = mount({ lines: [], preview: { id: 'p', d: 'M 0 0 L 5 5', invalid: true } });
        const preview = el.querySelector('g.tx-link-preview') as HTMLElement;
        expect(preview.classList.contains('invalid')).toBe(true);
        expect(preview.dataset.connId).toBeUndefined();
        expect(el.querySelector('.tx-link-hit')).toBeNull(); // за предпросмотр не ухватишься
    });
});
