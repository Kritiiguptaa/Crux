/**
 * Minimal `electron` stub for unit tests. Only the surface our Node-side code
 * touches at import time is provided; tests that need storage inject an
 * in-memory database via `setConnectionForTests`, so `app.getPath` is a
 * harmless fallback.
 */
import { tmpdir } from 'os'

export const app = {
  getPath: () => tmpdir(),
  getVersion: () => '0.0.0-test'
}

export const ipcMain = {
  handle: (): void => {}
}

export const dialog = {}
export const shell = {}
export class BrowserWindow {}
