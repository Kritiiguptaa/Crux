/**
 * One card in the side panel. Shows the captured text (or area image), an
 * editable title and note, tags, a color picker, a jump-back link to the exact
 * spot in the document, and delete. Edits are committed on blur so typing stays
 * snappy and the database isn't hit on every keystroke.
 */
import { useEffect, useState } from 'react'
import type { Card, HighlightColor, UpdateCardInput } from '@shared/domain-types'
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX } from '@renderer/modules/reader/colors'
import { AreaImage } from './AreaImage'
import { TagEditor } from './TagEditor'

interface CardItemProps {
  card: Card
  onJump: (card: Card) => void
  onUpdate: (input: UpdateCardInput) => void
  onDelete: (id: string) => void
}

export function CardItem({ card, onJump, onUpdate, onDelete }: CardItemProps) {
  // Local editable copies; synced from props when the card changes identity.
  const [title, setTitle] = useState(card.title ?? '')
  const [note, setNote] = useState(card.note)

  useEffect(() => {
    setTitle(card.title ?? '')
    setNote(card.note)
  }, [card.id, card.title, card.note])

  return (
    <div className="rounded-card border border-gray-200 bg-white shadow-sm">
      {/* Color stripe on the left edge. */}
      <div className="flex">
        <div
          className="w-1.5 shrink-0 rounded-l-card"
          style={{ backgroundColor: HIGHLIGHT_HEX[card.color] }}
        />
        <div className="flex-1 space-y-2 p-3">
          {/* Captured content */}
          {card.kind === 'area' && card.anchor?.imagePath ? (
            <AreaImage
              imagePath={card.anchor.imagePath}
              className="max-h-40 w-full rounded border border-gray-100 object-contain"
            />
          ) : (
            <p className="text-sm leading-snug text-ink">{card.body}</p>
          )}

          {/* Title */}
          <input
            className="w-full border-b border-transparent pb-0.5 text-xs font-semibold text-ink outline-none focus:border-gray-200"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== (card.title ?? '')) onUpdate({ id: card.id, title: title || null })
            }}
          />

          {/* Personal note */}
          <textarea
            className="w-full resize-y rounded-md border border-gray-200 p-2 text-xs text-ink outline-none focus:border-accent"
            rows={2}
            placeholder="Your note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== card.note) onUpdate({ id: card.id, note })
            }}
          />

          {/* Tags */}
          <TagEditor tags={card.tags} onChange={(tags) => onUpdate({ id: card.id, tags })} />

          {/* Footer: color picker, jump, delete */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((c: HighlightColor) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ id: card.id, color: c })}
                  title={c}
                  className={`h-4 w-4 rounded-full border ${
                    card.color === c ? 'border-ink' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: HIGHLIGHT_HEX[c] }}
                />
              ))}
            </div>
            <button
              className="ml-auto text-xs font-medium text-accent hover:underline"
              onClick={() => onJump(card)}
              title={`Go to page ${card.anchor?.pageOrSlide ?? '?'}`}
            >
              ↩ p.{card.anchor?.pageOrSlide ?? '?'}
            </button>
            <button
              className="text-xs text-subtle hover:text-red-600"
              onClick={() => onDelete(card.id)}
              aria-label="Delete card"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
