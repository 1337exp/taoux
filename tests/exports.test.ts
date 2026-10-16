// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const modules = readdirSync(new URL('../src', import.meta.url))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.slice(0, -3))
    .sort();

describe('package.json exports', () => {
    it('на каждый модуль в src есть subpath-экспорт и наоборот', () => {
        const exported = Object.keys(pkg.exports)
            .filter((k) => k !== './package.json')
            .map((k) => k.slice(2))
            .sort();
        expect(exported).toEqual(modules);
    });

    it('экспорты указывают на dist/<имя>.js и .d.ts', () => {
        for (const name of modules) {
            expect(pkg.exports[`./${name}`]).toEqual({ types: `./dist/${name}.d.ts`, import: `./dist/${name}.js` });
        }
    });
});
