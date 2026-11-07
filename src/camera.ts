/**
 * Camera: screen point = world * z + (x, y).
 * Screen coordinates here are relative to the top-left corner of the canvas.
 * Камера: экранная точка = мировая * z + (x, y).
 * Экранные координаты здесь — относительно левого верхнего угла холста.
 */
export interface Camera {
    x: number;
    y: number;
    z: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2;

/**
 * The range of the zoom. Apps with another scale of the world (a level a thousand units long) pass their own.
 * Диапазон масштаба. Приложения с другим масштабом мира (уровень длиной в тысячу единиц) передают свой.
 */
export interface ZoomLimits {
    min: number;
    max: number;
}

export const ZOOM_LIMITS: Readonly<ZoomLimits> = { min: MIN_ZOOM, max: MAX_ZOOM };

/**
 * Limits with the defaults filled in: `{ min: 0.05 }` keeps the default maximum.
 * Пределы с подставленными значениями по умолчанию: `{ min: 0.05 }` оставляет максимум прежним.
 */
export function zoomLimits(limits?: Partial<ZoomLimits>): ZoomLimits {
    return { min: limits?.min ?? MIN_ZOOM, max: limits?.max ?? MAX_ZOOM };
}

export const clampZoom = (z: number, limits: Readonly<ZoomLimits> = ZOOM_LIMITS): number => Math.min(limits.max, Math.max(limits.min, z));

export const createCamera = (): Camera => ({ x: 0, y: 0, z: 1 });

export function screenToWorld(cam: Camera, sx: number, sy: number): [number, number] {
    return [(sx - cam.x) / cam.z, (sy - cam.y) / cam.z];
}

export function worldToScreen(cam: Camera, wx: number, wy: number): [number, number] {
    return [wx * cam.z + cam.x, wy * cam.z + cam.y];
}

export function panBy(cam: Camera, dx: number, dy: number): Camera {
    return { ...cam, x: cam.x + dx, y: cam.y + dy };
}

/**
 * Zoom by `factor`; the point under the cursor (sx, sy) stays where it is. `limits` default to 0.2…2.
 * Масштаб в `factor` раз; точка под курсором (sx, sy) остаётся на месте. `limits` по умолчанию 0.2…2.
 */
export function zoomAt(cam: Camera, sx: number, sy: number, factor: number, limits: Readonly<ZoomLimits> = ZOOM_LIMITS): Camera {
    const z = clampZoom(cam.z * factor, limits);
    const k = z / cam.z;
    return { x: sx - (sx - cam.x) * k, y: sy - (sy - cam.y) * k, z };
}

/**
 * A camera that shows the whole rectangle `rect` (world units) in a view `size` (px), centred, with `padding` px of air
 * on every side. The zoom is clamped to `limits` (a tiny rectangle is not blown up beyond `max`; with `max` set to 1 it is
 * "fit, but never enlarge"). An empty or degenerate rectangle gives the default camera.
 * Камера, которая показывает весь прямоугольник `rect` (мировые единицы) в области `size` (px), по центру, с запасом
 * `padding` px со всех сторон. Масштаб ограничен `limits` (крошечный прямоугольник не раздувается выше `max`; с `max`, равным 1,
 * это «вписать, но не увеличивать»). Пустой или вырожденный прямоугольник даёт камеру по умолчанию.
 */
export function fitCamera(
    rect: { x: number; y: number; w: number; h: number } | null,
    size: { w: number; h: number },
    padding = 48,
    limits: Readonly<ZoomLimits> = ZOOM_LIMITS,
): Camera {
    if (!rect || rect.w <= 0 || rect.h <= 0 || size.w <= 0 || size.h <= 0) return createCamera();
    const availW = Math.max(1, size.w - padding * 2);
    const availH = Math.max(1, size.h - padding * 2);
    const z = clampZoom(Math.min(availW / rect.w, availH / rect.h), limits);
    return { z, x: (size.w - rect.w * z) / 2 - rect.x * z, y: (size.h - rect.h * z) / 2 - rect.y * z };
}
