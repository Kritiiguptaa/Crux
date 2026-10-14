/**
 * The side panel listing the cards for the open document. It's a thin container:
 * it renders a header with the count and a scrollable list of CardItems, and
 * forwards edit/jump/delete actions to the app.
 */
import type { Card, UpdateCardInput } from '@shared/domain-types'
import { CardItem } from './CardItem'

interface CardPanelProps {
  cards: Card[]
  onJump: (card: Card) => void
  onUpdate: (input: UpdateCardInput) => void
  onDelete: (id: string) => void
}

export function CardPanel({ cards, onJump, onUpdate, onDelete }: CardPanelProps) {
  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-paper">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Cards</h2>
        <p className="text-xs text-subtle">{cards.length} on this document</p>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-3">
        {cards.length === 0 ? (
          <p className="px-1 pt-6 text-center text-xs text-subtle">
            Highlight text or capture an area in the document to create your first card.
          </p>
        ) : (
          cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onJump={onJump}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
