/**
 * The document reader. Loads a PDF's bytes through the typed API, renders pages
 * in a scrollable column (only those near the viewport actually paint), and
 * turns the user's text or area selections into card drafts. A toolbar controls
 * zoom, the highlight color, and the rectangular "area" capture mode.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, CardCreationMode, HighlightColor, NormRect } from '@shared/domain-types'
import { api } from '@renderer/lib/api'
import { Button } from '@renderer/components/Button'
import { loadPdf, type PdfDocument } from './pdf'
import { PdfPage } from './PdfPage'
import { extractTextSelection } from './selection'
import { HIGHLIGHT_COLORS, HIGHLIGHT_HEX } from './colors'
import type { CardDraft, JumpTarget } from './types'

interface ReaderViewProps {
  documentId: string
  title: string
  cards: Card[]
  defaultColor: HighlightColor
  creationMode: CardCreationMode
  /** Called when the reader proposes a new card; the app applies the creation policy. */
  onDraft: (draft: CardDraft) => void
  jumpTarget: JumpTarget | null
  flashCardId: string | null
}

export function ReaderView({
  documentId,
  title,
  cards,
  defaultColor,
  creationMode,
  onDraft,
  jumpTarget,
  flashCardId
}: ReaderViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageEls = useRef<Map<number, HTMLElement>>(new Map())

  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [baseDims, setBaseDims] = useState<{ w: number; h: number }>({ w: 612, h: 792 })
  const [scale, setScale] = useState(1.25)
  const [areaMode, setAreaMode] = useState(false)
  const [color, setColor] = useState<HighlightColor>(defaultColor)
  const [visible, setVisible] = useState<Set<number>>(new Set([1, 2]))
  const [error, setError] = useState<string | null>(null)
  // When in manual mode, a pending draft waits behind a floating button.
  const [manual, setManual] = useState<{ draft: CardDraft; x: number; y: number } | null>(null)

  // Keep the active color in sync if the default changes in settings.
  useEffect(() => setColor(defaultColor), [defaultColor])

  // Group the document's cards by page so each page only gets its own overlays.
  const cardsByPage = useMemo(() => {
    const map = new Map<number, Card[]>()
    for (const card of cards) {
      const p = card.anchor?.pageOrSlide
      if (!p) continue
      const list = map.get(p) ?? []
      list.push(card)
      map.set(p, list)
    }
    return map
  }, [cards])

  // Load the PDF bytes and open the document.
  useEffect(() => {
    let cancelled = false
    setPdf(null)
    setError(null)
    setVisible(new Set([1, 2]))
    const run = async (): Promise<void> => {
      try {
        const bytes = await api.documents.getFileData({ documentId })
        const doc = await loadPdf(bytes)
        if (cancelled) return
        const first = await doc.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        if (cancelled) return
        setBaseDims({ w: vp.width, h: vp.height })
        setNumPages(doc.numPages)
        setPdf(doc)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [documentId])

  // Registers a page element so we can observe and scroll to it.
  const registerPage = useCallback((pageNumber: number, el: HTMLElement | null) => {
    if (el) pageEls.current.set(pageNumber, el)
    else pageEls.current.delete(pageNumber)
  }, [])

  // Observe page visibility so only near-viewport pages render.
  useEffect(() => {
    if (!pdf) return
    const root = scrollRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev)
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page)
            if (entry.isIntersecting) next.add(page)
          }
          return next
        })
      },
      { root, rootMargin: '600px 0px' }
    )
    for (const el of pageEls.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [pdf, numPages])

  // Scroll to and flash a page when a jump is requested.
  useEffect(() => {
    if (!jumpTarget) return
    const el = pageEls.current.get(jumpTarget.pageOrSlide)
    if (el) {
      setVisible((prev) => new Set(prev).add(jumpTarget.pageOrSlide))
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [jumpTarget])

  // Build a draft from the current text selection on mouse-up.
  const handleMouseUp = useCallback(
    (e: React.MouseEvent): void => {
      if (areaMode) return
      const selection = window.getSelection()
      // An empty/collapsed selection isn't a draft; dismiss any pending button.
      if (!selection || selection.isCollapsed) {
        setManual(null)
        return
      }
      for (const [pageNumber, el] of pageEls.current) {
        const result = extractTextSelection(selection, el)
        if (!result) continue
        const draft: CardDraft = {
          kind: 'text',
          body: result.text,
          color,
          anchor: {
            pageOrSlide: pageNumber,
            rects: result.rects,
            quotedText: result.text,
            prefix: result.prefix,
            suffix: result.suffix,
            imagePath: null
          }
        }
        if (creationMode === 'manual') {
          setManual({ draft, x: e.clientX, y: e.clientY })
        } else {
          onDraft(draft)
          selection.removeAllRanges()
        }
        return
      }
      // Selection didn't fall on any page — clear any stale pending button.
      setManual(null)
    },
    [areaMode, color, creationMode, onDraft]
  )

  // Build a draft from a completed area (rectangle) selection.
  const handleAreaComplete = useCallback(
    (pageNumber: number, pngBytes: Uint8Array, rect: NormRect): void => {
      const draft: CardDraft = {
        kind: 'area',
        body: '',
        color,
        pngBytes,
        anchor: {
          pageOrSlide: pageNumber,
          rects: [rect],
          quotedText: null,
          prefix: null,
          suffix: null,
          imagePath: null
        }
      }
      onDraft(draft)
    },
    [color, onDraft]
  )

  // Clicking an existing highlight scrolls/opens it via the shared jump handler.
  const handleHighlightClick = useCallback(
    (cardId: string): void => {
      const card = cards.find((c) => c.id === cardId)
      if (card?.anchor) {
        const el = pageEls.current.get(card.anchor.pageOrSlide)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },
    [cards]
  )

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-red-600">
        Could not open this document:<br />
        {error}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <span className="mr-2 max-w-[40%] truncate text-sm font-semibold text-ink" title={title}>
          {title}
        </span>
        <Button variant="ghost" onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}>
          −
        </Button>
        <span className="w-12 text-center text-xs text-subtle">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" onClick={() => setScale((s) => Math.min(3, s + 0.15))}>
          +
        </Button>

        <div className="mx-2 h-5 w-px bg-gray-200" />

        <Button
          variant={areaMode ? 'primary' : 'secondary'}
          onClick={() => setAreaMode((v) => !v)}
          title="Capture a rectangular area (diagrams, formulas)"
        >
          ▭ Area
        </Button>

        <div className="mx-2 h-5 w-px bg-gray-200" />

        {/* Highlight color picker */}
        <div className="flex items-center gap-1">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`h-5 w-5 rounded-full border ${
                color === c ? 'border-ink ring-2 ring-accent' : 'border-gray-300'
              }`}
              style={{ backgroundColor: HIGHLIGHT_HEX[c] }}
            />
          ))}
        </div>

        <span className="ml-auto text-xs text-subtle">
          {numPages > 0 ? `${numPages} pages` : ''}
        </span>
      </div>

      {/* Pages */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto bg-gray-100" onMouseUp={handleMouseUp}>
        {!pdf && (
          <div className="flex h-full items-center justify-center text-subtle">Loading document…</div>
        )}
        {pdf &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
            <PdfPage
              key={pageNumber}
              pdf={pdf}
              pageNumber={pageNumber}
              scale={scale}
              visible={visible.has(pageNumber)}
              areaMode={areaMode}
              baseWidth={baseDims.w}
              baseHeight={baseDims.h}
              cards={cardsByPage.get(pageNumber) ?? []}
              flashCardId={flashCardId}
              onRegister={registerPage}
              onAreaComplete={handleAreaComplete}
              onHighlightClick={handleHighlightClick}
            />
          ))}
      </div>

      {/* Manual-mode floating "add card" button near the selection. */}
      {manual && (
        <button
          className="fixed z-40 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-lg"
          style={{ left: manual.x + 8, top: manual.y + 8 }}
          onClick={() => {
            onDraft(manual.draft)
            window.getSelection()?.removeAllRanges()
            setManual(null)
          }}
        >
          ＋ Add card
        </button>
      )}
    </div>
  )
}
