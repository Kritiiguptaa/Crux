/**
 * Card persistence — the heart of the app. A card carries its anchor (where it
 * lives in the document) and its tags. Reads assemble the full `Card`; writes
 * keep the `cards`, `anchors`, `tags` and `card_tags` tables consistent inside
 * one transaction.
 */
import type {
  Anchor,
  Card,
  CardKind,
  CreateCardInput,
  HighlightColor,
  NormRect,
  UpdateCardInput
} from '@shared/domain-types'
import { getDb } from './db'
import { newId, now } from '../util/id'
import { touchStudySet } from './studySetRepo'

interface CardRow {
  id: string
  study_set_id: string
  document_id: string
  kind: string
  title: string | null
  body: string
  note: string
  color: string
  created_at: number
  updated_at: number
}

interface AnchorRow {
  card_id: string
  page_or_slide: number
  rects_json: string
  quoted_text: string | null
  prefix: string | null
  suffix: string | null
  image_path: string | null
}

/** Loads the anchor for a card, or null if it has none. */
function loadAnchor(cardId: string): Anchor | null {
  const row = getDb().prepare('SELECT * FROM anchors WHERE card_id = ?').get(cardId) as
    | AnchorRow
    | undefined
  if (!row) return null
  return {
    pageOrSlide: row.page_or_slide,
    rects: JSON.parse(row.rects_json) as NormRect[],
    quotedText: row.quoted_text,
    prefix: row.prefix,
    suffix: row.suffix,
    imagePath: row.image_path
  }
}

/** Loads the sorted tag names attached to a card. */
function loadTags(cardId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT t.name FROM tags t
         JOIN card_tags ct ON ct.tag_id = t.id
        WHERE ct.card_id = ?
        ORDER BY t.name`
    )
    .all(cardId) as { name: string }[]
  return rows.map((r) => r.name)
}

/** Assembles a full domain `Card` from its row, anchor and tags. */
function toCard(row: CardRow): Card {
  return {
    id: row.id,
    studySetId: row.study_set_id,
    documentId: row.document_id,
    kind: row.kind as CardKind,
    title: row.title,
    body: row.body,
    note: row.note,
    color: row.color as HighlightColor,
    tags: loadTags(row.id),
    anchor: loadAnchor(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * Ensures a tag exists (by unique name) and returns its id, so tags are shared
 * across cards rather than duplicated.
 */
function upsertTag(name: string): string {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as
    | { id: string }
    | undefined
  if (existing) return existing.id
  const id = newId()
  db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name)
  return id
}

/** Replaces a card's tag links with the given set of names (trimmed, de-duped). */
function setTags(cardId: string, tags: string[]): void {
  const db = getDb()
  db.prepare('DELETE FROM card_tags WHERE card_id = ?').run(cardId)
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
  const link = db.prepare('INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)')
  for (const name of clean) link.run(cardId, upsertTag(name))
}

/** Writes (inserts or replaces) a card's anchor. */
function writeAnchor(cardId: string, anchor: Anchor): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO anchors
         (card_id, page_or_slide, rects_json, quoted_text, prefix, suffix, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      cardId,
      anchor.pageOrSlide,
      JSON.stringify(anchor.rects),
      anchor.quotedText,
      anchor.prefix,
      anchor.suffix,
      anchor.imagePath
    )
}

/** Returns a single card by id, or undefined. */
export function getCard(id: string): Card | undefined {
  const row = getDb().prepare('SELECT * FROM cards WHERE id = ?').get(id) as
    | CardRow
    | undefined
  return row ? toCard(row) : undefined
}

/** Lists all cards in a study set, newest first. */
export function listCardsByStudySet(studySetId: string): Card[] {
  const rows = getDb()
    .prepare('SELECT * FROM cards WHERE study_set_id = ? ORDER BY created_at DESC')
    .all(studySetId) as CardRow[]
  return rows.map(toCard)
}

/** Lists cards for one document within a study set (drives the reader overlay). */
export function listCardsByDocument(studySetId: string, documentId: string): Card[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM cards
        WHERE study_set_id = ? AND document_id = ?
        ORDER BY created_at DESC`
    )
    .all(studySetId, documentId) as CardRow[]
  return rows.map(toCard)
}

/**
 * Creates a card (plus its anchor and tags) in one transaction and returns the
 * fully-assembled result. Also bumps the owning study set's activity time.
 */
export function createCard(input: CreateCardInput): Card {
  const db = getDb()
  const id = newId()
  const ts = now()
  const color: HighlightColor = input.color ?? 'yellow'

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO cards
         (id, study_set_id, document_id, kind, title, body, note, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.studySetId,
      input.documentId,
      input.kind,
      input.title ?? null,
      input.body,
      input.note ?? '',
      color,
      ts,
      ts
    )
    if (input.anchor) writeAnchor(id, input.anchor)
    if (input.tags && input.tags.length) setTags(id, input.tags)
    touchStudySet(input.studySetId)
  })
  run()

  return getCard(id) as Card
}

/**
 * Updates a card's editable fields (only those provided), replacing tags when
 * given, and returns the refreshed card.
 */
export function updateCard(input: UpdateCardInput): Card {
  const db = getDb()
  const existing = getCard(input.id)
  if (!existing) throw new Error(`Card not found: ${input.id}`)

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE cards
          SET title = ?, body = ?, note = ?, color = ?, updated_at = ?
        WHERE id = ?`
    ).run(
      input.title !== undefined ? input.title : existing.title,
      input.body !== undefined ? input.body : existing.body,
      input.note !== undefined ? input.note : existing.note,
      input.color !== undefined ? input.color : existing.color,
      now(),
      input.id
    )
    if (input.tags !== undefined) setTags(input.id, input.tags)
  })
  run()

  return getCard(input.id) as Card
}

/** Deletes a card; its anchor and tag links cascade away. Returns its image path if any. */
export function deleteCard(id: string): string | null {
  const db = getDb()
  const anchor = loadAnchor(id)
  db.prepare('DELETE FROM cards WHERE id = ?').run(id)
  return anchor?.imagePath ?? null
}

/**
 * Returns the relative image paths of every area card in a study set. Used to
 * delete the on-disk PNGs before the study set (and its cards) is removed, since
 * the database cascade can't reach the filesystem.
 */
export function listAreaImagePathsByStudySet(studySetId: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT a.image_path AS p FROM anchors a
         JOIN cards c ON c.id = a.card_id
        WHERE c.study_set_id = ? AND a.image_path IS NOT NULL`
    )
    .all(studySetId) as { p: string }[]
  return rows.map((r) => r.p)
}
