// ============ UI ============
// Palette dragging, collapse/expand, reset layout, and keyboard shortcuts.
// Relies on globals from app.js (palettes, zTop, isMobile, autoLayout).

palettes.forEach(p => {
  const bar = p.querySelector('.pal-bar');
  p.addEventListener('pointerdown', () => { p.style.zIndex = ++zTop; });   // bring to front
  bar.addEventListener('pointerdown', e => {
    if (isMobile() || e.target.closest('button')) return;
    const r = p.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    const move = ev => {
      p.style.left = Math.min(innerWidth - 60, Math.max(60 - r.width, ev.clientX - ox)) + 'px';
      p.style.top  = Math.min(innerHeight - 40, Math.max(0, ev.clientY - oy)) + 'px';
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup',   up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup',   up);
    bar.addEventListener('pointercancel', up);
  });
  p.querySelector('.pal-toggle').addEventListener('click', e => {
    const t = e.currentTarget, open = t.getAttribute('aria-expanded') !== 'true';
    t.setAttribute('aria-expanded', open); p.querySelector('.pal-b').hidden = !open;
  });
});

document.getElementById('resetLayout').addEventListener('click', () => {
  palettes.forEach(p => { p.style.left = p.style.top = ''; });
  autoLayout();
});

// ---- Keyboard shortcuts ----
let uiVisible = true;
document.addEventListener('keydown', e => {
  // Enter: toggle browser fullscreen (skip when focused in a text/number field)
  if (e.key === 'Enter') {
    const a = document.activeElement;
    const inText = a && (
      a.tagName === 'TEXTAREA' ||
      (a.tagName === 'INPUT' && ['text','number','email','search','password','url','tel'].includes(a.type)) ||
      a.isContentEditable
    );
    if (!inText) {
      e.preventDefault();
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    }
  }
  // Tab: toggle UI panels (palettes + top buttons)
  if (e.key === 'Tab') {
    e.preventDefault();
    uiVisible = !uiVisible;
    document.getElementById('palettes').classList.toggle('hidden', !uiVisible);
    document.getElementById('topRight').style.display = uiVisible ? '' : 'none';
  }
});
