/**
 * Versioned schema migrations. On startup `runMigrations` reads the current
 * `schema_meta.version` and applies each later migration in order inside a
 * transaction, so the database upgrades itself as the app evolves across phases.
 */
import type BetterSqlite3 from 'better-sqlite3'

/** One ordered schema step. `up` runs the SQL for that version. */
interface Migration {
  version: number
  up: (db: BetterSqlite3.Database) => void
}

/**
 * Migration 1 — Phase 1 schema: study sets, documents (content-hash identity),
 * the many-to-many link between them, cards, anchors, tags, and settings.
 * Later phases add mind-map, review and embedding tables as new migrations.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE study_sets (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE documents (
          id             TEXT PRIMARY KEY,
          content_hash   TEXT NOT NULL UNIQUE,
          title          TEXT NOT NULL,
          kind           TEXT NOT NULL,
          page_count     INTEGER,
          last_known_path TEXT,
          stored_path    TEXT NOT NULL,          -- our own copy of the file bytes
          created_at     INTEGER NOT NULL
        );

        -- Many-to-many: a document can belong to several study sets.
        CREATE TABLE study_set_documents (
          study_set_id TEXT NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
          document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          added_at     INTEGER NOT NULL,
          PRIMARY KEY (study_set_id, document_id)
        );

        CREATE TABLE cards (
          id           TEXT PRIMARY KEY,
          study_set_id TEXT NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
          document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          kind         TEXT NOT NULL,            -- 'text' | 'area' | 'manual'
          title        TEXT,
          body         TEXT NOT NULL DEFAULT '',
          note         TEXT NOT NULL DEFAULT '',
          color        TEXT NOT NULL DEFAULT 'yellow',
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
        CREATE INDEX idx_cards_study_set ON cards(study_set_id);
        CREATE INDEX idx_cards_document ON cards(document_id);

        -- One anchor per card (where it lives in the source document).
        CREATE TABLE anchors (
          card_id       TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
          page_or_slide INTEGER NOT NULL,
          rects_json    TEXT NOT NULL,           -- JSON array of {x,y,w,h} in 0..1
          quoted_text   TEXT,
          prefix        TEXT,
          suffix        TEXT,
          image_path    TEXT                     -- relative path for area cards
        );

        CREATE TABLE tags (
          id   TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE card_tags (
          card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
          tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (card_id, tag_id)
        );

        -- Simple key/value settings store (JSON-encoded values).
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `)
    }
  }
]

/**
 * Applies any migrations newer than the database's recorded version. Creates
 * the `schema_meta` bookkeeping table on first run, then runs each pending
 * migration in its own transaction and bumps the stored version.
 */
export function runMigrations(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL);`)

  const row = db.prepare('SELECT version FROM schema_meta LIMIT 1').get() as
    | { version: number }
    | undefined
  let current = row?.version ?? 0
  if (row === undefined) {
    db.prepare('INSERT INTO schema_meta (version) VALUES (0)').run()
  }

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      const apply = db.transaction(() => {
        migration.up(db)
        db.prepare('UPDATE schema_meta SET version = ?').run(migration.version)
      })
      apply()
      current = migration.version
    }
  }
}
