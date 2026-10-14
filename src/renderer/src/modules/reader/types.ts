/** Reader-local types shared between the reader and the app shell. */
import type { Anchor, HighlightColor } from '@shared/domain-types'

/**
 * A proposed new card produced by the reader from a selection, before the app
 * decides whether to create it (auto / ask / manual). For area cards the PNG
 * bytes are carried here and persisted to disk by the app, which then fills in
 * the anchor's `imagePath`.
 */
export interface CardDraft {
  kind: 'text' | 'area'
  body: string
  color: HighlightColor
  anchor: Anchor
  /** For area selections only: the cropped PNG bytes to save. */
  pngBytes?: Uint8Array
}

/** A request to scroll the reader to a card's location and flash it. */
export interface JumpTarget {
  pageOrSlide: number
  /** A changing value so repeated jumps to the same card re-trigger the effect. */
  nonce: number
}
