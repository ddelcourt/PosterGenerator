# Module Development Guide

A module is a self-contained JavaScript file that registers one or more layer types with the poster generator. Once registered, the layer type appears in the **New Layer** dialog and the **Type** selector in Layer Properties.

---

## Quick Start

1. Copy `js/modules/_template.js` to a new file (e.g. `js/modules/my_wave.js`).
2. Replace every `TODO` comment in the file.
3. Add a `<script>` tag in `index.html` **after** `app.js` and **before** `ui.js`:
   ```html
   <script src="js/modules/my_wave.js"></script>
   ```
4. Reload the browser → your module appears in the layer type selector.

---

## File Layout

```
js/modules/
  _template.js        ← annotated starting point
  recursive_div_1.js  ← Jazz cell-division layer
  title_vertical.js   ← AMR stacked-letter layer
  gliding_text.js     ← Festival scrolling-text layer
  image_layers.js     ← SVG and raster image layers
```

A module file must call `window.AMRApp.registerModule(def)` before `ui.js` runs.

---

## Registration Object

```js
window.AMRApp.registerModule({
  id:       'my_module',    // (required) unique snake_case identifier — never change once deployed
  patch:    'my_module',    // (required) source filename without .js — shown in the ⓘ tooltip
  name:     'My Module',    // (required) label shown in Type selector and New Layer dialog

  defaults: { ... },        // (required) param keys → starting values
  params:   [ ... ],        // (required) UI schema — see "Param Types" below

  layers:   [ ... ],        // (required) one or more layer descriptors — see "Layers"

  onUpdate(key, value) {},  // (optional) called after every dispatch()
  build() {},               // (optional) called when structural params change
  buildUI(container) {}     // (optional) custom HTML injected after auto params
});
```

---

## The Global `P` Object

`P` is the shared parameter store for the entire app. All registered module defaults are merged into it at startup.

**During a draw call your layer's own params are already in `P`.** The draw loop does `Object.assign(P, layer.params)` before calling `draw()`, then restores the previous values afterwards. You never need to do this yourself.

**During an `onUpdate` call, `P[key]` has already been set to the new value.**

### Naming convention — param key prefixes

Every key in `defaults` must start with a short prefix unique to your module. This prevents collisions when multiple layers share the global `P`.

```
recursive_div_1   →  seed, ink, minC, fill, ...      (no prefix — legacy)
title_vertical    →  amrColor, amrFont, amrSize, ...  (amr)
gliding_text      →  fText, fColor, fSize, ...        (f)
image_layers      →  svgPath, svgX, svgW, ...         (svg / img)
```

Pick a prefix that is not already in use. Two-to-four characters works well: `gr`, `wv`, `dot`, `ring`.

---

## Layers

Each entry in the `layers` array registers a drawable layer.

```js
layers: [{
  id:        'my_module',   // unique string; can match the module id when there is only one layer
  name:      'My Module',   // display name in the Layers palette
  visible:   true,          // initial visibility

  // Required draw functions:
  draw:      _draw,         // fn(g, k) — canvas rendering
  svg:       _svg,          // fn()     — returns SVG fragment string

  // Optional animation hooks:
  advance()   { ... },      // called once per frame before draw()
  needsLoop() { return ...; },  // return true to keep the rAF loop running

  // Optional offscreen cache:
  cached: true,
  key()   { return [...].join('|'); }   // string that invalidates the cache
}]
```

---

## `draw(g, k)` — Canvas Rendering

| Argument | Type | Description |
|----------|------|-------------|
| `g` | `CanvasRenderingContext2D` | The p5.js drawing context |
| `k` | `number` | Pixels per centimetre — multiply every cm value by `k` |

```js
function _draw(g, k) {
  g.save();
  g.fillStyle = P.myColor;
  g.fillRect(P.myX * k, P.myY * k, P.myW * k, P.myH * k);
  g.restore();
}
```

Always call `g.save()` / `g.restore()` around any state changes (globalAlpha, clip, transform, compositeOperation).

### Clipping

```js
g.save();
g.beginPath();
g.rect(0, 0, P.w * k, P.h * k);   // clip to poster bounds
g.clip();
// ... draw overflowing content ...
g.restore();
```

### Fonts

```js
g.font = `${P.myWeight} ${P.mySize * k}px "${P.myFont}", sans-serif`;
g.textAlign    = 'center';
g.textBaseline = 'alphabetic';   // y is the baseline, not the top
```

Use `emWidths(family, weight)(character)` to measure character widths in em units:

```js
const widthEm = emWidths(P.myFont, P.myWeight)('A');
const widthCm = widthEm * P.mySize;
```

### Randomness

Use the built-in seeded PRNG so results are reproducible and serialisable:

```js
const r = rng(P.mySeed);   // r() returns a float in [0, 1)
const x = r() * P.w;
```

---

## `svg()` — Vector Export

Must return a valid SVG fragment string, or `''` if there is nothing to draw.

```js
function _svg() {
  const f   = v => +v.toFixed(4);   // 4 decimal places — keep SVG tidy
  const esc = s => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<rect x="${f(P.myX)}" y="${f(P.myY)}" width="${f(P.myW)}" height="${f(P.myH)}" fill="${P.myColor}"/>\n`;
}
```

### SVG coordinate system

The root `<svg>` has `viewBox="0 0 {P.w} {P.h}"`. Use centimetres directly — **do not multiply by `k`**.

### Clipping in SVG

```js
const clipId = 'my-clip';
return (
  `<clipPath id="${clipId}">` +
    `<rect x="0" y="0" width="${f(P.w)}" height="${f(P.h)}"/>` +
  `</clipPath>\n` +
  `<g clip-path="url(#${clipId})">` +
    // ... clipped content ...
  `</g>\n`
);
```

If multiple layers of the same type can appear simultaneously, make the clip ID unique (e.g. include a position value).

### Text in SVG

```js
// Live text (editable in Illustrator — requires the font to be installed):
`<text x="${f(cx)}" y="${f(baseline)}" font-family="${P.myFont}" font-weight="${P.myWeight}" font-size="${f(size)}" fill="${P.myColor}" text-anchor="middle">${esc(text)}</text>`

// Outlined text (Save SVG Outlined) is handled automatically by export.js
// for font-based modules — see docs/EXPORT.md.
```

---

## Param Types

Params are declared in the `params` array. They are rendered top-to-bottom in the Layer Properties pane. Every object has a required `type` field.

### `section` — Heading

```js
{ type: 'section', label: 'My Section' }
// Optional: className: 'prop-layer-title'  (larger, coloured heading)
```

### `sep` — Horizontal divider

```js
{ type: 'sep' }
```

### `color` — Colour picker

```js
{ type: 'color', key: 'myColor', label: 'Fill color' }
```

### `range` — Single slider

```js
{
  type:  'range',
  key:   'mySize',
  label: 'Font size',
  min:   1,
  max:   120,
  step:  0.5,
  unit:  'cm',     // shown after the live value (optional)
  fmt:   2,        // decimal places in the value label (default 2)
  disabled: P => !P.myEnabled   // (optional) function(P) → boolean
}
```

### `range2` — Dual-thumb slider (lo/hi pair)

```js
{
  type:  'range2',
  keys:  { lo: 'mySpeedMin', hi: 'mySpeedMax' },
  label: 'Speed range',
  min:   -60,
  max:   60,
  step:  0.5,
  unit:  'cm/s',
  fmt:   1
}
```

### `number` — Free numeric input

```js
{ type: 'number', key: 'mySeed', label: 'Seed', step: 1, min: 0 }
// min, max, step are all optional.
// Use id: 'someDomId' if you need to target the element from JavaScript.
```

### `checkbox` — Boolean toggle

```js
{ type: 'checkbox', key: 'myAnimate', label: 'Animate' }
// Use id: 'someDomId' to reference the element from JavaScript.
```

### `button` — Action button

```js
{
  type:  'button',
  label: 'Randomise',
  alt:   true,       // secondary button style (lighter, bordered)
  onClick() {
    dispatch('mySeed', Math.floor(Math.random() * 100000));
  }
}
```

`onClick` has no arguments. Use `dispatch(key, value)` to change params (see below).

### `seg` — Segmented / radio button group

```js
{
  type:    'seg',
  key:     'myMode',
  label:   'Mode',              // used as aria-label
  groupId: 'myModeSeg',         // optional DOM id on the container
  options: [
    { value: 'lines',  label: 'Lines' },
    { value: 'dots',   label: 'Dots' },
    { value: 'filled', label: 'Filled' }
    // dataMode: 'custom-string'  — only needed when value is not a string
    //   (e.g. value: true  →  dataMode: 'on')
  ]
}
```

### `text` — Text input

```js
// Plain string:
{ type: 'text', key: 'myLabel', label: 'Label', placeholder: 'e.g. FESTIVAL' }

// Round-trips through an array (characters ↔ joined string):
{
  type:        'text',
  key:         'myGlyphs',
  label:       'Letters',
  placeholder: 'e.g. JAZZ',
  format: v => Array.isArray(v) ? v.join('') : String(v ?? ''),
  parse:  v => Array.from(v)
}
```

`format(value)` converts the stored value to a display string.
`parse(string)` converts user input back to the stored value.
When `parse` is provided, `dispatch` receives the parsed value.

### `font` and `weight` — Linked font controls

These two params must always appear as a pair. The font selector drives the weight selector: switching font family snaps weight to the nearest available value.

```js
{ type: 'font',   key: 'myFont',   label: 'Font',   linkedWeight: 'myWeight' },
{ type: 'weight', key: 'myWeight', label: 'Weight', linkedFont:   'myFont'   }
```

Registered font families live in the `FONT_WEIGHTS` and `FONT_FILES` objects in `app.js`. Add a new entry there to make a new family available to all modules.

### `margins` — Four sliders (Top / Bottom / Left / Right)

```js
{
  type: 'margins',
  keys: { T: 'myMt', B: 'myMb', L: 'myMl', R: 'myMr' },
  max:  50,
  step: 0.5,
  unit: 'cm',
  fmt:  2
}
```

### `file` — File picker (no image data stored)

Stores only the filename. The actual file content lives in a session-scoped Map and must be re-linked after a page reload.

```js
{
  type:     'file',
  key:      'mySrc',          // stores the filename string in params
  label:    'File',
  accept:   'image/png,image/jpeg,.png,.jpg',
  onLoad:   file  => _myRegisterFile(file),   // called when user picks a file
  isLinked: path  => _mySessions.has(path)    // tells UI if file is active this session
}
```

See `js/modules/image_layers.js` for the complete implementation pattern.

---

## `dispatch(key, value)` — Mutating Params

Always use `dispatch` to change a param — never set `P[key]` directly in response to user input.

```js
dispatch('myColor', '#ff0000');
```

`dispatch` will:
1. Set `P[key] = value` and update `layers[selLayer].params[key]`.
2. Sync all matching `[data-k]` DOM elements.
3. Call `mod.onUpdate(key, value)` on every registered module.
4. Trigger a `redraw()` (unless `onUpdate` returns `'none'`).
5. Call `saveState()` to persist to localStorage.

**Do not** call `dispatch` from inside `draw()` or `svg()`.

---

## `onUpdate(key, value)` — Reacting to Changes

```js
onUpdate(key, value) {
  // Start/stop the animation loop when the animate toggle changes:
  if (key === 'myAnimate') updateLoop();

  // Return 'build' to trigger build() before the redraw:
  if (key === 'mySeed') return 'build';

  // Return 'none' to skip the automatic redraw entirely:
  if (key === 'myLabel') return 'none';

  // Return null (or nothing) for a plain redraw:
  return null;
}
```

| Return value | Effect |
|---|---|
| `'build'` | Calls `build()` then `redraw()` |
| `'redraw'` | Calls `redraw()` only (default) |
| `'none'` | No redraw |
| `null` / `undefined` | Same as `'redraw'` |

If multiple modules return a value for the same key, `'build'` takes priority over `'redraw'`, and `'none'` only applies when every module returns it.

---

## `build()` — Pre-computing Layout

Use `build` for expensive computations that should only run when structural parameters change, not every frame.

```js
// In the registration object:
build() {
  _myCells.length = 0;
  // ... expensive layout computation using P.mySeed, P.w, P.h, etc. ...
}
```

`build()` is called:
- Once at app startup (after all modules are registered).
- Whenever `w` or `h` (poster dimensions) change.
- Whenever `onUpdate` returns `'build'` for any param.
- By `export.js` before SVG generation to ensure the data reflects the right params.

The draw loop also calls `build()` automatically per-layer when `layer.cached === true` and `layer.key()` changes.

---

## Animation

### Minimal animation pattern

```js
// Module-level state:
let _myOffset = 0;
let _myLast   = 0;

// In the layer descriptor:
advance() {
  if (!P.myAnimate) return;
  const now = performance.now();
  const dt  = Math.min((now - _myLast) / 1000, 0.1);
  _myLast   = now;
  _myOffset += P.mySpeed * dt;
},

needsLoop() {
  return !!P.myAnimate;
},

// In onUpdate:
onUpdate(key) {
  if (key === 'myAnimate') {
    _myLast = performance.now();
    updateLoop();   // start or stop the rAF loop
  }
}
```

`advance()` is called once per frame, before `draw()`.

`needsLoop()` is polled by `updateLoop()` whenever visibility or params change. If ANY visible layer returns `true`, p5.js enters loop mode; when none do, it stops.

**Never call `redraw()` or `updateLoop()` from inside `advance()`.**

---

## Offscreen Cache

For non-animated layers whose computation is expensive (many paths, large cell grids), mark the layer as `cached`. The draw loop renders it into an invisible canvas once and blits that canvas each frame.

```js
layers: [{
  id:     'my_layer',
  cached: true,
  key()   {
    // Return a string that changes whenever the visual output changes.
    // Include every param that affects appearance.
    return [P.w, P.h, P.myColor, P.mySize, P.mySeed].join('|');
  },
  draw: _draw,
  svg:  _svg
}]
```

The cache is invalidated (and `draw` is called again to repopulate it) whenever `key()` returns a different string.

**Do not use `cached` for animated layers** — the key won't change each frame and the animation will freeze.

---

## `buildUI(container)` — Custom HTML

For UI that cannot be expressed with the standard param types, add a `buildUI` function. It receives the Properties pane's `<div>` element and may append arbitrary DOM nodes.

```js
buildUI(container) {
  const btn = document.createElement('button');
  btn.className   = 'alt';
  btn.textContent = 'Shuffle everything';
  btn.addEventListener('click', () => {
    dispatch('mySeed',  Math.floor(Math.random() * 1e5));
    dispatch('myColor', `hsl(${Math.random() * 360 | 0}, 70%, 50%)`);
  });
  container.appendChild(btn);
}
```

`buildUI` is called after all `params` have been rendered, so its output appears at the bottom of the pane.

---

## Adding to the App

1. Add a `<script>` tag in `index.html` after `app.js`:

   ```html
   <script src="js/modules/my_wave.js"></script>
   <!-- other modules -->
   <script src="js/libs/theme.js"></script>
   ```

2. The module's `defaults` are merged into `P` at startup.
3. The module appears immediately in the **New Layer** dialog and the **Type** selector.
4. Existing saved states and presets that do not reference your module are unaffected.

---

## Checklist

| ✓ | Item |
|---|------|
| ☐ | Unique `id` that will never change |
| ☐ | Unique param key prefix — no conflicts with other modules |
| ☐ | Every key read in `draw()` / `svg()` has a matching entry in `defaults` |
| ☐ | `draw()` multiplies all cm values by `k` |
| ☐ | `svg()` uses cm directly (no `k`) |
| ☐ | `svg()` rounds floats with `f = v => +v.toFixed(4)` |
| ☐ | `svg()` escapes text with `esc()` if any string could contain `<`, `>`, `&` |
| ☐ | `g.save()` / `g.restore()` wraps any context state changes |
| ☐ | Animated layers call `updateLoop()` from `onUpdate` when the toggle changes |
| ☐ | `<script>` tag added to `index.html` |
