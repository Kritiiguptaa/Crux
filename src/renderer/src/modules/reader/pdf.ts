/**
 * pdf.js bootstrap for the renderer. Configures the worker (bundled by Vite as
 * a URL) and exposes a single `loadPdf` helper that turns raw bytes into a
 * PDFDocumentProxy. Keeping this in one module means the rest of the reader
 * never imports pdf.js internals directly.
 */
import * as pdfjsLib from 'pdfjs-dist'
// `?url` makes Vite emit the worker as a file and give us its URL.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDocument = pdfjsLib.PDFDocumentProxy
export type PdfPage = pdfjsLib.PDFPageProxy

/**
 * Loads a PDF from bytes. We copy into a fresh Uint8Array because pdf.js
 * transfers (detaches) the buffer it is given, which would corrupt a shared one.
 */
export async function loadPdf(bytes: Uint8Array): Promise<PdfDocument> {
  const data = new Uint8Array(bytes)
  const task = pdfjsLib.getDocument({ data })
  return task.promise
}

export { pdfjsLib }
