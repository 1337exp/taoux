import { computed, ref, type ComputedRef, type Ref } from 'vue';

/**
 * All dot-separated paths to dictionary strings: 'file.save', 'link.arrow', ...
 * Все пути до строк словаря через точку: 'file.save', 'link.arrow', ...
 */
export type Paths<T, P extends string = ''> = {
    [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageArgs = readonly (string | number)[];

export interface I18nOptions<L extends Record<string, object>> {
    /**
     * Dictionaries by language code. The other dictionaries must repeat the structure of any one of them.
     * Словари по кодам языков. Остальные словари должны повторять структуру любого из них.
     */
    locales: L;
    /**
     * The language to fall back to when the key is missing in the chosen one.
     * Язык, на который падаем, если ключа нет в выбранном.
     */
    fallback: keyof L & string;
    /**
     * The localStorage key for the user's choice.
     * Ключ localStorage для выбора пользователя.
     */
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
 * Typed i18n on object dictionaries. Texts and language codes belong to the app,
 * only the mechanics are here: translation with `{0}` arguments, a fallback language, language choice and remembering it.
 * Типизированный i18n на словарях-объектах. Тексты и коды языков принадлежат приложению,
 * здесь только механика: перевод с `{0}`-аргументами, запасной язык, выбор языка и его запоминание.
 *
 * `K` is the type of allowed keys. By default it is all dictionary paths; narrow it if the dictionary has
 * branches that are not translated through `t()` (for example, node texts).
 * `K` — тип допустимых ключей. По умолчанию это все пути словарей; сузьте, если в словаре есть
 * ветки, которые не переводятся через `t()` (например, тексты нод).
 */
export function createI18n<L extends Record<string, object>, K extends string = Paths<L[keyof L & string]>>(
    options: I18nOptions<L>,
) {
    type Code = keyof L & string;

    const { locales, fallback, storageKey } = options;
    const codes = Object.keys(locales) as Code[];
    // An explicit Ref<Code>: on a generic type ref() would unwrap it to any in the declarations.
    // Явный Ref<Code>: на обобщённом типе ref() размотал бы его до any в декларациях.
    const current = ref(fallback) as Ref<Code>;

    function isLocaleCode(value: unknown): value is Code {
        return typeof value === 'string' && (codes as readonly string[]).includes(value);
    }

    /**
     * The first browser language we support ('ru-RU' → 'ru'); otherwise the fallback.
     * Первый из языков браузера, который мы поддерживаем ('ru-RU' → 'ru'); иначе запасной.
     */
    function detectLocale(languages: readonly string[]): Code {
        for (const tag of languages) {
            const base = tag.toLowerCase().split(/[-_]/)[0];
            if (isLocaleCode(base)) return base;
        }
        return fallback;
    }

    /**
     * Apply the interface language: every `t()` in templates re-renders, `<html lang>` is updated.
     * Применить язык интерфейса: все `t()` в шаблонах перерисуются, `<html lang>` обновится.
     */
    function applyLocale(code: Code): void {
        current.value = code;
        if (typeof document !== 'undefined') document.documentElement.lang = code;
    }

    /**
     * Apply the language and remember the user's choice.
     * Применить язык и запомнить выбор пользователя.
     */
    function setLocale(code: Code): void {
        applyLocale(code);
        try {
            localStorage.setItem(storageKey, code);
        } catch {
            // private mode or storage is blocked: the language is simply not remembered
            // приватный режим или запрет хранилища: язык просто не запомнится
        }
    }

    /**
     * The language at start: the saved choice, else the browser language, else the fallback.
     * Язык при старте: сохранённый выбор, иначе язык браузера, иначе запасной.
     */
    function initLocale(): Code {
        let saved: string | null = null;
        try {
            saved = localStorage.getItem(storageKey);
        } catch {
            // see setLocale
            // см. setLocale
        }

        const code = isLocaleCode(saved)
            ? saved
            : detectLocale(typeof navigator === 'undefined' ? [] : navigator.languages);
        applyLocale(code);
        return code;
    }

    /**
     * Translation without reactivity: for places where the language is known explicitly (and in tests).
     * Перевод без реактивности: нужен там, где язык известен явно (и в тестах).
     */
    function translate(code: Code, key: K, args: MessageArgs = []): string {
        // the fallback: the fallback language, then the key itself (so that a gap is visible)
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
            // reads current.value inside, so the template re-renders when the language changes
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
