const { app, BrowserWindow, session, desktopCapturer, screen, Tray, Menu, nativeImage, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let quitWhenIdle = false;
let quitTimer = null;
let trayTooltip = '';
let recState = { status: 'idle', elapsedSeconds: 0 };
let shownHiddenHint = false;
let preferredSource = null;       // { id, isScreen, displayId } chosen in the in-app picker (null = primary screen)
let knownSourceIds = new Set();   // ids from the last picker list: only real sources can be selected
let zoomShortcutsActive = false;

const VALID_STATUSES = new Set(['idle', 'countdown', 'recording', 'paused', 'processing']);
const isActive = () => ['countdown', 'recording', 'paused', 'processing'].includes(recState.status);

// Performance optimizations for Windows screen recording:
// 1. Prevent Windows OS native window occlusion from pausing/throttling background render loop
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// 2. Enable GPU rasterization and zero-copy memory buffers for 60fps canvas compositing
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 360,
    title: 'WongCapture - Screen Recorder',
    backgroundColor: '#0a0a0a',
    show: false, // shown on 'ready-to-show' so the window never flashes an empty frame
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // The recorder draws frames with requestAnimationFrame. Without this, Chromium
      // throttles/pauses it when the window is minimized or covered, which freezes the recording.
      backgroundThrottling: false,
    },
  });

  // Load production build or local dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow = win;

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  // Safety net: never leave the app invisible if 'ready-to-show' does not arrive
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible() && !isQuitting) win.show();
  }, 4000);

  // Keep WongCapture's own window OUT of recordings (the "infinite mirror"). On Windows 10 (2004+) / 11 the window
  // is left out of the capture; older Windows shows it as a black box. The renderer can switch this off in Settings.
  win.setContentProtection(true);

  win.on('maximize', () => {
    if (!win.isDestroyed()) win.webContents.send('window:isMaximized', true);
  });
  win.on('unmaximize', () => {
    if (!win.isDestroyed()) win.webContents.send('window:isMaximized', false);
  });

  // Closing the window while a recording is running must not kill (or lose) it: keep it alive in the tray.
  win.on('close', (event) => {
    if (!isQuitting && isActive()) {
      event.preventDefault();
      win.hide();
      if (tray && !shownHiddenHint && process.platform === 'win32') {
        shownHiddenHint = true;
        tray.displayBalloon({
          title: 'WongCapture is still recording',
          content: 'Use the tray icon to pause, stop or reopen the window.',
        });
      }
    }
  });

  win.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------
function trayImage(name) {
  return nativeImage.createFromPath(path.join(__dirname, 'assets', `tray-${name}.png`));
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function sendCommand(command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('tray:command', command);
  }
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function requestQuit() {
  if (!isActive()) {
    isQuitting = true;
    app.quit();
    return;
  }
  // Finish and save the clip first, then quit (with a safety timeout so we can never hang)
  quitWhenIdle = true;
  if (recState.status !== 'processing') sendCommand('stop');
  clearTimeout(quitTimer);
  quitTimer = setTimeout(() => {
    isQuitting = true;
    app.quit();
  }, 20000);
}

function buildTrayMenu() {
  const { status } = recState;
  const statusLabel = {
    idle: 'Ready to record',
    countdown: 'Starting…',
    recording: `Recording  ${formatTime(recState.elapsedSeconds)}`,
    paused: `Paused  ${formatTime(recState.elapsedSeconds)}`,
    processing: 'Saving clip…',
  }[status];

  return Menu.buildFromTemplate([
    { label: 'Open WongCapture', click: showWindow },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    {
      label: 'Start Recording',
      enabled: status === 'idle',
      click: () => {
        sendCommand('start');
        // Get the window out of the shot; the recording keeps running while minimized
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
      },
    },
    {
      label: status === 'countdown' ? 'Cancel' : 'Stop && Save Clip',
      enabled: status === 'countdown' || status === 'recording' || status === 'paused',
      click: () => sendCommand('stop'),
    },
    {
      label: status === 'paused' ? 'Resume Recording' : 'Pause Recording',
      enabled: status === 'recording' || status === 'paused',
      click: () => sendCommand('toggle-pause'),
    },
    { type: 'separator' },
    { label: 'Quit WongCapture', click: requestQuit },
  ]);
}

let lastMenuStatus = null;
function refreshTray() {
  if (!tray) return;
  const { status, elapsedSeconds } = recState;
  const iconName = status === 'recording' ? 'rec' : status === 'paused' ? 'pause' : 'idle';

  if (status !== lastMenuStatus) {
    // Rebuild only when the state changes (rebuilding every second would flicker an open menu)
    lastMenuStatus = status;
    tray.setImage(trayImage(iconName));
    tray.setContextMenu(buildTrayMenu());
  }

  trayTooltip =
    status === 'recording' ? `WongCapture — Recording ${formatTime(elapsedSeconds)}`
    : status === 'paused' ? `WongCapture — Paused ${formatTime(elapsedSeconds)}`
    : status === 'countdown' ? 'WongCapture — Starting…'
    : status === 'processing' ? 'WongCapture — Saving clip…'
    : 'WongCapture — Ready';
  tray.setToolTip(trayTooltip);
}

function createTray() {
  try {
    tray = new Tray(trayImage('idle'));
  } catch (err) {
    console.error('Could not create tray icon:', err);
    return;
  }
  tray.on('click', toggleWindow);
  refreshTray();
}

// The page reports recorder state; we validate it because it crosses a process boundary.
ipcMain.on('tray:state', (event, payload) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  if (!payload || !VALID_STATUSES.has(payload.status)) return;
  const elapsed = Number.isFinite(payload.elapsedSeconds) ? Math.max(0, Math.floor(payload.elapsedSeconds)) : 0;

  recState = { status: payload.status, elapsedSeconds: elapsed };
  refreshTray();
  syncZoomShortcuts();

  if (quitWhenIdle && recState.status === 'idle') {
    isQuitting = true;
    app.quit();
  }
});

// Only our own window may talk to these handlers
const isMainSender = (event) => !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;

ipcMain.on('window:minimize', (event) => {
  if (isMainSender(event)) mainWindow.minimize();
});

ipcMain.on('window:maximize', (event) => {
  if (!isMainSender(event)) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.on('window:close', (event) => {
  if (isMainSender(event)) mainWindow.close();
});

ipcMain.on('window:pin', (event, pinned) => {
  if (isMainSender(event)) mainWindow.setAlwaysOnTop(pinned === true, 'screen-saver');
});

// Settings -> "Prevent infinite mirror": hide/show WongCapture's own window in recordings
ipcMain.on('window:setContentProtection', (event, enabled) => {
  if (isMainSender(event)) mainWindow.setContentProtection(enabled !== false);
});

// Windows & screens for the source picker. Small JPEG thumbnails keep the IPC payload light,
// and WongCapture's own window / unnamed system windows are never offered.
ipcMain.handle('desktop:getSources', async (event) => {
  if (!isMainSender(event)) return [];
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    const ownId = mainWindow.getMediaSourceId();
    const list = sources
      .filter((s) => s.id !== ownId && s.name && s.name.trim() !== '')
      .map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail:
          s.thumbnail && !s.thumbnail.isEmpty()
            ? `data:image/jpeg;base64,${s.thumbnail.toJPEG(70).toString('base64')}`
            : '',
        appIcon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
        isScreen: s.id.startsWith('screen:'),
        display_id: s.display_id,
      }));
    knownSourceIds = new Set(list.map((s) => s.id));
    return list;
  } catch (err) {
    console.error('Failed to get desktop sources:', err);
    return [];
  }
});

ipcMain.handle('desktop:setPreferredSource', (event, sourceId, displayId) => {
  if (!isMainSender(event)) return false;
  if (sourceId === null) {
    preferredSource = null;
    return true;
  }
  if (typeof sourceId !== 'string' || !knownSourceIds.has(sourceId)) return false;
  preferredSource = {
    id: sourceId,
    isScreen: sourceId.startsWith('screen:'),
    displayId: typeof displayId === 'string' && displayId ? displayId : null,
  };
  return true;
});

// Electron's getDisplayMedia() handler - respects the source picked in the app
function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
      });

      let chosen = null;
      if (preferredSource && preferredSource.id !== mainWindow?.getMediaSourceId()) {
        chosen = sources.find((s) => s.id === preferredSource.id);
      }

      if (!chosen) {
        // Nothing picked (or that window has closed): primary monitor, then first available
        const screens = sources.filter((s) => s.id.startsWith('screen:'));
        const primaryId = String(screen.getPrimaryDisplay().id);
        chosen = screens.find((s) => s.display_id === primaryId) || screens[0] || sources[0];
      }

      if (!chosen) {
        callback({});
        return;
      }

      callback({
        video: chosen,
        // Windows system-audio capture (what you hear); skipped if audio wasn't requested
        ...(request.audioRequested ? { audio: 'loopback' } : {}),
      });
    } catch (err) {
      console.error('Display media request failed:', err);
      callback({});
    }
  });
}

// ---------------------------------------------------------------------------
// Tutorial zoom: F10 / Alt+Z, registered system-wide ONLY while recording
// ---------------------------------------------------------------------------
// Which display the recording is of (null = we cannot tell, e.g. a single window)
function capturedDisplay() {
  const displays = screen.getAllDisplays();
  if (preferredSource && !preferredSource.isScreen) return null;
  if (preferredSource && preferredSource.displayId) {
    const match = displays.find((d) => String(d.id) === preferredSource.displayId);
    if (match) return match;
  }
  return screen.getPrimaryDisplay();
}

function triggerZoomAtCursor() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const display = capturedDisplay();
    if (!display) {
      // Recording a single window: Windows gives us no way to read its position, so zoom to its centre
      mainWindow.webContents.send('autozoom:trigger', { normX: 0.5, normY: 0.5, approximate: true });
      return;
    }
    const point = screen.getCursorScreenPoint();
    const b = display.bounds;
    const normX = (point.x - b.x) / b.width;
    const normY = (point.y - b.y) / b.height;
    // Cursor is on a different monitor than the one being recorded: nothing to zoom into
    if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return;
    mainWindow.webContents.send('autozoom:trigger', { normX, normY, approximate: false });
  } catch (err) {
    console.warn('Failed to calculate cursor zoom point:', err);
  }
}

function syncZoomShortcuts() {
  const wanted = recState.status === 'recording' || recState.status === 'paused';
  if (wanted === zoomShortcutsActive) return;
  zoomShortcutsActive = wanted;
  try {
    if (wanted) {
      for (const accel of ['F10', 'Alt+Z']) {
        if (!globalShortcut.register(accel, triggerZoomAtCursor)) {
          console.warn(`Global shortcut ${accel} is already used by another app`);
        }
      }
    } else {
      globalShortcut.unregister('F10');
      globalShortcut.unregister('Alt+Z');
    }
  } catch (err) {
    console.warn('Could not update global zoom shortcuts:', err);
  }
}

// One instance only, otherwise you would end up with several tray icons and competing recorders
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    registerDisplayMediaHandler();
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    try {
      globalShortcut.unregisterAll();
    } catch (_) {}
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// Test hooks (used by the automated checks; harmless at runtime)
module.exports.__test = {
  getMenu: buildTrayMenu,
  getTooltip: () => trayTooltip,
  getState: () => recState,
  getWindow: () => mainWindow,
  getPreferredSource: () => preferredSource,
  zoomShortcutsActive: () => zoomShortcutsActive,
  triggerZoomAtCursor,
};
