// ============ FESTIVAL MODULE ============
// A word repeated across N rows, each row gliding sideways at its own random speed.

const fOff = [];   // current horizontal offset per row (cm), grows dynamically
let fDir = [];     // per-row speed factor in [-1, 1], set by festDirections()
let fDirSeed = null;
let fLast = 0;

function festDirections() {
  const nRows = P.fRows;
  const cacheKey = `${P.fSeed}|${nRows}|${P.fSpeedMin}|${P.fSpeedMax}`;
  if (fDirSeed !== cacheKey) {
    fDirSeed = cacheKey;
    const r = rng(P.fSeed);
    const lo = P.fSpeedMin, hi = P.fSpeedMax;
    fDir = Array.from({ length: nRows }, () => lo + r() * (hi - lo));
  }
  return fDir;
}

function festAdvance() {
  const now = performance.now(), dt = Math.min(now - fLast, 100) / 1000;
  fLast = now;
  const nRows = P.fRows;
  const d = festDirections();
  for (let i = 0; i < nRows; i++) {
    if (fOff[i] == null) fOff[i] = 0;
    fOff[i] += d[i] * dt;
  }
}

// festItems is a top-level function so export.js can call it directly.
function festItems() {
  const text = P.fText;
  if (!text) return { text, rows: [] };
  const nRows  = P.fRows;
  const w      = emWidths(P.fFont, P.fWeight)(text) * P.fSize;
  const period = Math.max(0.1, w + P.fGap);
  const pitch  = P.fLineH > 0 ? P.fLineH : Math.max(0.1, (P.h - P.fMt - P.fMb) / nRows);
  const capH   = P.fSize * CAP;
  const rows   = [];
  for (let i = 0; i < nRows; i++) {
    const off = fOff[i] ?? 0;
    const o = ((off % period) + period) % period, xs = [];
    for (let x = o - period; x < P.w; x += period) if (x + w > 0) xs.push(x);
    rows.push({ y: P.fMt + (i + 0.5) * pitch + capH / 2, xs });  // y = baseline
  }
  return { text, rows };
}

function _draw(g, k) {
  const { text, rows } = festItems();
  g.fillStyle = P.fColor; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = `${P.fWeight} ${P.fSize * k}px "${P.fFont}", sans-serif`;
  g.save();
  g.beginPath(); g.rect(P.fMl * k, 0, (P.w - P.fMl - P.fMr) * k, P.h * k); g.clip();
  for (const r of rows) for (const x of r.xs) g.fillText(text, x * k, r.y * k);
  g.restore();
}

function _svg() {
  const { text, rows } = festItems(), f = v => +v.toFixed(4);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    `<clipPath id="festival-clip"><rect x="${f(P.fMl)}" y="0" width="${f(P.w - P.fMl - P.fMr)}" height="${f(P.h)}"/></clipPath>\n` +
    `<g id="layer-festival" clip-path="url(#festival-clip)" font-family="${P.fFont}" font-weight="${P.fWeight}" font-size="${f(P.fSize)}" fill="${P.fColor}">` +
    rows.map(r => r.xs.map(x => `<text x="${f(x)}" y="${f(r.y)}">${esc(text)}</text>`).join('')).join('') +
    '</g>\n'
  );
}

// ============ REGISTER ============
window.AMRApp.registerModule({
  id: 'festival',
  patch: 'gliding_text',
  name: 'Festival',

  defaults: {
    fText: 'FESTIVAL', fColor: '#1f3bd8', fSize: 22, fGap: 6,
    fMt: 6, fMb: 6, fMl: 0, fMr: 0, fLineH: 0,
    fPlay: true, fRows: 5, fSpeedMin: -10, fSpeedMax: 10, fSeed: 3,
    fFont: 'Inter', fWeight: 600
  },

  params: [
    { type: 'section', label: 'Common' },
    { type: 'color',  key: 'fColor',  label: 'Color' },
    { type: 'text',   key: 'fText',   label: 'Letters / text', placeholder: 'Repeated word (e.g. FESTIVAL)' },
    { type: 'font',   key: 'fFont',   label: 'Font',   linkedWeight: 'fWeight' },
    { type: 'weight', key: 'fWeight', label: 'Weight', linkedFont:   'fFont'   },
    { type: 'range',  key: 'fSize',   label: 'Font size',   min: 1,  max: 120, step: 0.5, unit: 'cm',   fmt: 2 },
    { type: 'range',  key: 'fLineH',  label: 'Row height',  min: 0,  max: 128, step: 0.5, unit: 'cm',   fmt: 2 },
    { type: 'margins', keys: { T: 'fMt', B: 'fMb', L: 'fMl', R: 'fMr' }, max: 50, step: 0.5, unit: 'cm', fmt: 2 },
    { type: 'sep' },
    { type: 'section', label: 'Festival', className: 'prop-layer-title' },
    { type: 'range',   key: 'fGap',   label: 'Space between repeats', min: 0,  max: 80, step: 0.5, unit: 'cm',   fmt: 2 },
    { type: 'checkbox', key: 'fPlay',  label: 'Glide' },
    { type: 'range',   key: 'fRows',  label: 'Repeats',               min: 1,  max: 64, step: 1,                  fmt: 0 },
    { type: 'range2',  keys: { lo: 'fSpeedMin', hi: 'fSpeedMax' },
      label: 'Speed', min: -60, max: 60, step: 0.5, unit: 'cm/s', fmt: 1 },
    { type: 'number',  key: 'fSeed',  label: 'Direction seed', step: 1, id: 'fSeed' },
    { type: 'button',  label: 'New directions', alt: true,
      onClick() {
        dispatch('fSeed', Math.floor(Math.random() * 100000));
      }
    }
  ],

  layers: [{
    id: 'festival', name: 'Festival', visible: true,
    draw: _draw,
    svg:  _svg,
    advance()   { if (P.fPlay) festAdvance(); },
    needsLoop() { return !!P.fPlay; }
  }],

  onUpdate(key) {
    if (key === 'fPlay') updateLoop();
    return null;
  }
});
