import { ref } from 'vue';
import { MAX_ZOOM, MIN_ZOOM, type Camera } from './camera';
import { History } from './history';
import type { SavedStorage } from './storage';

export type NoticeArgs = readonly (string | number)[];

/**
 * A short message to the user. Holds a translation key: the interface builds the text.
 * Короткое сообщение пользователю. Хранит ключ перевода: текст собирает интерфейс.
 */
export interface SessionNotice<K extends string = string> {
    kind: 'info' | 'error';
    key: K;
    args?: NoticeArgs;
}

/**
 * Why opening a file was refused; the interface builds the user text from `code`.
 * Причина отказа открыть файл; текст для пользователя собирает интерфейс по `code`.
 */
export interface LoadError {
    code: string;
    detail?: string | number;
}

export type LoadResult<D> =
    | { ok: true; doc: D; view?: Camera; dropped: number }
    | { ok: false; error: LoadError };

/**
 * Message keys the session shows by itself. The app dictionary must contain them.
 * Ключи сообщений, которые сессия показывает сама. Словарь приложения обязан их содержать.
 */
export interface SessionKeys<K extends string> {
    loaded: K; // {0} is the number of items (`countItems`) / {0} — число элементов (`countItems`)
    loadedWithDropped: K; // {0} is the number of items, {1} how many entries the codec dropped / {0} — число элементов, {1} — сколько записей отбросил кодек
    newDocument: K;
    saveFailed: K;
    restoreFailed: K;
    /**
     * The key for the reason a file was refused.
     * Ключ для причины отказа открыть файл.
     */
    loadError(code: string): K;
}

export interface SessionOptions<D, K extends string> {
    /**
     * The document in the app store.
     * Документ в сторе приложения.
     */
    document: { get(): D; set(doc: D): void };
    /**
     * The view of a canvas editor: saved with the document and brought back on open. Leave it out for a document
     * without one (a list of notes): `serialize` then gets `undefined`, and a `view` from `parse` is ignored.
     * Вид редактора-холста: сохраняется с документом и возвращается при открытии. Не задавайте для документа без него
     * (список заметок): тогда `serialize` получает `undefined`, а `view` из `parse` пропускается.
     */
    camera?: { get(): Camera; set(camera: Camera): void };
    storage: SavedStorage;
    codec: {
        serialize(doc: D, view: Camera | undefined, pretty: boolean): string;
        parse(text: string): LoadResult<D>;
    };
    empty(): D;
    /**
     * How many items are in the document (nodes, notes): substituted into the message about opening a file.
     * Сколько элементов в документе (узлов, заметок): подставляется в сообщение об открытии файла.
     */
    countItems?(doc: D): number;
    /**
     * @deprecated The old name of `countItems`; still read when `countItems` is not given.
     * Старое имя `countItems`; читается, если `countItems` не задан.
     */
    countNodes?(doc: D): number;
    keys: SessionKeys<K>;
    /**
     * The document was replaced as a whole (open, new, restore): reset the selection, the drag, the palette.
     * Документ подменён целиком (открытие, новый, восстановление): сбросить выделение, протягивание, палитру.
     */
    onReset?(): void;
    /**
     * The state was restored from history (undo/redo): drop references to what is gone.
     * Состояние восстановлено из истории (undo/redo): убрать ссылки на то, чего больше нет.
     */
    onRestore?(doc: D): void;
    /**
     * The pause before autosave, ms.
     * Пауза перед автосохранением, мс.
     */
    autosaveDelay?: number;
    /**
     * How long to show a notice, ms.
     * Сколько секунд показывать уведомление, мс.
     */
    noticeMs?: number;
}

const DEFAULT_NOTICE_MS = 5000;
const DEFAULT_AUTOSAVE_MS = 400;

/**
 * The lifecycle of an editor document: history (undo/redo with merged edits), autosave guarded against storage
 * failures, opening and saving a file, restore after a reload, notices.
 * The document, the camera and the file format belong to the app, only the mechanics are here.
 * Жизненный цикл документа редактора: история (undo/redo со склейкой правок), автосохранение с защитой от сбоев
 * хранилища, открытие и сохранение файла, восстановление после перезагрузки, уведомления.
 * Документ, камера и формат файла принадлежат приложению, здесь только механика.
 */
export function createDocumentSession<D, K extends string>(options: SessionOptions<D, K>) {
    const { document: doc, camera, storage, codec, keys } = options;
    const noticeMs = options.noticeMs ?? DEFAULT_NOTICE_MS;
    const count = (d: D) => (options.countItems ?? options.countNodes)?.(d) ?? 0;
    const autosaveDelay = options.autosaveDelay ?? DEFAULT_AUTOSAVE_MS;

    //---]>
    // notices
    // уведомления

    const notice = ref<SessionNotice<K> | null>(null);
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;

    function showNotice(kind: SessionNotice<K>['kind'], key: K, args?: NoticeArgs) {
        notice.value = { kind, key, args };
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => (notice.value = null), noticeMs);
    }

    //---]>
    // autosave
    // автосохранение

    let autosaveOn = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let saveFailedShown = false;

    /**
     * Writes the document and the camera position to storage.
     * Записывает документ и положение камеры в хранилище.
     */
    function flushSave() {
        clearTimeout(saveTimer);
        saveTimer = undefined;
        if (!autosaveOn) return;

        if (storage.write(codec.serialize(doc.get(), camera?.get(), false))) {
            saveFailedShown = false;
        } else if (!saveFailedShown) {
            saveFailedShown = true; // tell once, not on every edit / сообщаем один раз, а не при каждой правке
            showNotice('error', keys.saveFailed);
        }
    }

    function scheduleSave() {
        if (!autosaveOn) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushSave, autosaveDelay);
    }

    /**
     * Turns autosave on. Off by default (nothing is written in tests and before restore).
     * Edits are saved with a small delay, and at once when the tab is hidden or closed.
     * Returns a function that turns everything off.
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
    // history
    // история

    const snapshot = () => JSON.stringify(doc.get());
    const history = new History(snapshot());
    const canUndo = ref(false);
    const canRedo = ref(false);

    function syncHistory() {
        canUndo.value = history.canUndo;
        canRedo.value = history.canRedo;
        scheduleSave(); // the document changed (an edit, undo or redo): autosave will pick it up / документ изменился (правка, undo или redo): автосохранение подхватит
    }

    /**
     * Remembers the current state as a history step. The same `key` in a row merges edits (typing text).
     * Запоминает текущее состояние как шаг истории. Одинаковый `key` подряд склеивает правки (набор текста).
     */
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

    /**
     * An action that changes the document: afterwards the state goes into history.
     * Действие, меняющее документ: после него состояние попадает в историю.
     */
    function recorded<A extends unknown[], R>(fn: (...args: A) => R, key?: (...args: A) => string): (...args: A) => R {
        return (...args) => {
            const result = fn(...args);
            commit(key?.(...args));
            return result;
        };
    }

    //---]>
    // opening, files, restore
    // открытие, файлы, восстановление

    /**
     * Replaces the document as a whole. Without `resetHistory` it is an ordinary edit: it can be undone.
     * Подменяет документ целиком. Без `resetHistory` это обычная правка: её можно отменить.
     */
    function load(next: D, view?: Camera, resetHistory = false) {
        doc.set(next);
        options.onReset?.();
        if (view && camera) camera.set({ x: view.x, y: view.y, z: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.z)) });

        if (resetHistory) {
            history.reset(snapshot());
            syncHistory();
        } else {
            commit();
        }
    }

    /**
     * The file text for download.
     * Текст файла для скачивания.
     */
    const exportText = () => codec.serialize(doc.get(), camera?.get(), true);

    /**
     * Opens a document from file text. On an error the document is unchanged. The result is shown as a notice.
     * Открывает документ из текста файла. При ошибке документ не меняется. Результат показывается уведомлением.
     */
    function importText(text: string): LoadError | null {
        const result = codec.parse(text);
        if (!result.ok) {
            const { code, detail } = result.error;
            showNotice('error', keys.loadError(code), detail === undefined ? undefined : [detail]);
            return result.error;
        }

        load(result.doc, result.view);
        const items = count(result.doc);
        if (result.dropped > 0) showNotice('error', keys.loadedWithDropped, [items, result.dropped]);
        else showNotice('info', keys.loaded, [items]);
        return null;
    }

    function newDocument() {
        load(options.empty(), { x: 0, y: 0, z: 1 });
        showNotice('info', keys.newDocument);
    }

    /**
     * At app start: brings the document back from autosave. Returns true if there was something to restore.
     * При старте приложения: поднимает документ из автосохранения. Возвращает true, если было что поднимать.
     */
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
