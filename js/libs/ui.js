/**
 * UI Management
 * Handles palette visibility, dragging, keyboard shortcuts
 */

const UI = (() => {
  let uiVisible = true;

  const init = () => {
    setupKeyboardShortcuts();
    setupPalettePosition();
  };

  const setupKeyboardShortcuts = () => {
    document.addEventListener('keydown', (e) => {
      // Enter key: fullscreen
      if (e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreen();
      }
      // Tab key: toggle UI
      if (e.key === 'Tab') {
        e.preventDefault();
        toggleUI();
      }
    });
  };

  const toggleFullscreen = () => {
    const body = document.querySelector('body');
    body.classList.toggle('fullscreen');
  };

  const toggleUI = () => {
    const palettes = document.getElementById('palettes');
    const theme = document.getElementById('themeToggle');
    
    uiVisible = !uiVisible;
    palettes.classList.toggle('hidden');
    if (theme) theme.style.display = uiVisible ? 'block' : 'none';
  };

  const setupPalettePosition = () => {
    const palettes = document.getElementById('palettes');
    if (!palettes) return;

    const palettes_list = Array.from(palettes.querySelectorAll('.pal:not(.right-panel)'));
    const rightPanel = palettes.querySelector('.pal.right-panel');

    // Make left palettes draggable
    palettes_list.forEach(pal => {
      const bar = pal.querySelector('.pal-bar');
      if (!bar) return;

      let dragSrc = null;
      bar.addEventListener('pointerdown', (e) => {
        if (isMobile() || e.target.closest('button')) return;
        
        const r = pal.getBoundingClientRect();
        const ox = e.clientX - r.left;
        const oy = e.clientY - r.top;
        
        bar.setPointerCapture(e.pointerId);
        
        const move = (ev) => {
          pal.style.left = Math.min(innerWidth - 60, Math.max(60 - r.width, ev.clientX - ox)) + 'px';
          pal.style.top = Math.min(innerHeight - 40, Math.max(0, ev.clientY - oy)) + 'px';
        };
        
        const up = () => {
          bar.removeEventListener('pointermove', move);
          bar.removeEventListener('pointerup', up);
          bar.removeEventListener('pointercancel', up);
        };
        
        bar.addEventListener('pointermove', move);
        bar.addEventListener('pointerup', up);
        bar.addEventListener('pointercancel', up);
      });
    });

    // Setup toggle buttons
    palettes_list.forEach(pal => {
      const toggle = pal.querySelector('.pal-toggle');
      if (!toggle) return;
      
      toggle.addEventListener('click', (e) => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', open);
        const body = pal.querySelector('.pal-b');
        if (body) body.hidden = !open;
      });
    });
  };

  const showRightPanel = () => {
    const rightPanel = document.querySelector('.pal.right-panel');
    if (rightPanel) {
      rightPanel.classList.add('visible');
    }
  };

  const hideRightPanel = () => {
    const rightPanel = document.querySelector('.pal.right-panel');
    if (rightPanel) {
      rightPanel.classList.remove('visible');
    }
  };

  const toggleRightPanel = () => {
    const rightPanel = document.querySelector('.pal.right-panel');
    if (rightPanel) {
      rightPanel.classList.toggle('visible');
    }
  };

  function isMobile() {
    return window.innerWidth < 600;
  }

  return {
    init,
    toggleFullscreen,
    toggleUI,
    showRightPanel,
    hideRightPanel,
    toggleRightPanel
  };
})();
