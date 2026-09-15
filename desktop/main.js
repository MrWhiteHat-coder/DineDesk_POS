/**
 * DineDesk Windows Desktop — Electron main process.
 *
 * Production wrapper around the built React POS:
 *   - Loads the LOCAL production build (frontend/build) — no dev servers,
 *     no localhost dependency at runtime.
 *   - Opens DIRECTLY into the app: `/` is the marketing landing page on the
 *     web, but the desktop app is a POS terminal, so it routes straight to
 *     /login (or /pos when a valid session is restored — PublicRoute bounces
 *     authenticated users into /pos automatically). The marketing website
 *     is NOT part of the executable.
 *   - Offline-first: the same IndexedDB offline queue + sync engine the web
 *     PWA uses keeps billing working with zero connectivity.
 */
const { app, BrowserWindow, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Packaged builds carry the production bundle under resources/app-build;
// running from the repo (dev) reads frontend/build directly.
const BUILD_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'app-build')
  : path.join(__dirname, '..', 'frontend', 'build');

const isDev = !!process.env.DD_DESKTOP_DEV;
const DEV_URL = process.env.DD_DEV_URL || 'http://localhost:3000';

// The custom scheme must be registered as standard/secure BEFORE app ready
// so fetch/XHR (axios) and IndexedDB work inside it.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// Single instance — a POS terminal never runs two copies of the till.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#0F2417',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    title: 'DineDesk POS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links (mailto:, tel:, https help pages) in the OS handler,
  // never inside the POS window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(mailto:|tel:|https?:)/i.test(url)) { shell.openExternal(url); }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    loadApp();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* Load the packaged build with SPA routing support: file:// breaks
   BrowserRouter deep-links, so requests on app://local are transparently
   remapped — real asset files stream from disk, every route falls back to
   index.html (exactly what a dev server does).

   Electron ≥25 `protocol.handle` is fetch-style: the handler must RETURN a
   Response. The old callback style throws ERR_UNEXPECTED → blank window
   (this exact bug shipped once — do not regress it). */
function loadApp(route = '/login') {
  const indexHtml = path.join(BUILD_DIR, 'index.html');

  const handler = (request) => {
    let pathname = '/';
    try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { pathname = '/'; }
    const rel = pathname.replace(/^\/+/, '');
    if (rel) {
      const candidate = path.normalize(path.join(BUILD_DIR, rel));
      if (candidate.startsWith(BUILD_DIR) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return net.fetch(pathToFileURL(candidate).toString());
      }
    }
    // SPA fallback — every route serves the app shell
    return net.fetch(pathToFileURL(indexHtml).toString());
  };

  protocol.handle('app', handler);

  // Deep-link straight into the POS terminal — no marketing pages.
  // PublicRoute bounces an already-authenticated user into /pos automatically.
  mainWindow.loadURL(`app://local${route}`).catch((err) => {
    console.error('Failed to load app shell:', err);
    // Last-resort plain file load so the window is never blank without a trace.
    mainWindow.loadFile(indexHtml).catch(() => {});
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
