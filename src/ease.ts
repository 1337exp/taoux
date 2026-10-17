// Функции смягчения (easing): как значение идёт от 0 к 1, пока время идёт от 0 к 1. Чистая математика без зависимостей:
// ею пользуется редактор кривой (рисует участок) и рантайм (считает значение), поэтому результат у них один и тот же.

/** Семейства: у каждого три направления. */
export const EASE_FAMILIES = ['sine', 'quad', 'cubic', 'quart', 'expo', 'back', 'elastic', 'bounce'] as const;
/** `in` разгон, `out` торможение, `in-out` и то и другое. */
export const EASE_DIRECTIONS = ['in', 'out', 'in-out'] as const;

export type EaseFamily = (typeof EASE_FAMILIES)[number];
export type EaseDirection = (typeof EASE_DIRECTIONS)[number];
/** Именованный переход: `linear`, `step` (держит значение до следующей точки) или `семейство-направление`. */
export type EaseName = 'linear' | 'step' | `${EaseFamily}-${EaseDirection}`;
/** Переход: имя или кубическая кривая Безье `[x1, y1, x2, y2]`, как `cubic-bezier()` в CSS (x в 0…1, y свободный). */
export type Ease = EaseName | { bezier: readonly [number, number, number, number] };

export const EASE_NAMES: readonly EaseName[] = ['linear', 'step', ...EASE_FAMILIES.flatMap((f) => EASE_DIRECTIONS.map((d) => `${f}-${d}` as EaseName))];

const NAMES = new Set<string>(EASE_NAMES);

/** Безье по умолчанию, когда пользователь выбрал «своя кривая»: мягкий старт и финиш (как `ease` в CSS). */
export const DEFAULT_BEZIER: readonly [number, number, number, number] = [0.25, 0.1, 0.25, 1];

//--------------------------------------------------
// Формулы: в каждом семействе задано торможение (`out`), остальное выводится из него зеркалом

const PI = Math.PI;
const C1 = 1.70158;
const C3 = C1 + 1;
const C4 = (2 * PI) / 3;

const OUT: Record<EaseFamily, (t: number) => number> = {
    sine: (t) => Math.sin((t * PI) / 2),
    quad: (t) => 1 - (1 - t) * (1 - t),
    cubic: (t) => 1 - Math.pow(1 - t, 3),
    quart: (t) => 1 - Math.pow(1 - t, 4),
    expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    back: (t) => 1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2),
    elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * C4) + 1),
    bounce: (t) => {
        const n = 7.5625;
        const d = 2.75;
        if (t < 1 / d) return n * t * t;
        if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
        if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
        return n * (t -= 2.625 / d) * t + 0.984375;
    },
};

function family(f: EaseFamily, dir: EaseDirection, t: number): number {
    const out = OUT[f];
    if (dir === 'out') return out(t);
    if (dir === 'in') return 1 - out(1 - t);
    return t < 0.5 ? (1 - out(1 - 2 * t)) / 2 : (1 + out(2 * t - 1)) / 2;
}

/**
 * Кубическая кривая Безье как функция времени: точки (0,0), (x1,y1), (x2,y2), (1,1). По x ищем параметр (Ньютон, при плоском
 * наклоне деление пополам), по нему берём y. x ограничен 0…1, y может выходить за 0…1 (заступ).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
    const X1 = Math.min(1, Math.max(0, x1));
    const X2 = Math.min(1, Math.max(0, x2));
    const bx = (s: number) => 3 * (1 - s) * (1 - s) * s * X1 + 3 * (1 - s) * s * s * X2 + s * s * s;
    const by = (s: number) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
    const dx = (s: number) => 3 * (1 - s) * (1 - s) * X1 + 6 * (1 - s) * s * (X2 - X1) + 3 * s * s * (1 - X2);

    return (t) => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        let s = t;
        for (let i = 0; i < 8; i++) {
            const err = bx(s) - t;
            if (Math.abs(err) < 1e-6) return by(s);
            const slope = dx(s);
            if (Math.abs(slope) < 1e-6) break;
            s -= err / slope;
        }
        let lo = 0;
        let hi = 1;
        s = t;
        for (let i = 0; i < 40; i++) {
            const x = bx(s);
            if (Math.abs(x - t) < 1e-6) break;
            if (x < t) lo = s;
            else hi = s;
            s = (lo + hi) / 2;
        }
        return by(s);
    };
}

/** Разбирает имя перехода на семейство и направление; у `linear` и `step` их нет (null). */
export function easeParts(name: EaseName): { family: EaseFamily; direction: EaseDirection } | null {
    if (name === 'linear' || name === 'step') return null;
    const i = name.indexOf('-');
    return { family: name.slice(0, i) as EaseFamily, direction: name.slice(i + 1) as EaseDirection };
}

/** Собирает имя из семейства и направления. */
export const easeName = (f: EaseFamily, d: EaseDirection): EaseName => `${f}-${d}`;

/** Проверка значения из файла: имя из списка или Безье из четырёх конечных чисел с x в 0…1. */
export function isEase(value: unknown): value is Ease {
    if (typeof value === 'string') return NAMES.has(value);
    if (typeof value !== 'object' || value === null) return false;
    const b = (value as { bezier?: unknown }).bezier;
    return Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === 'number' && Number.isFinite(n)) && b[0]! >= 0 && b[0]! <= 1 && b[2]! >= 0 && b[2]! <= 1;
}

const cache = new Map<string, (t: number) => number>();

/**
 * Применяет переход к доле `u` участка (0…1, вне зажимается). Без перехода линейно. `back`, `elastic` и Безье могут
 * выйти за 0…1: это заступ, а не ошибка.
 */
export function easeValue(ease: Ease | undefined, u: number): number {
    const t = u <= 0 ? 0 : u >= 1 ? 1 : u;
    if (ease === undefined || ease === 'linear') return t;
    if (ease === 'step') return t >= 1 ? 1 : 0;
    if (typeof ease === 'object') {
        const key = ease.bezier.join(',');
        let fn = cache.get(key);
        if (!fn) {
            if (cache.size > 64) cache.clear();
            cache.set(key, (fn = cubicBezier(ease.bezier[0], ease.bezier[1], ease.bezier[2], ease.bezier[3])));
        }
        return fn(t);
    }
    const parts = easeParts(ease);
    return parts ? family(parts.family, parts.direction, t) : t;
}
