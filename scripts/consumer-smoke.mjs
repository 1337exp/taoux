#!/usr/bin/env node
/**
 * Consumer smoke test: packs the library, installs the tarball into a throwaway Vue + Vite project
 * next to TaoUI (the way a real user does), imports the modules by their public paths and builds.
 * Catches broken `exports`, missing files, CSS that does not ship and peer-dependency trouble
 * before a release. Run after `npm run build`:
 *
 *   npm run smoke
 *
 * Needs network access for `vue`, `vite` and `@1337exp/taoui` (from the registry).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const taouiVersion = JSON.parse(readFileSync(join(root, 'node_modules/@1337exp/taoui/package.json'), 'utf8')).version;

const dir = mkdtempSync(join(tmpdir(), 'taoux-smoke-'));
const run = (cmd, cwd = dir) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });

try {
    // 1. the tarball exactly as npm would publish it
    const tgz = run('npm pack --silent --pack-destination .', root).trim().split('\n').pop();
    const packed = join(root, tgz);
    writeFileSync(join(dir, tgz), readFileSync(packed));
    rmSync(packed);

    // 2. a plain consumer project
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'smoke', private: true, type: 'module' }));
    run(`npm install vue vite @vitejs/plugin-vue @1337exp/taoui@${taouiVersion} ./${tgz}`);

    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'vite.config.js'), "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()] };\n");
    writeFileSync(join(dir, 'index.html'), '<div id="app"></div><script type="module" src="/src/main.js"></script>');
    writeFileSync(
        join(dir, 'src/main.js'),
        `import { createApp } from 'vue';
import App from './App.vue';
import '@1337exp/taoui/styles.css';
import '@1337exp/taoux/taoui.css';
import '@1337exp/taoux/curveeditor.css';
import '@1337exp/taoux/curvefield.css';
import '@1337exp/taoux/gradienteditor.css';
import '@1337exp/taoux/canvas.css';
import '@1337exp/taoux/links.css';
createApp(App).mount('#app');
`,
    );

    // 3. every JS module in package.json exports, imported by its public path
    const subpaths = Object.keys(pkg.exports).filter((k) => !k.endsWith('.css') && k !== './package.json');
    const imports = subpaths.map((k, i) => `import * as m${i} from '@1337exp/taoux/${k.slice(2)}';`).join('\n');
    const uses = subpaths.map((_, i) => `m${i}`).join(', ');
    writeFileSync(
        join(dir, 'src/App.vue'),
        `<script setup>
import { ref } from 'vue';
import { TaoTimeline } from '@1337exp/taoui';
${imports}
const mods = [${uses}];
const clip = m${subpaths.indexOf('./playback')}.usePlayback({ length: 8 });
const points = ref([{ t: 0, v: 0 }, { t: 1, v: 1 }]);
const stops = ref([{ t: 0, color: [1, 1, 1], alpha: 1 }, { t: 1, color: [0, 0, 0], alpha: 1 }]);
</script>
<template>
  <p>{{ mods.length }}</p>
  <TaoTimeline v-model="clip.time.value" v-model:playing="clip.playing.value" :length="8" />
  <m${subpaths.indexOf('./curvefield')}.TaoxCurveField v-model="points" />
  <m${subpaths.indexOf('./gradienteditor')}.TaoxGradientEditor v-model="stops" />
</template>
`,
    );

    run('npx vite build');

    // 4. the stylesheets really shipped
    const assets = join(dir, 'dist/assets');
    const css = readdirSync(assets)
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(join(assets, f), 'utf8'))
        .join('\n');
    for (const needle of ['.tx-curve', '.tx-gradient', '--tx-curve-bg:var(--tao-color-surface-sunken)']) {
        if (!css.replace(/\s/g, '').includes(needle.replace(/\s/g, ''))) throw new Error(`built CSS lacks ${needle}`);
    }
    console.log(`smoke ok: ${subpaths.length} modules imported by public path, app built, CSS shipped (TaoUI ${taouiVersion})`);
} finally {
    rmSync(dir, { recursive: true, force: true });
}
