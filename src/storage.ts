/**
 * Autosave to localStorage. Any operation may fail: private mode, a site-level ban, a full quota.
 * So errors are swallowed and reported as a result, not thrown.
 * Автосохранение в localStorage. Любая операция может не сработать: приватный режим,
 * запрет сайта, переполнение квоты. Поэтому ошибки глушим и сообщаем результатом, а не исключением.
 */
export interface SavedStorage {
    read(): string | null;
    write(text: string): boolean;
    /**
     * What was saved could not be read: the copy is set aside so autosave does not overwrite it.
     * Сохранённое не удалось прочитать: откладываем копию, чтобы автосохранение её не затёрло.
     */
    backupBroken(text: string): void;
}

export function createSavedStorage(key: string): SavedStorage {
    const brokenKey = `${key}.broken`;

    return {
        read() {
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        },
        write(text) {
            try {
                localStorage.setItem(key, text);
                return true;
            } catch {
                return false;
            }
        },
        backupBroken(text) {
            try {
                localStorage.setItem(brokenKey, text);
            } catch {
                // nothing to do: there is no room
                // нечего делать: места нет
            }
        },
    };
}
