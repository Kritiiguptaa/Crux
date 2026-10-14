/** Reads the stored bytes of a registered document for the renderer to render. */
import { readFileSync } from 'fs'
import { getDocumentRow } from '../storage/documentRepo'

/**
 * Returns the raw bytes of a document from our content-addressed store. pdf.js
 * in the renderer consumes these to render pages. Throws if the document id is
 * unknown or its stored copy is missing.
 */
export function getFileData(documentId: string): Uint8Array {
  const row = getDocumentRow(documentId)
  if (!row) throw new Error(`Unknown document: ${documentId}`)
  return readFileSync(row.stored_path)
}
