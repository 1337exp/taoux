import type { Camera } from '../camera';

/**
 * A mutable tuple: app stores accept exactly these.
 * Изменяемый кортеж: сторы приложений принимают именно такие.
 */
export type Point = [number, number];

export interface Size {
    w: number;
    h: number;
}

export interface Rect extends Size {
    x: number;
    y: number;
}

/**
 * Which side or corner is dragged: compass directions.
 * За какую грань или угол тянут: стороны света.
 */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * What the canvas asks to do on a double click or a double tap.
 * Что холст просит сделать по двойному клику или двойному тапу.
 */
export type ActivateTarget = { kind: 'link'; id: string; at: Point } | { kind: 'handle'; nodeId: string };

/**
 * Dragging out a link. `P` is a pin address: opaque for the canvas, only the app understands it.
 * Протягивание связи. `P` — адрес пина: для холста непрозрачный, его понимает только приложение.
 */
export interface ConnectHost<P> {
    /**
     * The pin being dragged from (null when nothing is being dragged).
     * Пин, с которого тянут (null, если сейчас не тянут).
     */
    readonly origin: P | null;
    start(pin: P, cursor: Point): void;
    update(cursor: Point, target: P | null): void;
    /**
     * Finish on `target`; true if a link was created.
     * Завершить на `target`; true, если связь создана.
     */
    finish(target: P | null): boolean;
    /**
     * The gesture was aborted: the drag is discarded without a link.
     * Жест оборван: протягивание отбрасывается без связи.
     */
    cancel(): void;
}

export interface ResizeHost {
    rectOf(nodeId: string): Rect | null;
    /**
     * `start` is the rectangle at the moment of grabbing, (dx, dy) is the mouse shift since then in world units.
     * `start` — прямоугольник в момент захвата, (dx, dy) — сдвиг мыши с тех пор в мировых единицах.
     */
    from(nodeId: string, edge: ResizeEdge, start: Rect, dx: number, dy: number, snap: boolean): void;
}

/**
 * Everything the canvas needs from the app. The canvas does not know the data model (nodes, links, pins, file):
 * it parses gestures and calls these methods. Readable members must be reactive (getters over store state).
 * Всё, что холсту нужно от приложения. Модель данных (ноды, связи, пины, файл) холст не знает:
 * он разбирает жесты и зовёт эти методы. Читаемые члены должны быть реактивными (геттеры над состоянием стора).
 */
export interface CanvasHost<P = unknown> {
    //--- view
    //--- вид
    readonly camera: Camera;
    setCamera(camera: Camera): void;
    /**
     * The canvas reports its size in px (needed to place new nodes at the screen centre).
     * Холст сообщает свой размер в px (нужен, чтобы ставить новые ноды в центр экрана).
     */
    setViewport(size: Size): void;

    //--- selection
    //--- выделение
    readonly selection: ReadonlySet<string>;
    setSelection(ids: Iterable<string>): void;
    toggleSelected(nodeId: string): void;
    selectConnection(id: string | null): void;

    //--- dragging nodes (grid snapping and "travelling" containers are the app's business)
    //--- перетаскивание нод (привязка к сетке и «едущие» контейнеры: забота приложения)
    /**
     * The node that was grabbed goes on top of the others.
     * Нода, за которую взялись, ложится поверх остальных.
     */
    raise?(nodeId: string): void;
    beginDrag(primary: string): void;
    moveSelected(dx: number, dy: number, snap: boolean): void;
    endDrag(): void;

    //--- history and deletion
    //--- история и удаление
    /**
     * The gesture is over: the state goes into history as one step.
     * Жест закончен: состояние идёт в историю как один шаг.
     */
    commit(): void;
    undo(): void;
    redo(): void;
    removeSelected(): void;

    //--- node palette
    //--- палитра нод
    readonly paletteOpen: boolean;
    openPalette(screen: Point, world: Point, origin: P | null): void;
    closePalette(): void;

    //--- optional features: no member, no gesture
    //--- необязательные возможности: нет члена, нет и жеста
    connect?: ConnectHost<P>;
    resize?: ResizeHost;
    activate?(target: ActivateTarget): void;
    /**
     * Grid snapping is on (Alt turns it off for the moment).
     * Привязка к сетке включена (Alt на время отключает).
     */
    readonly snapEnabled?: boolean;
    /**
     * The touch "Select" mode: one finger draws a frame, a tap adds to the selection.
     * Сенсорный режим «Выделение»: один палец рисует рамку, тап добавляет в выделение.
     */
    readonly selectMode?: boolean;
}

/**
 * How the canvas finds pins in the DOM. The rest of the DOM contract the app's node view must keep:
 * `data-node-id` on the node root; `data-conn-id` on the link line (set by `TaoxLinks`); `data-resize="n|s|e|w|ne|nw|se|sw"`
 * on the handles; `data-node-container` on the root of a container node (only its strip counts for the selection frame);
 * `data-node-handle` on the strip a node is dragged by (a double click on it calls `activate`).
 * Как холст находит пины в DOM. Остальной DOM-контракт, который обязан соблюдать вид ноды приложения:
 * `data-node-id` на корне ноды; `data-conn-id` на линии связи (ставит `TaoxLinks`); `data-resize="n|s|e|w|ne|nw|se|sw"`
 * на ручках; `data-node-container` на корне ноды-контейнера (в рамку выделения попадает только её полоса);
 * `data-node-handle` на полосе, за которую тянут ноду (по двойному клику по ней вызывается `activate`).
 */
export interface CanvasOptions<P> {
    /**
     * The pin at the element under the pointer (by the `data-*` the app's node view sets).
     * Пин у элемента под указателем (по `data-*`, которые ставит вид ноды приложения).
     */
    pinAt(target: EventTarget | null): P | null;
    /**
     * The pin nearest to a point: for example, the side of a node whose body a link was released over. Without it `pinAt` is used.
     * Пин, ближайший к точке: например, сторона ноды, над телом которой отпустили связь. Без него берётся `pinAt`.
     */
    pinNear?(point: { clientX: number; clientY: number }): P | null;
}
