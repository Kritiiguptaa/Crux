/** Content hashing — the stable identity for documents. */
import { createHash } from 'crypto'
import { createReadStream } from 'fs'

/**
 * Computes the SHA-256 of a file's bytes by streaming it, so even large
 * textbooks hash without loading the whole file into memory. Returns the hex
 * digest used as the document's content hash.
 */
export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
