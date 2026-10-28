// Minimal, explicit bridge between the app UI and the tray in the main process.
// (contextIsolation stays on: the page only gets these two functions, never ipcRenderer/Node.)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wongTray', {
  /** Tell the tray what the recorder is doing so it can update its icon, tooltip and menu. */
  sendState: (status, elapsedSeconds) => {
    ipcRenderer.send('tray:state', { status, elapsedSeconds });
  },
  /** Listen for tray menu actions. Returns an unsubscribe function. */
  onCommand: (callback) => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on('tray:command', handler);
    return () => ipcRenderer.removeListener('tray:command', handler);
  },
});

contextBridge.exposeInMainWorld('wongWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (pinned) => ipcRenderer.send('window:pin', pinned),
  setContentProtection: (enabled) => ipcRenderer.send('window:setContentProtection', enabled),
  onMaximizedChange: (callback) => {
    const handler = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window:isMaximized', handler);
    return () => ipcRenderer.removeListener('window:isMaximized', handler);
  },
});

contextBridge.exposeInMainWorld('wongCapture', {
  getSources: () => ipcRenderer.invoke('desktop:getSources'),
  setPreferredSource: (sourceId, displayId) => ipcRenderer.invoke('desktop:setPreferredSource', sourceId, displayId),
  onAutoZoomTrigger: (callback) => {
    const handler = (_event, coords) => callback(coords);
    ipcRenderer.on('autozoom:trigger', handler);
    return () => ipcRenderer.removeListener('autozoom:trigger', handler);
  },
});
