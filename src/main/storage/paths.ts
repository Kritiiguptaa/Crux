/**
 * Resolves all on-disk locations EasyPeasy uses, under the OS per-user app data
 * directory (`%APPDATA%\EasyPeasy\` on Windows). Centralizing this keeps every
 * module agreeing on where the database and image crops live.
 */
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'

/** Returns the root EasyPeasy data directory, creating it if needed. */
export function dataDir(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Absolute path to the SQLite database file. */
export function databasePath(): string {
  return join(dataDir(), 'easypeasy.db')
}

/** Directory holding cropped area-card images, created on first use. */
export function imagesDir(): string {
  const dir = join(dataDir(), 'images')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Directory holding our own read-only copies of imported documents, keyed by
 * content hash. We copy the bytes in so notes keep working even if the user
 * moves or renames the original (which we never modify).
 */
export function documentsDir(): string {
  const dir = join(dataDir(), 'documents')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Resolves a stored relative image path (e.g. `images/ab12.png`) to absolute. */
export function resolveImagePath(relativePath: string): string {
  return join(dataDir(), relativePath)
}
