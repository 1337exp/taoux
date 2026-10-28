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

/**
 * Why a write failed: the quota is full (the user can free space), storage is denied (private mode, site settings),
 * or something else.
 * Почему запись не удалась: квота заполнена (пользователь может освободить место), хранилище запрещено (приватный
 * режим, настройки сайта) или что-то другое.
 */
export type StorageFailure = 'quota' | 'denied' | 'unknown';

export type StorageWriteResult = { ok: true } | { ok: false; reason: StorageFailure };

/**
 * What `createSavedStorage` returns: a `SavedStorage` (so it fits `createDocumentSession` as before) and more.
 * Что возвращает `createSavedStorage`: `SavedStorage` (поэтому подходит `createDocumentSession`, как раньше) и больше.
 */
export interface KeyStorage extends SavedStorage {
    /** Like `write`, with the reason of a failure. / Как `write`, с причиной отказа. */
    tryWrite(text: string): StorageWriteResult;
    /** Removes the key; true if storage answered. / Удаляет ключ; true, если хранилище ответило. */
    remove(): boolean;
    /**
     * Calls `listener` when another tab of the same site changes this key: the new text, or null when it was removed
     * or the whole storage was cleared. The tab that writes is not told (the browser fires the event in the others).
     * Returns the function that stops listening.
     * Вызывает `listener`, когда другая вкладка того же сайта меняет этот ключ: новый текст или null, если ключ удалён
     * или хранилище очищено целиком. Пишущей вкладке не сообщается (браузер шлёт событие в остальные).
     * Возвращает функцию, которая прекращает слушать.
     */
    subscribe(listener: (text: string | null) => void): () => void;
}

/**
 * The reason behind a storage exception. Browsers name a full quota differently (`QuotaExceededError`, the old
 * Firefox `NS_ERROR_DOM_QUOTA_REACHED`, codes 22 and 1014); a ban is a `SecurityError`.
 * Причина исключения хранилища. Браузеры называют полную квоту по-разному; запрет — это `SecurityError`.
 */
export function storageFailure(error: unknown): StorageFailure {
    const e = error as { name?: string; code?: number } | null;
    if (!e) return 'unknown';
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014) return 'quota';
    if (e.name === 'SecurityError' || e.code === 18) return 'denied';
    return 'unknown';
}

export function createSavedStorage(key: string): KeyStorage {
    const brokenKey = `${key}.broken`;

    function tryWrite(text: string): StorageWriteResult {
        try {
            localStorage.setItem(key, text);
            return { ok: true };
        } catch (error) {
            return { ok: false, reason: storageFailure(error) };
        }
    }

    return {
        read() {
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        },
        write: (text) => tryWrite(text).ok,
        tryWrite,
        remove() {
            try {
                localStorage.removeItem(key);
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
        subscribe(listener) {
            if (typeof window === 'undefined') return () => {};
            let area: Storage | null = null;
            try {
                area = localStorage;
            } catch {
                return () => {}; // storage is denied: no other tab can write it either / хранилище запрещено
            }
            const onStorage = (event: StorageEvent) => {
                // the same key in sessionStorage is someone else's / тот же ключ в sessionStorage — чужой
                if (event.storageArea && event.storageArea !== area) return;
                // key null: the other tab called clear() / key null: другая вкладка вызвала clear()
                if (event.key === key) listener(event.newValue);
                else if (event.key === null) listener(null);
            };
            window.addEventListener('storage', onStorage);
            return () => window.removeEventListener('storage', onStorage);
        },
    };
}
