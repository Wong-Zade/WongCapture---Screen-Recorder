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
