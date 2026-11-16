import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('TaoxLinks: стили', () => {
    it('наконечник заливается: его правило не слабее общего `.tx-links path { fill: none }`', () => {
        const css = readFileSync(join(process.cwd(), 'src/links/TaoxLinks.vue'), 'utf8');
        expect(css).toMatch(/[.]tx-links [.]tx-link-head[ ]*[{][^}]*fill:[ ]*var[(]--tx-link-now[)]/);
        expect(css).not.toMatch(/^[.]tx-link-head[ ]*[{]/m);
    });
});

describe('TaoxLinks: стиль линии', () => {
    const one = (extra: Partial<LinkLine>, selectedId?: string) => {
        const el = mount({ lines: [{ id: 's', d: 'M 0 0 L 10 10', head: 'M 10 10 L 5 5 Z', ...extra }], selectedId });
        return el.querySelector<SVGGElement>('g.tx-link')!;
    };

    it('без dash и width группа выглядит как раньше: ни классов стиля, ни переменных', () => {
        const g = one({});
        expect(g.getAttribute('class')).toBe('tx-link');
        expect(g.getAttribute('style')).toBeNull();
    });

    it('solid совпадает с отсутствием поля', () => {
        expect(one({ dash: 'solid' }).getAttribute('class')).toBe('tx-link');
    });

    it('dashed и dotted ставят свой класс на группу', () => {
        expect(one({ dash: 'dashed' }).classList.contains('tx-link-dashed')).toBe(true);
        expect(one({ dash: 'dotted' }).classList.contains('tx-link-dotted')).toBe(true);
        expect(one({ dash: 'dashed' }, 's').classList.contains('selected')).toBe(true);
    });

    it('толщина идёт переменными (в покое и при наведении на пиксель больше); мусор игнорируется', () => {
        const g = one({ width: 4 });
        expect(g.style.getPropertyValue('--tx-link-line-width')).toBe('4');
        expect(g.style.getPropertyValue('--tx-link-line-width-active')).toBe('5');
        for (const bad of [0, -1, NaN, Infinity]) expect(one({ width: bad }).getAttribute('style')).toBeNull();
    });

    it('наконечник и зона попадания не получают штрихов: правила узора только у .tx-link-line', () => {
        const css = readFileSync(join(__dirname, '../src/links/TaoxLinks.vue'), 'utf8').replace(/\r\n/g, '\n');
        for (const m of css.matchAll(/([^{}]+)\{[^}]*stroke-dasharray[^}]*\}/g)) {
            expect(m[1]).toContain('.tx-link-line');
            expect(m[1]).not.toMatch(/head|hit/);
        }
        const g = one({ dash: 'dotted' });
        // the hit path is a separate transparent solid stroke: the gaps of the visible line are clickable
        expect(g.querySelector('.tx-link-hit')?.getAttribute('d')).toBe('M 0 0 L 10 10');
        expect(g.querySelector('.tx-link-head')).not.toBeNull();
    });

    it('предпросмотр принимает dash и width', () => {
        const el = mount({ lines: [], preview: { id: 'p', d: 'M 0 0 L 5 5', dash: 'dotted', width: 3 } });
        const g = el.querySelector<SVGGElement>('g.tx-link-preview')!;
        expect(g.classList.contains('tx-link-dotted')).toBe(true);
        expect(g.style.getPropertyValue('--tx-link-line-width')).toBe('3');
    });
});
