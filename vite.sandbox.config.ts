import { readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('./sandbox', import.meta.url));

// Песочница: страницы из sandbox/ подключают модули прямо из src/, без сборки dist.
// Запуск: npm run sandbox. Новая страница = sandbox/<имя>.html + ссылка в sandbox/index.html.
// Sandbox: the pages in sandbox/ import the modules straight from src/, no dist build.
// `npm run sandbox:build` makes a static copy (sandbox/dist) with relative paths: drop it into any folder, e.g. /sandbox/taoux/.
export default defineConfig({
    root,
    base: './',
    plugins: [vue()],
    server: { port: 5300, open: false },
    resolve: { dedupe: ['vue'] },
    build: {
        rollupOptions: {
            input: Object.fromEntries(readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => [f.slice(0, -5), `${root}/${f}`])),
        },
    },
});
