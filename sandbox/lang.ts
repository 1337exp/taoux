import { setTaoLocale, localeEn, localeRu } from '@1337exp/taoui';
import { ref, watch } from 'vue';

/**
 * Sandbox language: `?lang=ru`, else the saved choice, else the browser language, else English.
 * The built-in texts of TaoUI follow it (`setTaoLocale`).
 */
export const LANGS = ['en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];

const KEY = 'taoux.sandbox.lang';
const isLang = (v: unknown): v is Lang => (LANGS as readonly unknown[]).includes(v);

function detect(): Lang {
    try {
        const fromUrl = new URLSearchParams(location.search).get('lang');
        if (isLang(fromUrl)) return fromUrl;
        const saved = localStorage.getItem(KEY);
        if (isLang(saved)) return saved;
    } catch {
        /* storage blocked: browser language below */
    }
    return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export const lang = ref<Lang>(detect());

watch(
    lang,
    (value) => {
        document.documentElement.lang = value;
        setTaoLocale(value === 'ru' ? localeRu : localeEn);
        try {
            localStorage.setItem(KEY, value);
        } catch {
            /* not worth failing over */
        }
    },
    { immediate: true },
);

/** A text in the current language: `tr('Reset', 'Сбросить')`. A missing one falls back to the other. */
export function tr(en: string, ru?: string): string {
    return (lang.value === 'ru' ? (ru ?? en) : en) ?? '';
}
