// ============ PRESETS ============
// Presets are discovered from presets/index.json at startup.
// To add a new preset:
//   1. Export your design (File → Export JSON) and save it in the presets/ folder.
//   2. Add one entry to presets/index.json: { "name": "...", "file": "filename.json" }

const _presetIndex = [];
const _presetCache = {};

async function _initPresets() {
  const sel = document.getElementById('presetSelect');
  try {
    const res = await fetch('presets/index.json');
    if (!res.ok) throw new Error(res.status);
    const list = await res.json();
    list.forEach((entry, i) => {
      _presetIndex.push(entry);
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = entry.name;
      sel.appendChild(opt);
    });
  } catch(e) {
    console.error('Could not load presets/index.json:', e);
  }
}

async function _fetchPreset(index) {
  if (_presetCache[index]) return _presetCache[index];
  const entry = _presetIndex[index];
  if (!entry) return null;
  const res = await fetch(`presets/${entry.file}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const state = await res.json();
  _presetCache[index] = state;
  return state;
}

async function loadPreset(index) {
  const msg = document.getElementById('msg');
  const entry = _presetIndex[index];
  if (!entry) return;
  try {
    const state = await _fetchPreset(index);
    importJSON(JSON.stringify(state));
    renderLayers();
    msg.textContent = `Loaded: ${entry.name}`;
    setTimeout(() => { if (msg.textContent.startsWith('Loaded:')) msg.textContent = ''; }, 3000);
  } catch(e) {
    msg.textContent = `Could not load preset "${entry.name}".`;
    console.error(e);
  }
}

document.getElementById('loadPresetBtn').addEventListener('click', () => {
  const idx = document.getElementById('presetSelect').value;
  if (idx === '') return;
  loadPreset(+idx);
});

_initPresets();
