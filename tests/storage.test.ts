/**
 * Storage-layer tests. These exercise the real SQL (migrations + repositories)
 * against an in-memory SQLite database, covering the core "capture once"
 * guarantees: content-hash document identity, many-to-many study-set links,
 * card creation with anchors and tags, cascading deletes, and settings.
 */
import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '@main/storage/migrations'
import { setConnectionForTests } from '@main/storage/db'
import {
  createStudySet,
  listStudySets,
  renameStudySet,
  deleteStudySet
} from '@main/storage/studySetRepo'
import {
  insertDocument,
  findByHash,
  linkToStudySet,
  listDocumentsInStudySet
} from '@main/storage/documentRepo'
import {
  createCard,
  listCardsByDocument,
  updateCard,
  deleteCard,
  listAreaImagePathsByStudySet
} from '@main/storage/cardRepo'
import { getSettings, setSettings } from '@main/storage/settingsRepo'

/** Spins up a fresh, migrated in-memory database before each test. */
beforeEach(() => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  setConnectionForTests(db)
})

/** Convenience: a study set with one registered+linked document. */
function seedSetWithDoc(): { setId: string; docId: string } {
  const set = createStudySet('Biology')
  const doc = insertDocument({
    contentHash: 'hash-abc',
    title: 'Cell Biology',
    kind: 'pdf',
    pageCount: 10,
    lastKnownPath: 'C:/x/cell.pdf',
    storedPath: 'C:/store/hash-abc.pdf'
  })
  linkToStudySet(doc.id, set.id)
  return { setId: set.id, docId: doc.id }
}

describe('study sets', () => {
  it('creates, lists, renames and deletes', () => {
    const set = createStudySet('  Chemistry  ')
    expect(set.name).toBe('Chemistry') // trimmed
    expect(listStudySets()).toHaveLength(1)

    const renamed = renameStudySet(set.id, 'Organic Chem')
    expect(renamed.name).toBe('Organic Chem')

    deleteStudySet(set.id)
    expect(listStudySets()).toHaveLength(0)
  })

  it('reports document and card counts', () => {
    const { setId, docId } = seedSetWithDoc()
    createCard({ studySetId: setId, documentId: docId, kind: 'manual', body: 'note' })
    const [set] = listStudySets()
    expect(set.documentCount).toBe(1)
    expect(set.cardCount).toBe(1)
  })
})

describe('documents', () => {
  it('finds a document by content hash', () => {
    const { docId } = seedSetWithDoc()
    const found = findByHash('hash-abc')
    expect(found?.id).toBe(docId)
  })

  it('links one document into multiple study sets (many-to-many)', () => {
    const { docId } = seedSetWithDoc()
    const second = createStudySet('Exam Revision')
    linkToStudySet(docId, second.id)
    expect(listDocumentsInStudySet(second.id)).toHaveLength(1)
  })
})

describe('cards', () => {
  it('creates a text card with an anchor and tags, then reads it back', () => {
    const { setId, docId } = seedSetWithDoc()
    const card = createCard({
      studySetId: setId,
      documentId: docId,
      kind: 'text',
      body: 'Mitochondria are the powerhouse of the cell.',
      color: 'green',
      tags: ['organelles', 'exam'],
      anchor: {
        pageOrSlide: 3,
        rects: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.03 }],
        quotedText: 'Mitochondria are the powerhouse of the cell.',
        prefix: 'Note: ',
        suffix: ' They produce ATP.',
        imagePath: null
      }
    })

    expect(card.anchor?.pageOrSlide).toBe(3)
    expect(card.anchor?.rects).toHaveLength(1)
    expect(card.tags).toEqual(['exam', 'organelles']) // sorted
    expect(card.color).toBe('green')

    const forDoc = listCardsByDocument(setId, docId)
    expect(forDoc).toHaveLength(1)
    expect(forDoc[0].id).toBe(card.id)
  })

  it('updates editable fields and replaces tags', () => {
    const { setId, docId } = seedSetWithDoc()
    const card = createCard({
      studySetId: setId,
      documentId: docId,
      kind: 'text',
      body: 'x',
      tags: ['a']
    })
    const updated = updateCard({ id: card.id, note: 'my note', color: 'blue', tags: ['b', 'c'] })
    expect(updated.note).toBe('my note')
    expect(updated.color).toBe('blue')
    expect(updated.tags).toEqual(['b', 'c'])
  })

  it('returns the area image path when deleting, for cleanup', () => {
    const { setId, docId } = seedSetWithDoc()
    const card = createCard({
      studySetId: setId,
      documentId: docId,
      kind: 'area',
      body: '',
      anchor: {
        pageOrSlide: 1,
        rects: [{ x: 0, y: 0, w: 0.3, h: 0.3 }],
        quotedText: null,
        prefix: null,
        suffix: null,
        imagePath: 'images/crop-1.png'
      }
    })
    expect(deleteCard(card.id)).toBe('images/crop-1.png')
    expect(listCardsByDocument(setId, docId)).toHaveLength(0)
  })

  it('lists area-card image paths for a study set (for on-delete cleanup)', () => {
    const { setId, docId } = seedSetWithDoc()
    createCard({
      studySetId: setId,
      documentId: docId,
      kind: 'area',
      body: '',
      anchor: {
        pageOrSlide: 1,
        rects: [{ x: 0, y: 0, w: 0.2, h: 0.2 }],
        quotedText: null,
        prefix: null,
        suffix: null,
        imagePath: 'images/a.png'
      }
    })
    createCard({ studySetId: setId, documentId: docId, kind: 'text', body: 'no image' })
    expect(listAreaImagePathsByStudySet(setId)).toEqual(['images/a.png'])
  })

  it('cascades: deleting a study set removes its cards', () => {
    const { setId, docId } = seedSetWithDoc()
    createCard({ studySetId: setId, documentId: docId, kind: 'manual', body: 'y' })
    deleteStudySet(setId)
    expect(listCardsByDocument(setId, docId)).toHaveLength(0)
  })
})

describe('settings', () => {
  it('returns defaults then persists updates', () => {
    expect(getSettings().cardCreationMode).toBe('ask')
    const updated = setSettings({ cardCreationMode: 'auto' })
    expect(updated.cardCreationMode).toBe('auto')
    expect(getSettings().defaultHighlightColor).toBe('yellow')
  })
})
