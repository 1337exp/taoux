import { describe, expect, it } from 'vitest';
import { GRID, SNAP_PX, snapThreshold, softSnap } from '../src/snap';

describe('softSnap', () => {
    it('липнет к ближайшей линии, если она не дальше порога', () => {
        expect(softSnap(50, GRID, 6)).toBe(48);
        expect(softSnap(53, GRID, 6)).toBe(48);
        expect(softSnap(-23, GRID, 6)).toBe(-24);
    });

    it('дальше порога значение остаётся свободным', () => {
        expect(softSnap(55, GRID, 6)).toBe(55); // 7 от линии 48
        expect(softSnap(60, GRID, 6)).toBe(60); // посередине между 48 и 72
    });

    it('порог в мировых единицах: SNAP_PX на экране, но не больше половины шага', () => {
        expect(snapThreshold(1)).toBe(SNAP_PX);
        expect(snapThreshold(2)).toBe(SNAP_PX / 2); // приблизили: порог в мире меньше
        expect(snapThreshold(0.2)).toBe(GRID / 2); // отдалили: привязка к сетке становится «жёсткой»
    });
});
