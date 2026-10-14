/**
 * Main-process entry point. Creates the secure browser window, opens the
 * database, registers IPC handlers, and manages the app lifecycle. The window
 * is locked down: no Node in the renderer, context isolation on, and the UI
 * reaches the backend only through the preload-exposed `window.api`.
 */
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getDb, closeDb } from './storage/db'
import { registerIpc } from './ipc/registerIpc'

/** Creates the main application window with a hardened web-preferences setup. */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#faf9f6',
    title: 'EasyPeasy',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false, // required so the preload can use Node's `require` for the bridge
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Show only once the renderer has painted, to avoid a white flash.
  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Open external links in the user's browser, never in-app — but only safe web
  // schemes, so a crafted link can't hand the OS a file:/javascript:/etc. target.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const { protocol } = new URL(details.url)
      if (protocol === 'http:' || protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Malformed URL — ignore it.
    }
    return { action: 'deny' }
  })

  // Load the Vite dev server in development, or the built files in production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// App is ready: initialize storage, IPC, and the first window.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.easypeasy.app')

  // Open the database up front so migrations run before any IPC call.
  getDb()
  registerIpc()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // macOS re-open behavior (harmless on Windows; keeps the code portable).
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed (Windows/Linux convention).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Checkpoint and close the database cleanly on exit.
app.on('will-quit', () => {
  closeDb()
})
