/**
 * Left sidebar: the list of study sets and, under the selected one, its
 * documents. Supports creating/renaming/deleting sets, adding a document
 * (native file picker via the API), and selecting a document to open.
 */
import { useState } from 'react'
import type { DocumentMeta, StudySet } from '@shared/domain-types'
import { Button } from '@renderer/components/Button'

interface StudySetSidebarProps {
  studySets: StudySet[]
  selectedSetId: string | null
  documents: DocumentMeta[]
  selectedDocId: string | null
  onSelectSet: (id: string) => void
  onCreateSet: (name: string) => void
  onRenameSet: (id: string, name: string) => void
  onDeleteSet: (id: string) => void
  onAddDocument: () => void
  onSelectDoc: (id: string) => void
  onOpenSettings: () => void
}

export function StudySetSidebar({
  studySets,
  selectedSetId,
  documents,
  selectedDocId,
  onSelectSet,
  onCreateSet,
  onRenameSet,
  onDeleteSet,
  onAddDocument,
  onSelectDoc,
  onOpenSettings
}: StudySetSidebarProps) {
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  /** Creates a set from the input box if non-empty, then clears it. */
  const submitNew = (): void => {
    const name = newName.trim()
    if (name) onCreateSet(name)
    setNewName('')
  }

  return (
    <div className="flex h-full w-72 flex-col border-r border-gray-200 bg-white">
      {/* Brand + settings */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold text-accent">EasyPeasy</span>
        <button
          className="rounded p-1 text-subtle hover:bg-gray-100"
          title="Settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </div>

      {/* New study set */}
      <div className="flex gap-1 px-3 pb-2">
        <input
          className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-accent"
          placeholder="New study set…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitNew()}
        />
        <Button variant="primary" onClick={submitNew}>
          +
        </Button>
      </div>

      {/* Study set list */}
      <div className="flex-1 overflow-auto px-2">
        {studySets.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-subtle">
            Create a study set to get started.
          </p>
        )}
        {studySets.map((set) => {
          const isSelected = set.id === selectedSetId
          return (
            <div key={set.id} className="mb-1">
              <div
                className={`group flex items-center gap-1 rounded-md px-2 py-1.5 ${
                  isSelected ? 'bg-accent-soft' : 'hover:bg-gray-50'
                }`}
              >
                {renamingId === set.id ? (
                  <input
                    autoFocus
                    className="flex-1 rounded border border-gray-200 px-1 text-sm outline-none"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        // Ignore a blank rename; keep the existing name.
                        const name = renameText.trim()
                        if (name) onRenameSet(set.id, name)
                        setRenamingId(null)
                      } else if (e.key === 'Escape') {
                        setRenamingId(null)
                      }
                    }}
                    onBlur={() => setRenamingId(null)}
                  />
                ) : (
                  <button
                    className="flex-1 truncate text-left text-sm font-medium text-ink"
                    onClick={() => onSelectSet(set.id)}
                  >
                    {set.name}
                    <span className="ml-1 text-xs font-normal text-subtle">
                      ({set.documentCount} · {set.cardCount})
                    </span>
                  </button>
                )}
                <button
                  className="hidden rounded p-0.5 text-xs text-subtle hover:bg-gray-200 group-hover:block"
                  title="Rename"
                  onClick={() => {
                    setRenamingId(set.id)
                    setRenameText(set.name)
                  }}
                >
                  ✎
                </button>
                <button
                  className="hidden rounded p-0.5 text-xs text-subtle hover:bg-gray-200 group-hover:block"
                  title="Delete study set"
                  onClick={() => {
                    if (confirm(`Delete “${set.name}” and its cards? Documents stay registered.`)) {
                      onDeleteSet(set.id)
                    }
                  }}
                >
                  🗑
                </button>
              </div>

              {/* Documents under the selected set */}
              {isSelected && (
                <div className="ml-2 mt-1 border-l border-gray-100 pl-2">
                  {documents.map((doc) => (
                    <button
                      key={doc.id}
                      className={`block w-full truncate rounded px-2 py-1 text-left text-sm ${
                        doc.id === selectedDocId
                          ? 'bg-accent text-white'
                          : 'text-ink hover:bg-gray-50'
                      }`}
                      onClick={() => onSelectDoc(doc.id)}
                      title={doc.title}
                    >
                      📄 {doc.title}
                    </button>
                  ))}
                  <button
                    className="mt-1 w-full rounded px-2 py-1 text-left text-xs font-medium text-accent hover:bg-accent-soft"
                    onClick={onAddDocument}
                  >
                    ＋ Add PDF…
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
