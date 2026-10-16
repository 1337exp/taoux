/**
 * Автосохранение в localStorage. Любая операция может не сработать: приватный режим,
 * запрет сайта, переполнение квоты. Поэтому ошибки глушим и сообщаем результатом, а не исключением.
 */
export interface SavedStorage {
    read(): string | null;
    write(text: string): boolean;
    /** Сохранённое не удалось прочитать: откладываем копию, чтобы автосохранение её не затёрло. */
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
                // нечего делать: места нет
            }
        },
    };
}
