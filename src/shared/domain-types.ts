/**
 * Domain types shared across main, preload and renderer.
 *
 * These describe the core "capture once, use everywhere" model: a Card is the
 * single source of truth, and its Anchor says where it lives in a Document.
 * In later phases the same Card also gains a mind-map placement and an FSRS
 * review state — all projections of this one object.
 */

/** File formats a document can originate from. Only `pdf` is wired in Phase 1. */
export type DocumentKind = 'pdf' | 'pptx' | 'ppt'

/** The five highlight colors, which double as flashcard/node accent colors. */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

/** How a text selection turns into a card: text run, rectangular area, or typed by hand. */
export type CardKind = 'text' | 'area' | 'manual'

/** A subject folder grouping one or more documents. */
export interface StudySet {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** Convenience counts filled in by list queries (not stored). */
  documentCount: number
  cardCount: number
}

/** A registered source document, identified by content hash rather than path. */
export interface DocumentMeta {
  id: string
  /** SHA-256 of the original file bytes — the stable identity. */
  contentHash: string
  title: string
  kind: DocumentKind
  pageCount: number | null
  /** Last place we saw the file on disk; a hint for re-opening, never authoritative. */
  lastKnownPath: string | null
  createdAt: number
}

/**
 * A rectangle in normalized page coordinates: x/y/w/h each in 0..1 of the page
 * width/height, origin at the page's top-left. Normalizing makes the anchor
 * independent of zoom level and render scale.
 */
export interface NormRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Where a card lives in its document. We store both geometry (page + rects)
 * and text context (quoted text plus short prefix/suffix) so a highlight can be
 * re-located by text if coordinates ever drift.
 */
export interface Anchor {
  /** 1-based page (PDF) or slide (later) number. */
  pageOrSlide: number
  /** One rect per wrapped line for text selections; a single rect for area selections. */
  rects: NormRect[]
  /** The exact selected text, or null for area selections. */
  quotedText: string | null
  /** ~32 chars of text immediately before the selection, for re-anchoring. */
  prefix: string | null
  /** ~32 chars of text immediately after the selection, for re-anchoring. */
  suffix: string | null
  /** For area cards: relative path (under the app data dir) to the cropped PNG. */
  imagePath: string | null
}

/** The central object: one highlight = one card. */
export interface Card {
  id: string
  studySetId: string
  documentId: string
  kind: CardKind
  /** Optional short heading shown in lists; falls back to the body. */
  title: string | null
  /** The quoted/selected text, or the user's typed content for manual cards. */
  body: string
  /** The user's personal note. */
  note: string
  color: HighlightColor
  tags: string[]
  anchor: Anchor | null
  createdAt: number
  updatedAt: number
}

/** How a new highlight should become a card. */
export type CardCreationMode = 'ask' | 'auto' | 'manual'

/** User-configurable app settings (persisted in the database). */
export interface AppSettings {
  /** Whether highlighting prompts, auto-creates, or never auto-creates a card. */
  cardCreationMode: CardCreationMode
  defaultHighlightColor: HighlightColor
}

/** Input shapes for create/update operations (ids/timestamps are assigned by main). */
export interface CreateCardInput {
  studySetId: string
  documentId: string
  kind: CardKind
  title?: string | null
  body: string
  note?: string
  color?: HighlightColor
  tags?: string[]
  anchor?: Anchor | null
}

export interface UpdateCardInput {
  id: string
  title?: string | null
  body?: string
  note?: string
  color?: HighlightColor
  tags?: string[]
}
