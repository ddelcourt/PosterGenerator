// ============ JAZZ / DIVISION MODULE ============
// Fractal cell-division layer. Registers itself with AMRApp.

// cells is a top-level const so export.js can reference it directly in the global scope.
const cells = [];
let cellsVer = 0;

// ---- Animation state ----
const _ANIM = {
  minC:  { lo: 0.3, hi: 3,  period: 4.1 },
  maxC:  { lo: 6,   hi: 40, period: 5.3 },
  curve: { lo: 0.1, hi: 2,  period: 6.7 }
};
let _animT = 0, _animLast = 0;
const _animPhase = {};

// Updates a param value, the matching range input, and its output element.
// Called during animation; elements may be absent when a different layer is selected.
function setParam(k, v) {
  P[k] = v;
  if (typeof layers !== 'undefined') {
    layers.forEach(l => { if (l.moduleId === 'division' && l.params && k in l.params) l.params[k] = v; });
  }
  const el = document.querySelector(`[data-k="${k}"]`);
  if (el) el.value = v;
  const out = document.getElementById(k + 'v');
  if (out) out.textContent = v.toFixed(2);
}

function startAnim() {
  for (const k in _ANIM) {
    const a = _ANIM[k], x = 2 * (P[k] - a.lo) / (a.hi - a.lo) - 1;
    _animPhase[k] = Math.asin(Math.min(1, Math.max(-1, x)));
  }
  _animT = 0; _animLast = performance.now(); animOn = true;
  requestAnimationFrame(_animFrame);
}

function stopAnim() {
  animOn = false;
  const el = document.getElementById('anim');
  if (el) el.checked = false;
  if (typeof saveState !== 'undefined') saveState();
}

function _animFrame(now) {
  if (!animOn) return;
  const dt = (now - _animLast) / 1000;
  if (dt >= 0.06) {
    _animLast = now; _animT += Math.min(dt, 0.25) * animSpeed;
    for (const k in _ANIM) {
      const a = _ANIM[k], s = Math.sin(_animPhase[k] + 2 * Math.PI * _animT / a.period);
      setParam(k, Math.round((a.lo + (a.hi - a.lo) * (0.5 + 0.5 * s)) * 100) / 100);
    }
    _buildCells(); redraw();
  }
  requestAnimationFrame(_animFrame);
}

// ---- Cell-division algorithm ----
function _buildCells() {
  const r = rng(P.seed);
  const x0 = P.jMl, y0 = P.jMt;
  const cw = Math.max(0.1, P.w - P.jMl - P.jMr);
  const ch = Math.max(0.1, P.h - P.jMt - P.jMb);
  const halfMin = Math.min(cw, ch) / 2;
  const ratio   = Math.max(P.maxC, P.minC * 1.01) / P.minC;

  const targetAt = (px, py) => {
    const minToBorder = Math.min(px - x0, py - y0, x0 + cw - px, y0 + ch - py);
    const d = Math.min(1, Math.max(0, 1 - minToBorder / halfMin));
    return P.minC * Math.pow(ratio, Math.pow(d, P.curve));
  };

  cells.length = 0; cellsVer++;
  let split;
  split = function(x, y, w, h, n) {
    const minToBorder = Math.max(0, Math.min(x - x0, y - y0, x0 + cw - (x + w), y0 + ch - (y + h)));
    const d      = Math.min(1, Math.max(0, 1 - minToBorder / halfMin));
    const target = P.minC * Math.pow(ratio, Math.pow(d, P.curve));
    if (Math.max(w, h) > target && Math.min(w, h) > 0.05 && n < 30 && cells.length < 40000) {
      let f = 0.5;
      if (P.grad) {
        const a = w >= h ? targetAt(x + w / 4, y + h / 2) : targetAt(x + w / 2, y + h / 4);
        const b = w >= h ? targetAt(x + 3 * w / 4, y + h / 2) : targetAt(x + w / 2, y + 3 * h / 4);
        f = Math.min(0.7, Math.max(0.3, a / (a + b)));
      }
      if (w >= h) { split(x, y, w * f, h, n + 1); split(x + w * f, y, w * (1 - f), h, n + 1); }
      else        { split(x, y, w, h * f, n + 1); split(x, y + h * f, w, h * (1 - f), n + 1); }
    } else cells.push({ x, y, w, h, g: '' });
  };

  if (P.jLineH > 0 && P.jLineH < ch) {
    for (let y = y0; y < y0 + ch; y += P.jLineH)
      split(x0, y, cw, Math.min(P.jLineH, y0 + ch - y), 0);
  } else {
    split(x0, y0, cw, ch, 0);
  }

  const q = v => Math.round(v * 1e6);
  cells.sort((a, b) => q(a.y) - q(b.y) || q(a.x) - q(b.x));
  const pool = GLYPHS.filter(Boolean); if (!pool.length) pool.push(' ');
  cells.forEach((c, i) => {
    c.g = r() * 100 < P.seq ? pool[i % pool.length] : pool[Math.floor(r() * pool.length)];
  });
}

// ---- Layer draw / svg ----
function _draw(g, k) {
  if (P.lines) {
    g.strokeStyle = P.lineColor; g.lineWidth = Math.max(0.5, k * 0.008);
    for (const c of cells) g.strokeRect(c.x * k, c.y * k, c.w * k, c.h * k);
  }
  if (P.letters) {
    const em = emWidths(P.font, P.weight), fl = P.fill / 100;
    g.fillStyle = P.ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const c of cells) {
      const eff = fl * Math.pow(Math.min(1, Math.min(c.w, c.h) / P.maxC), P.fillExp);
      const s   = Math.min(c.h * eff / CAP, c.w * eff / em(c.g)) * k;
      g.font = `${P.weight} ${s}px "${P.font}", sans-serif`;
      g.fillText(c.g, (c.x + c.w / 2) * k, (c.y + c.h / 2) * k + s * CAP / 2);
    }
  }
}

function _svg() {
  const f = v => +v.toFixed(4), em = emWidths(P.font, P.weight), fl = P.fill / 100;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '<g id="layer-division">\n';
  if (P.lines)
    out += `<g id="division" fill="none" stroke="${P.lineColor}" stroke-width="0.02">` +
      cells.map(c => `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}"/>`).join('') + '</g>\n';
  if (P.letters)
    out += `<g id="letters" font-family="${P.font}" font-weight="${P.weight}" text-anchor="middle" fill="${P.ink}">` +
      cells.map(c => {
        const eff = fl * Math.pow(Math.min(1, Math.min(c.w, c.h) / P.maxC), P.fillExp);
        const s   = Math.min(c.h * eff / CAP, c.w * eff / em(c.g));
        return `<text x="${f(c.x + c.w / 2)}" y="${f(c.y + c.h / 2 + s * CAP / 2)}" font-size="${f(s)}">${esc(c.g)}</text>`;
      }).join('') + '</g>\n';
  return out + '</g>\n';
}

// ---- Custom Properties pane section (injected after auto-generated common params) ----
function buildUI(container) {
  // Section header
  const h = document.createElement('h3');
  h.className = 'prop-section prop-layer-title';
  h.textContent = 'Jazz';
  container.appendChild(h);

  // Mode segment: Halving / Gradient
  // data-mode="0"/"1" matches the selector in storage.js's syncUIFromP.
  const seg = document.createElement('div');
  seg.className = 'seg'; seg.id = 'modeSeg';
  seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Division mode');
  [{ mode: '0', label: 'Halving', grad: false }, { mode: '1', label: 'Gradient', grad: true }].forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.dataset.mode = opt.mode; btn.textContent = opt.label;
    btn.setAttribute('aria-pressed', String(!!P.grad === opt.grad));
    btn.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      dispatch('grad', opt.grad);
    });
    seg.appendChild(btn);
  });
  container.appendChild(seg);

  // Remaining Jazz-specific controls rendered via the shared helpers on appAPI.
  // Using raw DOM/dispatch here keeps the module self-contained.
  _addRange(container, 'minC',    'Center cell',      0.15, 12,  0.05, 'cm', 2);
  _addRange(container, 'maxC',    'Edge cell',        0.5,  50,  0.5,  'cm', 2);
  _addRange(container, 'curve',   'Border spread',    0.1,  3,   0.05, '',   2);
  _addCheck(container, 'lines',   'Show cell division');
  _addCheck(container, 'letters', 'Show letters');
  _addRange(container, 'fillExp', 'Fill curve',       0,    3,   0.1,  '',   1);
  _addColor(container, 'lineColor', 'Division lines');
  _addRange(container, 'seq',     'In sequence',      0,    100, 5,    '%',  0);

  // Seed row: number input + shuffle button on same line
  const seedRow = document.createElement('div');
  seedRow.className = 'row';
  seedRow.innerHTML = '<span>Sequence seed</span><input type="number" data-k="seed" id="seed" step="1">';
  const seedInp = seedRow.querySelector('input');
  seedInp.value = P.seed;
  seedInp.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (isFinite(v)) dispatch('seed', v);
  });
  container.appendChild(seedRow);

  const shuffleBtn = document.createElement('button');
  shuffleBtn.className = 'alt'; shuffleBtn.type = 'button'; shuffleBtn.textContent = 'New seed';
  shuffleBtn.addEventListener('click', () => {
    const s = Math.floor(Math.random() * 100000);
    dispatch('seed', s);
  });
  container.appendChild(shuffleBtn);

  // Animation controls
  const animLabel = document.createElement('label');
  animLabel.className = 'chk';
  animLabel.innerHTML = `<input type="checkbox" id="anim"${animOn ? ' checked' : ''}><span>Animate division</span>`;
  animLabel.querySelector('input').addEventListener('change', e => {
    if (e.target.checked) { startAnim(); if (typeof saveState !== 'undefined') saveState(); }
    else stopAnim();
  });
  container.appendChild(animLabel);

  _addRange(container, 'animSpeed', 'Anim speed', 0.25, 4, 0.25, '×', 1, true /* isAnimSpeed */);
}

// Helpers for buildUI — build a standard range, checkbox, or color row in-place.
function _addRange(container, key, label, min, max, step, unit, fmt, isAnimSpeed) {
  const val = isAnimSpeed ? animSpeed : (P[key] ?? 0);
  const dp  = fmt ?? 2;
  const row = document.createElement('div');
  row.className = 'row wide';
  const inputId  = isAnimSpeed ? 'speed' : key;
  const outputId = isAnimSpeed ? 'speedv' : key + 'v';
  const dataK    = isAnimSpeed ? '' : ` data-k="${key}" data-fmt="${dp}"`;
  row.innerHTML =
    `<span>${label}: <output id="${outputId}">${Number(val).toFixed(dp)}</output> ${unit}</span>` +
    `<input type="range"${dataK} id="${inputId}" min="${min}" max="${max}" step="${step}" value="${val}">`;
  row.querySelector('input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById(outputId).textContent = v.toFixed(dp);
    if (isAnimSpeed) {
      animSpeed = v;
      if (typeof saveState !== 'undefined') saveState();
    } else {
      if (['minC', 'maxC', 'curve'].includes(key) && animOn) stopAnim();
      dispatch(key, v);
    }
  });
  container.appendChild(row);
}

function _addCheck(container, key, label) {
  const lbl = document.createElement('label');
  lbl.className = 'chk';
  lbl.innerHTML = `<input type="checkbox" data-k="${key}"${P[key] ? ' checked' : ''}><span>${label}</span>`;
  lbl.querySelector('input').addEventListener('change', e => dispatch(key, e.target.checked));
  container.appendChild(lbl);
}

function _addColor(container, key, label) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${label}</span><input type="color" data-k="${key}" value="${P[key] || '#000000'}" aria-label="${label}">`;
  row.querySelector('input').addEventListener('input', e => dispatch(key, e.target.value));
  container.appendChild(row);
}

// ============ REGISTER ============
window.AMRApp.registerModule({
  id: 'division',
  patch: 'recursive_div_1',
  name: 'Recursive Div 1',

  defaults: {
    minC: 0.4, maxC: 20, curve: 0.5, seed: 7, seq: 100, grad: false,
    lines: false, letters: true, ink: '#000000', lineColor: '#cdcdcd',
    font: 'Inter', weight: 600, fill: 82, fillExp: 0,
    jMt: 0, jMb: 0, jMl: 0, jMr: 0, jLineH: 0,
    glyphs: ['J', 'A', 'Z', 'Z']
  },

  // Auto-generated "Common" section in the Properties pane.
  params: [
    { type: 'section', label: 'Common' },
    { type: 'color',  key: 'ink',    label: 'Color' },
    { type: 'text',   key: 'glyphs', label: 'Letters / text',
      placeholder: 'Characters in order (e.g. JAZZ)',
      format: v => Array.isArray(v) ? v.join('') : (v ?? ''),
      parse:  v => Array.from(v) },
    { type: 'font',   key: 'font',   label: 'Font',   linkedWeight: 'weight' },
    { type: 'weight', key: 'weight', label: 'Weight', linkedFont:   'font'   },
    { type: 'range',  key: 'fill',   label: 'Letter fill', min: 20, max: 100, step: 1,   unit: '%',  fmt: 0 },
    { type: 'range',  key: 'jLineH', label: 'Row height',  min: 0,  max: 128, step: 0.5, unit: 'cm', fmt: 2 },
    { type: 'margins', keys: { T: 'jMt', B: 'jMb', L: 'jMl', R: 'jMr' }, max: 50, step: 0.5, unit: 'cm', fmt: 2 },
    { type: 'sep' }
  ],

  buildUI,
  build: _buildCells,

  layers: [{
    id: 'division', name: 'Recursive Div 1', visible: true, cached: true,
    key: () => [P.w, P.h, P.seed, P.seq, P.minC, P.maxC, P.curve,
                P.jMt, P.jMb, P.jMl, P.jMr, P.jLineH,
                P.glyphs ? P.glyphs.join('') : GLYPHS.join(''),
                P.lines, P.letters, P.ink, P.lineColor, P.font, P.weight, P.fill, P.fillExp].join('|'),
    draw: _draw,
    svg:  _svg
  }],

  onUpdate(key, value) {
    if (key === 'glyphs') {
      GLYPHS.length = 0;
      (Array.isArray(value) ? value : Array.from(value)).forEach(ch => GLYPHS.push(ch));
      document.fonts.load(`${P.weight} 20px "${P.font}"`, P.glyphs.join('') || ' ').then(() => redraw());
    }
    if (['minC', 'maxC', 'curve'].includes(key) && animOn) stopAnim();
    if (['minC', 'maxC', 'curve', 'seed', 'grad',
         'jMt', 'jMb', 'jMl', 'jMr', 'jLineH', 'seq', 'glyphs'].includes(key)) return 'build';
    return null;
  }
});
