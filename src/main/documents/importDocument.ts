/**
 * Importing a document: pick a file, hash it, and register it. We copy the
 * bytes into our own store keyed by hash (never modifying the original) so
 * highlights keep resolving even if the user later moves or renames the file.
 * Re-importing identical bytes reuses the existing record.
 */
import { dialog, BrowserWindow } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { basename, extname, join } from 'path'
import type { DocumentKind, DocumentMeta } from '@shared/domain-types'
import { hashFile } from './hash'
import { documentsDir } from '../storage/paths'
import {
  findByHash,
  insertDocument,
  linkToStudySet,
  getDocumentRow
} from '../storage/documentRepo'

/** Maps a file extension to a known document kind, or null if unsupported. */
function kindFromExtension(ext: string): DocumentKind | null {
  switch (ext.toLowerCase()) {
    case '.pdf':
      return 'pdf'
    case '.pptx':
      return 'pptx'
    case '.ppt':
      return 'ppt'
    default:
      return null
  }
}

/**
 * Shows the native open dialog (Phase 1: PDF only), then registers the chosen
 * file and links it to the study set. Returns the document metadata, or null if
 * the user cancelled.
 */
export async function importDocument(
  window: BrowserWindow | null,
  studySetId: string
): Promise<DocumentMeta | null> {
  const options = {
    title: 'Add a document',
    properties: ['openFile' as const],
    filters: [{ name: 'PDF documents', extensions: ['pdf'] }]
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null

  const sourcePath = result.filePaths[0]
  const kind = kindFromExtension(extname(sourcePath))
  if (!kind) throw new Error('Unsupported file type (Phase 1 supports PDF only).')

  const contentHash = await hashFile(sourcePath)

  // Reuse an existing record for identical bytes; just (re-)link it here.
  const existing = findByHash(contentHash)
  if (existing) {
    linkToStudySet(existing.id, studySetId)
    const row = getDocumentRow(existing.id)!
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

  // Copy the bytes into our store under the content hash.
  const storedPath = join(documentsDir(), `${contentHash}${extname(sourcePath)}`)
  if (!existsSync(storedPath)) copyFileSync(sourcePath, storedPath)

  const title = basename(sourcePath, extname(sourcePath))
  const meta = insertDocument({
    contentHash,
    title,
    kind,
    pageCount: null,
    lastKnownPath: sourcePath,
    storedPath
  })
  linkToStudySet(meta.id, studySetId)
  return meta
}
