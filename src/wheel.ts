/**
 * Что делает колесо мыши или двухпальцевая прокрутка тачпада. Как в Figma и Miro:
 * колесо двигает холст, а масштаб только с Ctrl (или Cmd). Щипок на тачпаде браузер присылает
 * как колесо с зажатым Ctrl, так что он тоже масштабирует, а обычная прокрутка не масштабирует случайно.
 * Чистая функция: что делать, решает она, а камеру двигает вызывающий.
 */

export interface WheelLike {
    deltaX: number;
    deltaY: number;
    /** 0 — пиксели, 1 — строки, 2 — страницы. */
    deltaMode: number;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

export type WheelIntent = { kind: 'zoom'; factor: number } | { kind: 'pan'; dx: number; dy: number };

/** Масштаб на одну засечку колеса мыши (deltaY ±100) и на одно событие щипка тачпада (deltaY — единицы). */
const ZOOM_SPEED_MOUSE = 0.0015;
const ZOOM_SPEED_PINCH = 0.01;
/** Событие мельче этого считаем плавным (тачпад), крупнее — засечкой колеса мыши. */
const SMOOTH_DELTA_PX = 30;
const LINE_PX = 16;

/** Размер дельты в пикселях: колесо мыши может присылать строки и страницы. */
function toPixels(delta: number, mode: number, pageSize: number): number {
    if (mode === 1) return delta * LINE_PX;
    if (mode === 2) return delta * pageSize;
    return delta;
}

export function wheelIntent(e: WheelLike, pageSize: number): WheelIntent {
    const dx = toPixels(e.deltaX, e.deltaMode, pageSize);
    const dy = toPixels(e.deltaY, e.deltaMode, pageSize);

    if (e.ctrlKey || e.metaKey) {
        const speed = Math.abs(dy) < SMOOTH_DELTA_PX ? ZOOM_SPEED_PINCH : ZOOM_SPEED_MOUSE;
        return { kind: 'zoom', factor: Math.exp(-dy * speed) };
    }

    // Shift + колесо: по горизонтали (на части платформ браузер уже сам превращает это в deltaX).
    if (e.shiftKey && dx === 0) return { kind: 'pan', dx: -dy, dy: 0 };
    return { kind: 'pan', dx: -dx, dy: -dy };
}
