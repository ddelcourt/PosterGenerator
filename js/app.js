// ============ STATE ============
// Global poster params; layer-specific defaults are registered by each module.
const P = { w: 89.5, h: 128, bg: '#ffffff' };

const CAP = 0.727;   // Inter cap height / em

// Font registry (shared across all modules)
const FONT_WEIGHTS = {
  'Inter':                       [100, 200, 300, 400, 500, 600, 700, 800, 900],
  'Special Gothic Expanded One': [400],
  'Ultra':                       [400],
  'BioRhyme Expanded':           [300, 400, 700, 800],
  'Caprasimo':                   [400],
  'Cormorant Garamond':          [300, 400, 500, 600, 700]
};
const FONT_FILES = {
  'Inter':                       { 100:'inter-100.ttf', 200:'inter-200.ttf', 300:'inter-300.ttf', 400:'inter-400.ttf', 500:'inter-500.ttf', 600:'inter-600.ttf', 700:'inter-700.ttf', 800:'inter-800.ttf', 900:'inter-900.ttf' },
  'Special Gothic Expanded One': { 400:'special-gothic-expanded-one-400.ttf' },
  'Ultra':                       { 400:'ultra-400.ttf' },
  'BioRhyme Expanded':           { 300:'biorhyme-expanded-300.ttf', 400:'biorhyme-expanded-400.ttf', 700:'biorhyme-expanded-700.ttf', 800:'biorhyme-expanded-800.ttf' },
  'Caprasimo':                   { 400:'caprasimo-400.ttf' },
  'Cormorant Garamond':          { 300:'cormorant-garamond-300.ttf', 400:'cormorant-garamond-400.ttf', 500:'cormorant-garamond-500.ttf', 600:'cormorant-garamond-600.ttf', 700:'cormorant-garamond-700.ttf' }
};
const WEIGHT_NAMES = {
  100:'Thin', 200:'ExtraLight', 300:'Light', 400:'Regular',
  500:'Medium', 600:'SemiBold', 700:'Bold', 800:'ExtraBold', 900:'Black'
};

// Font-key → weight-key mapping, populated at registration time from module param schemas.
const FONT_TO_WEIGHT = {};
const WEIGHT_TO_FONT = {};

// Global mutable char arrays kept as top-level const so storage.js can mutate them in-place.
const GLYPHS = ['J', 'A', 'Z', 'Z'];
const AMR    = ['A', 'M', 'R'];

// Primitives that storage.js reads/writes in the shared global lexical scope.
let animSpeed = 1;
let animOn    = false;
let selLayer  = 0;

// ============ LAYER & MODULE REGISTRY ============
const layers   = [];
const _modules = [];

// ============ UTILITIES ============
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

const _emCache = {};
function emWidths(family, weight) {
  const fam = family || 'Inter', wt = weight || 600, g = drawingContext;
  return ch => {
    const k = `${wt}|${fam}|${ch}`;
    if (!_emCache[k]) {
      g.save(); g.font = `${wt} 100px "${fam}", sans-serif`;
      _emCache[k] = Math.max(0.3, g.measureText(ch).width / 100);
      g.restore();
    }
    return _emCache[k];
  };
}

function nearestWeight(family, w) {
  const avail = FONT_WEIGHTS[family] || [400];
  return avail.reduce((best, v) => Math.abs(v - w) < Math.abs(best - w) ? v : best, avail[0]);
}

function loadFont(family) {
  if (!family) return;
  const weights = FONT_WEIGHTS[family] || [400];
  Promise.all(weights.map(w => document.fonts.load(`${w} 20px "${family}"`))).then(redraw);
}

// ============ MODULE API & LOADER ============
// Exposed on window so module scripts loaded after app.js can call registerModule.
window.AMRApp = {
  registerModule(def) {
    if (def.defaults) Object.assign(P, def.defaults);
    if (def.layers)   def.layers.forEach(L => { L.moduleId = def.id; L.params = { ...(def.defaults || {}) }; layers.push(L); });
    if (def.params) {
      def.params.forEach(p => {
        if (p.type === 'font' && p.linkedWeight) {
          FONT_TO_WEIGHT[p.key]           = p.linkedWeight;
          WEIGHT_TO_FONT[p.linkedWeight]  = p.key;
        }
      });
    }
    _modules.push(def);
  }
};

// ============ BUILD ============
// Delegates to every module that exposes a build() method (currently: division).
function build() {
  _modules.forEach(mod => { if (typeof mod.build === 'function') mod.build(); });
}

// ============ DISPATCH ============
// Single entry-point for all parameter mutations: updates P, syncs UI, triggers action.
const _FIT_KEYS = new Set(['w', 'h']);

function dispatch(key, value) {
  P[key] = value;
  const _cl = layers[selLayer];
  if (_cl && _cl.params && key in _cl.params) _cl.params[key] = value;
  updateParamUI(key, value);
  if (_modules.some(m => m.params && m.params.some(p => p.type === 'text' && p.key === key)))
    updateLayerNames();

  // Font → weight linking: repopulate the weight select for the new family.
  if (key in FONT_TO_WEIGHT) {
    const wKey    = FONT_TO_WEIGHT[key];
    const snapped = nearestWeight(value, P[wKey]);
    P[wKey] = snapped;
    if (_cl && _cl.params && wKey in _cl.params) _cl.params[wKey] = snapped;
    loadFont(value);
    const wSel = document.querySelector(`[data-k="${wKey}"]`);
    if (wSel && wSel.tagName === 'SELECT') {
      const avail = FONT_WEIGHTS[value] || [400];
      wSel.innerHTML = avail.map(w =>
        `<option value="${w}"${w === snapped ? ' selected' : ''}>${w} \u2014 ${WEIGHT_NAMES[w] || w}</option>`
      ).join('');
    }
    updateParamUI(wKey, snapped);
  }

  if (_FIT_KEYS.has(key)) { build(); fit(); if (typeof saveState !== 'undefined') saveState(); return; }

  let action = 'redraw';
  for (const mod of _modules) {
    if (!mod.onUpdate) continue;
    const a = mod.onUpdate(key, value);
    if (a === 'build') { action = 'build'; break; }
    if (a === 'none')  { action = 'none';  break; }
  }

  if (action === 'build') build();
  if (action !== 'none')  redraw();
  if (typeof saveState !== 'undefined') saveState();
}

// Updates all matching [data-k] elements without triggering re-dispatch.
function updateParamUI(key, value) {
  document.querySelectorAll(`[data-k="${key}"]`).forEach(el => {
    const formatted = typeof el._format === 'function' ? el._format(value) : value;
    if (el.type === 'checkbox') el.checked = !!value;
    else if (el.type === 'color') el.value = value;
    else el.value = formatted;
    if (el.type === 'range') {
      const out = document.getElementById(key + 'v');
      if (out) {
        const dp = el.dataset.fmt != null ? +el.dataset.fmt : 2;
        out.textContent = Number(formatted).toFixed(dp);
      }
      if (typeof el._updateTrack === 'function') el._updateTrack();
    }
  });
}

// ============ PROPERTIES PANE ============
// Clears and rebuilds the Properties pane content for the given layer.
function renderProperties(layerId) {
  const layer = layers.find(L => L.id === layerId);
  const mod = layer ? _modules.find(m => m.id === layer.moduleId) : null;
  const container = document.querySelector('#properties .pal-b');
  container.innerHTML = '';
  if (!mod) return;

  // Type selector — allows switching this layer to any registered module
  const layerIdx = layers.indexOf(layer);
  const typeRow = _el('div', 'row wide');
  const typeLabel = _el('span'); typeLabel.textContent = 'Type';
  const typeSel = document.createElement('select');
  _modules.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.name;
    opt.selected = (m.id === layer.moduleId);
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => setLayerModule(layerIdx, typeSel.value));
  typeRow.append(typeLabel, typeSel);
  container.appendChild(typeRow);
  container.insertAdjacentHTML('beforeend', '<div class="prop-sep"></div>');

  if (mod.params) mod.params.forEach(p => _renderParam(p, container));
  if (typeof mod.buildUI === 'function') mod.buildUI(container, window.AMRApp);
}

// Alias called by storage.js.
function syncCommonSection(layerId) { renderProperties(layerId); }

function _renderParam(param, container) {
  switch (param.type) {
    case 'section':  _rSection(param, container);  break;
    case 'sep':      container.insertAdjacentHTML('beforeend', '<div class="prop-sep"></div>'); break;
    case 'color':    _rColor(param, container);    break;
    case 'text':     _rText(param, container);     break;
    case 'font':     _rFont(param, container);     break;
    case 'weight':   _rWeight(param, container);   break;
    case 'range':    _rRange(param, container);    break;
    case 'range2':   _rRange2(param, container);   break;
    case 'number':   _rNumber(param, container);   break;
    case 'checkbox': _rCheckbox(param, container); break;
    case 'button':   _rButton(param, container);   break;
    case 'seg':      _rSeg(param, container);      break;
    case 'margins':  _rMargins(param, container);  break;
  }
}

function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function _el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function _rSection({ label, className }, c) {
  const h = _el('h3', 'prop-section' + (className ? ' ' + className : ''));
  h.textContent = label;
  c.appendChild(h);
}

function _rColor({ key, label }, c) {
  const row = _el('div', 'row');
  row.innerHTML = `<span>${_esc(label)}</span><input type="color" data-k="${_esc(key)}" value="${_esc(P[key] || '#000000')}" aria-label="${_esc(label)}">`;
  row.querySelector('input').addEventListener('input', e => dispatch(key, e.target.value));
  c.appendChild(row);
}

function _rText({ key, label, placeholder, format, parse }, c) {
  const val = typeof format === 'function' ? format(P[key]) : (P[key] ?? '');
  const row = _el('div', 'row wide');
  row.innerHTML = `<span>${_esc(label)}</span><input type="text" data-k="${_esc(key)}" value="${_esc(val)}" placeholder="${_esc(placeholder || '')}" autocomplete="off" spellcheck="false">`;
  const inp = row.querySelector('input');
  if (format) inp._format = format;
  inp.addEventListener('input', () => dispatch(key, parse ? parse(inp.value) : inp.value));
  c.appendChild(row);
}

function _rFont({ key, label }, c) {
  const families = Object.keys(FONT_WEIGHTS);
  const row = _el('div', 'row wide');
  row.innerHTML = `<span>${_esc(label)}</span><select data-k="${_esc(key)}">` +
    families.map(f => `<option value="${_esc(f)}"${f === P[key] ? ' selected' : ''}>${_esc(f)}</option>`).join('') +
    `</select>`;
  row.querySelector('select').addEventListener('change', e => dispatch(key, e.target.value));
  c.appendChild(row);
}

function _rWeight({ key, label }, c) {
  const fontKey = WEIGHT_TO_FONT[key];
  const family  = fontKey ? (P[fontKey] || Object.keys(FONT_WEIGHTS)[0]) : Object.keys(FONT_WEIGHTS)[0];
  const avail   = FONT_WEIGHTS[family] || [400];
  const snapped = nearestWeight(family, P[key] || 400);
  P[key] = snapped;
  const _cl = layers[selLayer];
  if (_cl && _cl.params && key in _cl.params) _cl.params[key] = snapped;
  const row = _el('div', 'row wide');
  row.innerHTML = `<span>${_esc(label)}</span><select data-k="${_esc(key)}">` +
    avail.map(w => `<option value="${w}"${w === snapped ? ' selected' : ''}>${w} \u2014 ${WEIGHT_NAMES[w] || w}</option>`).join('') +
    `</select>`;
  row.querySelector('select').addEventListener('change', e => dispatch(key, parseInt(e.target.value, 10)));
  c.appendChild(row);
}

function _rRange({ key, label, min, max, step, unit, fmt, disabled }, c) {
  const val = P[key] ?? 0;
  const dp  = fmt ?? 2;
  const dis = typeof disabled === 'function' ? disabled(P) : !!disabled;
  const row = _el('div', 'row wide');
  row.innerHTML =
    `<span>${_esc(label)}: <output id="${_esc(key)}v">${Number(val).toFixed(dp)}</output> ${_esc(unit || '')}</span>` +
    `<input type="range" data-k="${_esc(key)}" data-fmt="${dp}" min="${min}" max="${max}" step="${step}" value="${val}"${dis ? ' disabled' : ''}>`;
  row.querySelector('input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById(key + 'v').textContent = v.toFixed(dp);
    dispatch(key, v);
  });
  c.appendChild(row);
}

function _rRange2({ keys, label, min, max, step, unit, fmt }, c) {
  const dp = fmt ?? 2;
  const loKey = keys.lo, hiKey = keys.hi;
  const loVal = P[loKey] ?? min, hiVal = P[hiKey] ?? max;

  const row = _el('div', 'row wide');

  const span = _el('span');
  const loOut = document.createElement('output'); loOut.id = loKey + 'v'; loOut.textContent = Number(loVal).toFixed(dp);
  const hiOut = document.createElement('output'); hiOut.id = hiKey + 'v'; hiOut.textContent = Number(hiVal).toFixed(dp);
  span.append(`${label}: `, loOut, ' → ', hiOut, ` ${unit || ''}`);

  const wrap = _el('div', 'range2-wrap');
  const track = _el('div', 'range2-track');

  const loInp = document.createElement('input');
  loInp.type = 'range'; loInp.className = 'range2-lo';
  loInp.dataset.k = loKey; loInp.dataset.fmt = dp;
  loInp.min = min; loInp.max = max; loInp.step = step; loInp.value = loVal;

  const hiInp = document.createElement('input');
  hiInp.type = 'range'; hiInp.className = 'range2-hi';
  hiInp.dataset.k = hiKey; hiInp.dataset.fmt = dp;
  hiInp.min = min; hiInp.max = max; hiInp.step = step; hiInp.value = hiVal;

  function pct(v) { return ((v - min) / (max - min) * 100).toFixed(2); }

  function updateTrack() {
    const lo = parseFloat(loInp.value), hi = parseFloat(hiInp.value);
    // When both thumbs overlap, raise lo's z-index on the left half so it can be pulled back left.
    if (lo === hi) {
      loInp.style.zIndex = lo <= (min + max) / 2 ? 2 : 1;
      hiInp.style.zIndex = lo <= (min + max) / 2 ? 1 : 2;
    } else {
      loInp.style.zIndex = hiInp.style.zIndex = '';
    }
    track.style.background =
      `linear-gradient(to right, var(--bg-control) ${pct(lo)}%, var(--button-primary) ${pct(lo)}%, var(--button-primary) ${pct(hi)}%, var(--bg-control) ${pct(hi)}%)`;
  }

  loInp._updateTrack = hiInp._updateTrack = updateTrack;
  updateTrack();

  loInp.addEventListener('input', e => {
    let v = parseFloat(e.target.value);
    if (v > parseFloat(hiInp.value)) { v = parseFloat(hiInp.value); loInp.value = v; }
    loOut.textContent = v.toFixed(dp);
    updateTrack();
    dispatch(loKey, v);
  });

  hiInp.addEventListener('input', e => {
    let v = parseFloat(e.target.value);
    if (v < parseFloat(loInp.value)) { v = parseFloat(loInp.value); hiInp.value = v; }
    hiOut.textContent = v.toFixed(dp);
    updateTrack();
    dispatch(hiKey, v);
  });

  wrap.append(track, loInp, hiInp);
  row.append(span, wrap);
  c.appendChild(row);
}

function _rNumber({ key, label, min, max, step, id }, c) {
  const row = _el('div', 'row');
  row.innerHTML =
    `<span>${_esc(label)}</span>` +
    `<input type="number" data-k="${_esc(key)}"${id ? ` id="${_esc(id)}"` : ''} value="${P[key] ?? 0}"` +
    `${min != null ? ` min="${min}"` : ''}${max != null ? ` max="${max}"` : ''}${step != null ? ` step="${step}"` : ''}>`;
  row.querySelector('input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (isFinite(v)) dispatch(key, v);
  });
  c.appendChild(row);
}

function _rCheckbox({ key, label, id }, c) {
  const lbl = _el('label', 'chk');
  lbl.innerHTML = `<input type="checkbox" data-k="${_esc(key)}"${id ? ` id="${_esc(id)}"` : ''}${P[key] ? ' checked' : ''}><span>${_esc(label)}</span>`;
  lbl.querySelector('input').addEventListener('change', e => dispatch(key, e.target.checked));
  c.appendChild(lbl);
}

function _rButton({ label, alt, onClick }, c) {
  const btn = _el('button');
  if (alt) btn.className = 'alt';
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', () => typeof onClick === 'function' && onClick());
  c.appendChild(btn);
}

function _rSeg({ key, groupId, label, options }, c) {
  const seg = _el('div', 'seg');
  if (groupId) seg.id = groupId;
  seg.setAttribute('role', 'group');
  if (label) seg.setAttribute('aria-label', label);
  options.forEach(opt => {
    const btn = _el('button');
    btn.type = 'button';
    // dataMode is used by storage.js's syncUIFromP to identify buttons by role.
    btn.dataset.mode = opt.dataMode !== undefined ? String(opt.dataMode) : String(opt.value);
    btn.textContent  = opt.label;
    btn.setAttribute('aria-pressed', String(P[key] === opt.value));
    btn.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      dispatch(key, opt.value);
    });
    seg.appendChild(btn);
  });
  c.appendChild(seg);
}

function _rMargins({ keys, max, step, unit, fmt }, c) {
  const dp = fmt ?? 2;
  [['T', 'Top'], ['B', 'Bottom'], ['L', 'Left'], ['R', 'Right']].forEach(([dir, lbl]) => {
    const key = keys[dir], val = P[key] ?? 0;
    const row = _el('div', 'row wide');
    row.innerHTML =
      `<span>${_esc(lbl)}: <output id="${_esc(key)}v">${Number(val).toFixed(dp)}</output> ${_esc(unit || 'cm')}</span>` +
      `<input type="range" data-k="${_esc(key)}" data-fmt="${dp}" min="0" max="${max || 50}" step="${step || 0.5}" value="${val}">`;
    row.querySelector('input').addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      document.getElementById(key + 'v').textContent = v.toFixed(dp);
      dispatch(key, v);
    });
    c.appendChild(row);
  });
}

// ============ LAYER LIST ============
function layerDisplayName(L) {
  const mod = _modules.find(m => m.id === L.moduleId);
  if (!mod || !mod.params) return L.name;
  const tp = mod.params.find(p => p.type === 'text');
  if (!tp) return L.name;
  const val = (L.params || P)[tp.key];
  if (val == null) return L.name;
  const str = typeof tp.format === 'function' ? tp.format(val) : String(val);
  return str.trim() || L.name;
}

function updateLayerNames() {
  document.querySelectorAll('#layerList .layer').forEach(li => {
    const L = layers[+li.dataset.idx];
    const btn = li.querySelector('.layer-name');
    if (L && btn) btn.textContent = layerDisplayName(L);
  });
}

function loadLayerParams(L) {
  if (!L || !L.params) return;
  Object.assign(P, L.params);
  if (Array.isArray(P.glyphs))   { GLYPHS.length = 0; P.glyphs.forEach(ch => GLYPHS.push(ch)); }
  if (Array.isArray(P.amrChars)) { AMR.length = 0; P.amrChars.forEach(ch => AMR.push(ch)); }
}

function addLayer(moduleId) {
  const mod = _modules.find(m => m.id === moduleId);
  if (!mod || !mod.layers || !mod.layers[0]) return;
  const uid = moduleId + '_' + Date.now();
  layers.push({ ...mod.layers[0], id: uid, moduleId, params: { ...(mod.defaults || {}) } });
  selLayer = layers.length - 1;
  loadLayerParams(layers[selLayer]);
  if (typeof mod.build === 'function') mod.build();
  renderLayers(); redraw();
  if (typeof saveState !== 'undefined') saveState();
}

function deleteLayer(idx) {
  layers.splice(idx, 1);
  if (selLayer >= layers.length) selLayer = Math.max(0, layers.length - 1);
  if (layers.length > 0) loadLayerParams(layers[selLayer]);
  renderLayers();
  if (layers.length > 0) renderProperties(layers[selLayer].id);
  else document.querySelector('#properties .pal-b').innerHTML = '';
  redraw();
  if (typeof saveState !== 'undefined') saveState();
}

function setLayerModule(idx, newModuleId) {
  const newMod = _modules.find(m => m.id === newModuleId);
  if (!newMod || !newMod.layers || !newMod.layers[0]) return;
  const tmpl = newMod.layers[0];
  const visible = layers[idx].visible;
  Object.keys(layers[idx]).forEach(k => { delete layers[idx][k]; });
  Object.assign(layers[idx], { ...tmpl, moduleId: newModuleId, visible, params: { ...(newMod.defaults || {}) } });
  if (idx === selLayer) loadLayerParams(layers[idx]);
  if (typeof newMod.build === 'function') newMod.build();
  renderLayers();
  renderProperties(layers[idx].id);
  redraw();
  if (typeof saveState !== 'undefined') saveState();
}

function renderLayers() {
  const ul = document.getElementById('layerList');
  ul.textContent = '';
  let dragSrc = null;
  const displayLayers = [...layers].reverse();   // topmost layer first in the list

  displayLayers.forEach((L, displayIdx) => {
    const i  = layers.length - 1 - displayIdx;
    const li = _el('li', 'layer' + (i === selLayer ? ' sel' : ''));
    li.draggable = true; li.dataset.idx = i;

    const handle = _el('span', 'drag-handle');
    handle.textContent = '⠿'; handle.setAttribute('aria-hidden', 'true');

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = L.visible;
    cb.setAttribute('aria-label', 'Show ' + L.name);
    cb.addEventListener('change', () => { L.visible = cb.checked; updateLoop(); redraw(); });

    const nm = _el('button'); nm.type = 'button'; nm.className = 'layer-name';
    nm.textContent = layerDisplayName(L);
    nm.addEventListener('click', () => { selLayer = i; loadLayerParams(layers[i]); renderLayers(); });

    const mod = _modules.find(m => m.id === L.moduleId);
    const info = _el('button'); info.type = 'button'; info.className = 'layer-info';
    info.textContent = 'i'; info.setAttribute('aria-label', 'Patch info');
    if (mod && mod.patch) info.dataset.tooltip = mod.patch;
    info.addEventListener('click', e => e.stopPropagation());

    const del = _el('button'); del.type = 'button'; del.className = 'layer-delete';
    del.textContent = '×'; del.setAttribute('aria-label', 'Delete layer');
    del.addEventListener('click', e => { e.stopPropagation(); deleteLayer(i); });

    li.append(handle, cb, nm, info, del); ul.append(li);

    li.addEventListener('dragstart', e => {
      dragSrc = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', i);
      requestAnimationFrame(() => li.classList.add('dragging'));
    });
    li.addEventListener('dragend', () => { li.classList.remove('dragging'); dragSrc = null; });
    li.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragSrc !== i) li.classList.add('drag-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', e => {
      e.preventDefault(); li.classList.remove('drag-over');
      const from = +e.dataTransfer.getData('text/plain'), to = i;
      if (from === to) return;
      const [moved] = layers.splice(from, 1); layers.splice(to, 0, moved);
      if      (selLayer === from)                                selLayer = to;
      else if (from < to && selLayer > from && selLayer <= to)  selLayer--;
      else if (from > to && selLayer >= to && selLayer < from)  selLayer++;
      renderLayers(); redraw(); if (typeof saveState !== 'undefined') saveState();
    });
  });

  renderProperties(layers[selLayer].id);
  if (!isMobile()) autoLayout(true);
}

// ============ CANVAS (p5.js) ============
function setup() {
  loadState();
  createCanvas(10, 10).parent('stage'); noLoop(); renderLayers();
  const families = [...new Set(Object.keys(FONT_TO_WEIGHT).map(k => P[k]).filter(Boolean))];
  const loads = families.flatMap(fam =>
    (FONT_WEIGHTS[fam] || [400]).map(w => document.fonts.load(`${w} 20px "${fam}"`))
  );
  Promise.all(loads).then(() => { build(); fit(); updateLoop(); });
}

function windowResized() {
  fit();
  if (isMobile()) return;
  palettes.some(p => !p.style.left) ? autoLayout() : clampAll();
}

function fit() {
  const s = document.getElementById('stage'), pad = 32;
  const k = Math.min((s.clientWidth - pad) / P.w, (s.clientHeight - pad) / P.h);
  resizeCanvas(Math.max(10, Math.floor(P.w * k)), Math.max(10, Math.floor(P.h * k)));
  redraw();
}

function draw() {
  background(P.bg);
  const k = width / P.w;
  for (const L of layers) {
    if (!L.visible) continue;
    const mod = L.moduleId ? _modules.find(m => m.id === L.moduleId) : null;
    const keys = mod && mod.defaults ? Object.keys(mod.defaults) : [];
    let backup = null, glyphsBak = null, amrBak = null;
    if (L.params && keys.length) {
      backup = {}; keys.forEach(k => { backup[k] = P[k]; });
      glyphsBak = [...GLYPHS]; amrBak = [...AMR];
      Object.assign(P, L.params);
      if (Array.isArray(P.glyphs))   { GLYPHS.length = 0; P.glyphs.forEach(ch => GLYPHS.push(ch)); }
      if (Array.isArray(P.amrChars)) { AMR.length = 0; P.amrChars.forEach(ch => AMR.push(ch)); }
    }
    if (typeof L.advance === 'function') L.advance();
    // Per-layer build: rebuild shared module state when this layer's key changes
    if (L.cached && typeof L.key === 'function' && mod && typeof mod.build === 'function') {
      const ck = L.key();
      if (L._preKey !== ck) { mod.build(); L._preKey = ck; L._key = null; }
    }
    L.cached ? renderCached(L, k) : L.draw(drawingContext, k);
    if (backup) {
      keys.forEach(k => { P[k] = backup[k]; });
      GLYPHS.length = 0; glyphsBak.forEach(ch => GLYPHS.push(ch));
      AMR.length = 0; amrBak.forEach(ch => AMR.push(ch));
    }
  }
}

// Layers marked cached are painted once into an offscreen canvas and blitted each frame.
function renderCached(L, k) {
  const cv = drawingContext.canvas, pd = pixelDensity();
  const key = [width, height, pd, L.key()].join('|');
  if (L._key !== key) {
    if (!L._cv) L._cv = document.createElement('canvas');
    L._cv.width = cv.width; L._cv.height = cv.height;
    const g = L._cv.getContext('2d'); g.scale(pd, pd);
    L.draw(g, k); L._key = key;
  }
  drawingContext.drawImage(L._cv, 0, 0, width, height);
}

function updateLoop() {
  layers.some(L => L.visible && typeof L.needsLoop === 'function' && L.needsLoop()) ? loop() : noLoop();
}

// ============ FLOATING PALETTES ============
const palettes = [...document.querySelectorAll('.pal')];
const isMobile = () => matchMedia('(max-width:760px)').matches;
let zTop = 10;

function autoLayout(onlyUnplaced) {
  if (isMobile()) { palettes.forEach(p => { p.style.left = p.style.top = ''; }); return; }
  const W = 280, gap = 10, m = 12, maxY = innerHeight - m;
  const topRight = document.getElementById('topRight');
  const lStartY = topRight ? topRight.getBoundingClientRect().bottom + gap : m;
  const colX = { L: m, R: Math.max(m, innerWidth - m - W) }, colY = { L: lStartY, R: m };
  if (onlyUnplaced) palettes.forEach(p => {
    if (p.hidden || !p.style.left) return;
    const c = parseFloat(p.style.left) < innerWidth / 2 ? 'L' : 'R';
    colY[c] = Math.max(colY[c], parseFloat(p.style.top) + p.offsetHeight + gap);
  });
  palettes.forEach(p => {
    if (p.hidden || (onlyUnplaced && p.style.left)) return;
    const h = p.offsetHeight, pref = p.dataset.col || 'L', alt = pref === 'L' ? 'R' : 'L';
    const col = (colY[pref] + h <= maxY || colY[alt] + h > maxY) ? pref : alt;
    p.style.left = colX[col] + 'px'; p.style.top = colY[col] + 'px';
    colY[col] += h + gap;
  });
}

function clampAll() {
  palettes.forEach(p => {
    const w = p.offsetWidth;
    p.style.left = Math.min(innerWidth - 60, Math.max(60 - w, parseFloat(p.style.left) || 0)) + 'px';
    p.style.top  = Math.min(innerHeight - 40, Math.max(0, parseFloat(p.style.top) || 0)) + 'px';
  });
}

// ============ STATIC CONTROLS ============
// Poster size (w, h) and background color (bg) are hardcoded in the HTML with data-k.
// All module-specific controls are generated dynamically by renderProperties().
document.querySelectorAll('#palettes .pal:not(#properties) [data-k]').forEach(el => {
  el.addEventListener('input', () => {
    const k = el.dataset.k;
    if (el.type === 'color') { dispatch(k, el.value); return; }
    const v = parseFloat(el.value);
    if (!isFinite(v) || v <= 0) return;
    dispatch(k, v);
  });
});

function openNewLayerModal() {
  const sel = document.getElementById('newLayerType');
  sel.innerHTML = _modules.map(m =>
    `<option value="${_esc(m.id)}">${_esc(m.name)}</option>`
  ).join('');
  document.getElementById('newLayerModal').hidden = false;
  sel.focus();
}

function closeNewLayerModal() {
  document.getElementById('newLayerModal').hidden = true;
}

document.getElementById('addLayerBtn').addEventListener('click', () => {
  if (_modules.length) openNewLayerModal();
});

document.getElementById('newLayerCancel').addEventListener('click', closeNewLayerModal);

document.getElementById('newLayerCreate').addEventListener('click', () => {
  const moduleId = document.getElementById('newLayerType').value;
  closeNewLayerModal();
  addLayer(moduleId);
});

// Close on backdrop click.
document.getElementById('newLayerModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeNewLayerModal();
});

// Keyboard handling inside the modal (capture phase runs before ui.js's Tab/Enter handlers).
document.addEventListener('keydown', e => {
  const modal = document.getElementById('newLayerModal');
  if (modal.hidden) return;
  if (e.key === 'Tab' || e.key === 'Enter') e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeNewLayerModal(); }
}, true);
