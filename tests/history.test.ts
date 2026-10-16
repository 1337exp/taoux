import { beforeEach, describe, expect, it } from 'vitest';
import { COALESCE_MS, History } from '../src/history';

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
});
