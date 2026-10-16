import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { ComputedRef } from 'vue';
import { createI18n } from '../src/i18n';

const locales = {
    ru: { file: { save: 'Сохранить' }, run: { limit: 'Лимит ({0})' }, onlyRu: 'только ру' },
    en: { file: { save: 'Save' }, run: { limit: 'Limit ({0})' }, onlyRu: 'only ru' },
} as const;

const make = () => createI18n({ locales, fallback: 'en', storageKey: 'test.locale' });

afterEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
});

describe('translate', () => {
    const i18n = make();

    it('переводит по пути и подставляет аргументы', () => {
        expect(i18n.translate('ru', 'file.save')).toBe('Сохранить');
        expect(i18n.translate('en', 'run.limit', [100])).toBe('Limit (100)');
    });

    it('оставляет плейсхолдер, если аргумента нет', () => {
        expect(i18n.translate('en', 'run.limit')).toBe('Limit ({0})');
    });

    it('падает на запасной язык, затем на сам ключ', () => {
        const partial = createI18n({
            locales: { ru: { a: 'а' } as Record<string, string>, en: { a: 'a', b: 'b' } as Record<string, string> },
            fallback: 'en',
            storageKey: 'x',
        });
        expect(partial.translate('ru', 'b')).toBe('b');
        expect(partial.translate('ru', 'missing')).toBe('missing');
    });
});

describe('detectLocale', () => {
    const { detectLocale } = make();

    it('берёт первый поддерживаемый язык браузера', () => {
        expect(detectLocale(['de-DE', 'ru-RU', 'en-US'])).toBe('ru');
        expect(detectLocale(['en_GB'])).toBe('en');
    });

    it('без совпадений — запасной', () => {
        expect(detectLocale(['de', 'fr'])).toBe('en');
        expect(detectLocale([])).toBe('en');
    });
});

describe('типы', () => {
    it('код языка и ключи выводятся из словарей', () => {
        const { useI18n, translate } = make();
        expectTypeOf(useI18n().locale).toEqualTypeOf<ComputedRef<'ru' | 'en'>>();
        expectTypeOf(translate).parameter(1).toEqualTypeOf<'file.save' | 'run.limit' | 'onlyRu'>();
    });
});

describe('выбор языка', () => {
    it('setLocale применяет язык, запоминает его и ставит <html lang>', () => {
        const i18n = make();
        i18n.setLocale('ru');
        expect(i18n.current.value).toBe('ru');
        expect(localStorage.getItem('test.locale')).toBe('ru');
        expect(document.documentElement.lang).toBe('ru');
    });

    it('initLocale берёт сохранённый выбор, иначе язык браузера', () => {
        localStorage.setItem('test.locale', 'ru');
        expect(make().initLocale()).toBe('ru');

        localStorage.setItem('test.locale', 'xx'); // мусор игнорируем
        const code = make().initLocale();
        expect(i18nCodes).toContain(code);
    });

    it('useI18n реагирует на смену языка', () => {
        const i18n = make();
        const { t, locale } = i18n.useI18n();
        i18n.applyLocale('ru');
        expect(locale.value).toBe('ru');
        expect(t('file.save')).toBe('Сохранить');
        i18n.applyLocale('en');
        expect(t('file.save')).toBe('Save');
    });
});

const i18nCodes = ['ru', 'en'];
