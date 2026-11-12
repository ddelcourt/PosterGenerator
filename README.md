# Festival Poster Generator

A browser-based generative poster tool for the AMR Jazz Festival 2027. Produces typographic compositions from three composited layers, with export to PNG, live-text SVG, and fully outlined SVG (text as vector paths — no font dependency on the target machine).

---

## Running

A local HTTP server is required — browsers block font loading from `file://`:

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000**.

---

## Layers

| Layer | Description |
|-------|-------------|
| **Division** | Recursive cell grid filled with repeating glyphs (J A Z Z by default). Cell density increases toward the centre. |
| **AMR** | Three large stacked letters (A M R), sized to fill poster thirds or set manually. |
| **Festival** | A repeating text banner (FESTIVAL by default), optionally animated with per-row scroll directions. |

Layers can be reordered by drag-and-drop. Each has independent font, weight, colour, and layout controls.

---

## Export

| Button | Format | Font dependency |
|--------|--------|-----------------|
| Save PNG | Raster image | None |
| Save SVG | Vector, live text | Font must be installed on target machine |
| Save SVG (Outlined) | Vector, text as paths | None — fully portable |
| Export JSON | Settings snapshot | — |

**SVG (Outlined)** uses [opentype.js](https://opentype.js.org/) to parse the bundled TTF files and render every glyph as a `<path>`. Coordinates stay in centimetres to match the SVG viewBox. The library is bundled locally at `js/libs/opentype.min.js` and loaded on demand. See [`docs/EXPORT.md`](docs/EXPORT.md) for the full pipeline.

---

## Fonts

Six families bundled as local TTF files in `/fonts/`, loaded by `css/fonts.css`. No internet connection needed to render the poster.

| Family | Weights |
|--------|---------|
| Inter | 100 – 900 |
| Special Gothic Expanded One | 400 |
| Ultra | 400 |
| BioRhyme Expanded | 300, 400, 700, 800 |
| Caprasimo | 400 |
| Cormorant Garamond | 300, 400, 500, 600, 700 |

See [`docs/FONTS.md`](docs/FONTS.md) for details on adding fonts and how font names are handled in SVG exports.

---

## Sharing

Every parameter change is auto-saved to `localStorage`. Click **📎 Share** to copy a URL with the full current state to the clipboard. See [`docs/QUICKSTART.md`](docs/QUICKSTART.md) for the complete URL parameter reference.

---

## Project Structure

```
index.html          Single-file application — all logic inline
css/
  fonts.css         @font-face declarations for the bundled TTFs
  style.css         UI styling and theme variables (light / dark)
fonts/              Bundled TTF files
docs/
  QUICKSTART.md     Running the app + URL parameter reference
  FONTS.md          Font inventory and SVG font handling
  EXPORT.md         Export formats and SVG outline pipeline
archive/            Original monolithic version and early SVG samples
```

---

## Tech

- Canvas rendering: [p5.js](https://p5js.org/) 1.9.4
- Font outline export: [opentype.js](https://opentype.js.org/) 1.3.4 (bundled at `js/libs/opentype.min.js`, loaded on demand)
- No build step · No npm · No frameworks · No CDN required
