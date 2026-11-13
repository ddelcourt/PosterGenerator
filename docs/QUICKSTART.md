# Quick Start

## Running the App

A local HTTP server is required — browsers block font loading from `file://`.

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000** in your browser.

---

## Interface

The poster preview fills the centre of the screen. Floating palettes hold all controls and can be dragged by their title bars.

### Layers

The **Layers** palette lists all active layers, painted bottom to top. Each layer is an independent instance with its own parameter set.

| Control | Action |
|---------|--------|
| ⠿ drag handle | Reorder layers |
| ☑ checkbox | Toggle layer visibility |
| Layer name | Select layer (shows its properties) |
| ⓘ icon (hover) | Shows the patch filename |
| × button | Delete the layer |
| **＋ New Layer** | Add a new layer (defaults to first module; change type in Layer Properties) |

### Layer Properties

The **Layer Properties** palette updates to show the selected layer's parameters. Use the **Type** dropdown at the top to reassign the layer to a different module type.

### Export (File palette)

| Button | Output |
|--------|--------|
| Save PNG | Raster image at screen resolution |
| Save SVG | Vector file with live text |
| Save SVG (Outlined) | Vector file with text converted to paths |
| Export JSON | Settings snapshot |
| Load JSON | Restore from snapshot |

See [EXPORT.md](EXPORT.md) for full details on each format.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Toggle fullscreen |
| **Tab** | Show / hide all palettes |

---

## Saving Your Work

Changes are saved automatically to browser localStorage. Closing and reopening the browser restores the last state, including all layers and their individual parameter sets.

For a portable backup, use **Export JSON**.


## Running the App

A local HTTP server is required — browsers block font loading from `file://`.

```bash
python3 -m http.server 8000
```

Open **http://localhost:8000** in your browser.

---

## Interface

The poster preview fills the centre of the screen. Floating palettes hold all controls and can be dragged by their title bars.

### Layers

Three layers compose the poster, painted bottom to top:

| Layer | Description |
|-------|-------------|
| **Division** | Recursive cell grid filled with repeating glyphs (J A Z Z by default) |
| **AMR** | Three large stacked letters (A M R) |
| **Festival** | A repeating text banner, optionally animated |

Drag layer rows to reorder. Click a layer name to select it and show its properties. Use the checkbox to toggle visibility.

### Export

| Button | Output |
|--------|--------|
| Save PNG | Raster image at screen resolution |
| Save SVG | Vector file with live text |
| Save SVG (Outlined) | Vector file with text converted to paths |
| Export JSON | Settings snapshot |
| Load JSON | Restore from snapshot |

See [EXPORT.md](EXPORT.md) for full details on each format.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Toggle fullscreen |
| **Tab** | Show / hide all palettes |

---

## Saving Your Work

Changes are saved automatically to browser localStorage. Closing and reopening the browser restores the last state.

For a portable backup, use **Export JSON**.

---

## Sharing a Design

Click **📎 Share** in the Export panel to copy a URL with all current settings to the clipboard. Anyone opening that URL sees the same poster.

URLs can also be constructed manually:

```
http://localhost:8000/?seed=42&bg=%23ffffff&amrColor=%23e02020&fText=JAZZ
```

Colors must be URL-encoded: `#` → `%23`. Example: `bg=%23000000` for black.

### All URL Parameters

#### Canvas

| Parameter | Default | Description |
|-----------|---------|-------------|
| `w` | 89.5 | Width (cm) |
| `h` | 128 | Height (cm) |
| `seed` | 7 | Random seed for Division layout |
| `seq` | 100 | % of cells following glyph sequence |
| `grad` | false | Gradient cell splitting |
| `bg` | #ffffff | Background colour |

#### Division Layer

| Parameter | Default | Description |
|-----------|---------|-------------|
| `lines` | false | Show grid lines |
| `letters` | true | Show letters |
| `ink` | #000000 | Letter colour |
| `lineColor` | #cdcdcd | Grid line colour |
| `font` | Inter | Font family |
| `weight` | 600 | Font weight |
| `fill` | 82 | Fill percentage |

#### AMR Layer

| Parameter | Default | Description |
|-----------|---------|-------------|
| `amrMv` | 2.5 | Vertical margin (cm) |
| `amrMh` | 5 | Horizontal margin (cm) |
| `amrColor` | #e02020 | Text colour |
| `amrFit` | false | Fit letters to thirds |
| `amrSize` | 50 | Font size (cm) |
| `amrLine` | 42.5 | Line height (cm) |
| `amrFont` | Inter | Font family |
| `amrWeight` | 600 | Font weight |

#### Festival Layer

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fText` | FESTIVAL | Repeated text |
| `fColor` | #1f3bd8 | Text colour |
| `fSize` | 22 | Font size (cm) |
| `fGap` | 6 | Gap between repeats (cm) |
| `fMt` | 6 | Top margin (cm) |
| `fMb` | 6 | Bottom margin (cm) |
| `fPlay` | true | Animation on |
| `fSpeed` | 10 | Scroll speed (cm/s) |
| `fSeed` | 3 | Direction seed |
| `fFont` | Inter | Font family |
| `fWeight` | 600 | Font weight |

