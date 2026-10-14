/**
 * Owns the single better-sqlite3 connection for the whole app (main process).
 * Opens the database, applies robustness pragmas, runs migrations, and hands
 * the connection to the repositories. Vector-search extensions (sqlite-vec)
 * are intentionally not loaded here yet — they arrive in Phase 5.
 */
import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { databasePath } from './paths'
import { runMigrations } from './migrations'

let connection: BetterSqlite3.Database | null = null

/**
 * Opens (once) and returns the shared database connection. WAL mode gives us
 * safe concurrent reads while writing; `foreign_keys` enforces our cascades.
 */
export function getDb(): BetterSqlite3.Database {
  if (connection) return connection

  const db = new Database(databasePath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)

  connection = db
  return connection
}

/** Closes the connection on app shutdown so WAL data is checkpointed cleanly. */
export function closeDb(): void {
  if (connection) {
    connection.close()
    connection = null
  }
}

/**
 * Test-only: injects an already-migrated connection (typically an in-memory
 * database) as the shared singleton, so repository tests can run without
 * Electron or a file on disk. Not used by the app at runtime.
 */
export function setConnectionForTests(db: BetterSqlite3.Database): void {
  connection = db
}
