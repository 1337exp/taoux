import { onBeforeUnmount, reactive, toRefs, type ToRefs } from 'vue';
import { createTour, type Tour, type TourOptions, type TourState, type TourStep } from './core';

export type UseTour<S extends TourStep = TourStep> = ToRefs<TourState<S>> & {
    start: Tour<S>['start'];
    next(): void;
    prev(): void;
    goTo: Tour<S>['goTo'];
    skip(): void;
    finish(): void;
    setSteps(steps: S[]): void;
    /**
     * The model without Vue: for cases that need its full API (subscribe).
     * Модель без Vue: для случаев, когда нужен её полный API (subscribe).
     */
    tour: Tour<S>;
};

/**
 * A tour for a Vue component: reactive state on top of `createTour`; it is let go on unmount.
 * Тур для компонента Vue: реактивное состояние поверх `createTour`; при размонтировании отпускается.
 */
export function useTour<S extends TourStep = TourStep>(options: TourOptions<S>): UseTour<S> {
    const tour = createTour(options);
    const state = reactive({ active: tour.active, index: tour.index, step: tour.step, count: tour.count, position: tour.position, total: tour.total, first: tour.first, last: tour.last }) as TourState<S>;
    const stop = tour.subscribe((s) => Object.assign(state, s));
    onBeforeUnmount(() => {
        stop();
        tour.dispose();
    });

    return {
        ...toRefs(state),
        start: tour.start,
        next: tour.next,
        prev: tour.prev,
        goTo: tour.goTo,
        skip: tour.skip,
        finish: tour.finish,
        setSteps: tour.setSteps,
        tour,
    } as UseTour<S>;
}
