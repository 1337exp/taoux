// Pure node-palette logic: search and groups by category. The palette window and the pin compatibility rules stay in the app.
// Чистая логика палитры нод: поиск и группы по категориям. Окно палитры и правила совместимости пинов остаются в приложении.
/**
 * The least the palette knows about a node.
 * Минимум, что палитра знает о ноде.
 */
export interface PaletteItem {
    id: string;
    title: string;
    hidden?: boolean;
}

export interface NodeGroup<T> {
    category: string;
    nodes: T[];
}

/**
 * Category: the part of the id before "/" (`math/add` → `math`); without "/" it is `other`.
 * Категория: часть id до «/» (`math/add` → `math`), без «/» — `other`.
 */
export const categoryOf = (def: { id: string }): string => (def.id.includes('/') ? def.id.split('/')[0]! : 'other');

/**
 * Nodes matching a query (every word must occur in the name or id), by category and name.
 * Hidden ones (`hidden`) are not shown. `extraText` adds translations to the search text, so one can search in any language.
 * Ноды, подходящие под запрос (все слова должны встретиться в названии или id), по категориям и названиям.
 * Скрытые (`hidden`) не показываются. `extraText` добавляет к тексту поиска переводы, чтобы искать можно было на любом языке.
 */
export function filterNodes<T extends PaletteItem>(defs: readonly T[], query: string, extraText: (def: T) => string = () => ''): T[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);

    return defs
        .filter((def) => {
            if (def.hidden) return false;
            const haystack = `${def.title} ${def.id} ${extraText(def)}`.toLowerCase();
            return words.every((w) => haystack.includes(w));
        })
        .sort((a, b) => categoryOf(a).localeCompare(categoryOf(b)) || a.title.localeCompare(b.title));
}

/**
 * Groups of consecutive nodes of one category (the input must be sorted by `filterNodes`).
 * Группы идущих подряд нод одной категории (вход должен быть отсортирован `filterNodes`).
 */
export function groupByCategory<T extends { id: string }>(defs: readonly T[]): NodeGroup<T>[] {
    const groups: NodeGroup<T>[] = [];
    for (const def of defs) {
        const category = categoryOf(def);
        const last = groups[groups.length - 1];
        if (last?.category === category) last.nodes.push(def);
        else groups.push({ category, nodes: [def] });
    }
    return groups;
}
