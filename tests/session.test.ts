import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createDocumentSession, type LoadResult } from '../src/session';
import { createSavedStorage } from '../src/storage';

interface Doc {
    items: string[];
}

type Key = 'loaded' | 'dropped' | 'new' | 'saveFailed' | 'restoreFailed' | `error.${string}`;

const keys = {
    loaded: 'loaded',
    loadedWithDropped: 'dropped',
    newDocument: 'new',
    saveFailed: 'saveFailed',
    restoreFailed: 'restoreFailed',
    loadError: (code: string): Key => `error.${code}`,
} as const;

function setup(overrides: { dropped?: number } = {}) {
    const doc = ref<Doc>({ items: [] });
    const camera = ref({ x: 0, y: 0, z: 1 });
    const storage = createSavedStorage('test.doc');
    const onReset = vi.fn();
    const onRestore = vi.fn();

    const session = createDocumentSession<Doc, Key>({
        document: { get: () => doc.value, set: (d) => (doc.value = d) },
        camera: { get: () => camera.value, set: (c) => (camera.value = c) },
        storage,
        codec: {
            serialize: (d, view, pretty) => JSON.stringify({ d, view }, null, pretty ? 2 : undefined),
            parse(text): LoadResult<Doc> {
                try {
                    const raw = JSON.parse(text) as { d?: Doc; view?: { x: number; y: number; z: number } };
                    if (!raw.d) return { ok: false, error: { code: 'notOurFile' } };
                    return { ok: true, doc: raw.d, view: raw.view, dropped: overrides.dropped ?? 0 };
                } catch {
                    return { ok: false, error: { code: 'invalidJson', detail: 'x' } };
                }
            },
        },
        empty: () => ({ items: [] }),
        countNodes: (d) => d.items.length,
        keys,
        onReset,
        onRestore,
    });
    return { doc, camera, storage, session, onReset, onRestore };
}

const add = (doc: { value: Doc }, item: string) => doc.value.items.push(item);

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('история', () => {
    it('commit, undo и redo идут по состояниям документа', () => {
        const { doc, session, onRestore } = setup();
        expect(session.canUndo.value).toBe(false);

        add(doc, 'a');
        session.commit();
        add(doc, 'b');
        session.commit();
        expect(session.canUndo.value).toBe(true);

        expect(session.undo()).toBe(true);
        expect(doc.value.items).toEqual(['a']);
        expect(onRestore).toHaveBeenCalledWith({ items: ['a'] });
        expect(session.canRedo.value).toBe(true);

        session.redo();
        expect(doc.value.items).toEqual(['a', 'b']);
        expect(session.redo()).toBe(false);
    });

    it('одинаковый key подряд склеивает правки в один шаг', () => {
        const { doc, session } = setup();
        add(doc, 'a');
        session.commit('typing');
        add(doc, 'b');
        session.commit('typing');
        session.undo();
        expect(doc.value.items).toEqual([]);
    });

    it('recorded фиксирует результат действия в истории', () => {
        const { doc, session } = setup();
        const addItem = session.recorded((item: string) => add(doc, item));
        addItem('x');
        expect(session.canUndo.value).toBe(true);
        session.undo();
        expect(doc.value.items).toEqual([]);
    });
});

describe('автосохранение', () => {
    it('по умолчанию выключено', () => {
        const { doc, session, storage } = setup();
        add(doc, 'a');
        session.commit();
        vi.advanceTimersByTime(2000);
        expect(storage.read()).toBeNull();
    });

    it('пишет с задержкой, склеивая подряд идущие правки', () => {
        const { doc, session, storage } = setup();
        const stop = session.startAutosave();
        add(doc, 'a');
        session.commit();
        add(doc, 'b');
        session.commit();
        expect(storage.read()).toBeNull();
        vi.advanceTimersByTime(400);
        expect(JSON.parse(storage.read()!).d.items).toEqual(['a', 'b']);
        stop();
    });

    it('при закрытии вкладки пишет сразу, а после stop больше не пишет', () => {
        const { doc, session, storage } = setup();
        const stop = session.startAutosave();
        add(doc, 'a');
        session.commit();
        window.dispatchEvent(new Event('pagehide'));
        expect(storage.read()).not.toBeNull();

        stop();
        localStorage.clear();
        add(doc, 'b');
        session.commit();
        vi.advanceTimersByTime(1000);
        expect(storage.read()).toBeNull();
    });

    it('сбой хранилища показывается один раз, а не при каждой правке', () => {
        const { doc, session } = setup();
        const fail = () => {
            throw new Error('quota');
        };
        vi.stubGlobal('localStorage', { getItem: () => null, setItem: fail });
        session.startAutosave();

        add(doc, 'a');
        session.commit();
        vi.advanceTimersByTime(400);
        expect(session.notice.value).toMatchObject({ kind: 'error', key: 'saveFailed' });

        session.notice.value = null;
        add(doc, 'b');
        session.commit();
        vi.advanceTimersByTime(400);
        expect(session.notice.value).toBeNull();
    });
});

describe('файлы и восстановление', () => {
    it('экспорт содержит документ и камеру', () => {
        const { doc, camera, session } = setup();
        add(doc, 'a');
        camera.value = { x: 5, y: 6, z: 1.5 };
        expect(JSON.parse(session.exportText())).toEqual({ d: { items: ['a'] }, view: { x: 5, y: 6, z: 1.5 } });
    });

    it('открывает файл, ограничивает масштаб, сбрасывает выделение и пишет уведомление', () => {
        const { doc, camera, session, onReset } = setup();
        const text = JSON.stringify({ d: { items: ['a', 'b'] }, view: { x: 1, y: 2, z: 99 } });

        expect(session.importText(text)).toBeNull();
        expect(doc.value.items).toEqual(['a', 'b']);
        expect(camera.value).toEqual({ x: 1, y: 2, z: 2 }); // MAX_ZOOM
        expect(onReset).toHaveBeenCalled();
        expect(session.notice.value).toEqual({ kind: 'info', key: 'loaded', args: [2] });

        session.undo(); // открытие файла можно отменить
        expect(doc.value.items).toEqual([]);
    });

    it('сообщает об отброшенных связях', () => {
        const { session } = setup({ dropped: 3 });
        session.importText(JSON.stringify({ d: { items: ['a'] } }));
        expect(session.notice.value).toEqual({ kind: 'error', key: 'dropped', args: [1, 3] });
    });

    it('при ошибке документ не меняется, а причина идёт в уведомление', () => {
        const { doc, session } = setup();
        add(doc, 'keep');
        const err = session.importText('{not json');
        expect(err).toEqual({ code: 'invalidJson', detail: 'x' });
        expect(doc.value.items).toEqual(['keep']);
        expect(session.notice.value).toEqual({ kind: 'error', key: 'error.invalidJson', args: ['x'] });
    });

    it('новый документ пустой и с камерой по умолчанию', () => {
        const { doc, camera, session } = setup();
        add(doc, 'a');
        camera.value = { x: 9, y: 9, z: 1.2 };
        session.newDocument();
        expect(doc.value.items).toEqual([]);
        expect(camera.value).toEqual({ x: 0, y: 0, z: 1 });
        expect(session.notice.value?.key).toBe('new');
    });

    it('восстанавливает автосохранённое без шага в истории', () => {
        const first = setup();
        first.storage.write(JSON.stringify({ d: { items: ['saved'] }, view: { x: 3, y: 4, z: 1 } }));

        const { doc, camera, session } = setup();
        expect(session.restoreSaved()).toBe(true);
        expect(doc.value.items).toEqual(['saved']);
        expect(camera.value.x).toBe(3);
        expect(session.canUndo.value).toBe(false);
    });

    it('сломанное сохранение откладывает копию и не затирает автосохранением', () => {
        const { storage, session, doc } = setup();
        storage.write('garbage');
        expect(session.restoreSaved()).toBe(false);
        expect(localStorage.getItem('test.doc.broken')).toBe('garbage');
        expect(session.notice.value?.key).toBe('restoreFailed');
        expect(doc.value.items).toEqual([]);
    });

    it('без сохранения restoreSaved возвращает false и ничего не показывает', () => {
        const { session } = setup();
        expect(session.restoreSaved()).toBe(false);
        expect(session.notice.value).toBeNull();
    });

    it('уведомление гаснет само', () => {
        const { session } = setup();
        session.showNotice('info', 'loaded', [1]);
        expect(session.notice.value).not.toBeNull();
        vi.advanceTimersByTime(5000);
        expect(session.notice.value).toBeNull();
    });
});

describe('a document without a camera (a list of notes)', () => {
    function listSession() {
        const doc = ref<Doc>({ items: [] });
        const views: unknown[] = [];
        const session = createDocumentSession<Doc, Key>({
            document: { get: () => doc.value, set: (d) => (doc.value = d) },
            storage: createSavedStorage('test.list'),
            codec: {
                serialize: (d, view) => {
                    views.push(view);
                    return JSON.stringify(d);
                },
                parse: (text): LoadResult<Doc> => ({ ok: true, doc: JSON.parse(text) as Doc, view: { x: 5, y: 5, z: 2 }, dropped: 0 }),
            },
            empty: () => ({ items: [] }),
            countItems: (d) => d.items.length,
            keys,
        });
        return { doc, session, views };
    }

    it('saves and exports without a view, and ignores a view from the file', () => {
        const { doc, session, views } = listSession();
        session.startAutosave();
        doc.value.items.push('note');
        session.commit();
        vi.runAllTimers();
        session.exportText();
        expect(views).toEqual([undefined, undefined]);
        expect(session.importText('{"items":["a","b"]}')).toBeNull();
        expect(doc.value.items).toEqual(['a', 'b']);
    });

    it('countItems fills the message; the old countNodes still works (the tests above use it)', () => {
        const { session } = listSession();
        session.importText('{"items":["a","b","c"]}');
        expect(session.notice.value).toEqual({ kind: 'info', key: 'loaded', args: [3] });
    });
});
