'use client'

import type { CellData, EdgeDir, MarkerDef } from '@/lib/types'
import type { BoundaryData } from '@/lib/engine-types'
import { baseDef, edgeDef, overlayDef } from '@/lib/constants'

const DIR_LABELS: Record<EdgeDir, string> = { N: 'North', S: 'South', E: 'East', W: 'West' }

function boundaryLabel(b: BoundaryData): string {
  if (b.door) return `Door (${b.door.state})`
  if (b.wall !== undefined) return edgeDef(b.wall).label
  if (b.blocked) return 'Impassable'
  if (b.damage) return 'Damage zone'
  return 'Boundary'
}

function boundaryColor(b: BoundaryData): string {
  if (b.door) return b.door.state === 'locked' ? '#ef4444' : '#b45309'
  if (b.wall !== undefined) return edgeDef(b.wall).color
  return 'rgba(228,228,231,0.95)'
}

export function CellTooltip({
  x,
  y,
  cell,
  isPlayer,
  customBase,
  customOverlay,
  cellBoundaries,
}: {
  x: number
  y: number
  cell: CellData
  isPlayer: boolean
  customBase?: Record<number, MarkerDef>
  customOverlay?: Record<number, MarkerDef>
  cellBoundaries?: Partial<Record<EdgeDir, BoundaryData>>
}) {
  const hasBoundaries = Object.keys(cellBoundaries ?? {}).length > 0
  const hasContent =
    isPlayer ||
    (cell.base ?? 0) !== 0 ||
    cell.overlays.length > 0 ||
    hasBoundaries ||
    !!cell.note

  if (!hasContent) return null

  const boundaries = Object.entries(cellBoundaries ?? {}) as [EdgeDir, BoundaryData][]
  const flipX = x > window.innerWidth - 220
  const flipY = y > window.innerHeight - 160

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: flipX ? x - 8 : x + 14,
        top: flipY ? y - 8 : y + 14,
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
      }}
    >
      <div className="bg-zinc-900 border border-white/15 rounded-lg shadow-xl px-3 py-2.5 min-w-[160px] max-w-[220px] space-y-1.5 text-xs">
        {isPlayer && (
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <span className="text-base leading-none">⊕</span> You are here
          </div>
        )}

        {(cell.base ?? 0) !== 0 && (
          <div className="text-white/80 font-medium flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: baseDef(cell.base, customBase).color }}
            />
            {baseDef(cell.base, customBase).label}
          </div>
        )}

        {boundaries.length > 0 && (
          <div className="space-y-0.5">
            {boundaries.map(([dir, b]) => (
              <div key={dir} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: boundaryColor(b) }} />
                <span className="text-white/60">
                  {DIR_LABELS[dir]}: {boundaryLabel(b)}
                </span>
              </div>
            ))}
          </div>
        )}

        {cell.overlays.length > 0 && (
          <div className="space-y-0.5">
            {cell.overlays.map((o) => {
              const def = overlayDef(o, customOverlay)
              return (
                <div key={o} className="flex items-center gap-1.5 text-white/60">
                  <span className="shrink-0" style={{ color: def?.color }}>
                    {def?.icon ?? '•'}
                  </span>
                  {def?.label ?? `Overlay ${o}`}
                </div>
              )
            })}
          </div>
        )}

        {cell.note && (
          <div className="border-t border-white/10 pt-1.5 text-white/70 italic leading-snug">&ldquo;{cell.note}&rdquo;</div>
        )}
      </div>
    </div>
  )
}
