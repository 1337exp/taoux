// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The skill an AI assistant reads (skills/taoux) names every module and ships with the package.
// Skill для ИИ-ассистента называет каждый модуль и едет вместе с пакетом.

const root = fileURLToPath(new URL('..', import.meta.url));
const skill = readFileSync(join(root, 'skills/taoux/SKILL.md'), 'utf8');
const srcDir = join(root, 'src');
const modules = readdirSync(srcDir).flatMap((entry) => {
    const full = join(srcDir, entry);
    if (statSync(full).isDirectory()) {
        return existsSync(join(full, 'index.ts')) ? [entry] : [];
    }
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [entry.slice(0, -3)] : [];
});

describe('skills/taoux', () => {
    it('has a name and a description that says when to use it', () => {
        const front = /^---\n([\s\S]*?)\n---/.exec(skill.replace(/\r\n/g, '\n'))?.[1] ?? '';
        expect(front).toMatch(/^name: taoux$/m);
        expect(/^description: (.+)$/m.exec(front)?.[1]).toContain('Use when');
    });

    it('names every module as an import', () => {
        expect(modules.length).toBeGreaterThan(20);
        const missing = modules.filter((name) => !skill.includes(`| \`${name}\``));
        expect(missing).toEqual([]);
    });

    it('ships with the package', () => {
        expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).files).toContain('skills');
    });
});
