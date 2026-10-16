import type { Camera } from '../camera';

/** Изменяемый кортеж: сторы приложений принимают именно такие. */
export type Point = [number, number];

export interface Size {
    w: number;
    h: number;
}

export interface Rect extends Size {
    x: number;
    y: number;
}

/** За какую грань или угол тянут: стороны света. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Что холст просит сделать по двойному клику или двойному тапу. */
export type ActivateTarget = { kind: 'link'; id: string; at: Point } | { kind: 'handle'; nodeId: string };

/** Протягивание связи. `P` — адрес пина: для холста непрозрачный, его понимает только приложение. */
export interface ConnectHost<P> {
    /** Пин, с которого тянут (null, если сейчас не тянут). */
    readonly origin: P | null;
    start(pin: P, cursor: Point): void;
    update(cursor: Point, target: P | null): void;
    /** Завершить на `target`; true, если связь создана. */
    finish(target: P | null): boolean;
    /** Жест оборван: протягивание отбрасывается без связи. */
    cancel(): void;
}

export interface ResizeHost {
    rectOf(nodeId: string): Rect | null;
    /** `start` — прямоугольник в момент захвата, (dx, dy) — сдвиг мыши с тех пор в мировых единицах. */
    from(nodeId: string, edge: ResizeEdge, start: Rect, dx: number, dy: number, snap: boolean): void;
}

/**
 * Всё, что холсту нужно от приложения. Модель данных (ноды, связи, пины, файл) холст не знает:
 * он разбирает жесты и зовёт эти методы. Читаемые члены должны быть реактивными (геттеры над состоянием стора).
 */
export interface CanvasHost<P = unknown> {
    //--- вид
    readonly camera: Camera;
    setCamera(camera: Camera): void;
    /** Холст сообщает свой размер в px (нужен, чтобы ставить новые ноды в центр экрана). */
    setViewport(size: Size): void;

    //--- выделение
    readonly selection: ReadonlySet<string>;
    setSelection(ids: Iterable<string>): void;
    toggleSelected(nodeId: string): void;
    selectConnection(id: string | null): void;

    //--- перетаскивание нод (привязка к сетке и «едущие» контейнеры: забота приложения)
    /** Нода, за которую взялись, ложится поверх остальных. */
    raise?(nodeId: string): void;
    beginDrag(primary: string): void;
    moveSelected(dx: number, dy: number, snap: boolean): void;
    endDrag(): void;

    //--- история и удаление
    /** Жест закончен: состояние идёт в историю как один шаг. */
    commit(): void;
    undo(): void;
    redo(): void;
    removeSelected(): void;

    //--- палитра нод
    readonly paletteOpen: boolean;
    openPalette(screen: Point, world: Point, origin: P | null): void;
    closePalette(): void;

    //--- необязательные возможности: нет члена, нет и жеста
    connect?: ConnectHost<P>;
    resize?: ResizeHost;
    activate?(target: ActivateTarget): void;
    /** Привязка к сетке включена (Alt на время отключает). */
    readonly snapEnabled?: boolean;
    /** Сенсорный режим «Выделение»: один палец рисует рамку, тап добавляет в выделение. */
    readonly selectMode?: boolean;
}

/**
 * Как холст находит пины в DOM. Остальной DOM-контракт, который обязан соблюдать вид ноды приложения:
 * `data-node-id` на корне ноды; `data-conn-id` на линии связи (ставит `TaoxLinks`); `data-resize="n|s|e|w|ne|nw|se|sw"`
 * на ручках; `data-node-container` на корне ноды-контейнера (в рамку выделения попадает только её полоса);
 * `data-node-handle` на полосе, за которую тянут ноду (по двойному клику по ней вызывается `activate`).
 */
export interface CanvasOptions<P> {
    /** Пин у элемента под указателем (по `data-*`, которые ставит вид ноды приложения). */
    pinAt(target: EventTarget | null): P | null;
    /** Пин, ближайший к точке: например, сторона ноды, над телом которой отпустили связь. Без него берётся `pinAt`. */
    pinNear?(point: { clientX: number; clientY: number }): P | null;
}
