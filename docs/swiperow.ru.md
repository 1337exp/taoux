# swiperow

[English](swiperow.md)

`TaoxSwipeRow` оборачивает строку списка: свайп к началу после порога выполняет `start`, свайп к концу открывает
действия `end`, длинный свайп выполняет последнее из них (`fullSwipe`, включён по умолчанию; с `:full-swipe="false"`
протяжка упирается в пружину, и строка остаётся открытой).

## Переменные

Задаются на строке или на любом элементе вокруг неё.

| Переменная | По умолчанию | Что |
| --- | --- | --- |
| `--tx-swipe-bg` | `var(--tao-color-surface-raised)` | Лицо строки и основа, на которой подкрашены действия. Строка прямо на странице: `var(--tao-color-bg)` |
| `--tx-swipe-radius` | `var(--tao-radius-panel, 12px)` | Углы строки |
| `--tx-swipe-gap` | `6px` | Зазор между действиями справа |

## Как проверить свайп автоматически

Строка слушает события указателя на `.tx-swipe__front`, поэтому тест может вести её синтетическими `PointerEvent`,
настоящими касаниями (Playwright `page.touchscreen`, CDP `Input.dispatchTouchEvent`) или мышью, если у строки `mouse`.
Три вещи, которые нужно знать:

1. **Отправляйте события на `.tx-swipe__front`**, а не на корень `.tx-swipe`: слушатели на лице строки.
2. **Двигайте в несколько шагов.** Первое движение за порогом (несколько пикселей) только решает, что это свайп, а не
   прокрутка, и становится нулевой точкой, чтобы строка не прыгнула на величину порога. `pointerdown`, одно длинное
   `pointermove` и `pointerup` ничего не сдвигают.
3. **Не уводите фокус из окна.** Удерживаемый жест отпускается, когда окно теряет фокус (клик в консоль DevTools
   посреди жеста — как раз это), так же, как для настоящего пальца.

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
  await new Promise((r) => setTimeout(r, 16)); // не requestAnimationFrame: в скрытой вкладке он ждёт
}
send('pointerup', x); // строка остаётся открытой: видны действия справа
```

В Playwright то же самое идёт настоящими касаниями:

```js
const box = await page.locator('.tx-swipe__front').first().boundingBox();
const y = box.y + box.height / 2;
const cdp = await page.context().newCDPSession(page);
const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
await touch('touchStart', box.x + box.width - 20);
for (let x = box.x + box.width - 35; x > box.x + box.width - 220; x -= 15) await touch('touchMove', x);
await touch('touchEnd');
```
