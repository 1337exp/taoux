/**
 * A step of a tour. Only `id` is required: the rest (a target, a text, a placement) is yours, the model carries it.
 * Шаг тура. Обязателен только `id`: остальное (цель, текст, место) ваше, модель его просто несёт.
 */
export interface TourStep {
    id: string;
}

/**
 * How a tour ended: `done` (the last step was passed or `finish()`) or `skipped` (`skip()`, Esc, the cross).
 * Как закончился тур: `done` (прошли последний шаг или `finish()`) или `skipped` (`skip()`, Esc, крестик).
 */
export type TourEnd = 'done' | 'skipped';

export interface TourState<S extends TourStep = TourStep> {
    /** Whether a step is on screen. / Показан ли шаг. */
    active: boolean;
    /** The index of the current step in `steps` (-1 while not active). / Индекс текущего шага в `steps` (-1, пока тур не идёт). */
    index: number;
    /** The current step, or null. / Текущий шаг или null. */
    step: S | null;
    /** How many steps there are (also those that are jumped over now). / Сколько всего шагов (и тех, что сейчас перепрыгиваются). */
    count: number;
    /**
     * The place of the current step among the steps that can be shown now, from 0, and how many of those there are: what
     * a counter ("2 of 4") and the dots want, since the steps that are jumped over are not counted. `index` / `count`
     * stay the place in the whole list.
     * Место текущего шага среди шагов, которые можно показать сейчас, с 0, и сколько таких всего: то, что нужно счётчику
     * («2 из 4») и точкам, ведь перепрыгиваемые шаги не считаются. `index` / `count` — место в полном списке.
     */
    position: number;
    total: number;
    /** No step to go back to. / Назад идти некуда. */
    first: boolean;
    /** No step to go on to: `next()` ends the tour. / Дальше идти некуда: `next()` завершает тур. */
    last: boolean;
}

export interface TourOptions<S extends TourStep = TourStep> {
    steps: S[];
    /**
     * Whether a step can be shown now (its target is on the page, the user has the right). A step that cannot is
     * jumped over, in either direction. Called at every move, so it may look at the page.
     * Можно ли показать шаг сейчас (его цель есть на странице, у пользователя есть право). Шаг, который нельзя,
     * перепрыгивается в обе стороны. Вызывается при каждом переходе, поэтому может смотреть на страницу.
     */
    available?: (step: S, index: number) => boolean;
    /** Called once when a tour ends. / Вызывается один раз, когда тур закончился. */
    onEnd?: (reason: TourEnd, step: S | null) => void;
}

export interface Tour<S extends TourStep = TourStep> extends TourState<S> {
    /**
     * Starts at step `at` (an index or an `id`; the first by default). If that step cannot be shown, the next one
     * that can is taken. Returns false, and nothing starts, when there is no such step.
     * Начинает с шага `at` (индекс или `id`; по умолчанию первый). Если его нельзя показать, берётся ближайший
     * следующий, который можно. Возвращает false, и ничего не начинается, если такого шага нет.
     */
    start(at?: number | string): boolean;
    /** The next step; from the last one it ends the tour as `done`. / Следующий шаг; с последнего завершает тур как `done`. */
    next(): void;
    /** The previous step; from the first one it stays. / Предыдущий шаг; с первого остаётся на месте. */
    prev(): void;
    /** Jumps to a step (an index or an `id`); false if it does not exist or cannot be shown. / Переход к шагу; false, если шага нет или его нельзя показать. */
    goTo(target: number | string): boolean;
    /** Ends the tour as `skipped`. / Завершает тур как `skipped`. */
    skip(): void;
    /** Ends the tour as `done`. / Завершает тур как `done`. */
    finish(): void;
    /**
     * Replaces the steps. A tour that runs stays on the step with the same `id`, or, when it is gone, moves to the next
     * one that can be shown, or ends as `done`.
     * Заменяет шаги. Идущий тур остаётся на шаге с тем же `id`, а если его нет, переходит к ближайшему показываемому
     * или завершается как `done`.
     */
    setSteps(steps: S[]): void;
    /** The listener is called on any change. Returns the unsubscribe function. / Слушатель вызывается при любом изменении. */
    subscribe(listener: (state: TourState<S>) => void): () => void;
    dispose(): void;
}

export function createTour<S extends TourStep = TourStep>(options: TourOptions<S>): Tour<S> {
    let steps = [...options.steps];
    const listeners = new Set<(state: TourState<S>) => void>();
    let disposed = false;

    const can = (i: number) => i >= 0 && i < steps.length && (options.available?.(steps[i]!, i) ?? true);

    /** The nearest showable step from `from` (included) in a direction, or -1. / Ближайший показываемый шаг от `from` (включая его) или -1. */
    function seek(from: number, dir: 1 | -1): number {
        for (let i = from; i >= 0 && i < steps.length; i += dir) {
            if (can(i)) {
                return i;
            }
        }
        return -1;
    }

    const tour = {
        active: false,
        index: -1,
        step: null as S | null,
        count: steps.length,
        position: -1,
        total: 0,
        first: true,
        last: true,
    } as Tour<S>;

    function sync() {
        tour.count = steps.length;
        tour.step = tour.active ? (steps[tour.index] ?? null) : null;
        let total = 0;
        let position = -1;
        for (let i = 0; i < steps.length; i++) {
            if (!can(i)) continue;
            if (i <= tour.index) position = tour.active ? total : -1;
            total++;
        }
        tour.total = total;
        tour.position = position;
        tour.first = !tour.active || seek(tour.index - 1, -1) < 0;
        tour.last = !tour.active || seek(tour.index + 1, 1) < 0;
    }

    function emit() {
        sync();
        const state: TourState<S> = { active: tour.active, index: tour.index, step: tour.step, count: tour.count, position: tour.position, total: tour.total, first: tour.first, last: tour.last };
        for (const listener of [...listeners]) {
            listener(state);
        }
    }

    function end(reason: TourEnd) {
        if (!tour.active) {
            return;
        }
        const last = steps[tour.index] ?? null;
        tour.active = false;
        tour.index = -1;
        emit();
        options.onEnd?.(reason, last);
    }

    const indexOf = (target: number | string) => (typeof target === 'string' ? steps.findIndex((s) => s.id === target) : target);

    function show(index: number) {
        tour.active = true;
        tour.index = index;
        emit();
    }

    tour.start = (at = 0) => {
        if (disposed) {
            return false;
        }
        const from = indexOf(at);
        const found = from < 0 ? -1 : seek(from, 1);
        if (found < 0) {
            return false;
        }
        show(found);
        return true;
    };

    tour.next = () => {
        if (!tour.active) {
            return;
        }
        const found = seek(tour.index + 1, 1);
        if (found < 0) {
            end('done');
        } else {
            show(found);
        }
    };

    tour.prev = () => {
        if (!tour.active) {
            return;
        }
        const found = seek(tour.index - 1, -1);
        if (found >= 0) {
            show(found);
        }
    };

    tour.goTo = (target) => {
        const i = indexOf(target);
        if (!tour.active || !can(i)) {
            return false;
        }
        show(i);
        return true;
    };

    tour.skip = () => end('skipped');
    tour.finish = () => end('done');

    tour.setSteps = (next) => {
        const id = tour.step?.id;
        // the steps after the current one, in the old order: where to go when the current one is gone
        // шаги после текущего в старом порядке: куда идти, если текущий пропал
        const following = steps.slice(tour.index + 1).map((s) => s.id);
        steps = [...next];
        if (!tour.active) {
            emit();
            return;
        }
        const same = id === undefined ? -1 : steps.findIndex((s) => s.id === id);
        let found = same >= 0 && can(same) ? same : same >= 0 ? seek(same + 1, 1) : -1;
        for (const nextId of same >= 0 ? [] : following) {
            const at = steps.findIndex((s) => s.id === nextId);
            if (found < 0 && at >= 0 && can(at)) {
                found = at;
            }
        }
        if (found < 0) {
            end('done');
        } else {
            show(found);
        }
    };

    tour.subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    tour.dispose = () => {
        disposed = true;
        tour.active = false;
        tour.index = -1;
        listeners.clear();
        sync();
    };

    sync();
    return tour;
}
