import { ref } from 'vue';
import { MAX_ZOOM, MIN_ZOOM, type Camera } from './camera';
import { History } from './history';
import type { SavedStorage } from './storage';

export type NoticeArgs = readonly (string | number)[];

/** Короткое сообщение пользователю. Хранит ключ перевода: текст собирает интерфейс. */
export interface SessionNotice<K extends string = string> {
    kind: 'info' | 'error';
    key: K;
    args?: NoticeArgs;
}

/** Причина отказа открыть файл; текст для пользователя собирает интерфейс по `code`. */
export interface LoadError {
    code: string;
    detail?: string | number;
}

export type LoadResult<D> =
    | { ok: true; doc: D; view?: Camera; dropped: number }
    | { ok: false; error: LoadError };

/** Ключи сообщений, которые сессия показывает сама. Словарь приложения обязан их содержать. */
export interface SessionKeys<K extends string> {
    loaded: K; // {0} — число нод
    loadedWithDropped: K; // {0} — число нод, {1} — сколько связей отброшено
    newDocument: K;
    saveFailed: K;
    restoreFailed: K;
    /** Ключ для причины отказа открыть файл. */
    loadError(code: string): K;
}

export interface SessionOptions<D, K extends string> {
    /** Документ в сторе приложения. */
    document: { get(): D; set(doc: D): void };
    camera: { get(): Camera; set(camera: Camera): void };
    storage: SavedStorage;
    codec: {
        serialize(doc: D, view: Camera | undefined, pretty: boolean): string;
        parse(text: string): LoadResult<D>;
    };
    empty(): D;
    /** Сколько нод в документе: подставляется в сообщение об открытии файла. */
    countNodes(doc: D): number;
    keys: SessionKeys<K>;
    /** Документ подменён целиком (открытие, новый, восстановление): сбросить выделение, протягивание, палитру. */
    onReset?(): void;
    /** Состояние восстановлено из истории (undo/redo): убрать ссылки на то, чего больше нет. */
    onRestore?(doc: D): void;
    /** Пауза перед автосохранением, мс. */
    autosaveDelay?: number;
    /** Сколько секунд показывать уведомление, мс. */
    noticeMs?: number;
}

const DEFAULT_NOTICE_MS = 5000;
const DEFAULT_AUTOSAVE_MS = 400;

/**
 * Жизненный цикл документа редактора: история (undo/redo со склейкой правок), автосохранение с защитой от сбоев
 * хранилища, открытие и сохранение файла, восстановление после перезагрузки, уведомления.
 * Документ, камера и формат файла принадлежат приложению, здесь только механика.
 */
export function createDocumentSession<D, K extends string>(options: SessionOptions<D, K>) {
    const { document: doc, camera, storage, codec, keys } = options;
    const noticeMs = options.noticeMs ?? DEFAULT_NOTICE_MS;
    const autosaveDelay = options.autosaveDelay ?? DEFAULT_AUTOSAVE_MS;

    //---]>
    // уведомления

    const notice = ref<SessionNotice<K> | null>(null);
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;

    function showNotice(kind: SessionNotice<K>['kind'], key: K, args?: NoticeArgs) {
        notice.value = { kind, key, args };
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => (notice.value = null), noticeMs);
    }

    //---]>
    // автосохранение

    let autosaveOn = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let saveFailedShown = false;

    /** Записывает документ и положение камеры в хранилище. */
    function flushSave() {
        clearTimeout(saveTimer);
        saveTimer = undefined;
        if (!autosaveOn) return;

        if (storage.write(codec.serialize(doc.get(), camera.get(), false))) {
            saveFailedShown = false;
        } else if (!saveFailedShown) {
            saveFailedShown = true; // сообщаем один раз, а не при каждой правке
            showNotice('error', keys.saveFailed);
        }
    }

    function scheduleSave() {
        if (!autosaveOn) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSave, autosaveDelay);
    }

    /**
     * Включает автосохранение. Выключено по умолчанию (в тестах и до восстановления ничего не пишется).
     * Правки сохраняются с небольшой задержкой, а при скрытии вкладки и закрытии сразу.
     * Возвращает функцию, которая всё отключает.
     */
    function startAutosave(): () => void {
        autosaveOn = true;
        const onHide = () => {
            if (document.visibilityState === 'hidden') flushSave();
        };
        window.addEventListener('pagehide', flushSave);
        document.addEventListener('visibilitychange', onHide);

        return () => {
            autosaveOn = false;
            clearTimeout(saveTimer);
            window.removeEventListener('pagehide', flushSave);
            document.removeEventListener('visibilitychange', onHide);
        };
    }

    //---]>
    // история

    const snapshot = () => JSON.stringify(doc.get());
    const history = new History(snapshot());
    const canUndo = ref(false);
    const canRedo = ref(false);

    function syncHistory() {
        canUndo.value = history.canUndo;
        canRedo.value = history.canRedo;
        scheduleSave(); // документ изменился (правка, undo или redo): автосохранение подхватит
    }

    /** Запоминает текущее состояние как шаг истории. Одинаковый `key` подряд склеивает правки (набор текста). */
    function commit(key?: string) {
        history.commit(snapshot(), key);
        syncHistory();
    }

    function restore(state: string | null): boolean {
        if (state === null) return false;

        doc.set(JSON.parse(state) as D);
        options.onRestore?.(doc.get());
        syncHistory();
        return true;
    }

    const undo = () => restore(history.undo());
    const redo = () => restore(history.redo());

    /** Действие, меняющее документ: после него состояние попадает в историю. */
    function recorded<A extends unknown[], R>(fn: (...args: A) => R, key?: (...args: A) => string): (...args: A) => R {
        return (...args) => {
            const result = fn(...args);
            commit(key?.(...args));
            return result;
        };
    }

    //---]>
    // открытие, файлы, восстановление

    /** Подменяет документ целиком. Без `resetHistory` это обычная правка: её можно отменить. */
    function load(next: D, view?: Camera, resetHistory = false) {
        doc.set(next);
        options.onReset?.();
        if (view) camera.set({ x: view.x, y: view.y, z: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.z)) });

        if (resetHistory) {
            history.reset(snapshot());
            syncHistory();
        } else {
            commit();
        }
    }

    /** Текст файла для скачивания. */
    const exportText = () => codec.serialize(doc.get(), camera.get(), true);

    /** Открывает документ из текста файла. При ошибке документ не меняется. Результат показывается уведомлением. */
    function importText(text: string): LoadError | null {
        const result = codec.parse(text);
        if (!result.ok) {
            const { code, detail } = result.error;
            showNotice('error', keys.loadError(code), detail === undefined ? undefined : [detail]);
            return result.error;
        }

        load(result.doc, result.view);
        const nodes = options.countNodes(result.doc);
        if (result.dropped > 0) showNotice('error', keys.loadedWithDropped, [nodes, result.dropped]);
        else showNotice('info', keys.loaded, [nodes]);
        return null;
    }

    function newDocument() {
        load(options.empty(), { x: 0, y: 0, z: 1 });
        showNotice('info', keys.newDocument);
    }

    /** При старте приложения: поднимает документ из автосохранения. Возвращает true, если было что поднимать. */
    function restoreSaved(): boolean {
        const text = storage.read();
        if (text === null) return false;

        const result = codec.parse(text);
        if (!result.ok) {
            storage.backupBroken(text);
            showNotice('error', keys.restoreFailed);
            return false;
        }

        load(result.doc, result.view, true);
        return true;
    }

    return {
        notice,
        showNotice,
        canUndo,
        canRedo,
        commit,
        undo,
        redo,
        recorded,
        load,
        exportText,
        importText,
        newDocument,
        restoreSaved,
        startAutosave,
        flushSave,
    };
}

export type DocumentSession<D, K extends string> = ReturnType<typeof createDocumentSession<D, K>>;
