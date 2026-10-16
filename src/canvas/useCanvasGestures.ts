import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { panBy, screenToWorld, zoomAt } from '../camera';
import { edgeScrollVelocity } from '../edgescroll';
import { LONG_PRESS_MS, PinchTracker, TapRecognizer, pinchOf, type Sample } from '../gestures';
import { wheelIntent } from '../wheel';
import type { CanvasHost, CanvasOptions, Point, Rect, ResizeEdge } from './host';

const PAN_CLICK_THRESHOLD = 4; // ПКМ, сдвинутая меньше, это клик (открывает палитру)
const MAX_FRAME_S = 0.05; // после паузы (вкладка спала) камера не «прыгает»

/** Всё, что нужно знать о положении указателя: годится и настоящее событие, и последнее известное положение. */
type Pointer = Pick<MouseEvent, 'clientX' | 'clientY'>;

type Mode = 'idle' | 'pan' | 'drag' | 'marquee' | 'connect' | 'resize' | 'pinch';

/** Рамка выделения в клиентских координатах. */
export interface Marquee {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

/**
 * Машина жестов холста: мышь, сенсор (тап, двойной тап, долгое нажатие, щипок), колесо, автопрокрутка у края,
 * клавиши. Не знает модель данных: решения принимает приложение через `host`.
 * Хост берётся один раз при создании: он должен быть стабильным объектом.
 */
export function useCanvasGestures<P>(root: Ref<HTMLElement | null>, host: CanvasHost<P>, options: CanvasOptions<P>) {
    let mode: Mode = 'idle';
    let lastX = 0;
    let lastY = 0;
    let baseSelection: string[] = [];
    let panDistance = 0;
    /** Alt зажат: привязка к сетке временно отключена. Запоминаем, чтобы автопрокрутка (без события) тоже знала. */
    let altDown = false;
    const snapNow = () => (host.snapEnabled ?? false) && !altDown;
    let resizeId = '';
    let resizeEdge: ResizeEdge = 'se';
    let resizeStart: Rect = { x: 0, y: 0, w: 0, h: 0 };
    /** Сдвиг мыши с начала изменения размера, мировые единицы. */
    let resizeDx = 0;
    let resizeDy = 0;

    // Сенсор: пальцы на холсте, распознавание тапов и долгого нажатия, состояние щипка.
    const touches = new Map<number, { x: number; y: number }>();
    const taps = new TapRecognizer();
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let lastTouchAt = 0;
    const pinch = new PinchTracker();
    /**
     * Нода, на которую лёг палец: её выделение и подъём откладываются, пока не ясно намерение. Касание ещё может
     * оказаться началом жеста двумя пальцами, и тогда выделение, которое было у пользователя, не должно слететь.
     * Выделяем, когда палец пошёл тянуть (вышел за допуск) или поднят (тап, удержание).
     */
    let armed: string | null = null;
    /** Связь, на которую лёг палец: как с нодой, выбираем её только если это тап (палец не пошёл двигать холст). */
    let armedConn: string | null = null;

    /** `?debug=touch`: в углу видно последний распознанный жест и число пальцев. */
    const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'touch';
    const debugText = ref('');
    const note = (label: string) => {
        if (debug) debugText.value = `${label} · пальцев: ${touches.size}`;
    };

    const marquee = ref<Marquee | null>(null);

    //--------------------------------------------------
    // DOM

    const nodeIdAt = (target: EventTarget | null) =>
        (target as HTMLElement | null)?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null;

    const connIdAt = (target: EventTarget | null) =>
        (target as Element | null)?.closest<HTMLElement>('[data-conn-id]')?.dataset.connId ?? null;

    /** Поля ввода внутри нод: клик по ним выделяет ноду, но не тащит её и не отбирает фокус. */
    const isEditable = (target: EventTarget | null) =>
        !!(target as Element | null)?.closest('input, textarea, select, button, [contenteditable="true"]');

    /** Пин под курсором: ближайший пин (если приложение умеет) или тот, что точно под указателем. */
    const pinUnder = (e: Pointer): P | null =>
        options.pinNear?.(e) ?? options.pinAt(document.elementFromPoint(e.clientX, e.clientY));

    function cursorWorld(e: Pointer): Point {
        const rect = root.value!.getBoundingClientRect();
        return screenToWorld(host.camera, e.clientX - rect.left, e.clientY - rect.top);
    }

    function openPaletteAt(e: Pointer, origin: P | null) {
        const rect = root.value!.getBoundingClientRect();
        host.openPalette([e.clientX - rect.left, e.clientY - rect.top], cursorWorld(e), origin);
    }

    function nodesInMarquee(): string[] {
        const m = marquee.value;
        if (!m || !root.value) return [];

        const left = Math.min(m.x0, m.x1);
        const right = Math.max(m.x0, m.x1);
        const top = Math.min(m.y0, m.y1);
        const bottom = Math.max(m.y0, m.y1);

        const ids: string[] = [];
        for (const el of root.value.querySelectorAll<HTMLElement>('[data-node-id]')) {
            // Контейнер выделяется только за полосу: иначе любая рамка выбирала бы всю группу целиком.
            const area = el.hasAttribute('data-node-container') ? (el.querySelector('[data-node-handle]') ?? el) : el;
            const r = area.getBoundingClientRect();
            if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) ids.push(el.dataset.nodeId!);
        }
        return ids;
    }

    //--------------------------------------------------

    const sampleOf = (e: PointerEvent): Sample => ({ x: e.clientX, y: e.clientY, t: performance.now() });

    function capture(e: PointerEvent) {
        try {
            root.value?.setPointerCapture(e.pointerId);
        } catch {
            // указатель уже ушёл: захватывать нечего
        }
    }

    function releaseCapture(e: { pointerId: number }) {
        try {
            root.value?.releasePointerCapture(e.pointerId);
        } catch {
            // захвата уже нет
        }
    }

    function clearLongPress() {
        clearTimeout(longPressTimer);
        longPressTimer = undefined;
    }

    //--------------------------------------------------
    // Сенсор

    /** Второй палец лёг на холст: начатый жест отменяется, начинается щипок. Возвращает true, если событие обработано. */
    function touchDown(e: PointerEvent): boolean {
        // Первичный палец это начало нового касания: других пальцев на экране сейчас нет. Всё, что мы помним, зависло
        // (pointerup ушёл мимо холста, например на палитру, открытую долгим нажатием), и его надо забыть, иначе
        // следующий тап посчитается вторым пальцем и включит щипок насовсем.
        if (e.isPrimary) {
            touches.clear();
            armed = null;
            armedConn = null;
            if (mode !== 'idle') abortGesture();
        }

        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size < 2) return false;

        host.closePalette();
        abortGesture();
        mode = 'pinch';
        rebasePinch();
        capture(e);
        e.preventDefault();
        note('щипок');
        return true;
    }

    /** Палец лёг на холст (первый): запоминаем для тапа и ставим таймер долгого нажатия. Возвращает true для второго тапа подряд. */
    function beginTouch(e: PointerEvent): boolean {
        clearLongPress();
        const doubleDown = taps.down(sampleOf(e));
        longPressTimer = setTimeout(onLongPress, LONG_PRESS_MS);
        return doubleDown;
    }

    /** Палец лежит на пустом месте и не двигается: это правый клик сенсора, открываем палитру. */
    function onLongPress() {
        longPressTimer = undefined;
        if (mode !== 'pan' || !taps.longPressDue(performance.now() + 50)) return;

        // Захват не отпускаем: палитра открывается под пальцем, и без захвата pointerup ушёл бы на неё, а не на холст.
        taps.cancel();
        mode = 'idle';
        navigator.vibrate?.(15);
        openPaletteAt({ clientX: lastX, clientY: lastY }, null);
        note('долгое нажатие');
    }

    /**
     * Палец поднят или отменён где угодно в окне, а не только над холстом: например, над палитрой, которая открылась
     * под ним. Холст должен перестать считать этот палец лежащим, иначе он останется «вторым» навсегда.
     */
    function purgeTouch(e: PointerEvent) {
        if (e.pointerType !== 'touch' || !touches.delete(e.pointerId)) return;
        if (mode !== 'pinch') return;
        if (touches.size === 0) mode = 'idle';
        else rebasePinch();
    }

    /** Намерение стало ясно (палец пошёл тянуть или поднят): выделяем и поднимаем ноду, на которую он лёг. */
    function commitArmed() {
        const id = armed;
        armed = null;
        if (!id) return;

        host.selectConnection(null);
        // Изменение размера выделяет только свою ноду; перетаскивание сохраняет выделение, если нода уже в нём.
        if (mode === 'resize' || !host.selection.has(id)) host.setSelection([id]);
        host.raise?.(id);
        if (mode === 'drag') host.beginDrag(id);
    }

    /** Палец поднят. Возвращает true, если событие обработано целиком (идёт щипок). */
    function touchUp(e: PointerEvent): boolean {
        touches.delete(e.pointerId);

        if (mode === 'pinch') {
            if (touches.size === 0) {
                mode = 'idle';
                note('щипок закончен');
            } else {
                rebasePinch();
            }
            releaseCapture(e);
            return true;
        }

        clearLongPress();
        lastTouchAt = Date.now();
        const result = taps.up(sampleOf(e));
        commitArmed(); // тап или удержание без сдвига
        const onLine = armedConn !== null; // палец лёг на связь (тап по ней не «пустое место»)
        if (armedConn) {
            const id = armedConn;
            armedConn = null;
            if (!taps.isMoved) {
                host.setSelection([]);
                host.selectConnection(id);
            }
        }
        if (result === 'double') {
            activateAt(e);
            note('двойной тап');
        } else if (result === 'tap') {
            // Тап по пустому месту снимает выделение (мы не трогали его при касании: палец мог пойти двигать холст).
            if (mode === 'pan' && !onLine) {
                host.setSelection([]);
                host.selectConnection(null);
            }
            note('тап');
        }
        return false;
    }

    /** Набор пальцев изменился (лёг второй, подняли один): отсчёт жеста начинается заново, скачка нет. */
    function rebasePinch() {
        const [a, b] = [...touches.values()];
        if (a) pinch.begin(pinchOf(a, b));
    }

    /**
     * Браузер присылает движение пальцев отдельными событиями: сдвинулся один палец, потом второй. Между ними расстояние
     * между пальцами «дёргается», хотя жест один. Поэтому положение двух пальцев разбираем один раз за кадр, когда
     * оба уже пришли.
     */
    let pinchFrame = 0;
    function schedulePinch() {
        if (pinchFrame) return;
        pinchFrame = requestAnimationFrame(() => {
            pinchFrame = 0;
            if (mode === 'pinch') pinchMove();
        });
    }

    /** Щипок и жест двумя пальцами; с одним оставшимся пальцем просто двигаем холст. */
    function pinchMove() {
        const [a, b] = [...touches.values()];
        const el = root.value;
        if (!a || !el) return;

        const step = pinch.update(pinchOf(a, b));
        const rect = el.getBoundingClientRect();
        host.setCamera(panBy(zoomAt(host.camera, step.pivot[0] - rect.left, step.pivot[1] - rect.top, step.factor), step.pan[0], step.pan[1]));
    }

    //--------------------------------------------------

    function onPointerDown(e: PointerEvent) {
        const el = root.value;
        if (!el) return;
        altDown = e.altKey;

        const touch = e.pointerType === 'touch';
        if (touch && touchDown(e)) return; // второй палец: щипок

        host.closePalette();
        lastX = e.clientX;
        lastY = e.clientY;
        panDistance = 0;
        const doubleDown = touch && beginTouch(e);

        if (e.button === 1 || e.button === 2) {
            el.focus();
            mode = 'pan';
        } else if (e.button === 0) {
            const id = nodeIdAt(e.target);

            // Поле ввода внутри ноды: выделяем ноду и отдаём событие полю (фокус, каретка, выделение текста).
            if (id && isEditable(e.target)) {
                if (touch) {
                    armed = id; // выделим при отпускании: палец может оказаться началом жеста двумя пальцами
                } else {
                    host.raise?.(id);
                    host.selectConnection(null);
                    if (!host.selection.has(id)) host.setSelection([id]);
                }
                return;
            }

            el.focus();

            const connId = connIdAt(e.target);
            if (connId) {
                if (touch) {
                    // Линия тонкая, и палец на ней чаще начинает двигать холст, чем выбирать связь: ведём себя как на пустом месте.
                    armedConn = connId;
                    mode = host.selectMode ? 'idle' : 'pan';
                    e.preventDefault();
                    capture(e);
                    return;
                }
                host.setSelection([]);
                host.selectConnection(connId);
                e.preventDefault();
                return;
            }
            // На сенсоре выбор связи снимаем позже (тап по пустому месту или начало рамки), а не при касании.
            if (!touch) host.selectConnection(null);

            const pin = host.connect ? options.pinAt(e.target) : null;
            // На сенсоре Ctrl нет: его роль играет режим «Выделение».
            const additive = e.ctrlKey || e.shiftKey || (touch && !!host.selectMode);
            if (id && (!touch || additive)) host.raise?.(id);

            const resizeHandle = host.resize && id ? (e.target as Element).closest<HTMLElement>('[data-resize]') : null;

            if (pin && host.connect) {
                host.connect.start(pin, cursorWorld(e));
                mode = 'connect';
            } else if (id && resizeHandle && host.resize) {
                const rect = host.resize.rectOf(id);
                if (!rect) return;
                if (touch) armed = id;
                else host.setSelection([id]);
                resizeId = id;
                resizeEdge = resizeHandle.dataset.resize as ResizeEdge;
                resizeStart = rect;
                resizeDx = 0;
                resizeDy = 0;
                mode = 'resize';
            } else if (id) {
                if (additive) {
                    host.toggleSelected(id);
                    if (!host.selection.has(id)) return;
                    host.beginDrag(id);
                } else if (touch) {
                    armed = id; // выделение и beginDrag: в commitArmed, когда палец пошёл тянуть
                } else {
                    if (!host.selection.has(id)) host.setSelection([id]);
                    host.beginDrag(id);
                }
                mode = 'drag';
            } else if (touch && !host.selectMode && !doubleDown) {
                // Один палец по пустому месту двигает холст; выделение (если тап) снимется при отпускании.
                mode = 'pan';
                note('холст');
            } else {
                if (touch) host.selectConnection(null);
                baseSelection = additive ? [...host.selection] : [];
                host.setSelection(baseSelection);
                marquee.value = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
                mode = 'marquee';
                if (touch) note('рамка');
            }
        } else {
            return;
        }

        e.preventDefault();
        capture(e);
    }

    /**
     * Жест оборвался, а `pointerup` не пришёл (alt-tab, окно перекрыли, система забрала указатель):
     * закрываем начатое, чтобы ничего не «зависло»: протянутая связь, рамка выделения, захваченная нода.
     * Сделанное к этому моменту (сдвиг, размер) остаётся и записывается в историю.
     */
    function abortGesture() {
        clearLongPress();
        taps.cancel();
        armed = null;
        armedConn = null;
        if (mode === 'connect') {
            host.connect?.cancel();
        } else if (mode === 'drag' || mode === 'resize') {
            host.endDrag();
            host.commit();
        }
        mode = 'idle';
        marquee.value = null;
        stopAutoScroll();
    }

    /** Оборвать всё, включая пальцы на холсте (потеря фокуса окна, системная отмена). */
    function cancelGesture() {
        touches.clear();
        abortGesture();
    }

    function onPointerCancel(e: PointerEvent) {
        touches.delete(e.pointerId);
        if (mode === 'pinch' && touches.size > 0) {
            rebasePinch();
            return;
        }
        cancelGesture();
    }

    /** Захват указателя пропал: если жест ещё идёт и это не щипок (там палец снимают сами), рвём его. */
    function onLostCapture() {
        if (mode === 'pinch' || mode === 'idle') return;
        cancelGesture();
    }

    //--------------------------------------------------
    // Автопрокрутка: пока тянешь ноду, рамку, связь или край и курсор у края холста, камера едет в ту сторону.
    // Цикл крутится, даже когда мышь стоит; скорость считается по времени, а не по кадрам.

    const SCROLL_MODES: readonly Mode[] = ['drag', 'resize', 'marquee', 'connect'];
    let scrollFrame = 0;
    let scrollLast = 0;

    function scrollVelocity(): [number, number] {
        const el = root.value;
        if (!el || !SCROLL_MODES.includes(mode)) return [0, 0];
        const r = el.getBoundingClientRect();
        return edgeScrollVelocity(lastX - r.left, lastY - r.top, r.width, r.height);
    }

    function kickAutoScroll() {
        if (scrollFrame) return;
        const [vx, vy] = scrollVelocity();
        if (vx === 0 && vy === 0) return;
        scrollLast = performance.now();
        scrollFrame = requestAnimationFrame(autoScrollFrame);
    }

    function stopAutoScroll() {
        cancelAnimationFrame(scrollFrame);
        scrollFrame = 0;
    }

    function autoScrollFrame(now: number) {
        scrollFrame = 0;
        const [vx, vy] = scrollVelocity();
        if (vx === 0 && vy === 0) return;

        const dt = Math.min((now - scrollLast) / 1000, MAX_FRAME_S);
        scrollLast = now;

        // Камера уехала на (sx, sy) экранных px, и то, что было под курсором, оказалось в стороне:
        // догоняем курсор тем, что у жеста привязано к миру.
        const sx = vx * dt;
        const sy = vy * dt;
        const z = host.camera.z;
        host.setCamera(panBy(host.camera, -sx, -sy));

        const pointer: Pointer = { clientX: lastX, clientY: lastY };
        if (mode === 'drag') {
            host.moveSelected(sx / z, sy / z, snapNow());
        } else if (mode === 'resize') {
            resizeDx += sx / z;
            resizeDy += sy / z;
            host.resize?.from(resizeId, resizeEdge, resizeStart, resizeDx, resizeDy, snapNow());
        } else if (mode === 'connect') {
            host.connect?.update(cursorWorld(pointer), pinUnder(pointer));
        } else if (mode === 'marquee' && marquee.value) {
            // Начало рамки стоит на месте в мире, значит на экране уехало вместе с камерой.
            const m = marquee.value;
            marquee.value = { x0: m.x0 - sx, y0: m.y0 - sy, x1: lastX, y1: lastY };
            host.setSelection([...baseSelection, ...nodesInMarquee()]);
        }

        scrollFrame = requestAnimationFrame(autoScrollFrame);
    }

    function onPointerMove(e: PointerEvent) {
        altDown = e.altKey;
        const touch = e.pointerType === 'touch';
        if (touch) {
            if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (mode === 'pinch') {
                schedulePinch();
                return;
            }
            if (taps.move(sampleOf(e))) clearLongPress();
            // Пока палец не вышел за допуск тапа, холст и ноды стоят: дрожание не должно двигать ни то, ни другое.
            if (!taps.isMoved && (mode === 'pan' || mode === 'drag' || mode === 'resize')) return;
            if (armed && (mode === 'drag' || mode === 'resize')) commitArmed();
        } else if (mode !== 'idle' && e.buttons === 0) {
            // Кнопку отпустили где-то вне окна: событие мы не увидели, но по движению видно, что жест окончен.
            cancelGesture();
            return;
        }

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        if (mode === 'pan') {
            panDistance += Math.hypot(dx, dy);
            host.setCamera(panBy(host.camera, dx, dy));
        } else if (mode === 'drag') {
            host.moveSelected(dx / host.camera.z, dy / host.camera.z, snapNow());
        } else if (mode === 'resize') {
            resizeDx += dx / host.camera.z;
            resizeDy += dy / host.camera.z;
            host.resize?.from(resizeId, resizeEdge, resizeStart, resizeDx, resizeDy, snapNow());
        } else if (mode === 'connect') {
            host.connect?.update(cursorWorld(e), pinUnder(e));
        } else if (mode === 'marquee' && marquee.value) {
            marquee.value = { ...marquee.value, x1: e.clientX, y1: e.clientY };
            host.setSelection([...baseSelection, ...nodesInMarquee()]);
        }

        kickAutoScroll();
    }

    function onPointerUp(e: PointerEvent) {
        if (e.pointerType === 'touch' && touchUp(e)) return;
        if (mode === 'idle') return;
        if (mode === 'connect' && host.connect) {
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const origin = host.connect.origin;
            const connected = host.connect.finish(pinUnder(e));

            // Отпустили связь над пустым холстом: предлагаем создать ноду и подключить её.
            if (!connected && origin !== null && under && root.value?.contains(under) && !under.closest('[data-node-id]')) {
                openPaletteAt(e, origin);
            }
        } else if (mode === 'drag' || mode === 'resize') {
            host.endDrag();
            host.commit(); // перетаскивание или изменение размера целиком: один шаг истории (без сдвига ничего не запишется)
        } else if (mode === 'pan' && e.button === 2 && panDistance < PAN_CLICK_THRESHOLD) {
            openPaletteAt(e, null);
        }
        mode = 'idle';
        marquee.value = null;
        stopAutoScroll();
        releaseCapture(e);
    }

    /**
     * Горячие клавиши на всём окне, чтобы работали и после клика по панели инструментов.
     * Смотрим на физическую клавишу (`code`), чтобы Ctrl+Z работало и в русской раскладке.
     */
    function onKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) return;

        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'KeyZ' && !e.shiftKey) host.undo();
            else if (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)) host.redo();
            else return;
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            host.removeSelected();
        } else if (e.key === 'Escape') {
            host.closePalette();
        } else {
            return;
        }
        e.preventDefault();
    }

    /**
     * Двойное действие (двойной клик или двойной тап): по связи и по полосе ноды; что именно произойдёт,
     * решает приложение.
     */
    function activateAt(p: Pointer) {
        if (!host.activate) return;
        const under = document.elementFromPoint(p.clientX, p.clientY);
        const connId = connIdAt(under);
        if (connId) {
            host.activate({ kind: 'link', id: connId, at: cursorWorld(p) });
            return;
        }

        const handle = (under as Element | null)?.closest('[data-node-handle]');
        const nodeId = handle ? nodeIdAt(handle) : null;
        if (nodeId) host.activate({ kind: 'handle', nodeId });
    }

    /** Событие приходит на холст (он держит захват указателя). На сенсоре двойной тап распознаём сами, иначе действие сработало бы дважды. */
    function onDblClick(e: MouseEvent) {
        if (Date.now() - lastTouchAt < 800) return;
        activateAt(e);
    }

    /**
     * Колесо двигает холст, а масштаб только с Ctrl/Cmd (щипок тачпада приходит как Ctrl + колесо): так колесо над
     * заметкой, которую можно прокрутить, не масштабирует холст, стоит курсору случайно выйти за её край.
     */
    function onWheel(e: WheelEvent) {
        const el = root.value!;
        const zooming = e.ctrlKey || e.metaKey;

        // Колесо над прокручиваемым полем (длинная заметка) листает его, а не двигает холст.
        const field = (e.target as Element | null)?.closest('textarea');
        if (!zooming && field && field.scrollHeight > field.clientHeight) return;

        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const intent = wheelIntent(e, rect.height);
        if (intent.kind === 'zoom') {
            host.setCamera(zoomAt(host.camera, e.clientX - rect.left, e.clientY - rect.top, intent.factor));
        } else {
            host.setCamera(panBy(host.camera, intent.dx, intent.dy));
        }
    }

    //--------------------------------------------------
    // Жизненный цикл

    // Размер холста нужен приложению, чтобы ставить новые ноды в центр экрана.
    let resizeObserver: ResizeObserver | null = null;

    onMounted(() => {
        const el = root.value!;
        const update = () => host.setViewport({ w: el.clientWidth, h: el.clientHeight });
        update();
        resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(el);
        window.addEventListener('keydown', onKey);
        window.addEventListener('blur', cancelGesture);
        window.addEventListener('pointerup', purgeTouch);
        window.addEventListener('pointercancel', purgeTouch);
    });

    onUnmounted(() => {
        resizeObserver?.disconnect();
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', cancelGesture);
        window.removeEventListener('pointerup', purgeTouch);
        window.removeEventListener('pointercancel', purgeTouch);
        stopAutoScroll();
        clearLongPress();
        cancelAnimationFrame(pinchFrame);
    });

    // После закрытия палитры возвращаем фокус на холст, чтобы работали горячие клавиши.
    watch(
        () => host.paletteOpen,
        (now, before) => {
            if (!now && before) root.value?.focus();
        },
    );

    return {
        marquee,
        debug,
        debugText,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onLostCapture,
            onWheel,
            onDblClick,
        },
    };
}
