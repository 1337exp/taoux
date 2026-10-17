// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
        const full = join(dir, e);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });

const bridge = read('theme/taoui.css');
const mapped = new Map([...bridge.matchAll(/(--tx-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

// Everything the components read: `var(--tx-...)`
const used = new Set(
    walk(join(root, 'src'))
        .filter((f) => /\.(vue|ts)$/.test(f))
        .flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/var\((--tx-[a-z0-9-]+)/g)].map((m) => m[1]!)),
);

/** Colour variables: what the bridge is for. Sizes, widths and opacities stay with the module. */
const isColour = (name: string) => /-(bg|border|grid|label|text|accent|accent-subtle|color|outline|minor|major)$/.test(name) && !name.endsWith('-line-color');

describe('theme/taoui.css (the TaoUI bridge)', () => {
    it('maps every colour variable the components read', () => {
        const missing = [...used].filter((name) => isColour(name) && !mapped.has(name));
        expect(missing).toEqual([]);
    });

    it('maps only variables that exist', () => {
        const unknown = [...mapped.keys()].filter((name) => !used.has(name));
        expect(unknown).toEqual([]);
    });

    it('points only at TaoUI tokens that the installed TaoUI defines', () => {
        const semantic = read('node_modules/@1337exp/taoui/src/styles/semantic.css');
        const defined = new Set([...semantic.matchAll(/(--tao-[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
        const referenced = [...bridge.matchAll(/var\((--tao-[a-z0-9-]+)/g)].map((m) => m[1]!);
        expect(referenced.filter((name) => !defined.has(name))).toEqual([]);
    });

    it('is shipped: exported and listed in files', () => {
        const pkg = JSON.parse(read('package.json'));
        expect(pkg.exports['./taoui.css']).toBe('./theme/taoui.css');
        expect(pkg.files).toContain('theme');
    });
});
