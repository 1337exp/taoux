# swiperow

[Русский](swiperow.ru.md)

`TaoxSwipeRow` wraps a list row: a pull to the start runs `start` past a threshold, a pull to the end opens the `end`
actions, a long pull runs the last of them (`fullSwipe`, on by default; with `:full-swipe="false"` the pull meets a
spring and the row rests open).

## Keyboard

Each action button is a Tab stop and shows its side when it gets the focus. With your own keyboard path to the same
actions (arrows, Delete, a menu key) set `:tabbable="false"`: the buttons leave the Tab order and still work by a click
or a swipe.

## An open row and a click

While the row is open, only its actions are live. A click on the open row (the sliver of it that is left) closes it
and does not reach its content, so a tap meant to close never opens the item hidden under it. A press outside the row
closes it too, and the click that follows that press is swallowed once: it does not open another row or press a button
(a mail app does the same). A press that gives no click (a scroll) lets go of the guard after 0.6 s. To let the click
through after the row has closed, set `:swallow-outside-click="false"`; the click on the open row itself is always
kept from its content.

## Variables

Set them on the row or on any element around it.

| Variable | Default | What |
| --- | --- | --- |
| `--tx-swipe-bg` | `var(--tao-color-surface-raised)` | The face of the row and the ground its actions are tinted on. A row that lies right on the page: `var(--tao-color-bg)` |
| `--tx-swipe-radius` | `var(--tao-radius-panel, 12px)` | The corners of the row |
| `--tx-swipe-gap` | `6px` | The gap between the end actions |

## Testing a swipe

The row listens to pointer events on `.tx-swipe__front`, so a test can drive it with synthetic `PointerEvent`s, with
real touches (Playwright `page.touchscreen`, CDP `Input.dispatchTouchEvent`) or with the mouse when the row has `mouse`.
Three things to know:

1. **Send the events to `.tx-swipe__front`**, not to the `.tx-swipe` root: the listeners are on the face.
2. **Move in several steps.** The first move past the slop (a few pixels) only decides that this is a swipe and not a
   scroll, and becomes the zero point, so the row does not jump by the slop. `pointerdown`, one long `pointermove` and
   `pointerup` move nothing.
3. **Keep the window focused.** A held gesture lets go when the window loses the focus (a click into the DevTools
   console in the middle of it does that), as it does for a real finger.

```js
const front = document.querySelector('.tx-swipe__front');
const { top, height, right } = front.getBoundingClientRect();
const y = top + height / 2;
const send = (type, x) => front.dispatchEvent(new PointerEvent(type, {
  pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y,
}));

let x = right - 20;
send('pointerdown', x);
for (let i = 0; i < 12; i++) {
  x -= 15;
  send('pointermove', x);
  await new Promise((r) => setTimeout(r, 16)); // not requestAnimationFrame: it waits in a hidden tab
}
send('pointerup', x); // the row rests open: its end actions are shown
```

With Playwright the same goes through real touches:

```js
const box = await page.locator('.tx-swipe__front').first().boundingBox();
const y = box.y + box.height / 2;
const cdp = await page.context().newCDPSession(page);
const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
await touch('touchStart', box.x + box.width - 20);
for (let x = box.x + box.width - 35; x > box.x + box.width - 220; x -= 15) await touch('touchMove', x);
await touch('touchEnd');
```
