import { createSavedStorage, type KeyStorage } from '../storage';

/**
 * What a user has already seen of a tour, kept in localStorage under `key`, so a tour does not come back at every visit.
 * Storage may be forbidden (private mode): then nothing is remembered and nothing throws.
 * Что пользователь уже видел из тура; лежит в localStorage под ключом `key`, чтобы тур не возвращался при каждом визите.
 * Хранилище может быть запрещено (приватный режим): тогда ничего не запоминается и ничего не бросает исключений.
 */
export interface TourMemory {
    /** Whether the tour was ended (done or skipped) before. / Заканчивали ли тур раньше. */
    seen(): boolean;
    /** Remembers that the tour was ended. / Запоминает, что тур закончен. */
    markSeen(): boolean;
    /** Forgets it: the tour can show again ("show the tour once more" in a menu). / Забывает: тур снова можно показать. */
    reset(): boolean;
}

export function createTourMemory(key: string, storage: KeyStorage = createSavedStorage(key)): TourMemory {
    return {
        seen: () => storage.read() === '1',
        markSeen: () => storage.write('1'),
        reset: () => storage.remove(),
    };
}
