/**
 * Export/Import Management
 * Handles PNG, SVG, and JSON export/import
 */

const Export = (() => {
  const saveFile = (filename, blob) => {
    try {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: filename
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      
      const msg = document.getElementById('msg');
      if (msg) msg.textContent = 'Saved ' + filename;
    } catch (e) {
      const msg = document.getElementById('msg');
      if (msg) msg.textContent = 'Could not save ' + filename;
    }
  };

  const exportPNG = (canvas, width, height) => {
    canvas.toBlob(b => {
      if (b) saveFile(`jazz-poster-${width}x${height}cm.png`, b);
    }, 'image/png');
  };

  const exportSVG = (svgString, width, height) => {
    saveFile(
      `jazz-poster-${width}x${height}cm.svg`,
      new Blob([svgString], { type: 'image/svg+xml' })
    );
  };

  const exportJSON = (state, width, height) => {
    const json = JSON.stringify(state, null, 2);
    saveFile(
      `jazz-poster.json`,
      new Blob([json], { type: 'application/json' })
    );
  };

  const importJSON = (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = Storage.importJSON(e.target.result);
        callback(data);
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return {
    saveFile,
    exportPNG,
    exportSVG,
    exportJSON,
    importJSON
  };
})();
