/**
 * Renders a single PDF page: a canvas for the pixels, an invisible pdf.js text
 * layer on top for native text selection, and absolutely-positioned overlays
 * for existing highlights. When area mode is on, dragging on the page draws a
 * rectangle and, on release, crops that region of the canvas to a PNG.
 */
import { useEffect, useRef, useState } from 'react'
import type { Card, NormRect } from '@shared/domain-types'
import { pdfjsLib, type PdfDocument } from './pdf'
import { normalizeDragRect } from './selection'
import { HIGHLIGHT_RGBA } from './colors'

interface PdfPageProps {
  pdf: PdfDocument
  pageNumber: number
  scale: number
  visible: boolean
  areaMode: boolean
  /** Base (scale-1) page size, used to reserve layout space before render. */
  baseWidth: number
  baseHeight: number
  cards: Card[]
  /** Card id currently being flashed after a jump-back, if any. */
  flashCardId: string | null
  onRegister: (pageNumber: number, el: HTMLElement | null) => void
  onAreaComplete: (pageNumber: number, pngBytes: Uint8Array, rect: NormRect) => void
  onHighlightClick: (cardId: string) => void
}

/** Converts a normalized rect into CSS percentage positioning. */
function rectStyle(r: NormRect): React.CSSProperties {
  return {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`
  }
}

export function PdfPage({
  pdf,
  pageNumber,
  scale,
  visible,
  areaMode,
  baseWidth,
  baseHeight,
  cards,
  flashCardId,
  onRegister,
  onAreaComplete,
  onHighlightClick
}: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const [rendered, setRendered] = useState(false)
  // In-progress area drag, in client coordinates.
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null)

  const displayWidth = baseWidth * scale
  const displayHeight = baseHeight * scale

  // Register/unregister this page's element so the reader can scroll to it.
  useEffect(() => {
    onRegister(pageNumber, wrapperRef.current)
    return () => onRegister(pageNumber, null)
  }, [pageNumber, onRegister])

  // Render the canvas and text layer when the page is visible or the scale changes.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    // Structural types so we don't depend on pdf.js's exported class names.
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null
    let textLayerInstance: { cancel: () => void } | null = null

    const run = async (): Promise<void> => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        const textLayer = textLayerRef.current
        if (!canvas || !textLayer) return

        // Size the canvas in device pixels for crisp rendering, CSS in layout px.
        canvas.width = Math.floor(viewport.width * dpr)
        canvas.height = Math.floor(viewport.height * dpr)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        // pdf.js positions the text layer with calc(var(--scale-factor) * …). If
        // this CSS variable is unset the text boxes collapse to a default size and
        // no longer align with the glyphs, which makes selection grab the wrong
        // text. It must equal the viewport scale (device pixel ratio is handled
        // separately by pdf.js for its own measurements).
        textLayer.style.setProperty('--scale-factor', String(scale))

        renderTask = page.render({ canvasContext: ctx, viewport })
        await renderTask.promise
        if (cancelled) return

        // (Re)build the text layer for selection.
        textLayer.replaceChildren()
        const textContent = await page.getTextContent()
        if (cancelled) return
        const layer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport
        })
        textLayerInstance = layer
        await layer.render()
        if (!cancelled) setRendered(true)
      } catch {
        // The canvas render or text-layer build was cancelled (the effect re-ran
        // on scale/visibility change) or the page failed to load; in every case
        // there's nothing to show for this attempt, so swallow it.
      }
    }
    void run()

    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayerInstance?.cancel()
    }
  }, [pdf, pageNumber, scale, visible])

  // --- Area selection: draw a rectangle, then crop the canvas on release. ---

  /** Begins an area drag at the pointer position (area mode only). */
  const onPointerDown = (e: React.PointerEvent): void => {
    if (!areaMode) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag({ start: { x: e.clientX, y: e.clientY }, end: { x: e.clientX, y: e.clientY } })
  }

  /** Updates the drag rectangle as the pointer moves. */
  const onPointerMove = (e: React.PointerEvent): void => {
    if (!areaMode || !drag) return
    setDrag({ start: drag.start, end: { x: e.clientX, y: e.clientY } })
  }

  /** Finishes the drag: crops the canvas region to PNG and reports it up. */
  const onPointerUp = (): void => {
    if (!areaMode || !drag) return
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) {
      setDrag(null)
      return
    }
    const pageBox = wrapper.getBoundingClientRect()
    const rect = normalizeDragRect(drag.start, drag.end, pageBox)
    setDrag(null)
    if (rect.w < 0.01 || rect.h < 0.01) return // ignore stray clicks

    // Map the normalized rect onto the canvas's device-pixel space and crop.
    const sx = rect.x * canvas.width
    const sy = rect.y * canvas.height
    const sw = rect.w * canvas.width
    const sh = rect.h * canvas.height
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(sw))
    out.height = Math.max(1, Math.round(sh))
    const octx = out.getContext('2d')
    if (!octx) return
    octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height)
    out.toBlob((blob) => {
      if (!blob) return
      blob.arrayBuffer().then((buf) => {
        onAreaComplete(pageNumber, new Uint8Array(buf), rect)
      })
    }, 'image/png')
  }

  // Compute the live drag rectangle in page-relative percentages for preview.
  let dragStyle: React.CSSProperties | null = null
  if (drag && wrapperRef.current) {
    const r = normalizeDragRect(drag.start, drag.end, wrapperRef.current.getBoundingClientRect())
    dragStyle = rectStyle(r)
  }

  return (
    <div
      ref={wrapperRef}
      data-page={pageNumber}
      className="relative mx-auto my-4 bg-white shadow-md"
      style={{ width: displayWidth, height: displayHeight }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas ref={canvasRef} className="block" />
      {/* Text layer sits exactly over the canvas for selection. */}
      <div
        ref={textLayerRef}
        className="textLayer"
        style={{ pointerEvents: areaMode ? 'none' : 'auto' }}
      />

      {/* Existing highlight overlays for this page. */}
      {cards.map((card) =>
        (card.anchor?.rects ?? []).map((r, i) => (
          <div
            key={`${card.id}-${i}`}
            className={`absolute cursor-pointer rounded-sm ${
              flashCardId === card.id ? 'flash' : ''
            }`}
            style={{ ...rectStyle(r), backgroundColor: HIGHLIGHT_RGBA[card.color] }}
            title={card.title ?? card.body}
            onClick={() => onHighlightClick(card.id)}
          />
        ))
      )}

      {/* Live area-drag preview. */}
      {dragStyle && (
        <div
          className="absolute border-2 border-accent bg-accent/10"
          style={dragStyle}
        />
      )}

      {/* Page number badge. */}
      <div className="absolute -top-3 left-1 rounded bg-ink/70 px-1.5 text-[10px] text-white">
        {pageNumber}
      </div>

      {!rendered && visible && (
        <div className="absolute inset-0 flex items-center justify-center text-subtle">
          Rendering…
        </div>
      )}
    </div>
  )
}
