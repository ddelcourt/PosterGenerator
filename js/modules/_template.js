// =============================================================================
// MODULE TEMPLATE — Color Band
// =============================================================================
// Copy this file to a new name (e.g. my_module.js), then:
//   1. Find every TODO comment and replace with your own values.
//   2. Add a <script> tag for it in index.html, after app.js and before ui.js.
//   3. Reload the browser — the module appears in the "New Layer" selector.
//
// This template draws a full-width coloured rectangle band.
// It demonstrates the most common patterns; the full param-type reference
// is in docs/MODULES.md.
// =============================================================================


// =============================================================================
// 1. PARAM KEY PREFIX
// =============================================================================
// Every param key should start with a short, unique prefix so it doesn't clash
// with keys from other modules when multiple layers share the global P object.
// TODO: change 'bnd' to your own 2-4 character prefix (e.g. 'gr', 'wave').

// Prefix used: 'bnd' (band)


// =============================================================================
// 2. MODULE-LEVEL STATE
// =============================================================================
// Variables declared here are shared across all layers of this module type and
// are NEVER serialised. Use them for:
//   - Animation offsets / timestamps
//   - Cached computation results that are fast to rebuild
//
// Do NOT store data here that must survive a page reload — that belongs in
// layer.params (declared in defaults, below).

let _bndOffset = 0;   // current vertical scroll offset for animation (cm)
let _bndLast   = 0;   // timestamp of the last animation frame (ms)


// =============================================================================
// 3. HELPERS
// =============================================================================
// Pure functions that compute layout values from P.
// Keeping them separate makes draw() and svg() easier to read.

// Returns the effective Y position after snap logic is applied.
function _bndEffectiveY() {
  switch (P.bndSnap) {
    case 'top':    return 0;
    case 'center': return (P.h - P.bndH) / 2;
    case 'bottom': return P.h - P.bndH;
    default:       return P.bndY;   // 'free'
  }
}


// =============================================================================
// 4. DRAW — CANVAS (live preview)
// =============================================================================
// Called every frame by the draw loop in app.js.
//
// Parameters:
//   g — CanvasRenderingContext2D  (the p5.js "drawingContext")
//   k — number                    pixels per centimetre
//       Multiply every cm value by k before passing it to canvas methods.
//
// When this function runs, the global P already holds this layer's params.
// Save/restore g.save() / g.restore() around any state changes (alpha, clip, etc.).

function _draw(g, k) {
  const y = _bndEffectiveY() + _bndOffset;   // cm, with animation offset

  g.save();
  g.globalAlpha = P.bndOpacity;
  g.fillStyle   = P.bndColor;
  // All cm values → pixels via × k
  g.fillRect(0, y * k, P.w * k, P.bndH * k);
  g.restore();
}


// =============================================================================
// 5. SVG — VECTOR EXPORT
// =============================================================================
// Called by buildSVG() and buildSVGOutlined() in export.js.
// Must return a valid SVG fragment string (or '' for nothing).
//
// Rules:
//   - The SVG viewBox is "0 0 {P.w} {P.h}"; coordinates are in cm, no units.
//   - Use f(v) to round floats to 4 decimal places (keeps files tidy).
//   - Escape text content with esc() if any string could contain < > & characters.
//   - Animation offsets should NOT appear in the SVG — export is a snapshot.

function _svg() {
  const f   = v => +v.toFixed(4);
  const y   = _bndEffectiveY();   // no animation offset in exports

  if (P.bndH <= 0) return '';

  return (
    `<rect id="layer-band" ` +
    `x="0" y="${f(y)}" ` +
    `width="${f(P.w)}" height="${f(P.bndH)}" ` +
    `fill="${P.bndColor}" opacity="${f(P.bndOpacity)}"/>\n`
  );
}


// =============================================================================
// 6. ANIMATION (optional — delete if not needed)
// =============================================================================
// advance() is called once per frame, before draw(), by the draw loop.
// needsLoop() tells the app whether to keep the animation loop running.
// When a checkbox or other control changes the animation state, return
// 'none' or call updateLoop() from onUpdate() so the loop starts/stops.

function _bndAdvance() {
  if (!P.bndAnimate) return;
  const now = performance.now();
  const dt  = Math.min((now - _bndLast) / 1000, 0.1);   // cap dt to avoid jumps
  _bndLast  = now;
  const h   = P.h;
  _bndOffset = ((_bndOffset + P.bndSpeed * dt) % h + h) % h;
}

function _bndNeedsLoop() {
  return !!P.bndAnimate;
}


// =============================================================================
// 7. REGISTER
// =============================================================================

window.AMRApp.registerModule({

  // ---------- Identity ----------
  id:    'color_band',   // TODO: unique snake_case identifier (never change once deployed)
  patch: '_template',    // TODO: set to your filename without .js (shown in the ⓘ tooltip)
  name:  'Color Band',   // TODO: label shown in the Type selector and New Layer dialog

  // ---------- Defaults ----------
  // One entry per param key your module reads from P.
  // These values are used when a new layer is created and also initialise
  // the layer.params snapshot that is serialised to JSON / localStorage.
  // TODO: replace with your own keys and values.
  defaults: {
    bndColor:   '#1f3bd8',
    bndY:       20,
    bndH:       10,
    bndOpacity: 1,
    bndSnap:    'free',
    bndAnimate: false,
    bndSpeed:   5
  },

  // ---------- Params ----------
  // Declarative schema for the auto-generated Properties pane UI.
  // Rendered top to bottom. See docs/MODULES.md for all param types.
  // TODO: replace with your own param list.
  params: [

    // ── Sections group related controls. Use a unique label.
    { type: 'section', label: 'Band' },

    // ── Color picker
    { type: 'color', key: 'bndColor', label: 'Color' },

    // ── Single slider
    //    unit:  displayed after the live value (optional)
    //    fmt:   decimal places shown in the output label (default 2)
    { type: 'range', key: 'bndY',       label: 'Y position', min: 0,   max: 200, step: 0.5,  unit: 'cm', fmt: 2 },
    { type: 'range', key: 'bndH',       label: 'Height',     min: 0.5, max: 200, step: 0.5,  unit: 'cm', fmt: 2 },
    { type: 'range', key: 'bndOpacity', label: 'Opacity',    min: 0,   max: 1,   step: 0.01, fmt: 2 },

    // ── Horizontal divider
    { type: 'sep' },

    // ── Segmented / radio button group.
    //    value: the actual value written to P[key] on click.
    //    label: button text.
    //    dataMode: optional string for storage.js to match against when restoring UI;
    //              defaults to String(value), only needed when value is not a string.
    { type: 'seg', key: 'bndSnap', label: 'Snap to', options: [
      { value: 'free',   label: 'Free' },
      { value: 'top',    label: 'Top' },
      { value: 'center', label: 'Center' },
      { value: 'bottom', label: 'Bottom' }
    ]},

    { type: 'sep' },

    // ── Section for animation controls
    { type: 'section', label: 'Animation' },

    // ── Boolean toggle
    { type: 'checkbox', key: 'bndAnimate', label: 'Animate' },

    // ── Slider with a conditional disabled state.
    //    disabled: a function (P) => boolean evaluated each time the pane renders.
    //    The slider is greyed-out and non-interactive when it returns true.
    { type: 'range', key: 'bndSpeed', label: 'Speed',
      min: -40, max: 40, step: 0.5, unit: 'cm/s', fmt: 1,
      disabled: P => !P.bndAnimate },

    { type: 'sep' },

    // ── Action button.
    //    alt: true  → uses the secondary button style (lighter, bordered).
    //    onClick: called with no arguments; use dispatch() to mutate params.
    { type: 'button', label: 'Center band', alt: true,
      onClick() { dispatch('bndY', (P.h - P.bndH) / 2); dispatch('bndSnap', 'free'); }
    },

    // =========================================================================
    // ADDITIONAL PARAM TYPES — uncomment whichever you need.
    // See docs/MODULES.md for the full reference with all options.
    // =========================================================================

    // ── Free-form number input (no slider)
    // { type: 'number', key: 'bndSeed', label: 'Seed', step: 1 },

    // ── Plain text input
    // { type: 'text', key: 'bndLabel', label: 'Label', placeholder: 'e.g. FESTIVAL' },

    // ── Text input that round-trips through an array (e.g. 4 glyphs → "JAZZ")
    // { type: 'text', key: 'bndGlyphs', label: 'Letters',
    //   format: v => Array.isArray(v) ? v.join('') : String(v ?? ''),
    //   parse:  v => Array.from(v) },

    // ── Font family selector (auto-populates from FONT_WEIGHTS registry)
    //    linkedWeight: key of the matching weight control; they sync automatically.
    // { type: 'font',   key: 'bndFont',   label: 'Font',   linkedWeight: 'bndWeight' },
    // { type: 'weight', key: 'bndWeight', label: 'Weight', linkedFont:   'bndFont'   },

    // ── Dual-thumb range (two values, e.g. speed min/max)
    // { type: 'range2', keys: { lo: 'bndSpeedMin', hi: 'bndSpeedMax' },
    //   label: 'Speed range', min: -40, max: 40, step: 0.5, unit: 'cm/s', fmt: 1 },

    // ── Four margin sliders (Top / Bottom / Left / Right) in one block
    // { type: 'margins', keys: { T: 'bndMt', B: 'bndMb', L: 'bndMl', R: 'bndMr' },
    //   max: 50, step: 0.5, unit: 'cm', fmt: 2 },

    // ── File picker (stores filename only; see image_layers.js for the full pattern)
    // { type: 'file', key: 'bndSrc', label: 'Image', accept: 'image/png,image/jpeg',
    //   onLoad:    file  => _myRegisterFile(file),
    //   isLinked:  path  => _mySessions.has(path) },
  ],

  // ---------- Layers ----------
  // The layers array lists the drawable layer(s) this module contributes.
  // Most modules register exactly one layer. A module CAN register multiple
  // (they always share the same defaults and params), but each still appears
  // as a separate entry in the Layers palette.
  //
  // Required per layer:
  //   id      — unique identifier (can equal the module id when only one layer)
  //   name    — display name in the Layers palette
  //   visible — initial visibility
  //   draw    — canvas draw function
  //   svg     — SVG export function
  //
  // Optional per layer:
  //   advance()   — called each frame before draw (use for animation)
  //   needsLoop() — return true when the animation loop should keep running
  //   cached      — set true to enable the offscreen cache (see docs/MODULES.md)
  //   key()       — required when cached: return a string of all values that affect
  //                 the visual output; the cache is invalidated when it changes
  layers: [{
    id:      'color_band',
    name:    'Color Band',
    visible: true,
    draw:    _draw,
    svg:     _svg,
    advance:   _bndAdvance,     // remove if no animation
    needsLoop: _bndNeedsLoop    // remove if no animation
  }],

  // ---------- onUpdate (optional) ----------
  // Called by dispatch() after every param change, with the key and new value.
  // Use it to:
  //   - Start/stop the animation loop when an animate toggle changes.
  //   - Coerce or validate a value before the redraw.
  //   - Return 'build' to trigger a full rebuild instead of a plain redraw.
  //   - Return 'none' to suppress the automatic redraw entirely.
  //   - Return null (or nothing) to let the default redraw happen.
  onUpdate(key) {
    if (key === 'bndAnimate') {
      _bndLast = performance.now();   // reset timer so dt is 0 on first frame
      updateLoop();                   // start or stop the rAF loop
    }
    return null;
  }

  // ---------- build (optional) ----------
  // If your module pre-computes a data structure (like the cell grid in
  // recursive_div_1.js), define build() here. It is called:
  //   - once after all modules are registered (setup phase)
  //   - whenever a parameter returns 'build' from onUpdate()
  //   - whenever the poster dimensions (w, h) change
  // ,build() { ... }

});
