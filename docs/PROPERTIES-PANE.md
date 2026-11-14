# Properties Pane — Architecture

## Overview

The **Layer Properties** palette is a single floating panel that dynamically reflects the currently selected layer. It is rebuilt completely every time the selection changes.

---

## Panel Structure

```
[ Type       ] [ select: Jazz / AMR / Festival ]
─────────────────────────────────────────────
[ Common section  — Color, Letters, Font, Weight ]
[ Module-specific params ]
[ Module buildUI() output ]
```

### Type Selector

The first row lets you reassign the current layer's module type at any time. All registered modules are listed; selecting one reinitialises the layer with that module's default parameters.

---

## Per-Layer Parameter Instances

Each layer is an **independent instance** with its own `layer.params` object — a snapshot of all its module's default keys. Layers of the same module type do **not** share parameters.

### How it works

| Event | What happens |
|-------|--------------|
| Layer selected | `loadLayerParams(L)` merges `L.params` into global `P` and syncs `GLYPHS`/`AMR` |
| Param changed (dispatch) | `P[key]` updated, `layers[selLayer].params[key]` updated, UI synced |
| Layer drawn | Draw loop temporarily swaps `P` to `L.params`, draws, then restores |
| Layer saved | `layer.params` serialised inside `P.layerDefs` |

### Module-level shared state

Some modules maintain module-level state (e.g. `cells` in `recursive_div_1`, animation offsets in `gliding_text`). The draw loop calls the module's `build()` function per-layer when the layer's cache key changes, ensuring each layer's visual output uses its own params.

---

## Registration

Modules register themselves via `window.AMRApp.registerModule(def)`:

```js
window.AMRApp.registerModule({
  id:       'division',          // unique module ID
  patch:    'recursive_div_1',   // source filename (shown in (i) tooltip)
  name:     'Jazz',              // display name in Type selector / add-layer button
  defaults: { seed: 7, ... },    // initial param values, also used to initialise layer.params
  params:   [ ... ],             // param schema for auto-generated UI
  buildUI:  fn,                  // optional custom UI injected after auto params
  build:    fn,                  // optional: called when structural params change
  onUpdate: fn,                  // optional: called on every dispatch, returns 'build'/'redraw'/'none'
  layers:   [{ id, name, draw, svg, cached, key, advance, needsLoop }]
});
```

---

## Param Types

| Type | Description |
|------|-------------|
| `section` | Heading |
| `sep` | Horizontal divider |
| `color` | Colour picker |
| `text` | Text input (supports `format`/`parse` for array values) |
| `font` | Font family dropdown; `linkedWeight` auto-links to a weight key |
| `weight` | Font weight dropdown; snapped to available weights for the linked font |
| `range` | Single slider with live output |
| `range2` | Dual-thumb slider for `lo`/`hi` range |
| `number` | Numeric input |
| `checkbox` | Boolean toggle |
| `button` | Action button |
| `seg` | Segmented / radio button group |
| `margins` | Four sliders for T/B/L/R margin keys |
| `file` | File picker; stores filename only — `onLoad(file)` and `isLinked(path)` callbacks |

---

## Storage

Layers are persisted in `localStorage` as `P.layerDefs`:

```json
"layerDefs": [
  { "id": "division",          "moduleId": "division", "params": { "seed": 42, ... } },
  { "id": "amr_1731234567890", "moduleId": "amr",      "params": { "amrColor": "#ff0000", ... } }
]
```

On load, `syncUIFromP` rebuilds the `layers` array from `layerDefs`, restoring each layer's `params`. Then `loadLayerParams(layers[selLayer])` syncs `P` to the selected layer before the first render.


**Status:** Pre-implementation review  
**Scope:** Refactor of the layer parameter UI from multiple floating palettes into a single unified Properties panel

---

## 1. Problem Statement

The current UI presents layer parameters as **13 separate floating palettes**, one per concern per layer. When a layer is selected, its palettes are shown; others are hidden. This creates three issues:

1. **Cognitive overhead.** A user editing the Jazz layer must mentally map across up to five palettes (Division, Animation, Letters, Colors, Typography) simultaneously.
2. **Screen clutter.** On smaller displays the palettes compete for space with the canvas.
3. **No shared language across layers.** Each layer re-invents its own Color, Font, and Text controls in isolation, with different labels and positions.

The solution is a **single unified Properties panel** that is always present and contextual to the selected layer.

---

## 2. Design Principles

- **Zero regression.** Every control that exists today must exist after the port. No parameter may be silently dropped.
- **Flat state stays flat.** The `P` object retains its current structure. No restructuring to `P.layers[id].x` — it would require touching export, storage, and SVG generation.
- **Existing IDs and `data-k` attributes are preserved** where possible, to minimise changes to `storage.js` and `export.js`.
- **Additive changes only** to `export.js` and the drawing/rendering logic — ideally none at all.

---

## 3. Panel Structure

The panel is a **single floating, draggable, scrollable palette** replacing all `[data-layer]` palettes. The global palettes (Poster, Background, Layers, Export) are unaffected.

```
#properties  (.pal — same draggable palette component)
│
├── .pal-bar                     ← sticky; always visible for dragging
│
└── .pal-b                       ← scrollable; max-height: calc(100vh - 24px - bar-height)
    │
    ├── <h3 class="prop-section">Common</h3>
    │   ├── Color                ← primary text color, routes per layer
    │   ├── Letters              ← single text input, routes per layer
    │   ├── Font                 ← font family select, routes per layer
    │   └── Weight               ← font weight select, routes per layer
    │
    ├── <div class="prop-sep">   ← thin rule + layer name label
    │
    └── <div class="prop-layer-controls">
        ├── #layer-props-division    ← shown only when Jazz is selected
        ├── #layer-props-amr         ← shown only when AMR is selected
        └── #layer-props-festival    ← shown only when Festival is selected
```

### 3.1 Common Section

The four common controls are **logically keyed** (`color`, `letters`, `font`, `weight`). They do not carry a `data-k` attribute. Instead, a routing table maps each logical key to the real `P` key for the active layer.

```js
const LAYER_MAP = {
  division: { color: 'ink',      font: 'font',    weight: 'weight'    },
  amr:      { color: 'amrColor', font: 'amrFont', weight: 'amrWeight' },
  festival: { color: 'fColor',   font: 'fFont',   weight: 'fWeight'   },
};
```

`letters` is handled separately because it is not a scalar `P` key — it maps to `GLYPHS[]` (Jazz), `AMR[]` (AMR), and `P.fText` (Festival). The input type does not change; a single `<input type="text">` is used in all cases. On change:

- **Jazz/AMR:** `Array.from(value)` replaces the respective character array; `build()` is called for Jazz.
- **Festival:** `P.fText = value`; `redraw()` is called.

On layer switch, the input is repopulated from `GLYPHS.join('')`, `AMR.join('')`, or `P.fText`.

### 3.2 Layer-Specific Section

Each layer's controls live in a dedicated `<div id="layer-props-{id}">` block. Only one block is visible at a time, controlled by `renderLayers()`. All `data-k` attributes, element IDs, and output element IDs are **identical to today** — no rebinding is required.

#### Jazz (`#layer-props-division`)

| Label | Element | Key/ID | Trigger |
|---|---|---|---|
| Division mode | Segment buttons | `#modeSeg` → `P.grad` | `build()` |
| Center cell size | Range | `data-k="minC"` + `#minCv` | `build()`, stops animation |
| Edge cell size | Range | `data-k="maxC"` + `#maxCv` | `build()`, stops animation |
| Border spread | Range | `data-k="curve"` + `#curvev` | `build()`, stops animation |
| Show cell division | Checkbox | `data-k="lines"` | `redraw()` |
| Show letters | Checkbox | `data-k="letters"` | `redraw()` |
| Letter fill | Range | `data-k="fill"` + `#fillv` | `redraw()` |
| Fill curve | Range | `data-k="fillExp"` + `#fillExpv` | `redraw()` |
| Division line color | Color | `data-k="lineColor"` | `redraw()` |
| In sequence | Range | `data-k="seq"` | `build()` |
| Sequence seed | Number | `data-k="seed"`, `#seed` | `build()` |
| New seed | Button | `#shuffle` | Randomises `P.seed`, `build()` |
| Animate | Checkbox | `#anim` | `startAnim()` / stop |
| Animation speed | Range | `#speed` + `#speedv` | Updates `animSpeed` |

#### AMR (`#layer-props-amr`)

| Label | Element | Key/ID | Trigger |
|---|---|---|---|
| Type sizing mode | Segment buttons | `#fitSeg` → `P.amrFit` | `redraw()`, disables `#typeSliders` |
| Font size | Range | `data-k="amrSize"` + `#amrSizev` | `redraw()` |
| Line height | Range | `data-k="amrLine"` + `#amrLinev` | `redraw()` |
| Top/bottom margin | Range | `data-k="amrMv"` + `#amrMvv` | `redraw()` |
| Left/right margin | Range | `data-k="amrMh"` + `#amrMhv` | `redraw()` |

Font size and line height sliders remain wrapped in `#typeSliders` so the existing `disabled` logic is unchanged.

#### Festival (`#layer-props-festival`)

| Label | Element | Key/ID | Trigger |
|---|---|---|---|
| Font size | Range | `data-k="fSize"` + `#fSizev` | `redraw()` |
| Space between repeats | Range | `data-k="fGap"` + `#fGapv` | `redraw()` |
| Top margin | Range | `data-k="fMt"` + `#fMtv` | `redraw()` |
| Bottom margin | Range | `data-k="fMb"` + `#fMbv` | `redraw()` |
| Glide | Checkbox | `data-k="fPlay"` | `updateLoop()` |
| Speed | Range | `data-k="fSpeed"` + `#fSpeedv` | `redraw()` |
| Direction seed | Number | `data-k="fSeed"`, `#fSeed` | `redraw()` |
| New directions | Button | `#fNewDir` | Randomises `P.fSeed`, `redraw()` |

---

## 4. Routing and Binding

### 4.1 Common section inputs

Common inputs carry `data-common="color|letters|font|weight"` instead of `data-k`. A dedicated handler fires on `input`:

```js
document.querySelectorAll('[data-common]').forEach(el => {
  el.addEventListener('input', () => {
    const logicalKey = el.dataset.common;
    const layerId = layers[selLayer].id;
    if (logicalKey === 'letters') {
      handleLettersInput(el.value, layerId);
    } else {
      const realKey = LAYER_MAP[layerId][logicalKey];
      // apply the same type-aware logic as the data-k handler
      setCommonParam(realKey, el, logicalKey);
    }
    saveState();
  });
});
```

`setCommonParam` mirrors the existing `data-k` handler's type-awareness (color, select/font, select/weight).

### 4.2 Layer switch — `syncCommonSection(layerId)`

Called at the end of `renderLayers()` every time the selected layer changes. Reads from `P` and populates the four common controls:

```js
function syncCommonSection(layerId) {
  const map = LAYER_MAP[layerId];
  // color
  document.querySelector('[data-common="color"]').value = P[map.color];
  // font
  const fontEl = document.querySelector('[data-common="font"]');
  fontEl.value = P[map.font];
  // weight — repopulate options first, then set value
  populateWeightSelectCommon(layerId);
  document.querySelector('[data-common="weight"]').value = P[map.weight];
  // letters
  const lettersEl = document.querySelector('[data-common="letters"]');
  if (layerId === 'division') lettersEl.value = GLYPHS.join('');
  else if (layerId === 'amr')  lettersEl.value = AMR.join('');
  else                         lettersEl.value = P.fText;
}
```

`populateWeightSelectCommon` is a thin wrapper around `populateWeightSelect` that uses `LAYER_MAP[layerId].weight` as the weight key.

### 4.3 `syncUIFromP` changes (storage.js)

The only required change is replacing the two glyph-sync blocks:

**Before:**
```js
document.querySelectorAll('#glyphsJazz input').forEach((el, i) => { el.value = GLYPHS[i] || ''; });
document.querySelectorAll('#glyphsAmr input').forEach((el, i) => { el.value = AMR[i] || ''; });
```

**After:**
```js
// single text inputs in the common section are handled by syncCommonSection
syncCommonSection(layers[selLayer].id);
```

The `fText` special-case in `syncUIFromP` is also absorbed by `syncCommonSection`. All other `syncUIFromP` logic is unchanged.

---

## 5. Character Array Flexibility (AMR layer)

The existing `amrItems()` hardcodes three rows as `P.h / 3`. With a single text input driving `AMR[]`, the array length becomes variable.

`amrItems()` is updated to use `AMR.length` instead of the literal `3`:

```js
// before
const third = P.h / 3;
// after
const rowH = P.h / Math.max(1, AMR.length);
```

The layer's `key()` function already includes `AMR.join('')`, so cache invalidation is correct. No other change is needed in the drawing or SVG logic.

---

## 6. Scrollable Panel — CSS

A minimal addition to `.pal-b`:

```css
.pal-b {
  overflow-y: auto;
  max-height: calc(100vh - 24px - 44px); /* 44px ≈ bar height */
  overscroll-behavior: contain;
}

.pal {
  max-height: calc(100vh - 24px);
}
```

The title bar has `position: sticky` semantics by virtue of being outside `.pal-b`. No structural change is needed; the existing `.pal-bar` / `.pal-b` split already maps correctly.

Additionally, row padding is reduced from the current implicit `~8px` to `5px` vertical padding to lower the panel's natural height before scrolling becomes necessary.

```css
/* compact rows inside the properties panel only */
#properties .row {
  padding-block: 5px;
}
#properties .prop-section {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 10px 0 4px;
  padding: 0 12px;
}
#properties .prop-sep {
  border: none;
  border-top: 1px solid var(--border);
  margin: 8px 0;
}
```

---

## 7. Files Changed

| File | Nature of change |
|---|---|
| `index.html` | Remove all `[data-layer]` palette sections; add single `#properties` panel with common section + three layer-specific blocks |
| `js/app.js` | Add `LAYER_MAP`; add `syncCommonSection()`; add `populateWeightSelectCommon()`; replace `bindGlyphs` calls with single-input handler; call `syncCommonSection` from `renderLayers()`; update `amrItems()` |
| `js/libs/storage.js` | Replace two glyph-sync blocks; remove `#fText` special-case; call `syncCommonSection` |
| `css/style.css` | Add scrollable panel rules; add `.prop-section`, `.prop-sep` styles; add compact row override for `#properties` |

| File | Unchanged |
|---|---|
| `js/libs/export.js` | Reads `P` directly; no UI dependency |
| `js/libs/theme.js` | No change |
| `js/libs/ui.js` | Dragging, collapse, keyboard shortcuts work on any `.pal` — no change needed |

---

## 8. Implementation Order

The changes are sequenced so the application remains functional after each step.

1. **CSS first.** Add scrollable panel rules and new section styles. Existing palettes are unaffected.
2. **`index.html` — Properties panel.** Add the `#properties` palette with all three layer-specific blocks (IDs/`data-k` attributes unchanged). Remove the old `[data-layer]` sections only after confirming the new blocks are wired.
3. **`app.js` — routing layer.** Add `LAYER_MAP`, `syncCommonSection`, `populateWeightSelectCommon`, single-input letters handler. Update `renderLayers()` to call `syncCommonSection`. Update `amrItems()`.
4. **`js/libs/storage.js` — sync fix.** Replace glyph sync blocks. Verify `loadState()` → `syncUIFromP()` → `syncCommonSection()` chain produces correct UI on page load.
5. **End-to-end verification.** For each layer: switch to it, change every control, verify canvas updates, save/load JSON round-trip, export PNG, export SVG, export outlined SVG.

---

## 9. Out of Scope

- Restructuring the `P` state object.
- Changes to drawing, caching, animation, or SVG generation logic.
- Changing the global palettes (Poster, Background, Layers, Export).
- Mobile layout changes beyond what scrollable panels provide for free.
- Adding new parameters or controls not present today.
