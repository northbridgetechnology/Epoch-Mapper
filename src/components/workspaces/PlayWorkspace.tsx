'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { baseDef, overlayDef, edgeDef, DEFAULT_CELL, MIN_CELL, MAX_CELL } from '@/lib/constants'
import type { CellData, MapData, MarkerDef, EdgeDir } from '@/lib/types'
import type { Character } from '@/lib/engine-types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlayWorkspaceProps {
  activeMap: MapData | null
  party: Character[]
  gold: number
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  onMovePlayer: (dx: number, dy: number) => void
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const EMPTY_CELL: CellData = { base: 0, overlays: [], edges: {} }

function EdgeStripe({ dir, type, cellSize }: { dir: EdgeDir; type: number; cellSize: number }) {
  const color = edgeDef(type).color
  const w = Math.max(2, Math.round(cellSize / 8))
  const gap = Math.round(cellSize * 0.18)
  const s: React.CSSProperties = { position: 'absolute', backgroundColor: color, pointerEvents: 'none' }
  if (dir === 'N') Object.assign(s, { top: 0, left: gap, right: gap, height: w })
  if (dir === 'S') Object.assign(s, { bottom: 0, left: gap, right: gap, height: w })
  if (dir === 'W') Object.assign(s, { left: 0, top: gap, bottom: gap, width: w })
  if (dir === 'E') Object.assign(s, { right: 0, top: gap, bottom: gap, width: w })
  return <div style={s} />
}

// ── HP/MP bar ─────────────────────────────────────────────────────────────────

function StatBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-300', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Party HUD ─────────────────────────────────────────────────────────────────

function PartyHud({ party, gold }: { party: Character[]; gold: number }) {
  if (party.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-white/30 italic">
        No party — build one in the Party workspace
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 overflow-x-auto flex-shrink-0">
      {party.map((char) => {
        const hpPct = char.maxHp > 0 ? char.hp / char.maxHp : 0
        const hpColor = !char.alive || char.hp === 0
          ? 'bg-zinc-600'
          : hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-400' : 'bg-red-500'
        const dead = !char.alive || char.hp === 0
        return (
          <div
            key={char.id}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 min-w-[140px] flex-shrink-0',
              dead ? 'border-white/8 bg-zinc-900/40 opacity-50' : 'border-white/12 bg-zinc-900/70',
            )}
          >
            <span className="text-xl leading-none flex-shrink-0">{char.portrait ?? '🧑'}</span>
            <div className="flex-1 min-w-0">
              <div className={cn('text-xs font-semibold truncate', dead ? 'text-white/30 line-through' : 'text-white/80')}>
                {char.name}
                <span className="ml-1 text-[10px] font-normal text-white/30">Lv{char.level}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] text-red-400/60 w-4 flex-shrink-0">HP</span>
                <StatBar value={char.hp} max={char.maxHp} colorClass={hpColor} />
                <span className="text-[9px] tabular-nums text-white/30 w-9 text-right flex-shrink-0">
                  {dead ? 'KO' : `${char.hp}/${char.maxHp}`}
                </span>
              </div>
              {char.maxMp > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-sky-400/60 w-4 flex-shrink-0">MP</span>
                  <StatBar value={char.mp} max={char.maxMp} colorClass="bg-sky-500" />
                  <span className="text-[9px] tabular-nums text-white/30 w-9 text-right flex-shrink-0">
                    {char.mp}/{char.maxMp}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Gold display */}
      <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-950/20 flex-shrink-0">
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300 tabular-nums">{gold}</span>
      </div>
    </div>
  )
}

// ── D-pad ─────────────────────────────────────────────────────────────────────

function DPad({ onMove }: { onMove: (dx: number, dy: number) => void }) {
  const btn = (dx: number, dy: number, icon: React.ReactNode) => (
    <button
      onClick={() => onMove(dx, dy)}
      className="w-9 h-9 grid place-items-center rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-white/10 text-white/60 hover:text-white transition-colors"
    >
      {icon}
    </button>
  )
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 flex-shrink-0">
      <div />{btn(0, -1, <ArrowUp className="w-4 h-4" />)}<div />
      {btn(-1, 0, <ArrowLeft className="w-4 h-4" />)}
      <div className="w-9 h-9 grid place-items-center text-white/15 text-xs">⊕</div>
      {btn(1, 0, <ArrowRight className="w-4 h-4" />)}
      <div />{btn(0, 1, <ArrowDown className="w-4 h-4" />)}<div />
    </div>
  )
}

// ── Dungeon viewport ──────────────────────────────────────────────────────────

function DungeonViewport({
  map,
  cellSize,
  customBase,
  customOverlay,
  isCellRevealed,
}: {
  map: MapData
  cellSize: number
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)
  const [availH, setAvailH] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (r) { setAvailW(r.width); setAvailH(r.height) }
    })
    ro.observe(el)
    setAvailW(el.clientWidth)
    setAvailH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const rulerSize = 16
  const step = cellSize + 1
  const cols = Math.max(8, Math.floor((Math.max(availW, step) - rulerSize - 1) / step))
  const rows = Math.max(8, Math.floor((Math.max(availH, step) - rulerSize - 1) / step))

  const px = map.playerX
  const py = map.playerY
  const minX = px - Math.floor(cols / 2)
  const minY = py - Math.floor(rows / 2)
  const gridW = cols * step - 1
  const gridH = rows * step - 1

  return (
    <div ref={containerRef} className="flex-1 min-h-0 grid place-items-center bg-zinc-900/40 overflow-hidden">
      {availW > 0 && (
        <div className="overflow-hidden select-none">
          <div className="flex flex-col" style={{ width: gridW + rulerSize + 1, height: gridH + rulerSize + 1 }}>
            {/* X ruler */}
            <div className="flex shrink-0" style={{ marginLeft: rulerSize + 1 }}>
              {Array.from({ length: cols }, (_, ci) => (
                <div key={ci} className="text-center text-[9px] text-white/25 shrink-0 overflow-hidden" style={{ width: cellSize, marginRight: 1 }}>
                  {minX + ci}
                </div>
              ))}
            </div>

            <div className="flex">
              {/* Y ruler */}
              <div className="flex flex-col shrink-0" style={{ width: rulerSize, marginTop: 1 }}>
                {Array.from({ length: rows }, (_, ri) => (
                  <div key={ri} className="flex items-center justify-end pr-[3px] text-[9px] text-white/25 shrink-0" style={{ height: cellSize, marginBottom: 1 }}>
                    {minY + ri}
                  </div>
                ))}
              </div>

              {/* Cell grid */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                  gap: '1px',
                  backgroundColor: '#0a0a0c',
                }}
              >
                {Array.from({ length: rows }, (_, ri) => {
                  const y = minY + ri
                  return Array.from({ length: cols }, (_, ci) => {
                    const x = minX + ci
                    const key = `${x},${y}`
                    const isPlayer = x === px && y === py
                    const revealed = isCellRevealed(x, y)
                    const cell = map.cells[key] ?? EMPTY_CELL

                    if (!revealed) {
                      return <div key={key} style={{ width: cellSize, height: cellSize, background: '#0a0a0c' }} />
                    }

                    const bg = (cell.base ?? 0) !== 0 ? baseDef(cell.base, customBase).color : '#18181b'

                    return (
                      <div
                        key={key}
                        className={cn('relative overflow-hidden', isPlayer && 'ring-1 ring-inset ring-amber-300 z-10')}
                        style={{ width: cellSize, height: cellSize, background: bg }}
                      >
                        {isPlayer && (
                          <div className="absolute inset-0 grid place-items-center pointer-events-none z-20">
                            <div
                              className="rounded-full bg-amber-300 shadow shadow-amber-400"
                              style={{ width: Math.max(6, cellSize * 0.35), height: Math.max(6, cellSize * 0.35) }}
                            />
                          </div>
                        )}

                        {cell.overlays.length > 0 && (
                          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-[1px] pointer-events-none z-10 leading-none">
                            {cell.overlays.map(o => {
                              const def = overlayDef(o, customOverlay)
                              return (
                                <span key={o} style={{ color: def?.color, fontSize: Math.max(7, cellSize * 0.42) }}>
                                  {def?.icon ?? '•'}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {cell.note && (
                          <span className="absolute top-0 right-0 z-10 block w-0 h-0 border-t-[6px] border-l-[6px] border-t-amber-300 border-l-transparent" />
                        )}

                        {(Object.keys(cell.edges) as EdgeDir[]).map(dir => (
                          <EdgeStripe key={dir} dir={dir} type={cell.edges[dir]!} cellSize={cellSize} />
                        ))}
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayWorkspace({
  activeMap,
  party,
  gold,
  customBase,
  customOverlay,
  isCellRevealed,
  onMovePlayer,
}: PlayWorkspaceProps) {
  const [cellSize, setCellSize] = useState(DEFAULT_CELL + 6)

  const zoom = useCallback((delta: number) => {
    setCellSize(s => Math.max(MIN_CELL, Math.min(MAX_CELL, s + delta)))
  }, [])

  if (!activeMap) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
        No map — create one in the Map workspace
      </div>
    )
  }

  const px = activeMap.playerX
  const py = activeMap.playerY

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-zinc-950/60 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs text-white/50">
          <span className="font-semibold text-white/70">{activeMap.name}</span>
          <span className="text-white/25">·</span>
          <span className="font-mono">({px}, {py})</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => zoom(-2)} className="w-6 h-6 grid place-items-center rounded text-white/30 hover:text-white hover:bg-white/10">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => zoom(2)} className="w-6 h-6 grid place-items-center rounded text-white/30 hover:text-white hover:bg-white/10">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dungeon viewport */}
      <DungeonViewport
        map={activeMap}
        cellSize={cellSize}
        customBase={customBase}
        customOverlay={customOverlay}
        isCellRevealed={isCellRevealed}
      />

      {/* Bottom bar: party HUD + D-pad */}
      <div className="flex items-end gap-3 px-3 py-2 border-t border-white/10 bg-zinc-950/60 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <PartyHud party={party} gold={gold} />
        </div>
        <DPad onMove={onMovePlayer} />
      </div>

    </div>
  )
}
