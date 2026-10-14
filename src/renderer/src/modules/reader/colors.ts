/** Shared highlight color values for overlays and UI chips (light theme). */
import type { HighlightColor } from '@shared/domain-types'

/** Solid hex per color, for swatches and card accents. */
export const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#ffe066',
  green: '#b2f2bb',
  blue: '#a5d8ff',
  pink: '#ffc9c9',
  purple: '#d0bfff'
}

/** Semi-transparent per color, for highlight overlays drawn over the page. */
export const HIGHLIGHT_RGBA: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 224, 102, 0.40)',
  green: 'rgba(178, 242, 187, 0.45)',
  blue: 'rgba(165, 216, 255, 0.45)',
  pink: 'rgba(255, 201, 201, 0.45)',
  purple: 'rgba(208, 191, 255, 0.45)'
}

/** The ordered list of colors for pickers. */
export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple']
