import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

// Модуль = файл src/<имя>.ts или папка src/<имя>/ с index.ts. Каждый модуль: отдельная точка входа и subpath-экспорт
// (`@1337exp/taoux/<имя>`). Общий код rollup вынесет в chunks сам; главное, что модули не склеены в один бандл
// и режутся tree-shaking'ом. Стили Vue-модулей лежат рядом: dist/<имя>.css.
const entries: Record<string, string> = {};
for (const entry of readdirSync(srcDir)) {
    const full = `${srcDir}/${entry}`;
    if (statSync(full).isDirectory()) {
        if (existsSync(`${full}/index.ts`)) entries[entry] = `${full}/index.ts`;
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        entries[entry.slice(0, -3)] = full;
    }
}

export default defineConfig({
    plugins: [vue()],
    build: {
        lib: { entry: entries, formats: ['es'] },
        cssCodeSplit: true,
        minify: false,
        sourcemap: true,
        rollupOptions: {
            external: [/^vue(\/|$)/, /^@1337exp\/taoui(\/|$)/],
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: '[name][extname]',
            },
        },
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.ts'],
    },
});
