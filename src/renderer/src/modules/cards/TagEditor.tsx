/**
 * A simple free-form tag editor: chips with remove buttons plus an input that
 * adds a tag on Enter or comma. Tags are plain strings shared across the set.
 */
import { useState, type KeyboardEvent } from 'react'

interface TagEditorProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

export function TagEditor({ tags, onChange }: TagEditorProps) {
  const [input, setInput] = useState('')

  /** Adds the typed tag (trimmed, de-duplicated) and clears the input. */
  const commit = (): void => {
    const value = input.trim()
    if (value && !tags.includes(value)) onChange([...tags, value])
    setInput('')
  }

  /** Enter/comma commit a tag; Backspace on empty input removes the last one. */
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent"
        >
          {tag}
          <button
            className="text-accent/70 hover:text-accent"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-[60px] flex-1 bg-transparent text-xs outline-none"
        placeholder="Add tag…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    </div>
  )
}
