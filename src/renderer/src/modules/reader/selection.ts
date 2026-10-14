/**
 * Geometry helpers that convert a browser text selection into our robust,
 * zoom-independent anchor model (normalized rects + quoted text + surrounding
 * context). All rects are expressed as fractions of the page box so they map
 * back onto the page at any scale.
 */
import type { NormRect } from '@shared/domain-types'

/** Number of characters of context captured on each side of a selection. */
const CONTEXT_CHARS = 32

/** Converts a client-space rect into page-relative normalized coordinates. */
function normalizeRect(rect: DOMRect, pageBox: DOMRect): NormRect {
  return {
    x: (rect.left - pageBox.left) / pageBox.width,
    y: (rect.top - pageBox.top) / pageBox.height,
    w: rect.width / pageBox.width,
    h: rect.height / pageBox.height
  }
}

/** True if a selection rect meaningfully overlaps the given page box. */
function intersectsPage(rect: DOMRect, pageBox: DOMRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.left < pageBox.right &&
    rect.right > pageBox.left &&
    rect.top < pageBox.bottom &&
    rect.bottom > pageBox.top
  )
}

/** The data extracted from a completed text selection on one page. */
export interface TextSelectionResult {
  text: string
  rects: NormRect[]
  prefix: string
  suffix: string
}

/**
 * Extracts a text selection confined to a single page element. Returns null if
 * the selection is empty or lies outside the page. Rects come from the
 * selection's client rects (one per wrapped line); prefix/suffix are pulled
 * from the page's full text so the highlight can be re-found by text later.
 */
export function extractTextSelection(
  selection: Selection,
  pageEl: HTMLElement
): TextSelectionResult | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null
  const text = selection.toString().trim()
  if (!text) return null

  const range = selection.getRangeAt(0)
  // Ignore selections that don't touch this page.
  if (!pageEl.contains(range.commonAncestorContainer) &&
      !range.intersectsNode(pageEl)) {
    return null
  }

  const pageBox = pageEl.getBoundingClientRect()
  const rects: NormRect[] = []
  for (const rect of Array.from(range.getClientRects())) {
    if (intersectsPage(rect, pageBox)) rects.push(normalizeRect(rect, pageBox))
  }
  if (rects.length === 0) return null

  const { prefix, suffix } = extractContext(pageEl, text)
  return { text, rects, prefix, suffix }
}

/**
 * Finds short context strings around the selected text within the page's full
 * textContent, so re-anchoring can disambiguate repeated phrases. Falls back to
 * empty strings if the text can't be located (e.g. spanning odd whitespace).
 */
function extractContext(pageEl: HTMLElement, text: string): { prefix: string; suffix: string } {
  const full = (pageEl.textContent ?? '').replace(/\s+/g, ' ')
  const needle = text.replace(/\s+/g, ' ')
  const idx = full.indexOf(needle)
  if (idx < 0) return { prefix: '', suffix: '' }
  const prefix = full.slice(Math.max(0, idx - CONTEXT_CHARS), idx)
  const suffix = full.slice(idx + needle.length, idx + needle.length + CONTEXT_CHARS)
  return { prefix, suffix }
}

/** Normalizes a freehand drag rectangle (in client space) against a page box. */
export function normalizeDragRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
  pageBox: DOMRect
): NormRect {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  return {
    x: (left - pageBox.left) / pageBox.width,
    y: (top - pageBox.top) / pageBox.height,
    w: width / pageBox.width,
    h: height / pageBox.height
  }
}
