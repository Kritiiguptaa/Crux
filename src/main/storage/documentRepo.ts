/**
 * Document persistence. Documents are identified by the SHA-256 of their bytes,
 * so importing the same file twice reuses one record. We keep our own read-only
 * copy of the bytes (stored_path) so highlights survive the original being moved.
 */
import type { DocumentKind, DocumentMeta } from '@shared/domain-types'
import { getDb } from './db'
import { newId, now } from '../util/id'

/** Row shape as stored in the `documents` table. */
interface DocumentRow {
  id: string
  content_hash: string
  title: string
  kind: string
  page_count: number | null
  last_known_path: string | null
  stored_path: string
  created_at: number
}

/** Maps a raw row into the public `DocumentMeta` (hides stored_path). */
function toMeta(row: DocumentRow): DocumentMeta {
  return {
    id: row.id,
    contentHash: row.content_hash,
    title: row.title,
    kind: row.kind as DocumentKind,
    pageCount: row.page_count,
    lastKnownPath: row.last_known_path,
    createdAt: row.created_at
  }
}

/** Looks up a document by its content hash, or returns undefined. */
export function findByHash(contentHash: string): DocumentRow | undefined {
  return getDb()
    .prepare('SELECT * FROM documents WHERE content_hash = ?')
    .get(contentHash) as DocumentRow | undefined
}

/** Returns a document row by id, or undefined. */
export function getDocumentRow(id: string): DocumentRow | undefined {
  return getDb().prepare('SELECT * FROM documents WHERE id = ?').get(id) as
    | DocumentRow
    | undefined
}

/** Inserts a new document record and returns its metadata. */
export function insertDocument(input: {
  contentHash: string
  title: string
  kind: DocumentKind
  pageCount: number | null
  lastKnownPath: string | null
  storedPath: string
}): DocumentMeta {
  const db = getDb()
  const id = newId()
  const ts = now()
  db.prepare(
    `INSERT INTO documents
       (id, content_hash, title, kind, page_count, last_known_path, stored_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.contentHash,
    input.title,
    input.kind,
    input.pageCount,
    input.lastKnownPath,
    input.storedPath,
    ts
  )
  return {
    id,
    contentHash: input.contentHash,
    title: input.title,
    kind: input.kind,
    pageCount: input.pageCount,
    lastKnownPath: input.lastKnownPath,
    createdAt: ts
  }
}

/** Links a document into a study set (idempotent). */
export function linkToStudySet(documentId: string, studySetId: string): void {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO study_set_documents (study_set_id, document_id, added_at)
       VALUES (?, ?, ?)`
    )
    .run(studySetId, documentId, now())
}

/** Removes the link between a document and a study set (document stays registered). */
export function unlinkFromStudySet(documentId: string, studySetId: string): void {
  getDb()
    .prepare('DELETE FROM study_set_documents WHERE study_set_id = ? AND document_id = ?')
    .run(studySetId, documentId)
}

/** Lists the documents belonging to a study set, newest link first. */
export function listDocumentsInStudySet(studySetId: string): DocumentMeta[] {
  const rows = getDb()
    .prepare(
      `SELECT d.* FROM documents d
         JOIN study_set_documents l ON l.document_id = d.id
        WHERE l.study_set_id = ?
        ORDER BY l.added_at DESC`
    )
    .all(studySetId) as DocumentRow[]
  return rows.map(toMeta)
}
