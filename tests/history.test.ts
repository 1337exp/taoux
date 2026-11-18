import { beforeEach, describe, expect, it } from 'vitest';
import { COALESCE_MS, History, type HistoryState } from '../src/history';

describe('History', () => {
    let time = 0;
    const make = (limit?: number) => new History('A', limit, () => time);
    beforeEach(() => (time = 0));

    it('undo/redo идут по записанным состояниям', () => {
        const h = make();
        h.commit('B');
        h.commit('C');

        expect(h.undo()).toBe('B');
        expect(h.undo()).toBe('A');
        expect(h.undo()).toBeNull(); // дальше начала не уходим
        expect(h.redo()).toBe('B');
        expect(h.redo()).toBe('C');
        expect(h.redo()).toBeNull();
    });

    it('canUndo / canRedo отражают положение', () => {
        const h = make();
        expect([h.canUndo, h.canRedo]).toEqual([false, false]);
        h.commit('B');
        expect([h.canUndo, h.canRedo]).toEqual([true, false]);
        h.undo();
        expect([h.canUndo, h.canRedo]).toEqual([false, true]);
    });

    it('одинаковое состояние не записывается', () => {
        const h = make();
        expect(h.commit('A')).toBe(false);
        expect(h.canUndo).toBe(false);
        h.commit('B');
        expect(h.commit('B')).toBe(false);
        expect(h.undo()).toBe('A');
    });

    it('новая правка после undo отбрасывает redo', () => {
        const h = make();
        h.commit('B');
        h.commit('C');
        h.undo(); // B
        h.commit('D');

        expect(h.canRedo).toBe(false);
        expect(h.undo()).toBe('B');
        expect(h.undo()).toBe('A');
    });

    it('быстрые правки с одним ключом склеиваются, с паузой — нет', () => {
        const h = make();
        h.commit('1', 'value');
        time += 100;
        h.commit('12', 'value');
        time += 100;
        h.commit('123', 'value');
        expect(h.undo()).toBe('A'); // три нажатия — один шаг

        h.redo();
        time += COALESCE_MS + 1;
        h.commit('1234', 'value');
        expect(h.undo()).toBe('123'); // после паузы — отдельный шаг
    });

    it('разные ключи не склеиваются', () => {
        const h = make();
        h.commit('B', 'x');
        h.commit('C', 'y');
        expect(h.undo()).toBe('B');
    });

    it('после undo склейка не продолжается', () => {
        const h = make();
        h.commit('B', 'k');
        h.undo();
        h.commit('C', 'k');
        expect(h.undo()).toBe('A');
        expect(h.canUndo).toBe(false);
    });

    it('вернули значение к исходному в рамках серии — записи нет', () => {
        const h = make();
        h.commit('B', 'k');
        time += 10;
        h.commit('A', 'k'); // вернулись к A
        expect(h.canUndo).toBe(false);
    });

    it('ограничивает глубину истории', () => {
        const h = make(3);
        for (const s of ['B', 'C', 'D', 'E', 'F']) h.commit(s);

        const seen: string[] = [];
        for (let s = h.undo(); s !== null; s = h.undo()) seen.push(s);
        expect(seen).toEqual(['E', 'D', 'C']); // старше трёх шагов — забыто
    });

    it('reset начинает историю заново', () => {
        const h = make();
        h.commit('B');
        h.reset('Z');
        expect([h.canUndo, h.canRedo]).toEqual([false, false]);
        h.commit('Y');
        expect(h.undo()).toBe('Z');
    });

    describe('save и restore', () => {
        it('история уносится и возвращается целиком: снимки, положение, undo и redo', () => {
            const h = make();
            h.commit('B');
            h.commit('C');
            h.undo();
            const saved = h.save();
            expect(saved).toEqual({ states: ['A', 'B', 'C'], index: 1 });

            const other = make();
            other.commit('X');
            other.restore(saved);
            expect([other.canUndo, other.canRedo]).toEqual([true, true]);
            expect(other.undo()).toBe('A');
            expect(other.redo()).toBe('B');
            expect(other.redo()).toBe('C');
        });

        it('сохранённое не меняется от дальнейших правок, а возвращённое не связано с сохранённым', () => {
            const h = make();
            h.commit('B');
            const saved = h.save();
            h.commit('C');
            expect(saved.states).toEqual(['A', 'B']);

            const other = make();
            other.restore(saved);
            other.commit('Z');
            expect(saved.states).toEqual(['A', 'B']);
            expect(saved.index).toBe(1);
        });

        it('новая правка после возврата идёт как обычно: отбрасывает redo', () => {
            const h = make();
            h.commit('B');
            h.commit('C');
            h.undo();
            const other = make();
            other.restore(h.save());
            other.commit('D');
            expect(other.canRedo).toBe(false);
            expect(other.undo()).toBe('B');
        });

        it('серия склеенных правок через возврат не продолжается', () => {
            const h = make();
            h.commit('B', 'k');
            time = 100;
            const other = make();
            other.commit('Y', 'k'); // серия с тем же ключом уже идёт
            other.restore(h.save());
            other.commit('C', 'k'); // тот же ключ и недавно, но после возврата это новая запись
            expect(other.undo()).toBe('B');
        });

        it('негодное положение или пустой список отклоняется ошибкой, история остаётся прежней', () => {
            const h = make();
            h.commit('B');
            for (const bad of [{ states: [], index: 0 }, { states: ['A'], index: 1 }, { states: ['A'], index: -1 }, { states: ['A', 'B'], index: 0.5 }]) {
                expect(() => h.restore(bad)).toThrow(RangeError);
            }
            expect(h.undo()).toBe('A');
        });

        it('save пустой истории: одно состояние и нулевое положение', () => {
            expect(make().save()).toEqual({ states: ['A'], index: 0 });
        });
    });

    describe('подписи шагов, seal, dirty и окно склейки', () => {
        it('undo и redo называют шаг, который отменят и вернут', () => {
            const h = make();
            h.commit('B', undefined, 'add b');
            h.commit('C', undefined, 'add c');
            expect([h.undoLabel, h.redoLabel]).toEqual(['add c', undefined]);
            h.undo();
            expect([h.undoLabel, h.redoLabel]).toEqual(['add b', 'add c']);
            h.undo();
            expect([h.undoLabel, h.redoLabel]).toEqual([undefined, 'add b']);
            h.commit('D'); // a step with no label
            expect([h.undoLabel, h.redoLabel]).toEqual([undefined, undefined]);
        });

        it('склеенная серия называется по первой правке; серия, вернувшаяся к началу, пропадает вместе с подписью', () => {
            const h = make();
            h.commit('B', 'k', 'first');
            time += 10;
            h.commit('C', 'k', 'second');
            expect(h.undoLabel).toBe('first');
            h.commit('X', undefined, 'other');
            time += 10;
            h.commit('Y', 'j', 'j1');
            time += 10;
            h.commit('X', 'j', 'j2'); // back to the state before the series
            expect(h.undoLabel).toBe('other');
            expect(h.undo()).toBe('C');
            expect(h.undoLabel).toBe('first');
        });

        it('подписи переживают save и restore, а история без подписей возвращается без них', () => {
            const h = make();
            h.commit('B', undefined, 'add b');
            h.commit('C', undefined, 'add c');
            h.undo();
            const saved = h.save();
            expect(saved.labels).toEqual([undefined, 'add b', 'add c']);
            const other = make();
            other.restore(saved);
            expect([other.undoLabel, other.redoLabel]).toEqual(['add b', 'add c']);
            const old = make();
            old.restore({ states: ['A', 'B'], index: 1 });
            expect([old.undoLabel, old.canUndo]).toEqual([undefined, true]);
            // the saved labels are a copy
            (saved.labels as (string | undefined)[])[1] = 'changed';
            expect(other.undoLabel).toBe('add b');
        });

        it('подписи, прошедшие через JSON (undefined стал null), возвращаются как undefined', () => {
            const h = make();
            h.commit('B', undefined, 'add b');
            h.commit('C');
            const through = JSON.parse(JSON.stringify(h.save())) as HistoryState;
            expect(through.labels).toEqual([null, 'add b', null]);
            const other = make();
            other.restore(through);
            expect(other.undoLabel).toBeUndefined();
            other.undo();
            expect(other.undoLabel).toBe('add b');
            other.undo();
            expect(other.undoLabel).toBeUndefined();
            expect(other.redoLabel).toBe('add b');
        });

        it('подписи уходят вместе со снимками, когда история длиннее предела', () => {
            const h = make(2);
            for (const s of ['B', 'C', 'D']) h.commit(s, undefined, `to ${s}`);
            expect(h.undoLabel).toBe('to D');
            h.undo();
            expect(h.undoLabel).toBe('to C');
            h.undo();
            expect([h.canUndo, h.undoLabel]).toEqual([false, undefined]);
            expect(h.redoLabel).toBe('to C');
        });

        it('seal заканчивает серию: та же правка с тем же ключом становится новым шагом', () => {
            const h = make();
            h.commit('B', 'k');
            time += 10;
            h.commit('C', 'k');
            h.seal();
            time += 10;
            h.commit('D', 'k');
            expect(h.undo()).toBe('C');
            expect(h.undo()).toBe('A');
        });

        it('coalesceMs: Infinity склеивает через любую паузу, пока серию не закончит seal или другой ключ', () => {
            const h = new History('A', 100, () => time, { coalesceMs: Infinity });
            h.commit('B', 'k');
            time += 60_000;
            h.commit('C', 'k');
            time += 60_000;
            h.commit('D', 'k');
            expect(h.undo()).toBe('A');
            h.redo();
            h.seal();
            h.commit('E', 'k');
            expect(h.undo()).toBe('D');
            const short = new History('A', 100, () => time, { coalesceMs: 5 });
            short.commit('B', 'k');
            time += 6;
            short.commit('C', 'k');
            expect(short.undo()).toBe('B');
        });

        it('dirty следует за положением: правка грязнит, откат до сохранённого очищает, markSaved отмечает текущее', () => {
            const h = make();
            expect(h.dirty).toBe(false);
            h.commit('B');
            expect(h.dirty).toBe(true);
            h.markSaved();
            expect(h.dirty).toBe(false);
            h.commit('C');
            expect(h.dirty).toBe(true);
            h.undo();
            expect(h.dirty).toBe(false);
            h.undo();
            expect(h.dirty).toBe(true);
            h.redo();
            expect(h.dirty).toBe(false);
            h.reset('Z');
            expect(h.dirty).toBe(false);
            h.commit('Y');
            expect(h.dirty).toBe(true);
        });

        it('метка сохранённого едет в save и restore: у каждого документа своя', () => {
            const a = make();
            a.commit('B');
            a.markSaved();
            a.commit('C');
            const saved = a.save();
            expect(saved.saved).toBe('B');
            const other = make();
            other.commit('X');
            other.restore(saved);
            expect(other.dirty).toBe(true);
            other.undo();
            expect(other.dirty).toBe(false);
            // a history that never saved keeps its plain shape; restore takes the first snapshot as the saved one
            const plain = make();
            plain.commit('B');
            expect(plain.save()).toEqual({ states: ['A', 'B'], index: 1 });
            other.restore(plain.save());
            expect(other.dirty).toBe(true);
            other.undo();
            expect(other.dirty).toBe(false);
            // it goes through JSON
            const through = JSON.parse(JSON.stringify(saved)) as HistoryState;
            other.restore(through);
            other.undo();
            expect(other.dirty).toBe(false);
        });
    });
});
