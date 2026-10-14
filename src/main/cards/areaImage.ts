/**
 * Area-card image storage. Rectangular selections (diagrams, formulas) are
 * saved as PNG files on disk under the app data dir — referenced by a relative
 * path on the card's anchor — rather than as database blobs, keeping the DB
 * small and backups simple.
 */
import { writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { join, isAbsolute, normalize, sep } from 'path'
import { imagesDir, resolveImagePath } from '../storage/paths'
import { newId } from '../util/id'

/**
 * Writes PNG bytes for an area card and returns the path to store on the anchor,
 * relative to the data dir (e.g. `images/<uuid>.png`). The document id is kept
 * in the filename purely to make the store easier to inspect.
 */
export function saveAreaImage(documentId: string, pngBytes: Uint8Array): string {
  const fileName = `${documentId.slice(0, 8)}-${newId()}.png`
  const absolute = join(imagesDir(), fileName)
  writeFileSync(absolute, pngBytes)
  // Return a relative path so the store can be moved without breaking references.
  return join('images', fileName)
}

/**
 * Resolves a stored relative image path to an absolute one, guaranteeing it
 * stays inside imagesDir(). The trailing-separator check blocks both path
 * traversal (../) and sibling-directory prefix tricks (e.g. "<imagesDir>-evil").
 */
function resolveInsideImages(relativePath: string): string {
  if (isAbsolute(relativePath)) throw new Error('Expected a relative image path.')
  const absolute = normalize(resolveImagePath(relativePath))
  const root = normalize(imagesDir())
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new Error('Refusing to access a path outside the images directory.')
  }
  return absolute
}

/** Reads a previously saved area image back as bytes (confined to imagesDir()). */
export function getAreaImage(relativePath: string): Uint8Array {
  return readFileSync(resolveInsideImages(relativePath))
}

/** Deletes an area image file if it exists and is safely inside imagesDir(). */
export function deleteAreaImage(relativePath: string): void {
  try {
    const absolute = resolveInsideImages(relativePath)
    if (existsSync(absolute)) rmSync(absolute)
  } catch {
    // Path outside the images dir or malformed — nothing safe to delete.
  }
}
