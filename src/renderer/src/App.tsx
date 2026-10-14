/**
 * The application shell. Holds the top-level state (study sets, the open
 * document, its cards, and settings), wires the sidebar, reader and card panel
 * together, and applies the card-creation policy (auto / ask / manual) when the
 * reader proposes a new card.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppSettings,
  Card,
  DocumentMeta,
  StudySet,
  UpdateCardInput
} from '@shared/domain-types'
import { api } from './lib/api'
import { StudySetSidebar } from './modules/studysets/StudySetSidebar'
import { ReaderView } from './modules/reader/ReaderView'
import { CardPanel } from './modules/cards/CardPanel'
import { ConfirmCardDialog } from './modules/cards/ConfirmCardDialog'
import { SettingsModal } from './modules/settings/SettingsModal'
import type { CardDraft, JumpTarget } from './modules/reader/types'

export default function App() {
  const [studySets, setStudySets] = useState<StudySet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    cardCreationMode: 'ask',
    defaultHighlightColor: 'yellow'
  })

  const [pendingDraft, setPendingDraft] = useState<CardDraft | null>(null)
  const [jumpTarget, setJumpTarget] = useState<JumpTarget | null>(null)
  const [flashCardId, setFlashCardId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // --- Loaders ---

  /** Reloads all study sets (with their counts). */
  const refreshSets = useCallback(async (): Promise<void> => {
    setStudySets(await api.studySets.list())
  }, [])

  /** Reloads the documents of the selected study set. */
  const refreshDocuments = useCallback(async (): Promise<void> => {
    if (!selectedSetId) {
      setDocuments([])
      return
    }
    setDocuments(await api.studySets.documents({ id: selectedSetId }))
  }, [selectedSetId])

  /** Reloads the cards for the open document within the selected set. */
  const refreshCards = useCallback(async (): Promise<void> => {
    if (!selectedSetId || !selectedDocId) {
      setCards([])
      return
    }
    setCards(
      await api.cards.listByDocument({ studySetId: selectedSetId, documentId: selectedDocId })
    )
  }, [selectedSetId, selectedDocId])

  // Initial load: settings + study sets.
  useEffect(() => {
    void (async () => {
      setSettings(await api.settings.get())
      await refreshSets()
    })()
  }, [refreshSets])

  // When the selected set changes, load its documents and reset the open doc.
  useEffect(() => {
    setSelectedDocId(null)
    void refreshDocuments()
  }, [selectedSetId, refreshDocuments])

  // When the open document changes, load its cards.
  useEffect(() => {
    void refreshCards()
  }, [selectedDocId, refreshCards])

  // --- Study set actions ---

  const handleCreateSet = useCallback(
    async (name: string): Promise<void> => {
      const set = await api.studySets.create({ name })
      await refreshSets()
      setSelectedSetId(set.id)
    },
    [refreshSets]
  )

  const handleRenameSet = useCallback(
    async (id: string, name: string): Promise<void> => {
      await api.studySets.rename({ id, name })
      await refreshSets()
    },
    [refreshSets]
  )

  const handleDeleteSet = useCallback(
    async (id: string): Promise<void> => {
      await api.studySets.delete({ id })
      if (selectedSetId === id) setSelectedSetId(null)
      await refreshSets()
    },
    [refreshSets, selectedSetId]
  )

  // --- Document actions ---

  const handleAddDocument = useCallback(async (): Promise<void> => {
    if (!selectedSetId) return
    const meta = await api.documents.import({ studySetId: selectedSetId })
    if (meta) {
      await refreshDocuments()
      await refreshSets()
      setSelectedDocId(meta.id)
    }
  }, [selectedSetId, refreshDocuments, refreshSets])

  // --- Card creation policy ---

  /** Persists a draft as a card (saving the area image first if present). */
  const createFromDraft = useCallback(
    async (draft: CardDraft): Promise<void> => {
      if (!selectedSetId || !selectedDocId) return
      try {
        let imagePath: string | null = draft.anchor.imagePath
        if (draft.kind === 'area' && draft.pngBytes) {
          imagePath = await api.cards.saveAreaImage({
            documentId: selectedDocId,
            pngBytes: draft.pngBytes
          })
        }
        await api.cards.create({
          studySetId: selectedSetId,
          documentId: selectedDocId,
          kind: draft.kind,
          body: draft.body,
          color: draft.color,
          anchor: { ...draft.anchor, imagePath }
        })
        await refreshCards()
        await refreshSets()
      } catch (err) {
        // Surface the failure instead of silently dropping the card.
        console.error('Failed to create card:', err)
        window.alert('Sorry — that card could not be saved. Please try again.')
      }
    },
    [selectedSetId, selectedDocId, refreshCards, refreshSets]
  )

  /** The reader proposes a card; apply the current creation mode. */
  const handleDraft = useCallback(
    (draft: CardDraft): void => {
      if (settings.cardCreationMode === 'ask') {
        setPendingDraft(draft)
      } else {
        // 'auto' fires here directly; 'manual' only reaches this after the user
        // clicked the floating "Add card" button, so creating is correct too.
        void createFromDraft(draft)
      }
    },
    [settings.cardCreationMode, createFromDraft]
  )

  // --- Card edit / delete / jump ---

  const handleUpdate = useCallback(
    async (input: UpdateCardInput): Promise<void> => {
      await api.cards.update(input)
      await refreshCards()
    },
    [refreshCards]
  )

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      await api.cards.delete({ id })
      await refreshCards()
      await refreshSets()
    },
    [refreshCards, refreshSets]
  )

  /** Jump the reader to a card's spot and flash it briefly. */
  const handleJump = useCallback((card: Card): void => {
    if (!card.anchor) return
    setJumpTarget({ pageOrSlide: card.anchor.pageOrSlide, nonce: Date.now() })
    setFlashCardId(card.id)
    window.setTimeout(() => setFlashCardId(null), 2600)
  }, [])

  // --- Settings ---

  const handleSettingsChange = useCallback(async (patch: Partial<AppSettings>): Promise<void> => {
    const updated = await api.settings.set(patch)
    setSettings(updated)
  }, [])

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) ?? null,
    [documents, selectedDocId]
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <StudySetSidebar
        studySets={studySets}
        selectedSetId={selectedSetId}
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectSet={setSelectedSetId}
        onCreateSet={handleCreateSet}
        onRenameSet={handleRenameSet}
        onDeleteSet={handleDeleteSet}
        onAddDocument={handleAddDocument}
        onSelectDoc={setSelectedDocId}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-w-0 flex-1">
        {selectedDoc ? (
          <>
            <div className="min-w-0 flex-1">
              <ReaderView
                documentId={selectedDoc.id}
                title={selectedDoc.title}
                cards={cards}
                defaultColor={settings.defaultHighlightColor}
                creationMode={settings.cardCreationMode}
                onDraft={handleDraft}
                jumpTarget={jumpTarget}
                flashCardId={flashCardId}
              />
            </div>
            <div className="w-96 shrink-0">
              <CardPanel
                cards={cards}
                onJump={handleJump}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-subtle">
            <div>
              <p className="text-lg font-medium text-ink">Welcome to EasyPeasy</p>
              <p className="mt-1 text-sm">
                {selectedSetId
                  ? 'Add a PDF to this study set, then open it to start highlighting.'
                  : 'Create or pick a study set on the left to begin.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <ConfirmCardDialog
        draft={pendingDraft}
        onAllowOnce={() => {
          if (pendingDraft) void createFromDraft(pendingDraft)
          setPendingDraft(null)
          window.getSelection()?.removeAllRanges()
        }}
        onAlwaysAllow={() => {
          void handleSettingsChange({ cardCreationMode: 'auto' })
          if (pendingDraft) void createFromDraft(pendingDraft)
          setPendingDraft(null)
          window.getSelection()?.removeAllRanges()
        }}
        onCancel={() => {
          setPendingDraft(null)
          window.getSelection()?.removeAllRanges()
        }}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={handleSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
