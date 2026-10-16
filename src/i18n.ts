import { computed, ref, type ComputedRef, type Ref } from 'vue';

/** Все пути до строк словаря через точку: 'file.save', 'link.arrow', ... */
export type Paths<T, P extends string = ''> = {
    [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageArgs = readonly (string | number)[];

export interface I18nOptions<L extends Record<string, object>> {
    /** Словари по кодам языков. Остальные словари должны повторять структуру любого из них. */
    locales: L;
    /** Язык, на который падаем, если ключа нет в выбранном. */
    fallback: keyof L & string;
    /** Ключ localStorage для выбора пользователя. */
    storageKey: string;
}

function lookup(dict: unknown, path: string): string | undefined {
    let cur: unknown = dict;
    for (const part of path.split('.')) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === 'string' ? cur : undefined;
}

/**
 * Типизированный i18n на словарях-объектах. Тексты и коды языков принадлежат приложению,
 * здесь только механика: перевод с `{0}`-аргументами, запасной язык, выбор языка и его запоминание.
 *
 * `K` — тип допустимых ключей. По умолчанию это все пути словарей; сузьте, если в словаре есть
 * ветки, которые не переводятся через `t()` (например, тексты нод).
 */
export function createI18n<L extends Record<string, object>, K extends string = Paths<L[keyof L & string]>>(
    options: I18nOptions<L>,
) {
    type Code = keyof L & string;

    const { locales, fallback, storageKey } = options;
    const codes = Object.keys(locales) as Code[];
    // Явный Ref<Code>: на обобщённом типе ref() размотал бы его до any в декларациях.
    const current = ref(fallback) as Ref<Code>;

    function isLocaleCode(value: unknown): value is Code {
        return typeof value === 'string' && (codes as readonly string[]).includes(value);
    }

    /** Первый из языков браузера, который мы поддерживаем ('ru-RU' → 'ru'); иначе запасной. */
    function detectLocale(languages: readonly string[]): Code {
        for (const tag of languages) {
            const base = tag.toLowerCase().split(/[-_]/)[0];
            if (isLocaleCode(base)) return base;
        }
        return fallback;
    }

    /** Применить язык интерфейса: все `t()` в шаблонах перерисуются, `<html lang>` обновится. */
    function applyLocale(code: Code): void {
        current.value = code;
        if (typeof document !== 'undefined') document.documentElement.lang = code;
    }

    /** Применить язык и запомнить выбор пользователя. */
    function setLocale(code: Code): void {
        applyLocale(code);
        try {
            localStorage.setItem(storageKey, code);
        } catch {
            // приватный режим или запрет хранилища: язык просто не запомнится
        }
    }

    /** Язык при старте: сохранённый выбор, иначе язык браузера, иначе запасной. */
    function initLocale(): Code {
        let saved: string | null = null;
        try {
            saved = localStorage.getItem(storageKey);
        } catch {
            // см. setLocale
        }

        const code = isLocaleCode(saved)
            ? saved
            : detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages);
        applyLocale(code);
        return code;
    }

    /** Перевод без реактивности: нужен там, где язык известен явно (и в тестах). */
    function translate(code: Code, key: K, args: MessageArgs = []): string {
        // запасной вариант: запасной язык, затем сам ключ (чтобы пропуск было видно)
        const template = lookup(locales[code], key) ?? lookup(locales[fallback], key) ?? key;
        return template.replace(/\{(\d+)\}/g, (match, index: string) => {
            const value = args[Number(index)];
            return value === undefined ? match : String(value);
        });
    }

    function useI18n(): { locale: ComputedRef<Code>; t: (key: K, args?: MessageArgs) => string } {
        return {
            locale: computed(() => current.value),
            // читает current.value внутри, поэтому шаблон перерисуется при смене языка
            t: (key: K, args?: MessageArgs) => translate(current.value, key, args),
        };
    }

    return {
        codes,
        current,
        isLocaleCode,
        detectLocale,
        applyLocale,
        setLocale,
        initLocale,
        translate,
        useI18n,
    };
}
