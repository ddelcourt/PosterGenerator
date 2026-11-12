/**
 * Jazz Poster Generator - Main Application
 * Modular architecture with separated concerns
 */

// ============ GLOBAL STATE ============

const P = {
  w: 89.5, h: 128, minC: 0.4, maxC: 12, curve: 1, seed: 7, seq: 100, grad: false,
  lines: false, letters: true, ink: '#000000', lineColor: '#cdcdcd',
  font: 'Inter', weight: 600, fill: 82,
  bg: '#ffffff', amrMv: 2.5, amrMh: 5, amrColor: '#e02020',
  amrFit: false, amrSize: 50, amrLine: 42.5, amrFont: 'Inter', amrWeight: 600,
  fText: 'FESTIVAL', fColor: '#1f3bd8', fSize: 22, fGap: 6, fMt: 6, fMb: 6, fPlay: true, fSpeed: 10, fSeed: 3,
  fFont: 'Inter', fWeight: 600
};

const AMR = ['A', 'M', 'R'];
const GLYPHS = ['J', 'A', 'Z', 'Z'];
const CAP = 0.727;
const FONT_FAMILIES = [
  'Inter',
  'Special Gothic Expanded One',
  'Ultra',
  'BioRhyme Expanded',
  'Caprasimo',
  'Cormorant Garamond'
];
const FONT_WEIGHTS = {
  'Inter': [100, 200, 300, 400, 500, 600, 700, 800, 900],
  'Special Gothic Expanded One': [400],
  'Ultra': [400],
  'BioRhyme Expanded': [300, 400, 700, 800],
  'Caprasimo': [400],
  'Cormorant Garamond': [300, 400, 500, 600, 700]
};
const FONT_KEYS = new Set(['font', 'amrFont', 'fFont']);
const WEIGHT_KEYS = new Set(['weight', 'amrWeight', 'fWeight']);
const WEIGHT_KEY_BY_FONT_KEY = {
  font: 'weight',
  amrFont: 'amrWeight',
  fFont: 'fWeight'
};

// Maps each family+weight to its local TTF filename for SVG font embedding
const FONT_FILES = {
  'Inter': { 100: 'inter-100.ttf', 200: 'inter-200.ttf', 300: 'inter-300.ttf', 400: 'inter-400.ttf', 500: 'inter-500.ttf', 600: 'inter-600.ttf', 700: 'inter-700.ttf', 800: 'inter-800.ttf', 900: 'inter-900.ttf' },
  'Special Gothic Expanded One': { 400: 'special-gothic-expanded-one-400.ttf' },
  'Ultra': { 400: 'ultra-400.ttf' },
  'BioRhyme Expanded': { 300: 'biorhyme-expanded-300.ttf', 400: 'biorhyme-expanded-400.ttf', 700: 'biorhyme-expanded-700.ttf', 800: 'biorhyme-expanded-800.ttf' },
  'Caprasimo': { 400: 'caprasimo-400.ttf' },
  'Cormorant Garamond': { 300: 'cormorant-garamond-300.ttf', 400: 'cormorant-garamond-400.ttf', 500: 'cormorant-garamond-500.ttf', 600: 'cormorant-garamond-600.ttf', 700: 'cormorant-garamond-700.ttf' }
};

let cells = [], cellsVer = 0, selLayer = 0;

const ROWS = 5;
const fOff = [0, 0, 0, 0, 0];
let fDir = [1, 1, 1, 1, 1], fDirSeed = null, fLast = 0;

// ============ UTILITY FUNCTIONS ============

function rng(a) {
  return () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function loadFont(family) {
  if (!family) return;
  const weights = FONT_WEIGHTS[family] || [400, 600, 700];
  Promise.all(weights.map(w =>
    document.fonts.load(`${w} 20px "${family}"`)
  )).then(() => redraw());
}

function normalizeWeightForFont(family, weight) {
  const weights = FONT_WEIGHTS[family] || [400];
  const safeWeight = Number.isFinite(Number(weight)) ? Number(weight) : weights[0];
  return weights.reduce((closest, candidate) => (
    Math.abs(candidate - safeWeight) < Math.abs(closest - safeWeight) ? candidate : closest
  ), weights[0]);
}

function fontOptionsHtml(selectedFont) {
  return FONT_FAMILIES.map(font => (
    `<option value="${font}"${font === selectedFont ? ' selected' : ''}>${font}</option>`
  )).join('');
}

function weightOptionsHtml(family, selectedWeight) {
  const weights = FONT_WEIGHTS[family] || [400];
  const normalizedWeight = normalizeWeightForFont(family, selectedWeight);
  return weights.map(weight => (
    `<option value="${weight}"${weight === normalizedWeight ? ' selected' : ''}>${weight}</option>`
  )).join('');
}

const _emCache = {};
function emWidths(family, weight) {
  const fam = family || 'Inter', wt = weight || 600, g = drawingContext;
  return ch => {
    const k = `${wt}|${fam}|${ch}`;
    if (!_emCache[k]) {
      g.save();
      g.font = `${wt} 100px "${fam}", sans-serif`;
      _emCache[k] = Math.max(0.3, g.measureText(ch).width / 100);
      g.restore();
    }
    return _emCache[k];
  };
}

// ---- AMR layer helpers ----

function amrItems() {
  const em = emWidths(P.amrFont, P.amrWeight), third = P.h / 3;
  const boxH = Math.max(0.1, third - 2 * P.amrMv), boxW = Math.max(0.1, P.w - 2 * P.amrMh);
  const L = P.amrFit ? third : P.amrLine, top0 = (P.h - 3 * L) / 2;
  const items = [];
  AMR.forEach((ch, i) => {
    if (!ch) return;
    const s = P.amrFit ? Math.min(boxH / CAP, boxW / em(ch)) : P.amrSize;
    items.push({ ch, x: P.w / 2, y: top0 + i * L + (L + s * CAP) / 2, s });
  });
  return items;
}

// ---- Festival layer helpers ----

function festDirections() {
  if (fDirSeed !== P.fSeed) {
    fDirSeed = P.fSeed;
    const r = rng(P.fSeed);
    fDir = fOff.map(() => r() < 0.5 ? -1 : 1);
  }
  return fDir;
}

function festAdvance() {
  const now = performance.now(), dt = Math.min(now - fLast, 100) / 1000;
  fLast = now;
  const d = festDirections();
  for (let i = 0; i < ROWS; i++) fOff[i] += d[i] * P.fSpeed * dt;
}

function festItems() {
  const text = P.fText;
  if (!text) return { text, rows: [] };
  const w = emWidths(P.fFont, P.fWeight)(text) * P.fSize, period = Math.max(0.1, w + P.fGap);
  const pitch = Math.max(0, P.h - P.fMt - P.fMb) / ROWS, capH = P.fSize * CAP;
  const rows = [];
  for (let i = 0; i < ROWS; i++) {
    const o = ((fOff[i] % period) + period) % period, xs = [];
    for (let x = o - period; x < P.w; x += period) if (x + w > 0) xs.push(x);
    rows.push({ y: P.fMt + (i + 0.5) * pitch + capH / 2, xs });
  }
  return { text, rows };
}

// ---- Font embedding for SVG export ----

async function fetchFontBase64(family, weight) {
  const files = FONT_FILES[family];
  if (!files) return null;
  const file = files[weight];
  if (!file) return null;
  try {
    const resp = await fetch(`fonts/${file}`);
    if (!resp.ok) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

async function svgFontDefs() {
  const used = new Set();
  if (P.letters) used.add(`${P.font}|${P.weight}`);
  used.add(`${P.amrFont}|${P.amrWeight}`);
  used.add(`${P.fFont}|${P.fWeight}`);

  const rules = [];
  for (const key of used) {
    const [family, w] = key.split('|');
    const b64 = await fetchFontBase64(family, parseInt(w, 10));
    if (b64) {
      rules.push(`@font-face{font-family:'${family}';font-weight:${w};src:url('data:font/truetype;base64,${b64}') format('truetype');}`);
    }
  }
  return rules.length ? `<defs><style>${rules.join('')}</style></defs>\n` : '';
}

// ============ LAYER SYSTEM ============

const layers = [
  {
    id: 'division',
    name: 'Division',
    visible: true,
    draw: function() {
      if (!P.letters && !P.lines) return;
      drawDivision();
    },
    svg: function() {
      if (!P.letters && !P.lines) return '';
      return svgDivision();
    }
  },
  {
    id: 'amr',
    name: 'AMR',
    visible: true,
    draw: function() {
      drawAMR();
    },
    svg: function() {
      return svgAMR();
    }
  },
  {
    id: 'festival',
    name: 'Festival',
    visible: true,
    draw: function() {
      if (P.fPlay) drawFestival(frameCount / (P.fSpeed * 10));
      else drawFestival(0);
    },
    svg: function() {
      return svgFestival(0);
    }
  }
];

// ============ RENDERING ============

function drawDivision() {
  const g = drawingContext, k = width / P.w;
  if (P.lines) {
    g.strokeStyle = P.lineColor;
    g.lineWidth = Math.max(0.5, k * 0.008);
    for (const c of cells) g.strokeRect(c.x * k, c.y * k, c.w * k, c.h * k);
  }
  if (P.letters) {
    const em = emWidths(P.font, P.weight), fl = P.fill / 100;
    g.fillStyle = P.ink;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    for (const c of cells) {
      const s = Math.min(c.h * fl / CAP, c.w * fl / em(c.g)) * k;
      g.font = `${P.weight} ${s}px "${P.font}", sans-serif`;
      g.fillText(c.g, (c.x + c.w / 2) * k, (c.y + c.h / 2) * k + s * CAP / 2);
    }
  }
}

function drawAMR() {
  const g = drawingContext, k = width / P.w;
  g.fillStyle = P.amrColor;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  for (const it of amrItems()) {
    g.font = `${P.amrWeight} ${it.s * k}px "${P.amrFont}", sans-serif`;
    g.fillText(it.ch, it.x * k, it.y * k);
  }
}

function drawFestival(offset) {
  const d = festDirections();
  for (let i = 0; i < ROWS; i++) fOff[i] = d[i] * P.fSpeed * offset;
  const { text, rows } = festItems();
  const g = drawingContext, k = width / P.w;
  g.fillStyle = P.fColor;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = `${P.fWeight} ${P.fSize * k}px "${P.fFont}", sans-serif`;
  for (const r of rows) for (const x of r.xs) g.fillText(text, x * k, r.y * k);
}

function svgDivision() {
  const f = v => +v.toFixed(4), em = emWidths(P.font, P.weight), fl = P.fill / 100;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '<g id="layer-division">\n';
  if (P.lines) out += `<g id="division" fill="none" stroke="${P.lineColor}" stroke-width="0.02">` +
    cells.map(c => `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}"/>`).join('') + '</g>\n';
  if (P.letters) out += `<g id="letters" font-family="${P.font}" font-weight="${P.weight}" text-anchor="middle" fill="${P.ink}">` +
    cells.map(c => {
      const s = Math.min(c.h * fl / CAP, c.w * fl / em(c.g));
      return `<text x="${f(c.x + c.w / 2)}" y="${f(c.y + c.h / 2 + s * CAP / 2)}" font-size="${f(s)}">${esc(c.g)}</text>`;
    }).join('') + '</g>\n';
  return out + '</g>\n';
}

function svgAMR() {
  const f = v => +v.toFixed(4);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<g id="layer-amr" font-family="${P.amrFont}" font-weight="${P.amrWeight}" text-anchor="middle" fill="${P.amrColor}">` +
    amrItems().map(it => `<text x="${f(it.x)}" y="${f(it.y)}" font-size="${f(it.s)}">${esc(it.ch)}</text>`).join('') + '</g>\n';
}

function svgFestival(offset) {
  const prevOff = [...fOff];
  const d = festDirections();
  for (let i = 0; i < ROWS; i++) fOff[i] = d[i] * P.fSpeed * offset;
  const { text, rows } = festItems();
  for (let i = 0; i < ROWS; i++) fOff[i] = prevOff[i];

  const f = v => +v.toFixed(4);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<clipPath id="festival-clip"><rect width="${P.w}" height="${P.h}"/></clipPath>\n` +
    `<g id="layer-festival" clip-path="url(#festival-clip)" font-family="${P.fFont}" font-weight="${P.fWeight}" font-size="${f(P.fSize)}" fill="${P.fColor}">` +
    rows.map(r => r.xs.map(x => `<text x="${f(x)}" y="${f(r.y)}">${esc(text)}</text>`).join('')).join('') + '</g>\n';
}

function build() {
  const r = rng(P.seed), cx = P.w / 2, cy = P.h / 2, half = Math.hypot(cx, cy);
  const ratio = Math.max(P.maxC, P.minC * 1.01) / P.minC;
  const targetAt = (px, py) => P.minC * Math.pow(ratio, Math.pow(Math.min(1, Math.hypot(px - cx, py - cy) / half), P.curve));
  cells = []; cellsVer++;
  (function split(x, y, w, h, n) {
    const dx = Math.max(x - cx, 0, cx - x - w), dy = Math.max(y - cy, 0, cy - y - h);
    const d = Math.min(1, Math.hypot(dx, dy) / half);
    const target = P.minC * Math.pow(ratio, Math.pow(d, P.curve));
    if (Math.max(w, h) > target && Math.min(w, h) > 0.05 && n < 30 && cells.length < 40000) {
      let f = 0.5;
      if (P.grad) {
        const a = w >= h ? targetAt(x + w / 4, y + h / 2) : targetAt(x + w / 2, y + h / 4);
        const b = w >= h ? targetAt(x + 3 * w / 4, y + h / 2) : targetAt(x + w / 2, y + 3 * h / 4);
        f = Math.min(0.7, Math.max(0.3, a / (a + b)));
      }
      if (w >= h) { split(x, y, w * f, h, n + 1); split(x + w * f, y, w * (1 - f), h, n + 1); }
      else { split(x, y, w, h * f, n + 1); split(x, y + h * f, w, h * (1 - f), n + 1); }
    } else cells.push({ x, y, w, h, g: '' });
  })(0, 0, P.w, P.h, 0);
  const q = v => Math.round(v * 1e6);
  cells.sort((a, b) => q(a.y) - q(b.y) || q(a.x) - q(b.x));
  const pool = GLYPHS.filter(Boolean);
  if (!pool.length) pool.push(' ');
  cells.forEach((c, i) => {
    c.g = r() * 100 < P.seq ? pool[i % pool.length] : pool[Math.floor(r() * pool.length)];
  });
}

function redraw() {
  if (typeof window.redrawCanvas !== 'undefined') {
    window.redrawCanvas();
  }
}

// ============ UI RENDERING ============

function renderLayers() {
  const ul = document.getElementById('layerList');
  ul.textContent = '';
  let dragSrc = null;

  // Display layers in reverse order (topmost layer = top of list)
  const displayLayers = [...layers].reverse();
  
  displayLayers.forEach((L, displayIdx) => {
    const i = layers.length - 1 - displayIdx;
    const li = document.createElement('li');
    li.className = 'layer' + (i === selLayer ? ' sel' : '');
    li.draggable = true;
    li.dataset.idx = i;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.setAttribute('aria-hidden', 'true');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = L.visible;
    cb.setAttribute('aria-label', 'Show ' + L.name);
    cb.addEventListener('change', () => {
      L.visible = cb.checked;
      redraw();
    });

    const nm = document.createElement('button');
    nm.type = 'button';
    nm.className = 'layer-name';
    nm.textContent = (i + 1) + '  ' + L.name;
    nm.addEventListener('click', () => {
      selLayer = i;
      renderLayers();
      renderLayerProperties();
    });

    li.append(handle, cb, nm);
    ul.append(li);

    // Drag-drop functionality
    li.addEventListener('dragstart', e => {
      dragSrc = i;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', i);
      requestAnimationFrame(() => li.classList.add('dragging'));
    });
    
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      dragSrc = null;
    });
    
    li.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrc !== i) li.classList.add('drag-over');
    });
    
    li.addEventListener('dragleave', () => {
      li.classList.remove('drag-over');
    });
    
    li.addEventListener('drop', e => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const from = +e.dataTransfer.getData('text/plain');
      const to = i;
      if (from === to) return;
      
      const [moved] = layers.splice(from, 1);
      layers.splice(to, 0, moved);
      
      if (selLayer === from) selLayer = to;
      else if (from < to && selLayer > from && selLayer <= to) selLayer--;
      else if (from > to && selLayer >= to && selLayer < from) selLayer++;
      
      renderLayers();
      redraw();
    });
  });
}

function renderLayerProperties() {
  const container = document.getElementById('layerProps');
  container.textContent = '';
  
  if (selLayer < 0 || selLayer >= layers.length) return;
  
  const layer = layers[selLayer];
  
  // Render properties based on selected layer
  if (layer.id === 'division') {
    renderDivisionProperties(container);
  } else if (layer.id === 'amr') {
    renderAMRProperties(container);
  } else if (layer.id === 'festival') {
    renderFestivalProperties(container);
  }
}

function renderDivisionProperties(container) {
  const normalizedWeight = normalizeWeightForFont(P.font, P.weight);
  P.weight = normalizedWeight;
  const html = `
    <div class="category-group">
      <div class="category-title">Typography</div>
      <div class="row">
        <label>Font</label>
        <select data-k="font">
          ${fontOptionsHtml(P.font)}
        </select>
      </div>
      <div class="row">
        <label>Weight</label>
        <select data-k="weight">
          ${weightOptionsHtml(P.font, normalizedWeight)}
        </select>
      </div>
      <div class="row">
        <label>Fill %</label>
        <input type="range" data-k="fill" min="0" max="100" step="1" data-fmt="0">
        <output id="fillv">82</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Layout</div>
      <div class="row">
        <label>Min Cells</label>
        <input type="number" data-k="minC" step="0.1">
      </div>
      <div class="row">
        <label>Max Cells</label>
        <input type="number" data-k="maxC" step="0.1">
      </div>
      <div class="row">
        <label>Curve</label>
        <input type="range" data-k="curve" min="0.1" max="2" step="0.1" data-fmt="1">
        <output id="curvev">1</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Glyphs</div>
      <div class="glyphs" id="glyphInputs"></div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Visibility</div>
      <div class="chk">
        <input type="checkbox" data-k="lines" id="lines">
        <label for="lines">Lines</label>
      </div>
      <div class="chk">
        <input type="checkbox" data-k="letters" id="letters">
        <label for="letters">Letters</label>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Colors</div>
      <div class="row">
        <label>Ink</label>
        <input type="color" data-k="ink">
      </div>
      <div class="row">
        <label>Lines</label>
        <input type="color" data-k="lineColor">
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  setupPropertyInputs();
}

function renderAMRProperties(container) {
  const normalizedWeight = normalizeWeightForFont(P.amrFont, P.amrWeight);
  P.amrWeight = normalizedWeight;
  const html = `
    <div class="category-group">
      <div class="category-title">Typography</div>
      <div class="row">
        <label>Font</label>
        <select data-k="amrFont">
          ${fontOptionsHtml(P.amrFont)}
        </select>
      </div>
      <div class="row">
        <label>Weight</label>
        <select data-k="amrWeight">
          ${weightOptionsHtml(P.amrFont, normalizedWeight)}
        </select>
      </div>
      <div class="row">
        <label>Size</label>
        <input type="range" data-k="amrSize" min="10" max="200" step="1" data-fmt="0">
        <output id="amrSizev">50</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Layout</div>
      <div class="row">
        <label>Vertical</label>
        <input type="range" data-k="amrMv" min="0" max="10" step="0.1" data-fmt="1">
        <output id="amrMvv">2.5</output>
      </div>
      <div class="row">
        <label>Horizontal</label>
        <input type="range" data-k="amrMh" min="0" max="20" step="0.1" data-fmt="1">
        <output id="amrMhv">5</output>
      </div>
      <div class="row">
        <label>Line Height</label>
        <input type="range" data-k="amrLine" min="10" max="100" step="0.1" data-fmt="1">
        <output id="amrLinev">42.5</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Colors</div>
      <div class="row">
        <label>Color</label>
        <input type="color" data-k="amrColor">
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Options</div>
      <div class="chk">
        <input type="checkbox" data-k="amrFit" id="amrFit">
        <label for="amrFit">Fit Text</label>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  setupPropertyInputs();
}

function renderFestivalProperties(container) {
  const normalizedWeight = normalizeWeightForFont(P.fFont, P.fWeight);
  P.fWeight = normalizedWeight;
  const html = `
    <div class="category-group">
      <div class="category-title">Typography</div>
      <div class="row">
        <label>Font</label>
        <select data-k="fFont">
          ${fontOptionsHtml(P.fFont)}
        </select>
      </div>
      <div class="row">
        <label>Weight</label>
        <select data-k="fWeight">
          ${weightOptionsHtml(P.fFont, normalizedWeight)}
        </select>
      </div>
      <div class="row">
        <label>Size</label>
        <input type="range" data-k="fSize" min="8" max="60" step="1" data-fmt="0">
        <output id="fSizev">22</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Text</div>
      <div class="row wide">
        <label>Text</label>
        <input type="text" data-k="fText">
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Layout</div>
      <div class="row">
        <label>Gap</label>
        <input type="range" data-k="fGap" min="0" max="30" step="1" data-fmt="0">
        <output id="fGapv">6</output>
      </div>
      <div class="row">
        <label>Top Margin</label>
        <input type="range" data-k="fMt" min="0" max="50" step="1" data-fmt="0">
        <output id="fMtv">6</output>
      </div>
      <div class="row">
        <label>Bottom Margin</label>
        <input type="range" data-k="fMb" min="0" max="50" step="1" data-fmt="0">
        <output id="fMbv">6</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Animation</div>
      <div class="chk">
        <input type="checkbox" data-k="fPlay" id="fPlay">
        <label for="fPlay">Play</label>
      </div>
      <div class="row">
        <label>Speed</label>
        <input type="range" data-k="fSpeed" min="1" max="50" step="1" data-fmt="0">
        <output id="fSpeedv">10</output>
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Colors</div>
      <div class="row">
        <label>Color</label>
        <input type="color" data-k="fColor">
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  setupPropertyInputs();
}

function renderPosterProperties() {
  const container = document.getElementById('posterProps');
  const html = `
    <div class="category-group">
      <div class="category-title">Dimensions</div>
      <div class="row">
        <label>Width (cm)</label>
        <input type="number" data-k="w" step="0.1">
      </div>
      <div class="row">
        <label>Height (cm)</label>
        <input type="number" data-k="h" step="0.1">
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Seed</div>
      <div class="row">
        <label>Seed</label>
        <input type="number" data-k="seed">
      </div>
      <div class="row">
        <label>Sequence</label>
        <input type="number" data-k="seq" min="0">
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Background</div>
      <div class="row">
        <label>Color</label>
        <input type="color" data-k="bg">
      </div>
    </div>
    
    <div class="category-group">
      <div class="category-title">Effects</div>
      <div class="chk">
        <input type="checkbox" data-k="grad" id="grad">
        <label for="grad">Gradient</label>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  setupPropertyInputs();
}

function setupPropertyInputs() {
  const REDRAW_ONLY = new Set([
    'lines', 'letters', 'ink', 'lineColor', 'bg', 'amrColor', 'amrMv', 'amrMh',
    'amrSize', 'amrLine', 'fText', 'fColor', 'fSize', 'fGap', 'fMt', 'fMb',
    'fPlay', 'fSpeed', 'fSeed', 'font', 'weight', 'fill', 'amrFont', 'amrWeight',
    'fFont', 'fWeight'
  ]);
  
  const ZERO_OK = new Set([
    'seed', 'seq', 'amrMv', 'amrMh', 'fGap', 'fMt', 'fMb', 'fSpeed', 'fSeed'
  ]);

  document.querySelectorAll('[data-k]').forEach(el => {
    if (el.tagName === 'LABEL' || el.tagName === 'SPAN') return;
    
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      let value;
      
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'color') {
        value = el.value;
      } else if (el.tagName === 'SELECT') {
        if (FONT_KEYS.has(k)) {
          value = el.value;
          const weightKey = WEIGHT_KEY_BY_FONT_KEY[k];
          const weightSelect = document.querySelector(`[data-k="${weightKey}"]`);
          const normalizedWeight = normalizeWeightForFont(value, P[weightKey]);
          P[weightKey] = normalizedWeight;
          if (weightSelect) {
            weightSelect.innerHTML = weightOptionsHtml(value, normalizedWeight);
            weightSelect.value = String(normalizedWeight);
          }
          loadFont(value);
        } else if (WEIGHT_KEYS.has(k)) {
          value = parseInt(el.value, 10);
          if (!isFinite(value)) return;
        } else {
          value = el.value;
        }
      } else {
        value = parseFloat(el.value);
        if (!isFinite(value) || (value <= 0 && !ZERO_OK.has(k))) return;
      }
      
      P[k] = value;
      
      // Update output value display
      if (el.type === 'range') {
        const output = document.getElementById(k + 'v');
        if (output) {
          const dp = el.dataset.fmt != null ? +el.dataset.fmt : 2;
          output.textContent = value.toFixed(dp);
        }
      }
      
      // Handle redraw/rebuild
      if (REDRAW_ONLY.has(k)) {
        Storage.save(P);
        return redraw();
      }
      
      build();
      if (k === 'w' || k === 'h') fit();
      else redraw();
      Storage.save(P);
    });
  });
}

// ============ INITIALIZATION ============

function setup() {
  Theme.init();
  
  // Initialize state: URL params > localStorage > defaults
  const savedState = Storage.initialize(P);
  Object.assign(P, savedState);
  
  createCanvas(10, 10).parent('stage');
  noLoop();
  
  renderLayers();
  renderPosterProperties();
  renderLayerProperties();
  
  document.fonts.load('600 20px Inter').then(() => {
    build();
    fit();
  });

  // Theme toggle
  const btn = document.getElementById('themeToggle');
  btn.addEventListener('click', () => Theme.toggle());

  // Export buttons
  document.getElementById('exportPng').addEventListener('click', () => {
    drawingContext.canvas.toBlob(b => {
      if (b) Export.exportPNG(drawingContext.canvas, P.w, P.h);
    }, 'image/png');
  });

  document.getElementById('exportSvg').addEventListener('click', async () => {
    Export.exportSVG(await buildSVG(), P.w, P.h);
  });

  document.getElementById('exportJson').addEventListener('click', () => {
    Export.exportJSON(P, P.w, P.h);
  });

  document.getElementById('importJson').addEventListener('click', () => {
    document.getElementById('jsonFile').click();
  });

  document.getElementById('jsonFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    Export.importJSON(file, (data) => {
      Object.assign(P, data);
      Storage.save(P);
      renderLayerProperties();
      build();
      redraw();
    });
  });

  // Share button - copy URL with current state
  const shareBtn = document.getElementById('shareUrl');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = Storage.getShareURL(P);
      navigator.clipboard.writeText(url).then(() => {
        shareBtn.textContent = '✓ URL Copied!';
        setTimeout(() => {
          shareBtn.textContent = '📎 Share';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy URL to clipboard');
      });
    });
  }

  // UI initialization
  UI.init();
}

function windowResized() {
  fit();
}

function draw() {
  background(P.bg);
  layers.forEach(L => {
    if (L.visible) L.draw();
  });
}

async function buildSVG() {
  const fontDefs = await svgFontDefs();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.w}cm" height="${P.h}cm" viewBox="0 0 ${P.w} ${P.h}">\n` +
    fontDefs +
    `<rect width="${P.w}" height="${P.h}" fill="${P.bg}"/>\n` +
    layers.filter(L => L.visible).map(L => L.svg()).join('') +
    '</svg>';
}

function fit() {
  const w = P.w * devicePixelRatio;
  const h = P.h * devicePixelRatio;
  resizeCanvas(w, h);
  scale(devicePixelRatio);
}
