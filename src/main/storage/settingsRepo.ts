/**
 * Settings persistence as a small JSON key/value store. `getSettings` always
 * returns a complete object with defaults applied, so callers never deal with
 * missing keys.
 */
import type { AppSettings } from '@shared/domain-types'
import { getDb } from './db'

/** The defaults used when a setting has never been written. */
const DEFAULTS: AppSettings = {
  cardCreationMode: 'ask',
  defaultHighlightColor: 'yellow'
}

/** Reads one raw stored value by key, parsed from JSON, or undefined. */
function readRaw<T>(key: string): T | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row ? (JSON.parse(row.value) as T) : undefined
}

/** Writes one value by key as JSON (insert or replace). */
function writeRaw(key: string, value: unknown): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, JSON.stringify(value))
}

/** Returns all settings with defaults filled in for anything unset. */
export function getSettings(): AppSettings {
  return {
    cardCreationMode: readRaw<AppSettings['cardCreationMode']>('cardCreationMode') ??
      DEFAULTS.cardCreationMode,
    defaultHighlightColor:
      readRaw<AppSettings['defaultHighlightColor']>('defaultHighlightColor') ??
      DEFAULTS.defaultHighlightColor
  }
}

/** Merges a partial update into settings and returns the full, updated object. */
export function setSettings(patch: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) writeRaw(key, value)
  }
  return getSettings()
}
