// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Ярусы (см. docs/canvas.md):
 *   0, примитивы: ничего не импортируют из taoux;
 *   1, составные: импортируют только примитивы, но не друг друга.
 * Составные модули перечислены здесь; всё остальное в src считается примитивом.
 */
const COMPOSITES = new Set(['session', 'canvas', 'links', 'palette', 'pins', 'curveeditor', 'gradienteditor']);

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

/** Модуль = файл src/<имя>.ts или папка src/<имя>/. */
function modules(): { name: string; files: string[] }[] {
    return readdirSync(srcDir).map((entry) => {
        const full = join(srcDir, entry);
        if (statSync(full).isDirectory()) return { name: entry, files: walk(full) };
        return { name: entry.replace(/\.(ts|vue)$/, ''), files: [full] };
    });
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((e) => {
        const full = join(dir, e);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

/** Относительные импорты файла: 'from "./x"' и динамические import('./x'). */
function relativeImports(file: string): string[] {
    if (!/\.(ts|vue)$/.test(file)) return [];
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) => m[1]!);
}

/** В какой модуль taoux ведёт импорт (null, если в тот же модуль). */
function targetModule(file: string, spec: string, own: string): string | null {
    const abs = join(file, '..', spec);
    const rel = abs.slice(srcDir.length + 1).split(/[\\/]/)[0]!.replace(/\.(ts|vue)$/, '');
    return rel === own ? null : rel;
}

describe('ярусы модулей', () => {
    const mods = modules();

    it('примитивы ничего не импортируют из taoux', () => {
        for (const m of mods.filter((x) => !COMPOSITES.has(x.name))) {
            for (const f of m.files) expect(relativeImports(f), `${m.name}: ${f}`).toEqual([]);
        }
    });

    it('составные импортируют только примитивы', () => {
        for (const m of mods.filter((x) => COMPOSITES.has(x.name))) {
            for (const f of m.files) {
                for (const spec of relativeImports(f)) {
                    const target = targetModule(f, spec, m.name);
                    if (target === null) continue;
                    expect(COMPOSITES.has(target), `${m.name} импортирует составной модуль ${target}`).toBe(false);
                }
            }
        }
    });
});
