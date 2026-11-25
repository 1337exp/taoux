import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sampleCurve } from '../src/curveops';

// The sampling of a curve for a game or a worker that has no Vue: `@1337exp/taoux/curveops` pulls nothing of Vue, not even through its imports.
// Выборка кривой для игры или воркера без Vue: `@1337exp/taoux/curveops` не тянет Vue даже через свои импорты.

function importsOf(file: string, seen = new Set<string>()): string[] {
    if (seen.has(file)) return [];
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const found: string[] = [];
    for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)) {
        const spec = match[1]!;
        if (spec.startsWith('.')) {
            const base = resolve(dirname(file), spec);
            const target = [`${base}.ts`, `${base}/index.ts`].find((p) => { try { readFileSync(p); return true; } catch { return false; } });
            found.push(spec.endsWith('.vue') ? spec : spec);
            if (target) found.push(...importsOf(target, seen));
        } else {
            found.push(spec);
        }
    }
    return found;
}

describe('curveops', () => {
    it('samples a curve', () => {
        const points = [{ t: 0, v: 0 }, { t: 1, v: 10 }];
        expect(sampleCurve(points, 0)).toBe(0);
        expect(sampleCurve(points, 1)).toBe(10);
        expect(sampleCurve(points, 0.5)).toBeGreaterThan(0);
    });

    it('imports nothing of Vue, directly or through the modules it uses', () => {
        const all = importsOf(resolve(__dirname, '../src/curveops.ts'));
        expect(all.filter((spec) => spec === 'vue' || spec.endsWith('.vue') || spec.startsWith('@1337exp'))).toEqual([]);
    });
});
