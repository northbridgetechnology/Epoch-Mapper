'use client'

import type { CellData, EdgeDir, MarkerDef, SubcubeObject } from '@/lib/types'
import type { BoundaryData, CellEntity } from '@/lib/engine-types'
import { baseDef, edgeDef, overlayDef } from '@/lib/constants'
import { getSubcubeDef } from '@/lib/subcube-defs'

const DIR_LABELS: Record<EdgeDir, string> = { N: 'North', S: 'South', E: 'East', W: 'West' }

const ENTITY_ICONS: Record<CellEntity['t'], string> = {
  encounter: '⚔️',
  partyStart: '🏁',
  mapLink: '🚪',
  object: '📦',
  event: '⚡',
}

function entityLabel(ent: CellEntity): string {
  switch (ent.t) {
    case 'encounter': return `Encounter Zone`
    case 'partyStart': return 'Party Start'
    case 'mapLink': return 'Map Link'
    case 'object': return ent.object.kind.charAt(0).toUpperCase() + ent.object.kind.slice(1)
    case 'event': return `Event (${ent.event.trigger})`
  }
}

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

function posLabel(pos: SubcubeObject['pos']): string {
  return `${['Floor', 'Mid', 'Ceil'][pos.y]} ${['W', 'C', 'E'][pos.x]} ${['Near', 'C', 'Far'][pos.z]}`
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
    !!cell.note ||
    !!cell.entities?.length ||
    !!cell.subcubeObjects?.length

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

        {cell.entities && cell.entities.length > 0 && (
          <div className="space-y-0.5">
            {cell.entities.map((ent, i) => (
              <div key={i} className="flex items-center gap-1.5 text-white/60">
                <span className="shrink-0">{ENTITY_ICONS[ent.t]}</span>
                {entityLabel(ent)}
              </div>
            ))}
          </div>
        )}

        {cell.subcubeObjects && cell.subcubeObjects.length > 0 && (
          <div className="space-y-0.5">
            <div className="text-white/35 text-[10px] uppercase tracking-wide">Volume Objects</div>
            {cell.subcubeObjects.map((obj) => {
              const def = getSubcubeDef(obj.kind)
              return (
                <div key={obj.id} className="flex items-start gap-1.5 text-white/60">
                  <span className="shrink-0 mt-px" style={{ color: def?.color }}>{def?.icon ?? '•'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{def?.label ?? obj.kind}</div>
                    <div className="text-[9px] text-white/35">
                      {posLabel(obj.pos)}{obj.trigger ? ` · ${obj.trigger}` : ''}
                    </div>
                  </div>
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
