// ============ STATE ============
const P = {w:89.5, h:128, minC:0.4, maxC:20, curve:0.5, seed:7, seq:100, grad:false,
           lines:false, letters:true, ink:'#000000', lineColor:'#cdcdcd',
           font:'Inter', weight:600, fill:82, fillExp:0,
           bg:'#ffffff', amrMv:2.5, amrMh:5, amrColor:'#e02020',
           amrFit:false, amrSize:50, amrLine:42.5, amrFont:'Inter', amrWeight:600,
           fText:'FESTIVAL', fColor:'#1f3bd8', fSize:22, fGap:6, fMt:6, fMb:6, fPlay:true, fSpeed:10, fSeed:3,
           fFont:'Inter', fWeight:600,
           glyphs:['J','A','Z','Z'], amrChars:['A','M','R']};

const AMR   = ['A','M','R'];
const GLYPHS = ['J','A','Z','Z'];
const CAP   = 0.727;   // Inter cap height / em

const FONT_WEIGHTS = {
  'Inter':                       [100, 200, 300, 400, 500, 600, 700, 800, 900],
  'Special Gothic Expanded One': [400],
  'Ultra':                       [400],
  'BioRhyme Expanded':           [300, 400, 700, 800],
  'Caprasimo':                   [400],
  'Cormorant Garamond':          [300, 400, 500, 600, 700]
};
// Maps family + weight → local TTF filename (used for font outline export)
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
// font-key → its paired weight-key, and vice-versa
const FONT_TO_WEIGHT = { font:'weight', amrFont:'amrWeight', fFont:'fWeight' };
const WEIGHT_TO_FONT = { weight:'font', amrWeight:'amrFont', fWeight:'fFont' };

function nearestWeight(family, w) {
  const avail = FONT_WEIGHTS[family] || [400];
  return avail.reduce((best, v) => Math.abs(v - w) < Math.abs(best - w) ? v : best, avail[0]);
}

function populateWeightSelect(weightKey) {
  const family = P[WEIGHT_TO_FONT[weightKey]];
  if (!family) return;
  const avail = FONT_WEIGHTS[family] || [400];
  const snapped = nearestWeight(family, P[weightKey]);
  P[weightKey] = snapped;
  const sel = document.querySelector(`[data-k="${weightKey}"]`);
  if (!sel || sel.tagName !== 'SELECT') return;
  sel.innerHTML = avail.map(w =>
    `<option value="${w}"${w === snapped ? ' selected' : ''}>${w} — ${WEIGHT_NAMES[w] || w}</option>`
  ).join('');
}

function initWeightSelects() {
  ['weight', 'amrWeight', 'fWeight'].forEach(populateWeightSelect);
}

let cells = [], cellsVer = 0, selLayer = 0;

function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function loadFont(family){
  if (!family) return;
  const weights = FONT_WEIGHTS[family] || [400];
  Promise.all(weights.map(w => document.fonts.load(`${w} 20px "${family}"`))).then(redraw);
}

// Glyph width cache keyed by "weight|family|char" so switching fonts never pollutes measurements.
const _emCache = {};
function emWidths(family, weight){
  const fam = family || 'Inter', wt = weight || 600, g = drawingContext;
  return ch => {
    const k = `${wt}|${fam}|${ch}`;
    if (!_emCache[k]){
      g.save(); g.font = `${wt} 100px "${fam}", sans-serif`;
      _emCache[k] = Math.max(0.3, g.measureText(ch).width / 100);
      g.restore();
    }
    return _emCache[k];
  };
}

// ============ LAYERS ============
// A layer is { id, name, visible, draw(g,k), svg() }, plus palettes tagged data-layer="<id>".
// draw(g,k) paints at k px/cm; svg() returns SVG markup in cm units.

const layers = [{
  id: 'division', name: 'Jazz', visible: true, cached: true,
  key: () => [cellsVer, P.lines, P.letters, P.ink, P.lineColor, P.font, P.weight, P.fill, P.fillExp].join(),
  draw(g, k){
    if (P.lines){
      g.strokeStyle = P.lineColor; g.lineWidth = Math.max(0.5, k*0.008);
      for (const c of cells) g.strokeRect(c.x*k, c.y*k, c.w*k, c.h*k);
    }
    if (P.letters){
      const em = emWidths(P.font, P.weight), fl = P.fill / 100;
      g.fillStyle = P.ink; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (const c of cells){
        const eff = fl * Math.pow(Math.min(1, Math.min(c.w, c.h) / P.maxC), P.fillExp);
        const s = Math.min(c.h*eff/CAP, c.w*eff/em(c.g)) * k;
        g.font = `${P.weight} ${s}px "${P.font}", sans-serif`;
        g.fillText(c.g, (c.x+c.w/2)*k, (c.y+c.h/2)*k + s*CAP/2);
      }
    }
  },
  svg(){
    const f = v => +v.toFixed(4), em = emWidths(P.font, P.weight), fl = P.fill / 100;
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let out = '<g id="layer-division">\n';
    if (P.lines) out += `<g id="division" fill="none" stroke="${P.lineColor}" stroke-width="0.02">` +
      cells.map(c => `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}"/>`).join('') + '</g>\n';
    if (P.letters) out += `<g id="letters" font-family="${P.font}" font-weight="${P.weight}" text-anchor="middle" fill="${P.ink}">` +
      cells.map(c => {
        const eff = fl * Math.pow(Math.min(1, Math.min(c.w, c.h) / P.maxC), P.fillExp);
        const s = Math.min(c.h*eff/CAP, c.w*eff/em(c.g));
        return `<text x="${f(c.x+c.w/2)}" y="${f(c.y+c.h/2+s*CAP/2)}" font-size="${f(s)}">${esc(c.g)}</text>`;
      }).join('') + '</g>\n';
    return out + '</g>\n';
  }
}];

/* Layer 2: three stacked lines, one letter each, top to bottom. */
function amrItems(){
  const em = emWidths(P.amrFont, P.amrWeight), third = P.h/3;
  const boxH = Math.max(0.1, third - 2*P.amrMv), boxW = Math.max(0.1, P.w - 2*P.amrMh);
  const L = P.amrFit ? third : P.amrLine, top0 = (P.h - 3*L)/2;
  const items = [];
  AMR.forEach((ch, i) => {
    if (!ch) return;
    const s = P.amrFit ? Math.min(boxH/CAP, boxW/em(ch)) : P.amrSize;
    items.push({ch, x: P.w/2, y: top0 + i*L + (L + s*CAP)/2, s});   // y is the baseline
  });
  return items;
}
layers.push({
  id: 'amr', name: 'AMR', visible: true, cached: true,
  key: () => [P.w, P.h, P.amrMv, P.amrMh, P.amrColor, P.amrFit, P.amrSize, P.amrLine, AMR.join(''), P.amrFont, P.amrWeight].join(),
  draw(g, k){
    g.fillStyle = P.amrColor; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const it of amrItems()){ g.font = `${P.amrWeight} ${it.s*k}px "${P.amrFont}", sans-serif`; g.fillText(it.ch, it.x*k, it.y*k); }
  },
  svg(){
    const f = v => +v.toFixed(4);
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<g id="layer-amr" font-family="${P.amrFont}" font-weight="${P.amrWeight}" text-anchor="middle" fill="${P.amrColor}">` +
      amrItems().map(it => `<text x="${f(it.x)}" y="${f(it.y)}" font-size="${f(it.s)}">${esc(it.ch)}</text>`).join('') + '</g>\n';
  }
});

/* Layer 3: a word repeated across 5 rows, each row gliding sideways in a random direction. */
const ROWS = 5, fOff = [0,0,0,0,0];   // current horizontal offset per row, in cm
let fDir = [1,1,1,1,1], fDirSeed = null, fLast = 0;
function festDirections(){
  if (fDirSeed !== P.fSeed){ fDirSeed = P.fSeed; const r = rng(P.fSeed); fDir = fOff.map(() => r() < 0.5 ? -1 : 1); }
  return fDir;
}
function festAdvance(){
  const now = performance.now(), dt = Math.min(now - fLast, 100) / 1000; fLast = now;
  const d = festDirections();
  for (let i = 0; i < ROWS; i++) fOff[i] += d[i] * P.fSpeed * dt;
}
function festItems(){
  const text = P.fText;
  if (!text) return {text, rows: []};
  const w = emWidths(P.fFont, P.fWeight)(text) * P.fSize, period = Math.max(0.1, w + P.fGap);
  const pitch = Math.max(0, P.h - P.fMt - P.fMb) / ROWS, capH = P.fSize * CAP;
  const rows = [];
  for (let i = 0; i < ROWS; i++){
    const o = ((fOff[i] % period) + period) % period, xs = [];
    for (let x = o - period; x < P.w; x += period) if (x + w > 0) xs.push(x);
    rows.push({y: P.fMt + (i + 0.5) * pitch + capH/2, xs});   // y is the baseline, cap height centered in the row
  }
  return {text, rows};
}
layers.push({
  id: 'festival', name: 'Festival', visible: true,
  draw(g, k){
    const {text, rows} = festItems();
    g.fillStyle = P.fColor; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = `${P.fWeight} ${P.fSize*k}px "${P.fFont}", sans-serif`;
    for (const r of rows) for (const x of r.xs) g.fillText(text, x*k, r.y*k);
  },
  svg(){
    const {text, rows} = festItems(), f = v => +v.toFixed(4);
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<clipPath id="festival-clip"><rect width="${P.w}" height="${P.h}"/></clipPath>\n` +
      `<g id="layer-festival" clip-path="url(#festival-clip)" font-family="${P.fFont}" font-weight="${P.fWeight}" font-size="${f(P.fSize)}" fill="${P.fColor}">` +
      rows.map(r => r.xs.map(x => `<text x="${f(x)}" y="${f(r.y)}">${esc(text)}</text>`).join('')).join('') + '</g>\n';
  }
});

// Only the animated layer needs a live loop, and only while it is visible and playing.
function updateLoop(){
  const L = layers.find(l => l.id === 'festival');
  (L && L.visible && P.fPlay) ? loop() : noLoop();
}

// Layers that do not change every frame are painted once into their own canvas and copied.
function renderCached(L, k){
  const cv = drawingContext.canvas, pd = pixelDensity();
  const key = [width, height, pd, L.key()].join('|');
  if (L._key !== key){
    if (!L._cv) L._cv = document.createElement('canvas');
    L._cv.width = cv.width; L._cv.height = cv.height;
    const g = L._cv.getContext('2d'); g.scale(pd, pd);
    L.draw(g, k); L._key = key;
  }
  drawingContext.drawImage(L._cv, 0, 0, width, height);
}

function renderLayers(){
  const ul = document.getElementById('layerList'); ul.textContent = '';
  let dragSrc = null;
  const displayLayers = [...layers].reverse();   // topmost layer first in the list
  displayLayers.forEach((L, displayIdx) => {
    const i = layers.length - 1 - displayIdx;
    const li = document.createElement('li');
    li.className = 'layer' + (i === selLayer ? ' sel' : '');
    li.draggable = true;
    li.dataset.idx = i;

    const handle = document.createElement('span');
    handle.className = 'drag-handle'; handle.textContent = '⠿'; handle.setAttribute('aria-hidden','true');

    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = L.visible; cb.setAttribute('aria-label', 'Show ' + L.name);
    cb.addEventListener('change', () => { L.visible = cb.checked; updateLoop(); redraw(); });

    const nm = document.createElement('button'); nm.type = 'button'; nm.className = 'layer-name'; nm.textContent = (i+1) + '  ' + L.name;
    nm.addEventListener('click', () => { selLayer = i; renderLayers(); });

    li.append(handle, cb, nm); ul.append(li);

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
      renderLayers(); redraw();
    });
  });
  document.querySelectorAll('.pal[data-layer]').forEach(p => {
    p.hidden = p.dataset.layer !== layers[selLayer].id;
    p.querySelector('.pal-title').textContent = `${layers[selLayer].name}: ${p.dataset.title}`;
  });
  if (!isMobile()) autoLayout(true);
}

// ============ CELL DIVISION ============
function build(){
  const r = rng(P.seed);
  const halfMin = Math.min(P.w, P.h) / 2;
  const ratio = Math.max(P.maxC, P.minC*1.01) / P.minC;
  const targetAt = (px, py) => {
    const minToBorder = Math.min(px, py, P.w - px, P.h - py);
    const d = Math.min(1, Math.max(0, 1 - minToBorder / halfMin));
    return P.minC * Math.pow(ratio, Math.pow(d, P.curve));
  };
  cells = []; cellsVer++;
  (function split(x, y, w, h, n){
    const minToBorder = Math.max(0, Math.min(x, y, P.w - (x+w), P.h - (y+h)));
    const d = Math.min(1, Math.max(0, 1 - minToBorder / halfMin));
    const target = P.minC * Math.pow(ratio, Math.pow(d, P.curve));
    if (Math.max(w,h) > target && Math.min(w,h) > 0.05 && n < 30 && cells.length < 40000){
      let f = 0.5;
      if (P.grad){
        const a = w >= h ? targetAt(x+w/4, y+h/2) : targetAt(x+w/2, y+h/4);
        const b = w >= h ? targetAt(x+3*w/4, y+h/2) : targetAt(x+w/2, y+3*h/4);
        f = Math.min(0.7, Math.max(0.3, a/(a+b)));
      }
      if (w >= h){ split(x, y, w*f, h, n+1); split(x+w*f, y, w*(1-f), h, n+1); }
      else       { split(x, y, w, h*f, n+1); split(x, y+h*f, w, h*(1-f), n+1); }
    } else cells.push({x, y, w, h, g: ''});
  })(0, 0, P.w, P.h, 0);
  const q = v => Math.round(v*1e6);
  cells.sort((a, b) => q(a.y)-q(b.y) || q(a.x)-q(b.x));
  const pool = GLYPHS.filter(Boolean); if (!pool.length) pool.push(' ');
  cells.forEach((c, i) => {
    c.g = r()*100 < P.seq ? pool[i % pool.length] : pool[Math.floor(r()*pool.length)];
  });
}

// ============ CANVAS (p5.js) ============
function setup(){
  loadState();
  createCanvas(10,10).parent('stage'); noLoop(); renderLayers();
  const families = [...new Set([P.font, P.amrFont, P.fFont])];
  const loads = families.flatMap(fam =>
    (FONT_WEIGHTS[fam] || [400]).map(w => document.fonts.load(`${w} 20px "${fam}"`))
  );
  Promise.all(loads).then(() => { build(); fit(); updateLoop(); });
}
function windowResized(){
  fit();
  if (isMobile()) return;
  palettes.some(p => !p.style.left) ? autoLayout() : clampAll();
}
function fit(){
  const s = document.getElementById('stage'), pad = 32;
  const k = Math.min((s.clientWidth-pad)/P.w, (s.clientHeight-pad)/P.h);
  resizeCanvas(Math.max(10,Math.floor(P.w*k)), Math.max(10,Math.floor(P.h*k)));
  redraw();
}
function draw(){
  background(P.bg);
  const k = width / P.w, fest = layers.find(l => l.id === 'festival');
  if (isLooping() && P.fPlay && fest && fest.visible) festAdvance();
  for (const L of layers) if (L.visible) L.cached ? renderCached(L, k) : L.draw(drawingContext, k);
}

// ============ FLOATING PALETTES ============
const palettes = [...document.querySelectorAll('.pal')];
const isMobile = () => matchMedia('(max-width:760px)').matches;
let zTop = 10;

function autoLayout(onlyUnplaced){
  if (isMobile()){ palettes.forEach(p => { p.style.left = p.style.top = ''; }); return; }
  const W = 252, gap = 10, m = 12, maxY = innerHeight - m;
  const colX = {L: m, R: Math.max(m, innerWidth - m - W)}, colY = {L: m, R: m};
  if (onlyUnplaced) palettes.forEach(p => {
    if (p.hidden || !p.style.left) return;
    const c = parseFloat(p.style.left) < innerWidth/2 ? 'L' : 'R';
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
function clampAll(){   // keep every title bar reachable after a window shrink
  palettes.forEach(p => {
    const w = p.offsetWidth;
    p.style.left = Math.min(innerWidth - 60, Math.max(60 - w, parseFloat(p.style.left) || 0)) + 'px';
    p.style.top = Math.min(innerHeight - 40, Math.max(0, parseFloat(p.style.top) || 0)) + 'px';
  });
}

// ============ PARAMETERS ============
const ZERO_OK    = new Set(['seed','seq','amrMv','amrMh','fGap','fMt','fMb','fSpeed','fSeed']);
const REDRAW_ONLY = new Set(['lines','letters','ink','lineColor','bg','amrColor','amrMv','amrMh','amrSize','amrLine','fText','fColor','fSize','fGap','fMt','fMb','fPlay','fSpeed','fSeed',
                             'font','weight','fill','fillExp','amrFont','amrWeight','fFont','fWeight']);
document.querySelectorAll('[data-k]').forEach(el => {
  el.addEventListener('input', () => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') P[k] = el.checked;
    else if (el.type === 'color') P[k] = el.value;
    else if (el.tagName === 'SELECT') {
      if (k in FONT_TO_WEIGHT) {
        P[k] = el.value; loadFont(P[k]); populateWeightSelect(FONT_TO_WEIGHT[k]);
      } else if (k in WEIGHT_TO_FONT) {
        P[k] = parseInt(el.value, 10);
      } else {
        P[k] = el.value;
      }
    }
    else { const v = parseFloat(el.value); if (!isFinite(v) || v <= 0 && !ZERO_OK.has(k)) return; P[k] = v; }
    if (el.type === 'range'){ const o = document.getElementById(k + 'v'); if (o){ const dp = el.dataset.fmt != null ? +el.dataset.fmt : 2; o.textContent = (+el.value).toFixed(dp); } }
    if (k === 'fPlay') updateLoop();
    if (REDRAW_ONLY.has(k)) { saveState(); return redraw(); }
    build(); (k==='w'||k==='h') ? fit() : redraw();
    saveState();
  });
});

// ============ ANIMATION ============
// Each parameter drifts on its own sine cycle so the combination keeps changing.
const ANIM = {
  minC:  {lo:0.3, hi:3,   period:4.1},
  maxC:  {lo:6,   hi:40,  period:5.3},
  curve: {lo:0.1, hi:2,   period:6.7}
};
let animOn = false, animT = 0, animLast = 0, animSpeed = 1;
const animPhase = {};
function setParam(k, v){
  P[k] = v;
  document.querySelector(`[data-k="${k}"]`).value = v;
  document.getElementById(k + 'v').textContent = v.toFixed(2);
}
function startAnim(){
  for (const k in ANIM){
    const a = ANIM[k], x = 2*(P[k]-a.lo)/(a.hi-a.lo) - 1;
    animPhase[k] = Math.asin(Math.min(1, Math.max(-1, x)));
  }
  animT = 0; animLast = performance.now(); animOn = true;
  requestAnimationFrame(animFrame);
}
function animFrame(now){
  if (!animOn) return;
  const dt = (now - animLast) / 1000;
  if (dt >= 0.06){
    animLast = now; animT += Math.min(dt, 0.25) * animSpeed;
    for (const k in ANIM){
      const a = ANIM[k], s = Math.sin(animPhase[k] + 2*Math.PI*animT/a.period);
      setParam(k, Math.round((a.lo + (a.hi-a.lo)*(0.5 + 0.5*s))*100)/100);
    }
    build(); redraw();
  }
  requestAnimationFrame(animFrame);
}
function stopAnim(){ animOn = false; document.getElementById('anim').checked = false; saveState(); }
document.getElementById('anim').addEventListener('change', e => e.target.checked ? startAnim() : (animOn = false));
document.getElementById('speed').addEventListener('input', e => {
  animSpeed = parseFloat(e.target.value); document.getElementById('speedv').textContent = animSpeed;
});
['minC','maxC','curve'].forEach(k => {
  document.querySelector(`[data-k="${k}"]`).addEventListener('input', stopAnim);
});

document.querySelectorAll('#modeSeg button').forEach(b => b.addEventListener('click', () => {
  P.grad = b.dataset.mode === '1';
  document.querySelectorAll('#modeSeg button').forEach(o => o.setAttribute('aria-pressed', o === b));
  build(); redraw(); saveState();
}));
document.querySelectorAll('#fitSeg button').forEach(b => b.addEventListener('click', () => {
  P.amrFit = b.dataset.mode === 'fit';
  document.querySelectorAll('#fitSeg button').forEach(o => o.setAttribute('aria-pressed', o === b));
  document.querySelectorAll('#typeSliders input').forEach(i => i.disabled = P.amrFit);
  redraw(); saveState();
}));

function bindGlyphs(id, list, rebuild, getFontStr){
  document.querySelectorAll(`#${id} input`).forEach((el, i) => {
    el.addEventListener('input', () => {
      const ch = Array.from(el.value.trim())[0] || '';
      el.value = ch; list[i] = ch; if (rebuild) build(); redraw();
      document.fonts.load(getFontStr(), ch || ' ').then(redraw);
      saveState();
    });
  });
}
bindGlyphs('glyphsJazz', GLYPHS, true,  () => `${P.weight} 20px "${P.font}"`);
bindGlyphs('glyphsAmr',  AMR,   false, () => `${P.amrWeight} 20px "${P.amrFont}"`);
document.getElementById('fText').addEventListener('input', e => { P.fText = e.target.value; redraw(); saveState(); });
document.getElementById('fNewDir').addEventListener('click', () => {
  P.fSeed = Math.floor(Math.random()*100000); document.getElementById('fSeed').value = P.fSeed; redraw(); saveState();
});
document.getElementById('shuffle').addEventListener('click', () => {
  P.seed = Math.floor(Math.random()*100000); document.getElementById('seed').value = P.seed; build(); redraw(); saveState();
});
