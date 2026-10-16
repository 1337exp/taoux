import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Песочница: страницы из sandbox/ подключают модули прямо из src/, без сборки dist.
// Запуск: npm run sandbox. Новая страница = sandbox/<имя>.html + ссылка в sandbox/index.html.
export default defineConfig({
    root: fileURLToPath(new URL('./sandbox', import.meta.url)),
    plugins: [vue()],
    server: { port: 5300, open: false },
    resolve: { dedupe: ['vue'] },
});
