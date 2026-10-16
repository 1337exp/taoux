<script lang="ts" setup>
import { TaoSegmented, TaoSegmentedOption } from '@1337exp/taoui';
import { ref, watch } from 'vue';

// Общая обёртка страниц песочницы: заголовок, ссылка на список и переключатель темы TaoUI.
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
                <a class="back" href="./index.html">taoux · sandbox</a>
                <h1>{{ title }}</h1>
            </div>
            <TaoSegmented v-model="theme" size="small">
                <TaoSegmentedOption value="dark" label="Dark" />
                <TaoSegmentedOption value="light" label="Light" />
            </TaoSegmented>
        </header>
        <p v-if="note" class="muted">{{ note }}</p>
        <slot />
    </main>
</template>

<style>
:root {
    /* Модули taoux настраиваются своими переменными; песочница связывает их с токенами TaoUI, как это делают продукты. */
    --tx-curve-bg: var(--tao-color-surface-sunken);
    --tx-curve-border: var(--tao-color-border);
    --tx-curve-grid: var(--tao-color-border);
    --tx-curve-label: var(--tao-color-text-muted);
    --tx-curve-accent: var(--tao-color-accent);
    --tx-gradient-border: var(--tao-color-border);
    --tx-gradient-stop-border: var(--tao-color-text-muted);
    --tx-gradient-stop-bg: var(--tao-color-surface-sunken);
    --tx-gradient-accent: var(--tao-color-accent);
}

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
