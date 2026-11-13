// ============ EXPORT ============
// File saving (PNG, SVG, JSON) and SVG outline generation.
// Relies on globals from app.js (P, cells, layers, emWidths, amrItems, festItems, CAP, FONT_FILES)
// and storage.js (exportJSON, importJSON).

function saveFile(filename, blob){
  const msg = document.getElementById('msg');
  try {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {href: url, download: filename});
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    msg.textContent = 'Saved ' + filename;
  } catch(e) { msg.textContent = 'Could not save ' + filename + '.'; }
}

function buildSVG(){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.w}cm" height="${P.h}cm" viewBox="0 0 ${P.w} ${P.h}">\n` +
    `<rect width="${P.w}" height="${P.h}" fill="${P.bg}"/>\n` +
    layers.map(L => L.visible ? L.svg() : '').join('') + '</svg>';
}

document.getElementById('save').addEventListener('click', () =>
  drawingContext.canvas.toBlob(b => b && saveFile(`jazz-poster-${P.w}x${P.h}cm.png`, b), 'image/png'));
document.getElementById('saveSvg').addEventListener('click', () =>
  saveFile(`jazz-poster-${P.w}x${P.h}cm.svg`, new Blob([buildSVG()], {type:'image/svg+xml'})));
document.getElementById('exportJson').addEventListener('click', () =>
  saveFile(`jazz-poster.json`, new Blob([exportJSON()], {type:'application/json'})));
document.getElementById('importJson').addEventListener('click', () =>
  document.getElementById('jsonFile').click());
document.getElementById('jsonFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { importJSON(ev.target.result); renderLayers(); };
  reader.readAsText(file);
});

// ---- SVG outline export ----
// opentype.js is lazy-loaded the first time it is needed.
let _ot = null;
function loadOpentype() {
  if (_ot) return Promise.resolve(_ot);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/libs/opentype.min.js';
    s.onload  = () => { _ot = window.opentype; resolve(_ot); };
    s.onerror = () => reject(new Error('Could not load opentype.js'));
    document.head.appendChild(s);
  });
}

const _fontCache = {};
async function loadOpentypeFont(family, weight) {
  const file = (FONT_FILES[family] || {})[weight];
  if (!file) return null;
  const key = `${family}|${weight}`;
  if (_fontCache[key]) return _fontCache[key];
  const ot   = await loadOpentype();
  const font = await ot.load(`fonts/${file}`);
  _fontCache[key] = font;
  return font;
}

function textPathData(font, text, x, y, size, center = false) {
  const startX = center ? x - font.getAdvanceWidth(text, size) / 2 : x;
  return font.getPath(text, startX, y, size).toPathData(4);
}

async function buildSVGOutlined() {
  const f = v => +v.toFixed(4);
  let body = '';

  for (const L of layers) {
    if (!L.visible) continue;

    if (L.id === 'division') {
      let out = '<g id="layer-division">\n';
      if (P.lines) {
        out += `<g id="division" fill="none" stroke="${P.lineColor}" stroke-width="0.02">` +
          cells.map(c => `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}"/>`).join('') + '</g>\n';
      }
      if (P.letters) {
        const font = await loadOpentypeFont(P.font, P.weight);
        if (!font) {
          out += L.svg().match(/<g id="letters"[\s\S]*?<\/g>/)?.[0] ?? '';
        } else {
          const em = emWidths(P.font, P.weight), fl = P.fill / 100;
          out += `<g id="letters" fill="${P.ink}">`;
          for (const c of cells) {
            if (!c.g) continue;
            const eff = fl * Math.pow(Math.min(1, Math.min(c.w, c.h) / P.maxC), P.fillExp ?? 0);
            const s   = Math.min(c.h * eff / CAP, c.w * eff / em(c.g));
            if (s <= 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2 + s * CAP / 2;
            out += `<path d="${textPathData(font, c.g, cx, cy, s, true)}"/>`;
          }
          out += '</g>\n';
        }
      }
      body += out + '</g>\n';

    } else if (L.id === 'amr') {
      const font = await loadOpentypeFont(P.amrFont, P.amrWeight);
      if (!font) { body += L.svg(); continue; }
      let out = `<g id="layer-amr" fill="${P.amrColor}">`;
      for (const it of amrItems())
        out += `<path d="${textPathData(font, it.ch, it.x, it.y, it.s, true)}"/>`;
      body += out + '</g>\n';

    } else if (L.id === 'festival') {
      const font = await loadOpentypeFont(P.fFont, P.fWeight);
      if (!font) { body += L.svg(); continue; }
      const { text, rows } = festItems();
      const fv = v => +v.toFixed(4);
      let out = `<clipPath id="festival-clip"><rect x="${fv(P.fMl)}" y="0" width="${fv(P.w - P.fMl - P.fMr)}" height="${fv(P.h)}"/></clipPath>\n`;
      out += `<g id="layer-festival" clip-path="url(#festival-clip)" fill="${P.fColor}">`;
      for (const r of rows)
        for (const x of r.xs)
          out += `<path d="${textPathData(font, text, x, r.y, P.fSize)}"/>`;
      body += out + '</g>\n';
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${P.w}cm" height="${P.h}cm" viewBox="0 0 ${P.w} ${P.h}">\n` +
    `<rect width="${P.w}" height="${P.h}" fill="${P.bg}"/>\n` +
    body + '</svg>';
}

document.getElementById('saveOutlined').addEventListener('click', async () => {
  const msg = document.getElementById('msg');
  const btn = document.getElementById('saveOutlined');
  btn.disabled = true;
  msg.textContent = 'Generating outlines…';
  try {
    const svg = await buildSVGOutlined();
    saveFile(`jazz-poster-${P.w}x${P.h}cm-outlined.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  } catch (e) {
    msg.textContent = 'Outline export failed: ' + e.message;
  } finally {
    btn.disabled = false;
  }
});
