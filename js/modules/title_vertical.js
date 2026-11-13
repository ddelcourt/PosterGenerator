// ============ AMR MODULE ============
// Three stacked single-character rows, one letter each, top to bottom.

// amrItems is a top-level function so export.js can call it directly.
function amrItems() {
  const em    = emWidths(P.amrFont, P.amrWeight);
  const nRows = Math.max(1, AMR.filter(Boolean).length);
  const totalH = Math.max(0.1, P.h - P.amrMt - P.amrMb);
  const totalW = Math.max(0.1, P.w - P.amrMl - P.amrMr);
  const rowH   = totalH / nRows;
  const cx     = P.amrMl + totalW / 2;
  const L      = P.amrFit ? rowH : P.amrLine;
  const top0   = P.amrMt + (totalH - nRows * L) / 2;
  return AMR.filter(Boolean).map((ch, i) => {
    const s = P.amrFit ? Math.min(rowH / CAP, totalW / em(ch)) : P.amrSize;
    return { ch, x: cx, y: top0 + i * L + (L + s * CAP) / 2, s };   // y = baseline
  });
}

function _draw(g, k) {
  g.fillStyle = P.amrColor; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const it of amrItems()) {
    g.font = `${P.amrWeight} ${it.s * k}px "${P.amrFont}", sans-serif`;
    g.fillText(it.ch, it.x * k, it.y * k);
  }
}

function _svg() {
  const f = v => +v.toFixed(4);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<g id="layer-amr" font-family="${P.amrFont}" font-weight="${P.amrWeight}" text-anchor="middle" fill="${P.amrColor}">` +
    amrItems().map(it => `<text x="${f(it.x)}" y="${f(it.y)}" font-size="${f(it.s)}">${esc(it.ch)}</text>`).join('') +
    '</g>\n';
}

function buildUI(container) {
  const h = document.createElement('h3');
  h.className = 'prop-section prop-layer-title';
  h.textContent = 'AMR';
  container.appendChild(h);

  // Fit / Manual segmented control.
  // data-mode="fit"/"manual" matches the selector in storage.js's syncUIFromP.
  const seg = document.createElement('div');
  seg.className = 'seg'; seg.id = 'fitSeg';
  seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Type sizing');
  [{ mode: 'fit', label: 'Fit to rows', fit: true }, { mode: 'manual', label: 'Manual', fit: false }].forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.dataset.mode = opt.mode; btn.textContent = opt.label;
    btn.setAttribute('aria-pressed', String(!!P.amrFit === opt.fit));
    btn.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      dispatch('amrFit', opt.fit);
    });
    seg.appendChild(btn);
  });
  container.appendChild(seg);
}

// ============ REGISTER ============
window.AMRApp.registerModule({
  id: 'amr',
  name: 'AMR',

  defaults: {
    amrColor: '#e02020', amrFit: false, amrSize: 50, amrLine: 42.5,
    amrFont: 'Inter', amrWeight: 600,
    amrMt: 2.5, amrMb: 2.5, amrMl: 5, amrMr: 5,
    amrMv: 2.5, amrMh: 5,     // legacy keys kept for saved-state compat
    amrChars: ['A', 'M', 'R']
  },

  params: [
    { type: 'section', label: 'Common' },
    { type: 'color',  key: 'amrColor',  label: 'Color' },
    { type: 'text',   key: 'amrChars',  label: 'Letters / text',
      placeholder: 'One character per row (e.g. AMR)',
      format: v => Array.isArray(v) ? v.join('') : (v ?? ''),
      parse:  v => Array.from(v) },
    { type: 'font',   key: 'amrFont',   label: 'Font',   linkedWeight: 'amrWeight' },
    { type: 'weight', key: 'amrWeight', label: 'Weight', linkedFont:   'amrFont'   },
    { type: 'range',  key: 'amrSize',   label: 'Font size',   min: 1, max: 150, step: 0.5, unit: 'cm', fmt: 2,
      disabled: P => P.amrFit },
    { type: 'range',  key: 'amrLine',   label: 'Line height', min: 1, max: 130, step: 0.5, unit: 'cm', fmt: 2,
      disabled: P => P.amrFit },
    { type: 'margins', keys: { T: 'amrMt', B: 'amrMb', L: 'amrMl', R: 'amrMr' }, max: 50, step: 0.5, unit: 'cm', fmt: 2 },
    { type: 'sep' }
  ],

  buildUI,

  layers: [{
    id: 'amr', name: 'AMR', visible: true, cached: true,
    key: () => [P.w, P.h, P.amrMt, P.amrMb, P.amrMl, P.amrMr, P.amrColor, P.amrFit, P.amrSize, P.amrLine, AMR.join(''), P.amrFont, P.amrWeight].join(),
    draw: _draw,
    svg:  _svg
  }],

  onUpdate(key, value) {
    if (key === 'amrChars') {
      AMR.length = 0;
      (Array.isArray(value) ? value : Array.from(value)).forEach(ch => AMR.push(ch));
      document.fonts.load(`${P.amrWeight} 20px "${P.amrFont}"`, AMR.join('') || ' ').then(() => redraw());
    }
    if (key === 'amrFit') {
      ['amrSize', 'amrLine'].forEach(k => {
        const el = document.querySelector(`[data-k="${k}"]`);
        if (el) el.disabled = value;
      });
    }
    return null;   // all AMR param changes only need a redraw
  }
});
