/** Сторона ноды, на которой сидит пин связи. */
export type Side = 'left' | 'right' | 'top' | 'bottom';
/** `end`: наконечник стрелки на конце связи. */
export type Arrow = 'none' | 'end';

type Point = readonly [number, number];

/** Куда смотрит наружу пин на данной стороне ноды. */
const OUT: Record<Side, Point> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

/** Размер наконечника стрелки на экране: крупнейший (при зуме 1 и ближе) и мельчайший (при сильном отдалении), px. */
export const HEAD_MAX_PX = 14;
export const HEAD_MIN_PX = 6;

/**
 * Размер наконечника на экране при масштабе камеры `zoom`. Постоянные 14 px при отдалении выглядели огромными
 * рядом с уменьшившимися нодами (при зуме 0.2 заметка 48 px, и стрелка занимала треть её ширины), поэтому он
 * уменьшается плавно (корень из масштаба), но не мельче `HEAD_MIN_PX`, чтобы стрелка оставалась читаемой.
 */
export function headSizePx(zoom: number): number {
    return Math.min(HEAD_MAX_PX, Math.max(HEAD_MIN_PX, HEAD_MAX_PX * Math.sqrt(zoom)));
}
const MIN_TENSION = 60;

export interface LinkShape {
    /** Путь линии. */
    d: string;
    /** Путь наконечника (залитый треугольник) или null, если стрелки нет. */
    head: string | null;
}

/** Вынос контрольной точки: половина расстояния вдоль оси стороны, но не меньше минимума. */
function tension(side: Side, a: Point, b: Point): number {
    const along = OUT[side][0] !== 0 ? Math.abs(b[0] - a[0]) : Math.abs(b[1] - a[1]);
    return Math.max(along * 0.5, MIN_TENSION);
}

/**
 * Кривая Безье между двумя пинами: из пина она выходит наружу ноды (вправо из правого, вверх из верхнего и т.д.).
 * Наконечник рисуем сами, а не маркером SVG: линия тонкая «в пикселях экрана», и наконечник должен
 * держать свой экранный размер при любом масштабе камеры `zoom`.
 */
export function linkShape(a: Point, aSide: Side, b: Point, bSide: Side, arrow: Arrow, zoom: number): LinkShape {
    const [ax, ay] = OUT[aSide];
    const [bx, by] = OUT[bSide];
    const ta = tension(aSide, a, b);
    const tb = tension(bSide, a, b);
    const c1: Point = [a[0] + ax * ta, a[1] + ay * ta];
    const c2: Point = [b[0] + bx * tb, b[1] + by * tb];

    if (arrow === 'none') {
        return { d: `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${b[0]} ${b[1]}`, head: null };
    }

    // Стрелка смотрит в ноду, то есть против «наружу» пина. Линию заканчиваем внутри наконечника.
    const dx = -bx;
    const dy = -by;
    const size = headSizePx(zoom) / zoom; // в мировых единицах
    const end: Point = [b[0] - dx * size * 0.8, b[1] - dy * size * 0.8];
    const base: Point = [b[0] - dx * size, b[1] - dy * size];
    const half = size * 0.45;
    // Крылья наконечника перпендикулярны направлению.
    const px = -dy * half;
    const py = dx * half;

    return {
        d: `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${end[0]} ${end[1]}`,
        head: `M ${b[0]} ${b[1]} L ${base[0] + px} ${base[1] + py} L ${base[0] - px} ${base[1] - py} Z`,
    };
}

/** Кубическая кривая Безье с горизонтальными касательными, как в Blueprint (для связей «выход справа, вход слева»). */
export function curvePath(x1: number, y1: number, x2: number, y2: number): string {
    const tension = Math.max(Math.abs(x2 - x1) * 0.5, 60);
    return `M ${x1} ${y1} C ${x1 + tension} ${y1}, ${x2 - tension} ${y2}, ${x2} ${y2}`;
}
