import { readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

// Каждый src/<имя>.ts — отдельная точка входа и отдельный subpath-экспорт (`@1337exp/taoux/<имя>`).
// Общий код rollup вынесет в chunks сам; тут главное, что модули не склеены в один бандл и режутся tree-shaking'ом.
const entries = Object.fromEntries(
    readdirSync(srcDir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .map((f) => [f.slice(0, -3), `${srcDir}/${f}`]),
);

export default defineConfig({
    build: {
        lib: { entry: entries, formats: ['es'] },
        minify: false,
        sourcemap: true,
        rollupOptions: {
            external: [/^vue(\/|$)/],
            output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
        },
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.ts'],
    },
});
