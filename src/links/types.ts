/**
 * The line style of a link: a solid line, dashes or dots.
 * Стиль линии связи: сплошная, штрихи или точки.
 */
export type LinkDash = 'solid' | 'dashed' | 'dotted';

/**
 * Ready-made link geometry. Paths are built by the app (see `curve`): the canvas does not know how pins are laid out.
 * Готовая геометрия связи. Пути строит приложение (см. `curve`): холст не знает, как устроены пины.
 */
export interface LinkLine {
    /**
     * Goes into `data-conn-id`: that is how the canvas knows which link was clicked.
     * Попадает в `data-conn-id`: по нему холст понимает, по какой связи кликнули.
     */
    id: string;
    /**
     * The line path (the SVG `d` attribute).
     * Путь линии (атрибут `d` SVG).
     */
    d: string;
    /**
     * The path of the filled arrowhead; none means no arrow.
     * Путь залитого наконечника стрелки; нет — стрелки нет.
     */
    head?: string | null;
    /**
     * The colour of this link (any CSS colour). Without it `--tx-link-color` is used.
     * Цвет этой связи (любой CSS-цвет). Без него берётся `--tx-link-color`.
     */
    color?: string;
    /**
     * The line style: `'solid'` (default), `'dashed'` or `'dotted'`. The dashes are measured in line widths (so they grow
     * with `width`) and in screen pixels (they do not change with the zoom, like the line itself); the arrowhead stays
     * solid and the hit area ignores the gaps. A preview keeps its own dashes unless it names `'dashed'` or `'dotted'`.
     * Стиль линии: `'solid'` (по умолчанию), `'dashed'` или `'dotted'`. Штрихи меряются в толщинах линии (растут вместе с
     * `width`) и в экранных пикселях (от зума не меняются, как и сама линия); наконечник остаётся сплошным, а зона
     * попадания пропусков не имеет. У предпросмотра свой пунктир, пока не задан `'dashed'` или `'dotted'`.
     */
    dash?: LinkDash;
    /**
     * The thickness of this link in screen pixels (a positive number). Without it `--tx-link-width` is used (2); on hover
     * and selection it grows by one pixel, as the default does.
     * Толщина этой связи в экранных пикселях (положительное число). Без неё берётся `--tx-link-width` (2); при наведении
     * и выборе растёт на один пиксель, как и по умолчанию.
     */
    width?: number;
}

/**
 * The link the user is dragging out right now.
 * Связь, которую пользователь протягивает сейчас.
 */
export interface LinkPreview extends LinkLine {
    /**
     * The target is not allowed: the line turns red.
     * Цель недопустима: линия краснеет.
     */
    invalid?: boolean;
}
