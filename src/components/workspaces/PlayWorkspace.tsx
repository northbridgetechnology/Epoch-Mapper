'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Coins, Map, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { baseDef, overlayDef, edgeDef, DEFAULT_CELL, MIN_CELL, MAX_CELL } from '@/lib/constants'
import type { CellData, MapData, MarkerDef, EdgeDir } from '@/lib/types'
import type { Character, Facing } from '@/lib/engine-types'

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlayWorkspaceProps {
  activeMap: MapData | null
  party: Character[]
  gold: number
  facing: Facing
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  onMoveForward: () => void
  onMoveBack: () => void
  onTurnLeft: () => void
  onTurnRight: () => void
  onInteract: () => void
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

// ── First-person blobber view ─────────────────────────────────────────────────

const VW = 320
const VH = 240
const MAX_D = 5

type FacingDir = Facing

function facingDelta(f: FacingDir): [number, number] {
  if (f === 'N') return [0, -1]
  if (f === 'S') return [0, 1]
  if (f === 'E') return [1, 0]
  return [-1, 0]
}

function rightDelta(f: FacingDir): [number, number] {
  if (f === 'N') return [1, 0]
  if (f === 'S') return [-1, 0]
  if (f === 'E') return [0, 1]
  return [0, -1]
}

function leftOf(f: FacingDir): EdgeDir {
  if (f === 'N') return 'W'
  if (f === 'S') return 'E'
  if (f === 'E') return 'N'
  return 'S'
}

function rightOf(f: FacingDir): EdgeDir {
  if (f === 'N') return 'E'
  if (f === 'S') return 'W'
  if (f === 'E') return 'S'
  return 'N'
}

function frontOf(f: FacingDir): EdgeDir {
  return f as unknown as EdgeDir
}

function sliceRect(d: number) {
  if (d === 0) return { x1: 0, y1: 0, x2: VW, y2: VH }
  const f = Math.pow(0.7, d)
  const mx = VW * (1 - f) / 2
  const my = VH * (1 - f) / 2
  return { x1: mx, y1: my, x2: VW - mx, y2: VH - my }
}

function frontColor(d: number): string {
  const l = Math.max(8, 38 - (d - 1) * 7)
  return `hsl(220 10% ${l}%)`
}

function sideColor(d: number): string {
  const l = Math.max(5, 26 - (d - 1) * 6)
  return `hsl(220 8% ${l}%)`
}

function ceilColor(): string {
  return 'hsl(220 12% 6%)'
}

function floorColor(): string {
  return 'hsl(220 8% 11%)'
}

interface FirstPersonViewProps {
  map: MapData
  facing: Facing
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
}

function isWall(map: MapData, x: number, y: number, customBase: Record<number, MarkerDef>): boolean {
  const cell = map.cells[`${x},${y}`]
  if (!cell) return true
  const def = baseDef(cell.base ?? 0, customBase)
  return (cell.base ?? 0) === 0 || def.label.toLowerCase().includes('wall')
}

function hasEdgeWall(map: MapData, x: number, y: number, dir: EdgeDir): boolean {
  const cell = map.cells[`${x},${y}`]
  if (!cell) return false
  return (cell.edges[dir] ?? 0) !== 0
}

function FirstPersonView({ map, facing, customBase, customOverlay, isCellRevealed }: FirstPersonViewProps) {
  const [fd0, fd1] = facingDelta(facing)
  const [rd0, rd1] = rightDelta(facing)
  const px = map.playerX
  const py = map.playerY

  function cellAt(ahead: number, side: number): [number, number] {
    return [px + fd0 * ahead + rd0 * side, py + fd1 * ahead + rd1 * side]
  }

  function hasFrontWall(ahead: number): boolean {
    const [cx, cy] = cellAt(ahead, 0)
    // Check edge marker on current cell facing forward
    if (hasEdgeWall(map, cx, cy, frontOf(facing))) return true
    const [nx, ny] = cellAt(ahead + 1, 0)
    return isWall(map, nx, ny, customBase) || !isCellRevealed(nx, ny)
  }

  function hasSideWall(ahead: number, side: 'left' | 'right'): boolean {
    const s = side === 'right' ? 1 : -1
    const [cx, cy] = cellAt(ahead, 0)
    const dir = side === 'right' ? rightOf(facing) : leftOf(facing)
    if (hasEdgeWall(map, cx, cy, dir)) return true
    const [sx, sy] = cellAt(ahead, s)
    return isWall(map, sx, sy, customBase) || !isCellRevealed(sx, sy)
  }

  // Build SVG paths — painter's algorithm: farthest first
  const rects: React.ReactNode[] = []

  // Sky / floor gradient slabs (full-width, constant across all depths)
  rects.push(
    <rect key="ceil" x={0} y={0} width={VW} height={VH / 2} fill={ceilColor()} />,
    <rect key="floor" x={0} y={VH / 2} width={VW} height={VH / 2} fill={floorColor()} />,
  )

  for (let d = MAX_D; d >= 1; d--) {
    const cur = sliceRect(d - 1)
    const far = sliceRect(d)

    // Front wall at distance d
    if (hasFrontWall(d - 1)) {
      rects.push(
        <rect
          key={`front-${d}`}
          x={far.x1} y={far.y1}
          width={far.x2 - far.x1} height={far.y2 - far.y1}
          fill={frontColor(d)}
          stroke="hsl(220 10% 4%)" strokeWidth={0.5}
        />,
      )
    }

    // Left wall side face
    if (hasSideWall(d - 1, 'left')) {
      // Trapezoid: connects current depth slice left edge to far depth slice left edge
      const points = [
        `${cur.x1},${cur.y1}`,
        `${far.x1},${far.y1}`,
        `${far.x1},${far.y2}`,
        `${cur.x1},${cur.y2}`,
      ].join(' ')
      rects.push(
        <polygon key={`left-${d}`} points={points} fill={sideColor(d)} stroke="hsl(220 10% 4%)" strokeWidth={0.5} />,
      )
    }

    // Right wall side face
    if (hasSideWall(d - 1, 'right')) {
      const points = [
        `${cur.x2},${cur.y1}`,
        `${far.x2},${far.y1}`,
        `${far.x2},${far.y2}`,
        `${cur.x2},${cur.y2}`,
      ].join(' ')
      rects.push(
        <polygon key={`right-${d}`} points={points} fill={sideColor(d)} stroke="hsl(220 10% 4%)" strokeWidth={0.5} />,
      )
    }
  }

  // Entity icons on the nearest front face (depth 1)
  const [fx, fy] = cellAt(1, 0)
  const frontCell = map.cells[`${fx},${fy}`]
  const overlayIcons = frontCell?.overlays?.map(o => overlayDef(o, customOverlay)?.icon).filter(Boolean) ?? []
  if (overlayIcons.length > 0 && !hasFrontWall(0)) {
    const near = sliceRect(0)
    const cx = (near.x1 + near.x2) / 2
    const cy = (near.y1 + near.y2) / 2
    const fontSize = Math.max(10, (near.x2 - near.x1) * 0.22)
    rects.push(
      <text key="entity" x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fill="rgba(255,255,255,0.85)">
        {overlayIcons[0]}
      </text>,
    )
  }

  // Compass (top-right corner)
  const compassLabels: Record<Facing, string> = { N: '↑N', S: '↓S', E: '→E', W: '←W' }
  rects.push(
    <rect key="compass-bg" x={VW - 30} y={4} width={26} height={14} rx={3} fill="rgba(0,0,0,0.55)" />,
    <text key="compass" x={VW - 17} y={14} textAnchor="middle" fontSize={9}
      fontFamily="monospace" fill="hsl(45 100% 70%)">{compassLabels[facing]}</text>,
  )

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%" height="100%"
      style={{ display: 'block', imageRendering: 'pixelated' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {rects}
    </svg>
  )
}

// ── Blobber D-pad ─────────────────────────────────────────────────────────────

function BlobberDPad({
  onForward, onBack, onLeft, onRight, onInteract,
}: {
  onForward: () => void
  onBack: () => void
  onLeft: () => void
  onRight: () => void
  onInteract: () => void
}) {
  const btn = (onClick: () => void, icon: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      title={label}
      className="w-9 h-9 grid place-items-center rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-white/10 text-white/60 hover:text-white transition-colors"
    >
      {icon}
    </button>
  )
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 flex-shrink-0">
      <div />
      {btn(onForward, <ArrowUp className="w-4 h-4" />, 'Forward (W)')}
      <div />
      {btn(onLeft, <ArrowLeft className="w-4 h-4" />, 'Turn Left (A)')}
      <button
        onClick={onInteract}
        title="Interact (E)"
        className="w-9 h-9 grid place-items-center rounded-lg bg-amber-800/60 hover:bg-amber-700/60 active:bg-amber-600/60 border border-amber-500/30 text-amber-300 hover:text-amber-200 transition-colors text-xs font-bold"
      >
        E
      </button>
      {btn(onRight, <ArrowRight className="w-4 h-4" />, 'Turn Right (D)')}
      <div />
      {btn(onBack, <ArrowDown className="w-4 h-4" />, 'Back (S)')}
      <div />
    </div>
  )
}

// ── Dungeon viewport (map mode) ───────────────────────────────────────────────

function DungeonViewport({
  map,
  cellSize,
  facing,
  customBase,
  customOverlay,
  isCellRevealed,
}: {
  map: MapData
  cellSize: number
  facing: Facing
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

  // Direction arrow for facing indicator
  const facingArrow: Record<Facing, string> = { N: '↑', S: '↓', E: '→', W: '←' }

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
                              className="rounded-full bg-amber-300 shadow shadow-amber-400 grid place-items-center"
                              style={{ width: Math.max(6, cellSize * 0.5), height: Math.max(6, cellSize * 0.5), fontSize: Math.max(6, cellSize * 0.3) }}
                            >
                              <span style={{ lineHeight: 1, color: '#1a1005' }}>{facingArrow[facing]}</span>
                            </div>
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
  facing,
  customBase,
  customOverlay,
  isCellRevealed,
  onMoveForward,
  onMoveBack,
  onTurnLeft,
  onTurnRight,
  onInteract,
}: PlayWorkspaceProps) {
  const [cellSize, setCellSize] = useState(DEFAULT_CELL + 6)
  const [view, setView] = useState<'3d' | 'map'>('3d')

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
          <span className="text-white/25">·</span>
          <span className="text-amber-400/70 font-mono">{facing}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View toggle */}
          <button
            onClick={() => setView(v => v === '3d' ? 'map' : '3d')}
            title={view === '3d' ? 'Switch to map view' : 'Switch to 3D view'}
            className={cn(
              'flex items-center gap-1 px-2 h-6 rounded text-xs transition-colors',
              'text-white/40 hover:text-white hover:bg-white/10',
            )}
          >
            {view === '3d' ? <Map className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {view === '3d' ? 'Map' : '3D'}
          </button>
          {view === 'map' && (
            <>
              <button onClick={() => zoom(-2)} className="w-6 h-6 grid place-items-center rounded text-white/30 hover:text-white hover:bg-white/10">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => zoom(2)} className="w-6 h-6 grid place-items-center rounded text-white/30 hover:text-white hover:bg-white/10">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main viewport */}
      {view === '3d' ? (
        <div className="flex-1 min-h-0 grid place-items-center bg-zinc-950 overflow-hidden p-4">
          <div className="w-full max-w-md aspect-[4/3] rounded-lg overflow-hidden border border-white/10 shadow-2xl">
            <FirstPersonView
              map={activeMap}
              facing={facing}
              customBase={customBase}
              customOverlay={customOverlay}
              isCellRevealed={isCellRevealed}
            />
          </div>
        </div>
      ) : (
        <DungeonViewport
          map={activeMap}
          cellSize={cellSize}
          facing={facing}
          customBase={customBase}
          customOverlay={customOverlay}
          isCellRevealed={isCellRevealed}
        />
      )}

      {/* Bottom bar: party HUD + blobber D-pad */}
      <div className="flex items-end gap-3 px-3 py-2 border-t border-white/10 bg-zinc-950/60 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <PartyHud party={party} gold={gold} />
        </div>
        <BlobberDPad
          onForward={onMoveForward}
          onBack={onMoveBack}
          onLeft={onTurnLeft}
          onRight={onTurnRight}
          onInteract={onInteract}
        />
      </div>

    </div>
  )
}
