import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { channels } from '../shared/ipc';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc';

const devUrl = process.env.VUT_RENDERER_URL;

function installProductionPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders ?? {};
    responseHeaders['Content-Security-Policy'] = [
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
    ];
    callback({ responseHeaders });
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 680,
    minHeight: 440,
    show: false,
    frame: false,
    title: 'Archive',
    backgroundColor: '#050a08',
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send(channels.state, true));
  win.on('unmaximize', () => win.webContents.send(channels.state, false));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (devUrl && url.startsWith(devUrl)) return;
    if (url.startsWith('file:')) return;
    event.preventDefault();
  });
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    if (!devUrl) installProductionPolicy();
    ipcMain.on(channels.minimize, (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
    ipcMain.on(channels.toggleMaximize, (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    });
    ipcMain.on(channels.close, (event) => BrowserWindow.fromWebContents(event.sender)?.close());
    registerIpc(dialog);
    createWindow();
  });
  app.on('window-all-closed', () => {
    app.quit();
  });
}
