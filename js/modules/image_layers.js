// ============ IMAGE / SVG LAYER MODULES ============
// A single factory registers two modules:
//   • svg_layer   – loads a local SVG file and renders it as a layer
//   • image_layer – loads a local PNG / JPG / WebP file as a layer
//
// The file is stored as a base64 data URL inside each layer's params so the
// JSON export is fully self-contained — no re-linking needed after reload.
// A separate 'Name' key stores just the filename for the UI button label.
//
// Storage note: large raster images inflate JSON/localStorage proportionally
// (~33 % base64 overhead). Typical poster graphics (SVGs, logos) stay small.

(function () {

  function makeImageModule(id, name, accept, prefix) {
    // p(suffix) → namespaced key, e.g. p('Src') → 'svgSrc' or 'imgSrc'
    const p = s => prefix + s;

    // dataUrl → HTMLImageElement (session cache — avoids recreating Image on every frame)
    const _cache = new Map();

    function _loadImg(src) {
      let img = _cache.get(src);
      if (img) return img;
      img = new Image();
      img.onload = () => redraw();
      img.src = src;
      _cache.set(src, img);
      return img;
    }

    // Compute destination rect (cm) applying the chosen fit mode.
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
      // 'stretch': fill the box exactly, aspect ratio ignored
      return { bx, by, bw, bh, dx, dy, dw, dh };
    }

    function _draw(g, k) {
      const src = P[p('Src')];
      if (!src) return;
      const img = _loadImg(src);
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
      const src = P[p('Src')];
      if (!src) return '';
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
        [p('Src')]:     '',   // base64 data URL — the actual image content
        [p('Name')]:    '',   // original filename — display only, not used for drawing
        [p('X')]:       0,
        [p('Y')]:       0,
        [p('W')]:       0,
        [p('H')]:       0,
        [p('Opacity')]: 1,
        [p('Fit')]:     'contain'
      },

      params: [
        { type: 'section', label: name },
        { type: 'file',  key: p('Src'), nameKey: p('Name'), label: 'File', accept },
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
        svg:  _svg
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


