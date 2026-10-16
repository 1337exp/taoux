import { describe, expect, it } from 'vitest';
import { wheelIntent, type WheelLike } from '../src/wheel';

const wheel = (over: Partial<WheelLike>): WheelLike => ({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false, ...over });
const PAGE = 800;

describe('wheelIntent', () => {
    it('колесо без Ctrl двигает холст, а не масштабирует (в том числе тачпад)', () => {
        expect(wheelIntent(wheel({ deltaY: 100 }), PAGE)).toEqual({ kind: 'pan', dx: -0, dy: -100 });
        expect(wheelIntent(wheel({ deltaX: 30, deltaY: -20 }), PAGE)).toEqual({ kind: 'pan', dx: -30, dy: 20 });
    });

    it('Ctrl или Cmd + колесо масштабирует: вниз уменьшает, вверх увеличивает', () => {
        const down = wheelIntent(wheel({ ctrlKey: true, deltaY: 100 }), PAGE);
        const up = wheelIntent(wheel({ metaKey: true, deltaY: -100 }), PAGE);
        expect(down.kind).toBe('zoom');
        expect(down.kind === 'zoom' && down.factor).toBeLessThan(1);
        expect(up.kind === 'zoom' && up.factor).toBeGreaterThan(1);
    });

    it('щипок тачпада (мелкие дельты с Ctrl) чувствительнее засечки колеса мыши', () => {
        const pinch = wheelIntent(wheel({ ctrlKey: true, deltaY: -5 }), PAGE);
        const notch = wheelIntent(wheel({ ctrlKey: true, deltaY: -100 }), PAGE);
        // 5 px щипка двигают масштаб заметно, а засечка колеса (100) на порядок мягче «на пиксель»
        expect(pinch.kind === 'zoom' && Math.log(pinch.factor) / 5).toBeGreaterThan(notch.kind === 'zoom' ? Math.log(notch.factor) / 100 : 0);
    });

    it('Shift + колесо двигает по горизонтали, если браузер сам не прислал deltaX', () => {
        expect(wheelIntent(wheel({ shiftKey: true, deltaY: 60 }), PAGE)).toEqual({ kind: 'pan', dx: -60, dy: 0 });
        expect(wheelIntent(wheel({ shiftKey: true, deltaX: 40, deltaY: 0 }), PAGE)).toEqual({ kind: 'pan', dx: -40, dy: -0 });
    });

    it('строки и страницы приводятся к пикселям', () => {
        expect(wheelIntent(wheel({ deltaMode: 1, deltaY: 3 }), PAGE)).toMatchObject({ kind: 'pan', dy: -48 });
        expect(wheelIntent(wheel({ deltaMode: 2, deltaY: 1 }), PAGE)).toMatchObject({ kind: 'pan', dy: -PAGE });
    });
});
