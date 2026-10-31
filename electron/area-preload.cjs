// Tiny bridge for the full-screen "select an area" overlay (electron/area-overlay.html).
const { contextBridge, ipcRenderer } = require('electron');

const sfArg = process.argv.find((a) => a.startsWith('--area-sf='));
const scaleFactor = sfArg ? parseFloat(sfArg.split('=')[1]) || 1 : 1;

contextBridge.exposeInMainWorld('areaOverlay', {
  scaleFactor,
  submit: (rect) => ipcRenderer.send('area:result', rect),
  cancel: () => ipcRenderer.send('area:result', null),
});
