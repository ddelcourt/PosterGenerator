// ============ STORAGE ============
// Persistence via localStorage. All functions rely on globals from app.js (P, GLYPHS, AMR, etc.)
//
// Architecture rule: module params live ONLY inside layerDefs[n].params, never at the
// top level of a snapshot. This guarantees each param is serialised exactly once,
// regardless of how large the value is (including base64 image data URLs).

// Keys written at the top level of every snapshot. Module-specific param keys are
// intentionally excluded — they belong exclusively to their layer's params object.
const _CORE_KEYS = new Set([
  'w', 'h', 'bg', 'glyphs', 'amrChars',
  'layerDefs', 'layerOrder', 'layerVisibility', 'selLayer', 'animSpeed', 'animOn'
]);

// Builds a clean layerDefs array, filtering each layer's params to only the
// keys declared in its module's defaults. Removes stale keys from old code.
function _cleanLayerDefs() {
  return layers.map(l => {
    const mod = _modules.find(m => m.id === l.moduleId);
    const known = mod ? new Set(Object.keys(mod.defaults || {})) : null;
    const params = known
      ? Object.fromEntries(Object.entries(l.params || {}).filter(([k]) => known.has(k)))
      : { ...(l.params || {}) };
    return { id: l.id, moduleId: l.moduleId, params };
  });
}

// Strips any top-level keys not in _CORE_KEYS from a parsed snapshot before
// merging into P. Also filters each layerDef's params to its module's known keys.
// Handles old JSON files that stored module params at the top level.
function _cleanSnapshot(snap) {
  Object.keys(snap).forEach(k => { if (!_CORE_KEYS.has(k)) delete snap[k]; });
  if (Array.isArray(snap.layerDefs)) {
    snap.layerDefs = snap.layerDefs.map(def => {
      const mod = _modules.find(m => m.id === def.moduleId);
      if (!mod) return def;
      const known = new Set(Object.keys(mod.defaults || {}));
      return { ...def, params: Object.fromEntries(Object.entries(def.params || {}).filter(([k]) => known.has(k))) };
    });
  }
}

function saveState() {
  const snap = { w: P.w, h: P.h, bg: P.bg };
  snap.glyphs          = [...GLYPHS];
  snap.amrChars        = [...AMR];
  snap.layerDefs       = _cleanLayerDefs();
  snap.layerOrder      = layers.map(l => l.id);
  snap.layerVisibility = Object.fromEntries(layers.map(l => [l.id, l.visible]));
  snap.selLayer        = selLayer;
  snap.animSpeed       = animSpeed;
  snap.animOn          = animOn;
  localStorage.setItem('jazz-poster-state', JSON.stringify(snap));
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
  if (Array.isArray(P.layerDefs)) {
    layers.length = 0;
    P.layerDefs.forEach(def => {
      const mod = _modules.find(m => m.id === def.moduleId);
      if (mod && mod.layers) {
        const tmpl = mod.layers.find(l => l.id === def.id) || mod.layers[0];
        if (tmpl) {
          // If def.params has content use it; otherwise init from P (old-format migration)
          const hasSavedParams = def.params && Object.keys(def.params).length > 0;
          const layerParams = hasSavedParams
            ? { ...(mod.defaults || {}), ...def.params }
            : Object.fromEntries(Object.keys(mod.defaults || {}).map(k => [k, P[k] ?? (mod.defaults || {})[k]]));
          layers.push({ ...tmpl, id: def.id, moduleId: def.moduleId, params: layerParams });
        }
      }
    });
    if (layers.length === 0) {
      _modules.forEach(mod => mod.layers && mod.layers.forEach(L =>
        layers.push({ ...L, moduleId: mod.id, params: { ...(mod.defaults || {}) } })));
    }
  } else if (Array.isArray(P.layerOrder)) {
    const byId = Object.fromEntries(layers.map(l => [l.id, l]));
    const ordered = P.layerOrder.map(id => byId[id]).filter(Boolean);
    layers.forEach(l => { if (!ordered.includes(l)) ordered.push(l); });
    layers.length = 0; ordered.forEach(l => layers.push(l));
  }
  // Ensure every layer has params (init from P for layers that lack them)
  layers.forEach(l => {
    if (!l.params) {
      const mod = _modules.find(m => m.id === l.moduleId);
      if (mod && mod.defaults)
        l.params = Object.fromEntries(Object.keys(mod.defaults).map(k => [k, P[k] ?? mod.defaults[k]]));
    }
  });
  if (P.layerVisibility && typeof P.layerVisibility === 'object') {
    layers.forEach(l => { if (l.id in P.layerVisibility) l.visible = !!P.layerVisibility[l.id]; });
  }
  if (typeof P.selLayer === 'number' && P.selLayer >= 0 && P.selLayer < layers.length) {
    selLayer = P.selLayer;
  }
  loadLayerParams(layers[selLayer]);
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
    try {
      const snap = JSON.parse(saved);
      _cleanSnapshot(snap);
      Object.assign(P, snap);
    } catch(e) {}
  }
  syncUIFromP();
  saveState();   // re-save immediately so stale keys are purged from localStorage
}

function exportJSON() {
  const snap = { w: P.w, h: P.h, bg: P.bg };
  snap.glyphs          = [...GLYPHS];
  snap.amrChars        = [...AMR];
  snap.layerDefs       = _cleanLayerDefs();
  snap.layerOrder      = layers.map(l => l.id);
  snap.layerVisibility = Object.fromEntries(layers.map(l => [l.id, l.visible]));
  snap.selLayer        = selLayer;
  snap.animSpeed       = animSpeed;
  snap.animOn          = animOn;
  return JSON.stringify(snap, null, 2);
}

function importJSON(json) {
  try {
    const snap = JSON.parse(json);
    _cleanSnapshot(snap);
    Object.assign(P, snap);
    syncUIFromP();
    build(); redraw();
    saveState();
  } catch(e) { alert('Invalid JSON'); }
}

