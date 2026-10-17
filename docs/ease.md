# Transitions between curve points (`ease`)

**English** · [Русский](ease.ru.md)

Every curve point may have an `ease` field: it says **how to go from this point to the next one**. The last point has no transition. Without the field the segment is linear, so old files read as before.

```ts
const curve: CurvePoint[] = [
    { t: 0,   v: 0, ease: 'cubic-out' },                       // a smooth deceleration
    { t: 0.5, v: 1, ease: { bezier: [0.25, 0.1, 0.25, 1] } },  // your own Bezier curve
    { t: 1,   v: 0 },
];
```

## What you can set

| Value | What it does |
| --- | --- |
| `'linear'` | a straight line (the same as no field) |
| `'step'` | a step: the value is held until the next point and jumps there |
| `'<family>-<direction>'` | a ready function, the list is below |
| `{ bezier: [x1, y1, x2, y2] }` | a cubic Bezier curve, like `cubic-bezier()` in CSS |

Families: `sine`, `quad`, `cubic`, `quart`, `expo`, `back`, `elastic`, `bounce`.
Directions: `in` (acceleration), `out` (deceleration), `in-out` (both).
Examples: `quad-in`, `elastic-out`, `back-in-out`.

`back`, `elastic` and Bezier may leave the point values (overshoot). This is not an error: the editor widens the view so the curve and the handles stay visible. `bounce` stays within the segment.

In a Bezier `x1` and `x2` must be in the range 0…1 (otherwise time would run backwards), while `y1` and `y2` are free.

## The `@1337exp/taoux/ease` module

Pure maths with no dependencies (tier 0). The editor draws segments with the same formulas a runtime computes the value with, so the picture and the result match.

```ts
import { easeValue, isEase, EASE_NAMES, cubicBezier, DEFAULT_BEZIER } from '@1337exp/taoux/ease';

easeValue('quad-in', 0.5);                  // 0.25
easeValue({ bezier: [0.42, 0, 0.58, 1] }, 0.5);
isEase(valueFromFile);                      // validates a value from a file
```

- `easeValue(ease, u)` takes the fraction `u` of a segment (clamped outside 0…1) and returns the fraction of the value.
- `isEase(x)` validates a value from a file: a name from the list, or a Bezier of four finite numbers with `x` in 0…1.
- `easeParts(name)` and `easeName(family, direction)` split and build a name.

A runtime does not have to depend on taoux at install time: the module is tiny and can be inlined into your build.

## In the curve editor

- A segment is drawn by its own transition. A "B" mark in the curve colour stands above the start of a Bezier segment.
- The **selected** point with a Bezier shows two handles. Drag them with the mouse or move them with the arrows (step 0.05, ×5 with Shift). A handle never leaves 0…1 along `x`.
- The view grows with the handles: pull a handle far and the scale zooms out, so the handle can always be reached. While dragging, the view stands still and is recomputed on release.
- A segment with no height difference (`v` of both points equal) has no handles: its shape does not depend on them.
- Guides from the selected point to the axes: the `guides` prop (`off`, `lines`, `values`). `lines` draws dashed lines, `values` adds the point values on the axes. `lines` by default; `TaoxCurveField` has the same prop.
- Labels for screen readers: `pointLabel` for points, `handleLabel(n, index)` for handles.

Operations: `setEase(points, index, ease)` sets a transition (`undefined` or `'linear'` removes the field), `sampleSegment(a, b)` returns the polyline of a segment for drawing, `sampleCurve` and `valueBounds` take transitions into account. `movePoint` keeps `ease` on the moved point.

## Not doing yet

Host-supplied functions (a callback instead of a name): the file must stay pure data.
