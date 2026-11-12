# Export Guide

## Formats at a Glance

| Button | Format | Font dependency | Editable text |
|--------|--------|-----------------|---------------|
| Save PNG | Raster (PNG) | None | No |
| Save SVG | Vector (SVG) | Font must be installed | Yes |
| Save SVG (Outlined) | Vector (SVG) | None | No — paths only |
| Export JSON | Settings (JSON) | — | — |

---

## Save PNG

A raster screenshot of the canvas rendered at the current screen resolution. Suitable for quick previews and web use. For print, use an SVG format instead.

---

## Save SVG — Live Text

A vector file at the poster's physical dimensions. The SVG root carries `width` and `height` in centimetres so Illustrator opens it at the correct size:

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     width="89.5cm" height="128cm"
     viewBox="0 0 89.5 128">
```

All text is preserved as `<text>` elements grouped by layer, each carrying the font family, weight, and colour:

```xml
<g id="layer-amr" font-family="Inter" font-weight="600" fill="#e02020">
  <text x="44.75" y="43.17" font-size="50">A</text>
  <text x="44.75" y="85.67" font-size="50">M</text>
  <text x="44.75" y="128.17" font-size="50">R</text>
</g>
```

The Festival layer wraps its text in a `<clipPath>` so text does not bleed outside the poster area.

**When to use:** When you need editable text in Illustrator — to retype content, adjust kerning, or reformat the design.

**Requirement:** The font must be installed on the machine opening the SVG. See [FONTS.md](FONTS.md) for details on what happens when it isn't.

---

## Save SVG (Outlined) — Vectorised Typography

Text is converted to filled `<path>` shapes before export. The resulting SVG has zero font dependencies and renders identically on every machine and in every application.

```xml
<g id="layer-amr" fill="#e02020">
  <path d="M 23.41 10.21 C 23.41 10.21 25.08 14.37 ..."/>
  <path d="M 11.22 42.70 L 13.05 42.70 ..."/>
  <path d="M 18.90 85.14 C 20.41 85.14 ..."/>
</g>
```

### How It Works

1. **opentype.js is loaded on first use.** The library (~167 KB minified) is bundled at `js/libs/opentype.min.js` and injected into the page as a `<script>` tag on the first outline export. Subsequent exports reuse the cached instance with no additional load.

2. **Font files are fetched and parsed once per session.** Only the families and weights actually used in the current poster are loaded from `/fonts/`. Parsed `Font` objects are cached so they are not re-parsed on repeated exports.

3. **Each text element is converted to a path.** The core call is:
   ```js
   font.getPath(text, x, y, fontSize)
   ```
   Coordinates are in centimetres, matching the SVG viewBox — no unit conversion is needed.

4. **Text alignment is handled explicitly.** The Division and AMR layers use centre alignment (`text-anchor="middle"` in the live SVG). For the outlined version, the advance width is measured and the x origin is shifted:
   ```js
   const startX = x - font.getAdvanceWidth(text, size) / 2;
   font.getPath(text, startX, y, size)
   ```

5. **Clipping is preserved.** The Festival layer's `<clipPath>` is included in the outlined output so text still clips to the poster bounds.

6. **Fallback.** If a font file cannot be fetched (e.g. running from `file://` without a server), that layer falls back to live text automatically rather than failing.

### Requirements

- The app must be served over HTTP (`python3 -m http.server 8000`), not opened as a local file, so that the font TTF files can be fetched for path generation.
- No internet connection is needed — opentype.js is bundled locally at `js/libs/opentype.min.js`.

### When to Use

- Final print delivery.
- Sharing with someone who does not have the fonts installed.
- Placing the poster in a document, presentation, or layout where font availability cannot be guaranteed.

---

## Export JSON / Load JSON

Saves all current parameter values as a JSON file:

```json
{
  "w": 89.5,
  "h": 128,
  "seed": 7,
  "font": "Inter",
  "weight": 600,
  "amrColor": "#e02020",
  "fText": "FESTIVAL",
  ...
}
```

Importing a JSON file restores all parameters and triggers a full redraw. Use this for:

- Versioning designs (save snapshots at different stages).
- Sharing a configuration without opening the app.
- Restoring a state after clearing browser storage.
