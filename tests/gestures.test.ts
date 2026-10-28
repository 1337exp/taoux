import { describe, expect, it } from 'vitest';
import {
    DOUBLE_TAP_MS,
    DOUBLE_TAP_RADIUS_PX,
    LONG_PRESS_MS,
    TAP_MAX_MS,
    TAP_SLOP_PX,
    TapRecognizer,
    pinchOf,
    PINCH_DEADBAND_PX,
    PINCH_ENGAGE_PX,
    PinchTracker,
    settleOpen,
    SWIPE_FLING_PX_PER_MS,
    SWIPE_SLOP_PX,
    SwipeTracker,
} from '../src/gestures';

const at = (x: number, y: number, t: number) => ({ x, y, t });

describe('TapRecognizer', () => {
    it('короткое касание на месте это тап', () => {
        const r = new TapRecognizer();
        expect(r.down(at(100, 100, 0))).toBe(false);
        expect(r.up(at(101, 100, 120))).toBe('tap');
    });

    it('дрожание в пределах допуска не мешает тапу, выход за допуск мешает', () => {
        const ok = new TapRecognizer();
        ok.down(at(0, 0, 0));
        expect(ok.move(at(TAP_SLOP_PX - 1, 0, 50))).toBe(false);
        expect(ok.up(at(TAP_SLOP_PX - 1, 0, 100))).toBe('tap');

        const far = new TapRecognizer();
        far.down(at(0, 0, 0));
        expect(far.move(at(TAP_SLOP_PX + 1, 0, 50))).toBe(true);
        expect(far.isMoved).toBe(true);
        expect(far.up(at(0, 0, 100))).toBeNull(); // вернулся на место, но уже тащил
    });

    it('долгое касание это не тап', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 0));
        expect(r.up(at(0, 0, TAP_MAX_MS + 1))).toBeNull();
    });

    it('два тапа подряд рядом это двойной тап; третий снова одиночный', () => {
        const r = new TapRecognizer();
        r.down(at(50, 50, 0));
        expect(r.up(at(50, 50, 80))).toBe('tap');

        expect(r.down(at(60, 55, 200))).toBe(true); // второе касание уже известно как «двойное»
        expect(r.up(at(60, 55, 260))).toBe('double');

        expect(r.down(at(60, 55, 400))).toBe(false);
        expect(r.up(at(60, 55, 450))).toBe('tap');
    });

    it('второй тап слишком поздно или слишком далеко не двойной', () => {
        const late = new TapRecognizer();
        late.down(at(0, 0, 0));
        late.up(at(0, 0, 50));
        expect(late.down(at(0, 0, 50 + DOUBLE_TAP_MS + 1))).toBe(false);

        const far = new TapRecognizer();
        far.down(at(0, 0, 0));
        far.up(at(0, 0, 50));
        expect(far.down(at(DOUBLE_TAP_RADIUS_PX + 1, 0, 100))).toBe(false);
    });

    it('двойной тап с протяжкой не становится ни тапом, ни двойным тапом', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 0));
        r.up(at(0, 0, 50));
        expect(r.down(at(2, 2, 150))).toBe(true); // можно начинать рамку
        r.move(at(80, 2, 200));
        expect(r.up(at(80, 2, 400))).toBeNull();
        expect(r.down(at(80, 2, 450))).toBe(false); // после протяжки двойной тап не продолжается
    });

    it('долгое нажатие: палец лежит на месте дольше порога', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 1000));
        expect(r.longPressDue(1000 + LONG_PRESS_MS - 1)).toBe(false);
        expect(r.longPressDue(1000 + LONG_PRESS_MS)).toBe(true);

        r.move(at(TAP_SLOP_PX + 5, 0, 1200)); // сдвинулся: уже не долгое нажатие
        expect(r.longPressDue(5000)).toBe(false);
    });

    it('cancel забывает и касание, и прошлый тап', () => {
        const r = new TapRecognizer();
        r.down(at(0, 0, 0));
        r.up(at(0, 0, 50));
        r.cancel();
        expect(r.down(at(0, 0, 100))).toBe(false);
        r.cancel();
        expect(r.up(at(0, 0, 120))).toBeNull();
        expect(r.longPressDue(99999)).toBe(false);
    });
});

describe('pinch', () => {
    it('считает центр и расстояние; один палец даёт расстояние 0', () => {
        expect(pinchOf({ x: 0, y: 0 }, { x: 6, y: 8 })).toEqual({ cx: 3, cy: 4, dist: 10 });
        expect(pinchOf({ x: 5, y: 7 })).toEqual({ cx: 5, cy: 7, dist: 0 });
    });

    const spread = (d: number, cx = 0, cy = 0) => pinchOf({ x: cx - d / 2, y: cy }, { x: cx + d / 2, y: cy });

    it('пока расстояние не изменилось осознанно, это только сдвиг: масштаб не трогается', () => {
        const t = new PinchTracker();
        t.begin(spread(40));
        // дрожание вокруг 40 px, сдвиг центра на 10
        for (const d of [41, 39, 42, 38, 43, 40]) expect(t.update(spread(d, 10)).factor).toBe(1);
        expect(t.isZooming).toBe(false);
    });

    it('сдвиг центра работает всегда, масштаб вокруг прежнего центра', () => {
        const t = new PinchTracker();
        t.begin(spread(100, 50, 50));
        const step = t.update(spread(100, 70, 60));
        expect(step.pan).toEqual([20, 10]);
        expect(step.pivot).toEqual([50, 50]);
    });

    it('масштаб включается после порога без скачка, дальше идёт плавно', () => {
        const t = new PinchTracker();
        t.begin(spread(40));

        expect(t.update(spread(PINCH_ENGAGE_PX + 40)).factor).toBe(1); // порог пройден: отсчёт с этого расстояния
        expect(t.isZooming).toBe(true);

        const out = t.update(spread(PINCH_ENGAGE_PX + 40 + 30));
        expect(out.factor).toBeCloseTo((PINCH_ENGAGE_PX + 70) / (PINCH_ENGAGE_PX + 40), 10);
        const back = t.update(spread(PINCH_ENGAGE_PX + 40)); // обратно
        expect(back.factor).toBeLessThan(1);
    });

    it('после включения мелкое дрожание отсекается мёртвой зоной, а накопленный дрейф не теряется', () => {
        const t = new PinchTracker();
        t.begin(spread(100));
        t.update(spread(130)); // включили
        expect(t.update(spread(130 + PINCH_DEADBAND_PX - 0.5)).factor).toBe(1);
        expect(t.update(spread(130 - PINCH_DEADBAND_PX + 0.5)).factor).toBe(1);

        // медленное, но настоящее движение: набегает за порог и применяется
        let total = 1;
        for (let d = 130; d <= 160; d += 1) total *= t.update(spread(d)).factor;
        expect(total).toBeCloseTo(160 / 130, 1);
    });

    it('на малом и большом расстоянии одно и то же дрожание ведёт себя одинаково: не масштабирует', () => {
        for (const base of [30, 400]) {
            const t = new PinchTracker();
            t.begin(spread(base));
            let zoomSteps = 0;
            for (let i = 0; i < 40; i++) if (t.update(spread(base + (i % 2 ? 2 : -2), i)).factor !== 1) zoomSteps++;
            expect(zoomSteps).toBe(0);
        }
    });

    it('с одним пальцем масштаба нет, при смене числа пальцев begin сбрасывает отсчёт', () => {
        const t = new PinchTracker();
        t.begin(pinchOf({ x: 30, y: 10 }));
        expect(t.update(pinchOf({ x: 35, y: 12 }))).toMatchObject({ factor: 1, pan: [5, 2] });
        expect(t.update(spread(500)).factor).toBe(1); // второй палец появился без begin: масштаб не включается

        t.begin(spread(100));
        expect(t.update(pinchOf({ x: 0, y: 0 })).factor).toBe(1); // подняли палец
    });

    // Браузер присылает движение пальцев по одному: сначала сдвинулся один, потом второй.
    function fingers() {
        const a = { x: 0, y: 0 };
        const b = { x: 100, y: 0 };
        return { a, b, now: () => pinchOf({ ...a }, { ...b }) };
    }

    it('сдвиг двумя пальцами не включает масштаб, даже если расстояние плывёт и пальцы приходят по одному', () => {
        const f = fingers();
        const t = new PinchTracker();
        t.begin(f.now());

        let zoomSteps = 0;
        for (let i = 0; i < 60; i++) {
            f.a.x += 6; // палец A сдвинулся
            if (t.update(f.now()).factor !== 1) zoomSteps++;
            f.b.x += 6 + (i % 2 ? 1 : 0.5); // палец B догоняет и понемногу уходит вперёд: расстояние плывёт на десятки px
            if (t.update(f.now()).factor !== 1) zoomSteps++;
        }
        expect(f.b.x - f.a.x - 100).toBeGreaterThan(PINCH_ENGAGE_PX); // дрейф действительно больше порога
        expect(zoomSteps).toBe(0);
        expect(t.isZooming).toBe(false);
    });

    it('настоящий щипок, когда пальцы приходят по одному, масштабирует в нужную сторону', () => {
        const f = fingers();
        const t = new PinchTracker();
        t.begin(f.now());

        let total = 1;
        let wrongWay = 0;
        for (let i = 0; i < 25; i++) {
            f.a.x -= 4;
            let k = t.update(f.now()).factor;
            total *= k;
            if (k < 1) wrongWay++;
            f.b.x += 4;
            k = t.update(f.now()).factor;
            total *= k;
            if (k < 1) wrongWay++;
        }
        expect(t.isZooming).toBe(true);
        expect(wrongWay).toBe(0);
        expect(total).toBeGreaterThan(1.5);
    });

    it('после щипка пальцы повезли вместе: масштаб выключается и не включается от дрейфа', () => {
        const f = fingers();
        const t = new PinchTracker();
        t.begin(f.now());
        for (let i = 0; i < 25; i++) {
            f.a.x -= 4;
            t.update(f.now());
            f.b.x += 4;
            t.update(f.now());
        }
        expect(t.isZooming).toBe(true);

        let zoomAfter = 0;
        for (let i = 0; i < 40; i++) {
            f.a.x += 8;
            if (t.update(f.now()).factor !== 1) zoomAfter++;
            f.b.x += 8 + (i % 2 ? 0.7 : 0.3);
            if (t.update(f.now()).factor !== 1) zoomAfter++;
        }
        expect(t.isZooming).toBe(false);
        expect(zoomAfter).toBeLessThan(6); // допустимо пара шагов, пока окно «забывает» щипок
    });

    it('покоящиеся пальцы с дрожанием не включают масштаб, сколько бы дрейфа ни накопилось', () => {
        const f = fingers();
        const t = new PinchTracker();
        t.begin(f.now());
        for (let i = 0; i < 200; i++) {
            f.b.x += i % 3 === 0 ? 0.8 : -0.1; // слабый шум со сдвигом в одну сторону (дрейф около 40 px на 200 шагов)
            expect(t.update(f.now()).factor).toBe(1);
        }
        expect(f.b.x - f.a.x - 100).toBeGreaterThan(PINCH_ENGAGE_PX);
        expect(t.isZooming).toBe(false);
    });
});

describe('SwipeTracker', () => {
    it('inside the slop nothing is decided; along the axis it is a swipe, without a jump by the slop', () => {
        const s = new SwipeTracker();
        s.down(at(100, 100, 0));
        expect(s.move(at(100 - SWIPE_SLOP_PX, 102, 10)).intent).toBe('pending');
        expect(s.move(at(100 - SWIPE_SLOP_PX - 2, 102, 20))).toEqual({ intent: 'swipe', offset: 0 });
        expect(s.move(at(40, 104, 60)).offset).toBe(-(100 - SWIPE_SLOP_PX - 2 - 40));
    });

    it('across the axis it is a scroll, and stays one: the page owns the gesture', () => {
        const s = new SwipeTracker();
        s.down(at(0, 0, 0));
        expect(s.move(at(4, 30, 20)).intent).toBe('scroll');
        expect(s.move(at(80, 30, 40)).intent).toBe('scroll');
        expect(s.up(at(80, 30, 60))).toBeNull();
    });

    it('a diagonal goes to the page; a vertical tracker swipes along y', () => {
        const d = new SwipeTracker();
        d.down(at(0, 0, 0));
        expect(d.move(at(20, 20, 20)).intent).toBe('scroll');
        const v = new SwipeTracker('y');
        v.down(at(0, 0, 0));
        expect(v.move(at(2, 30, 20)).intent).toBe('swipe');
    });

    it('starts from where the row stands and measures the release speed over the last stretch', () => {
        const s = new SwipeTracker();
        s.down(at(200, 0, 0), -80);
        s.move(at(215, 0, 10));
        s.move(at(260, 0, 200));
        const r = s.up(at(300, 0, 250))!;
        expect(r.offset).toBe(-80 + (300 - 215));
        expect(r.velocity).toBeCloseTo((300 - 260) / 50, 5);
    });
});

describe('settleOpen', () => {
    const open = { end: 80 };
    it('without a fling the nearest stop wins', () => {
        expect(settleOpen({ offset: -30, velocity: 0 }, open)).toBe(0);
        expect(settleOpen({ offset: -50, velocity: 0 }, open)).toBe(-80);
    });

    it('a fling goes on in its direction, one stop at a time', () => {
        const f = SWIPE_FLING_PX_PER_MS;
        expect(settleOpen({ offset: -10, velocity: -f }, open)).toBe(-80);
        expect(settleOpen({ offset: -70, velocity: f }, open)).toBe(0);
        // both sides: an open end row flung right closes, it does not fly to the start / закрывается, а не улетает
        expect(settleOpen({ offset: -80, velocity: 2 * f }, { start: 60, end: 80 })).toBe(0);
        expect(settleOpen({ offset: 10, velocity: f }, { start: 60, end: 80 })).toBe(60);
    });

    it('a fling past the last stop stays at it', () => {
        expect(settleOpen({ offset: -120, velocity: -1 }, open)).toBe(-80);
        expect(settleOpen({ offset: 30, velocity: 1 }, open)).toBe(0);
    });
});
