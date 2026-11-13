// ============ STORAGE ============
// Persistence via localStorage. All functions rely on globals from app.js (P, GLYPHS, AMR, etc.)

function saveState() {
  P.glyphs          = [...GLYPHS];
  P.amrChars        = [...AMR];
  P.layerOrder      = layers.map(l => l.id);
  P.layerVisibility = Object.fromEntries(layers.map(l => [l.id, l.visible]));
  P.selLayer        = selLayer;
  P.animSpeed       = animSpeed;
  P.animOn          = animOn;
  localStorage.setItem('jazz-poster-state', JSON.stringify(P));
}

function syncUIFromP() {
  document.querySelectorAll('[data-k]').forEach(el => {
    const v = P[el.dataset.k];
    if (v === undefined) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'color') el.value = v;
    else el.value = v;
    if (el.type === 'range') {
      const o = document.getElementById(el.dataset.k + 'v');
      if (o){ const dp = el.dataset.fmt != null ? +el.dataset.fmt : 2; o.textContent = Number(v).toFixed(dp); }
    }
  });
  document.querySelectorAll('#modeSeg button').forEach(b =>
    b.setAttribute('aria-pressed', (b.dataset.mode === '1') === !!P.grad));
  document.querySelectorAll('#fitSeg button').forEach(b =>
    b.setAttribute('aria-pressed', (b.dataset.mode === 'fit') === !!P.amrFit));
  if (Array.isArray(P.glyphs)) {
    GLYPHS.length = 0; P.glyphs.forEach(ch => GLYPHS.push(ch));
  }
  if (Array.isArray(P.amrChars)) {
    AMR.length = 0; P.amrChars.forEach(ch => AMR.push(ch));
  }
  if (Array.isArray(P.layerOrder)) {
    const byId = Object.fromEntries(layers.map(l => [l.id, l]));
    const ordered = P.layerOrder.map(id => byId[id]).filter(Boolean);
    layers.forEach(l => { if (!ordered.includes(l)) ordered.push(l); });
    layers.length = 0; ordered.forEach(l => layers.push(l));
  }
  if (P.layerVisibility && typeof P.layerVisibility === 'object') {
    layers.forEach(l => { if (l.id in P.layerVisibility) l.visible = !!P.layerVisibility[l.id]; });
  }
  if (typeof P.selLayer === 'number' && P.selLayer >= 0 && P.selLayer < layers.length) {
    selLayer = P.selLayer;
  }
  if (typeof P.animSpeed === 'number') {
    animSpeed = P.animSpeed;
    const speedEl = document.getElementById('speed');
    if (speedEl) { speedEl.value = animSpeed; document.getElementById('speedv').textContent = animSpeed; }
  }
  if (typeof P.animOn === 'boolean') {
    const animEl = document.getElementById('anim');
    if (animEl) animEl.checked = P.animOn;
    if (P.animOn) startAnim();
  }
  syncCommonSection(layers[selLayer].id);
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
  P.glyphs          = [...GLYPHS];
  P.amrChars        = [...AMR];
  P.layerOrder      = layers.map(l => l.id);
  P.layerVisibility = Object.fromEntries(layers.map(l => [l.id, l.visible]));
  P.selLayer        = selLayer;
  P.animSpeed       = animSpeed;
  P.animOn          = animOn;
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
