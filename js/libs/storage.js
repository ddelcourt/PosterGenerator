// ============ STORAGE ============
// Persistence via localStorage. All functions rely on globals from app.js (P, GLYPHS, AMR, etc.)

function saveState() {
  P.glyphs    = [...GLYPHS];
  P.amrChars  = [...AMR];
  localStorage.setItem('jazz-poster-state', JSON.stringify(P));
}

function syncUIFromP() {
  initWeightSelects();
  document.querySelectorAll('[data-k]').forEach(el => {
    const v = P[el.dataset.k];
    if (v === undefined) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'color') el.value = v;
    else el.value = v;
    if (el.type === 'range') {
      const o = document.getElementById(el.dataset.k + 'v');
      if (o) { const dp = el.dataset.fmt != null ? +el.dataset.fmt : 2; o.textContent = Number(v).toFixed(dp); }
    }
  });
  const fTextEl = document.getElementById('fText');
  if (fTextEl) fTextEl.value = P.fText;
  document.querySelectorAll('#modeSeg button').forEach(b =>
    b.setAttribute('aria-pressed', (b.dataset.mode === '1') === !!P.grad));
  document.querySelectorAll('#fitSeg button').forEach(b =>
    b.setAttribute('aria-pressed', (b.dataset.mode === 'fit') === !!P.amrFit));
  document.querySelectorAll('#typeSliders input').forEach(i => i.disabled = !!P.amrFit);
  if (Array.isArray(P.glyphs)) {
    P.glyphs.forEach((ch, i) => { if (i < GLYPHS.length) GLYPHS[i] = ch; });
    document.querySelectorAll('#glyphsJazz input').forEach((el, i) => { el.value = GLYPHS[i] || ''; });
  }
  if (Array.isArray(P.amrChars)) {
    P.amrChars.forEach((ch, i) => { if (i < AMR.length) AMR[i] = ch; });
    document.querySelectorAll('#glyphsAmr input').forEach((el, i) => { el.value = AMR[i] || ''; });
  }
  updateLoop();
}

function loadState() {
  const saved = localStorage.getItem('jazz-poster-state');
  if (saved) {
    try { Object.assign(P, JSON.parse(saved)); } catch(e) {}
  }
  syncUIFromP();
}

function exportJSON() {
  P.glyphs   = [...GLYPHS];
  P.amrChars = [...AMR];
  return JSON.stringify(P, null, 2);
}

function importJSON(json) {
  try {
    Object.assign(P, JSON.parse(json));
    syncUIFromP();
    build(); redraw();
    saveState();
  } catch(e) { alert('Invalid JSON'); }
}
