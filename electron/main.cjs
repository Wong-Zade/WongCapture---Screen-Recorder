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

  if (quitWhenIdle && recState.status === 'idle') {
    isQuitting = true;
    app.quit();
  }
});

ipcMain.on('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.on('window:pin', (_event, pinned) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(!!pinned, 'screen-saver');
  }
});

let preferredSourceId = null;

// Expose open windows & screens to renderer for the source selector modal
ipcMain.handle('desktop:getSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 360, height: 202 },
      fetchWindowIcons: true,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      isScreen: s.id.startsWith('screen:'),
      display_id: s.display_id,
    }));
  } catch (err) {
    console.error('Failed to get desktop sources:', err);
    return [];
  }
});

ipcMain.handle('desktop:setPreferredSource', (_event, sourceId) => {
  preferredSourceId = sourceId;
  return true;
});

// Electron's getDisplayMedia() handler - respects preferred source selected by user
function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 },
      });

      let chosen = null;
      if (preferredSourceId) {
        chosen = sources.find((s) => s.id === preferredSourceId);
      }

      if (!chosen) {
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

// One instance only, otherwise you would end up with several tray icons and competing recorders
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    registerDisplayMediaHandler();
    createWindow();
    createTray();

    // Global tutorial zoom trigger: when F10 or Alt+Z is pressed anywhere in Windows,
    // zoom smoothly into where the presenter's mouse cursor is pointing!
    const triggerZoomAtCursor = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        const point = screen.getCursorScreenPoint();
        const primary = screen.getPrimaryDisplay();
        const normX = Math.max(0, Math.min(1, (point.x - primary.bounds.x) / (primary.bounds.width || 1920)));
        const normY = Math.max(0, Math.min(1, (point.y - primary.bounds.y) / (primary.bounds.height || 1080)));
        mainWindow.webContents.send('autozoom:trigger', { normX, normY });
      } catch (err) {
        console.warn('Failed to calculate cursor zoom point:', err);
      }
    };

    try {
      globalShortcut.register('F10', triggerZoomAtCursor);
      globalShortcut.register('Alt+Z', triggerZoomAtCursor);
    } catch (err) {
      console.warn('Could not register global zoom shortcuts:', err);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
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
};
