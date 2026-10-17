import { onMounted, onUnmounted, onUpdated, reactive, type Ref } from 'vue';

/**
 * Pin positions for editors where pins are rows inside a node and their position depends on the layout (node-graph editors).
 * The layout cannot be guessed from the model, so it is measured from the DOM: the node view puts `data-pin="<name>"`
 * and `data-dir="in|out"` on every pin, and the pin centre is remembered relative to the node's top-left corner in world units.
 * Позиции пинов для редакторов, где пины это строки внутри ноды и их положение зависит от вёрстки (graph-up, taofx).
 * Вёрстку не угадать по модели, поэтому её измеряют по DOM: вид ноды ставит на каждый пин `data-pin="<имя>"`
 * и `data-dir="in|out"`, а центр пина запоминается относительно левого верхнего угла ноды в мировых единицах.
 */

/**
 * Pin centres of a node relative to its corner, world units. Key: `<in|out>:<pin name>`.
 * Центры пинов ноды относительно её угла, мировые единицы. Ключ: `<in|out>:<имя пина>`.
 */
export type PinOffsets = Record<string, [number, number]>;

export const pinKey = (dir: 'in' | 'out', pin: string) => `${dir}:${pin}`;

/**
 * Whether two sets are equal within `eps`: so that fraction jitter does not cause extra redraws.
 * Равны ли два набора с точностью до `eps`: чтобы дрожание дробей не вызывало лишних перерисовок.
 */
export function samePinOffsets(a: PinOffsets | undefined, b: PinOffsets, eps = 0.01): boolean {
    if (!a) return false;
    const keys = Object.keys(b);
    if (keys.length !== Object.keys(a).length) return false;
    return keys.every((k) => {
        const p = a[k];
        const q = b[k]!;
        return p !== undefined && Math.abs(p[0] - q[0]) < eps && Math.abs(p[1] - q[1]) < eps;
    });
}

/**
 * Measures the pins inside `root` (the node element) at camera scale `zoom`.
 * Измеряет пины внутри `root` (элемент ноды) при масштабе камеры `zoom`.
 */
export function measurePins(root: HTMLElement, zoom: number): PinOffsets {
    const nodeRect = root.getBoundingClientRect();
    const offsets: PinOffsets = {};

    for (const pin of root.querySelectorAll<HTMLElement>('[data-pin]')) {
        const dir = pin.dataset.dir;
        if (dir !== 'in' && dir !== 'out') continue;
        const r = pin.getBoundingClientRect();
        offsets[pinKey(dir, pin.dataset.pin!)] = [(r.left + r.width / 2 - nodeRect.left) / zoom, (r.top + r.height / 2 - nodeRect.top) / zoom];
    }
    return offsets;
}

/**
 * A (reactive) store of measured positions per node and the conversion to world coordinates.
 * Хранилище измеренных позиций по нодам (реактивное) и пересчёт в мировые координаты.
 */
export function createPinRegistry() {
    const offsets = reactive<Record<string, PinOffsets>>({});

    return {
        offsets,
        set(nodeId: string, next: PinOffsets) {
            if (!samePinOffsets(offsets[nodeId], next)) offsets[nodeId] = next;
        },
        clear(nodeId: string) {
            delete offsets[nodeId];
        },
        /**
         * World coordinates of the pin centre, or null if it has not been measured yet.
         * Мировые координаты центра пина или null, если ещё не измерен.
         */
        world(node: { id: string; x: number; y: number } | undefined, dir: 'in' | 'out', pin: string): [number, number] | null {
            const offset = node && offsets[node.id]?.[pinKey(dir, pin)];
            return node && offset ? [node.x + offset[0], node.y + offset[1]] : null;
        },
    };
}

export type PinRegistry = ReturnType<typeof createPinRegistry>;

export interface PinMeasureOptions {
    /**
     * The current camera scale.
     * Текущий масштаб камеры.
     */
    zoom(): number;
    report(offsets: PinOffsets): void;
    /**
     * The node is gone: forget its positions.
     * Нода исчезла: забыть её позиции.
     */
    clear(): void;
}

/**
 * Measures a node's pins on mount, on resize and on every re-render (a value field disappears and
 * appears when a link is connected) and reports the result. Call it from the `setup` of the node view.
 * Измеряет пины ноды при монтировании, изменении размера и каждой перерисовке (поле значения исчезает и
 * появляется при подключении связи) и сообщает результат. Вызывать из `setup` вида ноды.
 */
export function usePinMeasure(el: Ref<HTMLElement | null>, options: PinMeasureOptions) {
    let observer: ResizeObserver | null = null;

    function measure() {
        if (el.value) options.report(measurePins(el.value, options.zoom()));
    }

    onMounted(() => {
        measure();
        observer = new ResizeObserver(measure);
        if (el.value) observer.observe(el.value);
    });
    onUpdated(measure);
    onUnmounted(() => {
        observer?.disconnect();
        options.clear();
    });

    return { measure };
}
