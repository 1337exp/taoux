<script lang="ts" setup>
import { TaoSegmented, TaoSegmentedOption } from '@1337exp/taoui';
import { ref, watch } from 'vue';
import '../theme/taoui.css';
import { lang, LANGS, tr } from './lang';

// Shared wrapper of the sandbox pages: title, link to the index, language and TaoUI theme switches.
// Общая обёртка страниц песочницы: заголовок, ссылка на список, переключатели языка и темы TaoUI.
defineProps<{ title: string; note?: string }>();

const KEY = 'taoux.sandbox.theme';
const read = () => {
    try {
        return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
};

const theme = ref<'dark' | 'light'>(read());

watch(
    theme,
    (t) => {
        if (t === 'light') document.documentElement.dataset.taoTheme = 'light';
        else delete document.documentElement.dataset.taoTheme;
        try {
            localStorage.setItem(KEY, t);
        } catch {
            /* без хранилища тема просто не запоминается */
        }
    },
    { immediate: true },
);
</script>

<template>
    <main class="page">
        <header class="head">
            <div>
                <a class="back" href="./index.html">{{ tr('taoux · sandbox', 'taoux · песочница') }}</a>
                <h1>{{ title }}</h1>
            </div>
            <div class="switches">
                <TaoSegmented v-model="lang" size="small" :aria-label="tr('Language', 'Язык')">
                    <TaoSegmentedOption v-for="code in LANGS" :key="code" :value="code" :label="code.toUpperCase()" />
                </TaoSegmented>
                <TaoSegmented v-model="theme" size="small" :aria-label="tr('Theme', 'Тема')">
                    <TaoSegmentedOption value="dark" label="Dark" />
                    <TaoSegmentedOption value="light" label="Light" />
                </TaoSegmented>
            </div>
        </header>
        <p v-if="note" class="muted">{{ note }}</p>
        <slot />
    </main>
</template>

<style>
html,
body {
    margin: 0;
    min-height: 100%;
}

body {
    background: var(--tao-color-bg);
    color: var(--tao-color-text);
    font: 14px/1.4 system-ui, sans-serif;
}

* {
    box-sizing: border-box;
}

.page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px 16px;
}

.head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.switches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.head h1 {
    margin: 2px 0 8px;
    font-size: 20px;
}

.back {
    color: var(--tao-color-text-muted);
    font-size: 12px;
    text-decoration: none;
}

.back:hover {
    color: var(--tao-color-accent);
}

.muted {
    color: var(--tao-color-text-muted);
}

pre {
    white-space: pre-wrap;
    word-break: break-all;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    margin-top: 16px;
}

.case {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--tao-color-border);
    border-radius: 8px;
    background: var(--tao-color-surface);
}

.case h2 {
    margin: 0;
    font-size: 13px;
}

.case h2 small {
    margin-left: 6px;
    color: var(--tao-color-text-muted);
    font-weight: 400;
}

.case pre {
    margin: 0;
    color: var(--tao-color-text-muted);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
}

.row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.row .grow {
    flex: 1;
}
</style>
