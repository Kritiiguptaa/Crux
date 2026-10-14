/**
 * Study-set persistence. A study set is a subject folder grouping documents
 * (many-to-many) and owning the cards captured for that subject.
 */
import type { StudySet } from '@shared/domain-types'
import { getDb } from './db'
import { newId, now } from '../util/id'

/** Row shape as stored, before we attach computed counts. */
interface StudySetRow {
  id: string
  name: string
  created_at: number
  updated_at: number
}

/** Maps a raw row plus its counts into the domain `StudySet`. */
function toStudySet(row: StudySetRow, documentCount: number, cardCount: number): StudySet {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount,
    cardCount
  }
}

/** Lists all study sets, most recently updated first, with document/card counts. */
export function listStudySets(): StudySet[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM study_sets ORDER BY updated_at DESC')
    .all() as StudySetRow[]

  const docCount = db.prepare(
    'SELECT COUNT(*) AS n FROM study_set_documents WHERE study_set_id = ?'
  )
  const cardCount = db.prepare('SELECT COUNT(*) AS n FROM cards WHERE study_set_id = ?')

  return rows.map((row) => {
    const d = docCount.get(row.id) as { n: number }
    const c = cardCount.get(row.id) as { n: number }
    return toStudySet(row, d.n, c.n)
  })
}

/** Creates a study set with the given name and returns it. */
export function createStudySet(name: string): StudySet {
  const db = getDb()
  const id = newId()
  const ts = now()
  db.prepare(
    'INSERT INTO study_sets (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, name.trim(), ts, ts)
  return { id, name: name.trim(), createdAt: ts, updatedAt: ts, documentCount: 0, cardCount: 0 }
}

/** Renames a study set, bumps its updated_at, and returns the fresh row. */
export function renameStudySet(id: string, name: string): StudySet {
  const db = getDb()
  const ts = now()
  db.prepare('UPDATE study_sets SET name = ?, updated_at = ? WHERE id = ?').run(
    name.trim(),
    ts,
    id
  )
  const row = db.prepare('SELECT * FROM study_sets WHERE id = ?').get(id) as StudySetRow
  const d = db
    .prepare('SELECT COUNT(*) AS n FROM study_set_documents WHERE study_set_id = ?')
    .get(id) as { n: number }
  const c = db
    .prepare('SELECT COUNT(*) AS n FROM cards WHERE study_set_id = ?')
    .get(id) as { n: number }
  return toStudySet(row, d.n, c.n)
}

/** Deletes a study set; cascades remove its links and cards. */
export function deleteStudySet(id: string): void {
  getDb().prepare('DELETE FROM study_sets WHERE id = ?').run(id)
}

/** Marks a study set as recently active (called when its contents change). */
export function touchStudySet(id: string): void {
  getDb().prepare('UPDATE study_sets SET updated_at = ? WHERE id = ?').run(now(), id)
}
