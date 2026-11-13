# Fonts

## Included Fonts

All fonts are stored as local TTF files in `/fonts/` and loaded by `css/fonts.css`. No internet connection is required to render the poster.

| Family | Weights |
|--------|---------|
| Inter | 100, 200, 300, 400, 500, 600, 700, 800, 900 |
| Special Gothic Expanded One | 400 |
| Ultra | 400 |
| BioRhyme Expanded | 300, 400, 700, 800 |
| Caprasimo | 400 |
| Cormorant Garamond | 300, 400, 500, 600, 700 |

File naming follows the pattern `family-weight.ttf` in lowercase with hyphens (e.g. `inter-600.ttf`, `biorhyme-expanded-700.ttf`).

---

## How Fonts Are Loaded

`css/fonts.css` declares each weight as a separate `@font-face` rule:

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('../fonts/inter-600.ttf') format('truetype');
}
```

Before the first render, the app calls `document.fonts.load(...)` for each weight of the selected font to avoid a flash of unstyled text.

---

## Adding or Replacing a Font

1. Add the TTF file to `/fonts/` using the `family-weight.ttf` naming pattern.
2. Add the matching `@font-face` rule to `css/fonts.css`.
3. In `js/app.js`, update:
   - `FONT_WEIGHTS` object — add the family and its available weight numbers.
   - `FONT_FILES` object — add the family and its `weight → filename` mapping (used by the SVG outline exporter to fetch the TTF at export time).

---

## Fonts in SVG Exports

### Live-text SVG

The **Save SVG** export writes font metadata directly into the SVG as XML presentation attributes:

```xml
<g font-family="Inter" font-weight="600" fill="#000000">
  <text x="44.75" y="64.0" font-size="50">A</text>
</g>
```

The font name is written without CSS quotes (`Inter`, not `'Inter'`). Illustrator reads SVG attributes as plain XML, not CSS — quoting the name causes it to look for a font literally named `'Inter'` and fall back to Helvetica when it can't find one.

**Requirement:** The font must be installed on the machine opening the SVG. If it is not, Illustrator shows a "missing font" substitution dialog — intentional behaviour that tells you exactly which font to install.

### Outlined SVG

The **Save SVG (Outlined)** export converts all text to `<path>` shapes. No font is required on the target machine. See [EXPORT.md](EXPORT.md) for a full technical description.
