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
