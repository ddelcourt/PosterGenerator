// ============ IMAGE / SVG LAYER MODULES ============
// A single factory registers two modules:
//   • svg_layer   – loads a local SVG file
//   • image_layer – loads a local PNG / JPG / WebP file
//
// Only the filename is stored in params/JSON — no image data is serialised.
// Actual file content lives in a per-module session Map (blob URL for drawing,
// data URL for SVG export) and must be re-linked after a page reload.

(function () {

  function makeImageModule(id, name, accept, prefix) {
    // p(suffix) builds the namespaced param key, e.g. p('Path') → 'svgPath' or 'imgPath'
    const p = s => prefix + s;

    // Session-only — never written to params or JSON.
    // filename → { blobUrl: string, dataUrl: string|null }
    const _sessions = new Map();

    // url → HTMLImageElement
    const _imgCache = new Map();

    // Called by _rFile when the user picks a file.
    function _registerFile(file) {
      const prev = _sessions.get(file.name);
      if (prev) URL.revokeObjectURL(prev.blobUrl);
      const entry = { blobUrl: URL.createObjectURL(file), dataUrl: null };
      _sessions.set(file.name, entry);
      // Read data URL for SVG export (async but fast for local files).
      const reader = new FileReader();
      reader.onload = ev => { entry.dataUrl = ev.target.result; };
      reader.readAsDataURL(file);
    }

    function _isLinked(path) { return !!path && _sessions.has(path); }

    function _loadImg(url) {
      let img = _imgCache.get(url);
      if (img) return img;
      img = new Image();
      img.onload = () => redraw();
      img.src = url;
      _imgCache.set(url, img);
      return img;
    }

    // Compute the destination rect (in cm) for the given Image element.
    function _dest(img) {
      const bw = P[p('W')] > 0 ? P[p('W')] : P.w;
      const bh = P[p('H')] > 0 ? P[p('H')] : P.h;
      const bx = P[p('X')], by = P[p('Y')];
      const fit = P[p('Fit')];
      const ar = img.naturalWidth / img.naturalHeight;
      let dw = bw, dh = bh, dx = bx, dy = by;
      if (fit === 'contain') {
        if (bw / bh > ar) { dh = bh; dw = dh * ar; }
        else              { dw = bw; dh = dw / ar; }
        dx = bx + (bw - dw) / 2; dy = by + (bh - dh) / 2;
      } else if (fit === 'cover') {
        if (bw / bh > ar) { dw = bw; dh = dw / ar; }
        else              { dh = bh; dw = dh * ar; }
        dx = bx + (bw - dw) / 2; dy = by + (bh - dh) / 2;
      }
      // 'stretch': dw/dh stay at bw/bh, no offset adjustment
      return { bx, by, bw, bh, dx, dy, dw, dh };
    }

    function _draw(g, k) {
      const path = P[p('Path')];
      if (!path) return;
      const entry = _sessions.get(path);
      if (!entry) return;   // not linked in this session — render nothing
      const img = _loadImg(entry.blobUrl);
      if (!img || !img.complete || !img.naturalWidth) return;

      const { bx, by, bw, bh, dx, dy, dw, dh } = _dest(img);
      const opacity = P[p('Opacity')] ?? 1;

      g.save();
      if (opacity !== 1) g.globalAlpha = opacity;
      if (P[p('Fit')] === 'cover') {
        g.beginPath(); g.rect(bx * k, by * k, bw * k, bh * k); g.clip();
      }
      g.drawImage(img, dx * k, dy * k, dw * k, dh * k);
      g.restore();
    }

    function _svg() {
      const path = P[p('Path')];
      if (!path) return '';
      const entry = _sessions.get(path);
      if (!entry) return '';
      // Prefer data URL (portable, embedded) — falls back to blob URL (session-only).
      const src = entry.dataUrl ?? entry.blobUrl;
      const f = v => +v.toFixed(4);
      const bw = P[p('W')] > 0 ? P[p('W')] : P.w;
      const bh = P[p('H')] > 0 ? P[p('H')] : P.h;
      const bx = P[p('X')], by = P[p('Y')];
      const opacity = P[p('Opacity')] ?? 1;
      const fit = P[p('Fit')];
      const par = fit === 'cover'   ? 'xMidYMid slice'
                : fit === 'stretch' ? 'none'
                :                     'xMidYMid meet';

      if (fit === 'cover') {
        const cid = `${id}-clip-${f(bx)}-${f(by)}-${f(bw)}-${f(bh)}`;
        return (
          `<clipPath id="${cid}"><rect x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}"/></clipPath>\n` +
          `<image x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" opacity="${f(opacity)}" preserveAspectRatio="${par}" clip-path="url(#${cid})" href="${src}"/>\n`
        );
      }
      return `<image x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" opacity="${f(opacity)}" preserveAspectRatio="${par}" href="${src}"/>\n`;
    }

    window.AMRApp.registerModule({
      id,
      patch: id,
      name,

      defaults: {
        [p('Path')]:    '',
        [p('Label')]:   '',
        [p('X')]:       0,
        [p('Y')]:       0,
        [p('W')]:       0,
        [p('H')]:       0,
        [p('Opacity')]: 1,
        [p('Fit')]:     'contain'
      },

      params: [
        { type: 'section', label: name },
        { type: 'file',  key: p('Path'),    label: 'File',                accept, onLoad: _registerFile, isLinked: _isLinked },
        { type: 'text',  key: p('Label'),   label: 'Label',               placeholder: 'Layer label' },
        { type: 'sep' },
        { type: 'section', label: 'Position & Size' },
        { type: 'range', key: p('X'),       label: 'X',                   min: -100, max: 300, step: 0.5,  unit: 'cm', fmt: 2 },
        { type: 'range', key: p('Y'),       label: 'Y',                   min: -100, max: 300, step: 0.5,  unit: 'cm', fmt: 2 },
        { type: 'range', key: p('W'),       label: 'Width  (0 = poster)', min: 0,    max: 300, step: 0.5,  unit: 'cm', fmt: 2 },
        { type: 'range', key: p('H'),       label: 'Height (0 = poster)', min: 0,    max: 300, step: 0.5,  unit: 'cm', fmt: 2 },
        { type: 'sep' },
        { type: 'section', label: 'Appearance' },
        { type: 'range', key: p('Opacity'), label: 'Opacity',             min: 0,    max: 1,   step: 0.01, fmt: 2 },
        { type: 'seg',   key: p('Fit'),     label: 'Fit', options: [
          { value: 'contain', label: 'Contain' },
          { value: 'cover',   label: 'Cover' },
          { value: 'stretch', label: 'Stretch' }
        ]}
      ],

      layers: [{
        id,
        name,
        visible: true,
        draw: _draw,
        svg: _svg
      }]
    });
  }

  makeImageModule(
    'svg_layer', 'SVG Layer',
    '.svg,image/svg+xml',
    'svg'
  );

  makeImageModule(
    'image_layer', 'Image Layer',
    'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    'img'
  );

}());

