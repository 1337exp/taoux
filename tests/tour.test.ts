import { describe, expect, it, vi } from 'vitest';
import { createTour, createTourMemory, type TourEnd } from '../src/tour';
import type { KeyStorage } from '../src/storage';

const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('createTour', () => {
    it('does not run until it is started, and starts at the first step', () => {
        const tour = createTour({ steps });
        expect(tour.active).toBe(false);
        expect(tour.step).toBeNull();
        expect(tour.start()).toBe(true);
        expect(tour.active).toBe(true);
        expect(tour.step?.id).toBe('a');
        expect(tour.first).toBe(true);
        expect(tour.last).toBe(false);
        expect(tour.count).toBe(4);
    });

    it('goes on and back; back from the first step stays; on from the last one ends it as done', () => {
        const ends: TourEnd[] = [];
        const tour = createTour({ steps, onEnd: (reason) => ends.push(reason) });
        tour.start();
        tour.prev();
        expect(tour.index).toBe(0);
        tour.next();
        tour.next();
        tour.next();
        expect(tour.step?.id).toBe('d');
        expect(tour.last).toBe(true);
        tour.next();
        expect(tour.active).toBe(false);
        expect(tour.index).toBe(-1);
        expect(ends).toEqual(['done']);
    });

    it('skip ends it as skipped, once', () => {
        const onEnd = vi.fn();
        const tour = createTour({ steps, onEnd });
        tour.start('b');
        tour.skip();
        tour.skip();
        tour.finish();
        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(onEnd).toHaveBeenCalledWith('skipped', { id: 'b' });
    });

    it('a step that cannot be shown is jumped over in both directions, also at the start', () => {
        const hidden = new Set(['a', 'c']);
        const tour = createTour({ steps, available: (step) => !hidden.has(step.id) });
        expect(tour.start()).toBe(true);
        expect(tour.step?.id).toBe('b');
        expect(tour.first).toBe(true);
        tour.next();
        expect(tour.step?.id).toBe('d');
        expect(tour.last).toBe(true);
        tour.prev();
        expect(tour.step?.id).toBe('b');
    });

    it('does not start when no step can be shown, or the start does not exist', () => {
        const none = createTour({ steps, available: () => false });
        expect(none.start()).toBe(false);
        expect(none.active).toBe(false);
        const tour = createTour({ steps });
        expect(tour.start('nope')).toBe(false);
        expect(tour.start(9)).toBe(false);
    });

    it('goTo jumps by index or id, and refuses a step that does not exist or cannot be shown', () => {
        const tour = createTour({ steps, available: (step) => step.id !== 'c' });
        expect(tour.goTo('b')).toBe(false);
        tour.start();
        expect(tour.goTo('d')).toBe(true);
        expect(tour.index).toBe(3);
        expect(tour.goTo('c')).toBe(false);
        expect(tour.goTo('zzz')).toBe(false);
        expect(tour.goTo(1)).toBe(true);
        expect(tour.step?.id).toBe('b');
    });

    it('asks about availability at every move, so a target that appears later is taken', () => {
        let ready = false;
        const tour = createTour({ steps, available: (step) => step.id !== 'b' || ready });
        tour.start();
        tour.next();
        expect(tour.step?.id).toBe('c');
        ready = true;
        tour.prev();
        expect(tour.step?.id).toBe('b');
    });

    it('tells its listeners about every change, and stops when they unsubscribe', () => {
        const tour = createTour({ steps });
        const seen: Array<string | undefined> = [];
        const stop = tour.subscribe((state) => seen.push(state.step?.id));
        tour.start();
        tour.next();
        stop();
        tour.next();
        expect(seen).toEqual(['a', 'b']);
    });

    it('setSteps keeps the current step by id, moves on when it is gone, ends when nothing is left', () => {
        const tour = createTour({ steps });
        tour.start('b');
        tour.setSteps([{ id: 'x' }, ...steps]);
        expect(tour.step?.id).toBe('b');
        expect(tour.index).toBe(2);
        tour.setSteps([{ id: 'x' }, { id: 'c' }]);
        expect(tour.step?.id).toBe('c');
        const ends: TourEnd[] = [];
        const gone = createTour({ steps, onEnd: (reason) => ends.push(reason) });
        gone.start('d');
        gone.setSteps([{ id: 'a' }]);
        expect(gone.active).toBe(false);
        expect(ends).toEqual(['done']);
    });

    it('after dispose it cannot start and keeps quiet', () => {
        const tour = createTour({ steps });
        const listener = vi.fn();
        tour.subscribe(listener);
        tour.dispose();
        expect(tour.start()).toBe(false);
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('createTourMemory', () => {
    function fake(initial: string | null = null): KeyStorage {
        let value = initial;
        return {
            read: () => value,
            write: (text: string) => {
                value = text;
                return true;
            },
            backupBroken: () => {},
            tryWrite: (text: string) => {
                value = text;
                return { ok: true };
            },
            remove: () => {
                value = null;
                return true;
            },
            subscribe: () => () => {},
        } as unknown as KeyStorage;
    }

    it('remembers that the tour was seen, and can forget it', () => {
        const memory = createTourMemory('tour.demo', fake());
        expect(memory.seen()).toBe(false);
        expect(memory.markSeen()).toBe(true);
        expect(memory.seen()).toBe(true);
        expect(memory.reset()).toBe(true);
        expect(memory.seen()).toBe(false);
    });

    it('with the real storage it survives a new memory under the same key', () => {
        localStorage.clear();
        createTourMemory('tour.real').markSeen();
        expect(createTourMemory('tour.real').seen()).toBe(true);
        expect(createTourMemory('tour.other').seen()).toBe(false);
    });
});
