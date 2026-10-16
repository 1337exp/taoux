// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

interface Module {
    name: string;
    /** Папка с index.ts (Vue-модули и составные) или одиночный файл. */
    dir: boolean;
    /** Есть ли в модуле Vue-компоненты, то есть стили. */
    hasVue: boolean;
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((e) => {
        const full = join(dir, e);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

const modules: Module[] = readdirSync(srcDir)
    .flatMap((entry): Module[] => {
        const full = join(srcDir, entry);
        if (statSync(full).isDirectory()) {
            return existsSync(join(full, 'index.ts')) ? [{ name: entry, dir: true, hasVue: walk(full).some((f) => f.endsWith('.vue')) }] : [];
        }
        return entry.endsWith('.ts') ? [{ name: entry.slice(0, -3), dir: false, hasVue: false }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

describe('package.json exports', () => {
    it('на каждый модуль в src есть subpath-экспорт и наоборот', () => {
        const exported = Object.keys(pkg.exports)
            .filter((k) => k !== './package.json' && !k.endsWith('.css'))
            .map((k) => k.slice(2))
            .sort();
        expect(exported).toEqual(modules.map((m) => m.name));
    });

    it('экспорты указывают на dist/<имя>.js и соответствующий .d.ts', () => {
        for (const m of modules) {
            const types = m.dir ? `./dist/${m.name}/index.d.ts` : `./dist/${m.name}.d.ts`;
            expect(pkg.exports[`./${m.name}`], m.name).toEqual({ types, import: `./dist/${m.name}.js` });
        }
    });

    it('у модулей с Vue-компонентами есть экспорт стилей, у остальных его нет', () => {
        for (const m of modules) {
            const css = pkg.exports[`./${m.name}.css`];
            if (m.hasVue) expect(css, m.name).toBe(`./dist/${m.name}.css`);
            else expect(css, m.name).toBeUndefined();
        }
    });
});
