'use client'

/**
 * Drag-to-resize width for side drawers. Returns [width, handleElement]:
 * spread the width into the panel's style and render the handle as the
 * panel's first child (the panel needs `relative`). Width persists per-id.
 */

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function usePanelWidth(
  id: string,
  side: 'left' | 'right',
  defaultWidth = 320,
  min = 260,
  max = 640,
): [number, React.ReactNode] {
  const storageKey = `epochmapper.panelw.${id}`
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth
    const saved = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(saved) && saved >= min && saved <= max ? saved : defaultWidth
  })
  const drag = useRef<{ startX: number; startW: number } | null>(null)

  const handle = (
    <div
      key="resize-handle"
      title="Drag to resize"
      onPointerDown={e => {
        drag.current = { startX: e.clientX, startW: width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.startX
        const w = Math.min(max, Math.max(min, drag.current.startW + (side === 'right' ? -dx : dx)))
        setWidth(w)
        try { window.localStorage.setItem(storageKey, String(w)) } catch { /* ignore */ }
      }}
      onPointerUp={e => {
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      className={cn(
        'absolute inset-y-0 z-20 w-1.5 cursor-col-resize hover:bg-amber-500/40 active:bg-amber-500/60 transition-colors',
        side === 'right' ? 'left-0' : 'right-0',
      )}
    />
  )

  return [width, handle]
}
