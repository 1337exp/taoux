import { describe, expect, it } from 'vitest';
import { categoryOf, filterNodes, groupByCategory } from '../src/palette';

const defs = [
    { id: 'math/add', title: 'Add' },
    { id: 'math/greater', title: 'Greater' },
    { id: 'flow/branch', title: 'Branch' },
    { id: 'flow/start', title: 'Start' },
    { id: 'debug/print', title: 'Print' },
    { id: 'secret/thing', title: 'Secret', hidden: true },
    { id: 'lonely', title: 'Lonely' },
];

describe('categoryOf', () => {
    it('берёт часть id до «/», без неё — other', () => {
        expect(categoryOf({ id: 'math/add' })).toBe('math');
        expect(categoryOf({ id: 'lonely' })).toBe('other');
    });
});

describe('filterNodes', () => {
    it('ищет по названию и id, все слова должны совпасть', () => {
        expect(filterNodes(defs, 'add').map((d) => d.id)).toEqual(['math/add']);
        expect(filterNodes(defs, 'MATH').map((d) => d.id)).toEqual(['math/add', 'math/greater']);
        expect(filterNodes(defs, 'math gre').map((d) => d.id)).toEqual(['math/greater']);
        expect(filterNodes(defs, 'нет такой')).toEqual([]);
    });

    it('не показывает скрытые', () => {
        expect(filterNodes(defs, '').map((d) => d.id)).not.toContain('secret/thing');
        expect(filterNodes(defs, 'secret')).toEqual([]);
    });

    it('сортирует по категории, затем по названию', () => {
        // «lonely» без «/» попадает в категорию other, а она по алфавиту идёт после math
        expect(filterNodes(defs, '').map((d) => d.id)).toEqual(['debug/print', 'flow/branch', 'flow/start', 'math/add', 'math/greater', 'lonely']);
    });

    it('extraText расширяет поиск (например, переводами)', () => {
        const ru = (d: { id: string }) => (d.id === 'math/add' ? 'Сложение' : '');
        expect(filterNodes(defs, 'сложение', ru).map((d) => d.id)).toEqual(['math/add']);
    });
});

describe('groupByCategory', () => {
    it('группирует подряд идущие ноды одной категории', () => {
        const groups = groupByCategory(filterNodes(defs, ''));
        expect(groups.map((g) => g.category)).toEqual(['debug', 'flow', 'math', 'other']);
        expect(groups.every((g) => g.nodes.every((d) => categoryOf(d) === g.category))).toBe(true);
    });
});
