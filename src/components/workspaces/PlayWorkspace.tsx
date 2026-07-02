'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Coins, Map, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { baseDef, overlayDef, edgeDef, boundaryKey, DEFAULT_CELL, MIN_CELL, MAX_CELL, BASE, EDGE } from '@/lib/constants'
import type { CellData, MapData, MarkerDef, EdgeDir } from '@/lib/types'
import { getTheme, type MapThemeDef } from '@/lib/themes'
import { getSubcubeDef } from '@/lib/subcube-defs'
import type { BoundaryData, CellEntity, Character, Facing } from '@/lib/engine-types'
import { objectUsedFlagKey } from '@/lib/event-engine'

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlayWorkspaceProps {
  activeMap: MapData | null
  party: Character[]
  gold: number
  facing: Facing
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  revealedBoundaries?: Set<string>
  bumpTrigger?: number
  flags: Record<string, boolean | number | string>
  onMoveForward: () => void
  onMoveBack: () => void
  onTurnLeft: () => void
  onTurnRight: () => void
  onInteract: () => void
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const EMPTY_CELL: CellData = { base: 0, overlays: [] }

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
      <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-950/20 flex-shrink-0">
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300 tabular-nums">{gold}</span>
      </div>
    </div>
  )
}

// ── First-person blobber renderer ─────────────────────────────────────────────
//
// Painter's algorithm on an SVG viewBox. Geometry:
//   VW×VH canvas, VP at centre. Each depth level d scales by DEPTH_F^d.
//   Bands between consecutive depth levels form the visible floor/ceiling slices.
//   Walls are painted back-to-front; each face gets a depth-fog overlay so far
//   geometry reads darker even before any shadow passes.

const VW = 640
const VH = 480
const MAX_D = 5
const VP_X = VW / 2
const VP_Y = VH / 2
const MAX_S = 3   // ±3 cells lateral

// True perspective: camera at the BACK edge of the player's cell (classic
// crawler framing) so an adjacent wall reads as a wall, not a screen-filler.
// The wall plane between depth k and k+1 sits z = k + 1 cells from the camera.
const PF_X = 500   // horizontal focal — screenX = VP_X + lateral(cells) * PF_X / z
const PF_Y = 190   // vertical focal — wall half-height on screen = PF_Y / z

// Wall-plane rect at depth-plane d (z = d + 1); d=-1 is the player's back plane
function sliceRect(d: number) {
  const z = Math.max(0.3, d + 1)
  const hw = (0.5 * PF_X) / z
  const hh = PF_Y / z
  return { x1: VP_X - hw, y1: VP_Y - hh, x2: VP_X + hw, y2: VP_Y + hh }
}

// Screen rect for an off-axis cell at depth d, lateral offset s
function cellFaceRect(d: number, s: number) {
  const r = sliceRect(d)
  const w = r.x2 - r.x1
  return { x1: r.x1 + s * w, y1: r.y1, x2: r.x2 + s * w, y2: r.y2 }
}

// Dark fog blended on top of each face — linear ramp so d=1→0, d=5→0.72
function depthFog(d: number): number {
  return Math.min(0.72, Math.max(0, (d - 1) * 0.18))
}

// Map sub-cube cell-space position to screen fractions, accounting for facing.
// xFrac: 0=left edge of corridor, 1=right edge
// yFrac: 0=floor, 1=ceiling  (invariant to facing)
// zFrac: 0=near (player side), 1=far  — used to interpolate between sliceRect(d-1) and sliceRect(d)
function subcubeScreenFracs(
  pos: { x: 0|1|2; y: 0|1|2; z: 0|1|2 },
  f: Facing,
): { xFrac: number; yFrac: number; zFrac: number } {
  const { x, y, z } = pos
  const yFrac = (y + 0.5) / 3
  switch (f) {
    case 'N': return { xFrac: (x + 0.5) / 3,   yFrac, zFrac: z / 2 }
    case 'S': return { xFrac: (2.5 - x) / 3,   yFrac, zFrac: (2 - z) / 2 }
    case 'E': return { xFrac: (2.5 - z) / 3,   yFrac, zFrac: x / 2 }
    case 'W': return { xFrac: (z + 0.5) / 3,   yFrac, zFrac: (2 - x) / 2 }
  }
}

// Depth-into-side-cell fraction for the side strip (0=near corridor edge, 1=far).
// For each facing × side combination, a different sub-cube axis is the depth axis.
function subcubeSideDepthFrac(
  pos: { x: 0|1|2; y: 0|1|2; z: 0|1|2 },
  f: Facing,
  side: 1 | -1,
): number {
  const { x, z } = pos
  if (f === 'N') return side > 0 ? x / 2 : (2 - x) / 2
  if (f === 'S') return side > 0 ? (2 - x) / 2 : x / 2
  if (f === 'E') return side > 0 ? (2 - z) / 2 : z / 2
  /* W */        return side > 0 ? z / 2 : (2 - z) / 2
}

// ── Theme-driven colour palette ────────────────────────────────────────────────
function makeFpPalette(t: MapThemeDef) {
  return {
    frontWall: (d: number) => `hsl(${t.wallHue} ${t.wallSat}% ${Math.max(10, t.wallLBase - (d - 1) * t.wallLStep)}%)`,
    sideWall:  (d: number) => `hsl(${t.sideHue} ${t.sideSat}% ${Math.max(7,  t.sideLBase - (d - 1) * t.sideLStep)}%)`,
    wallEdge:  (d: number) => `hsl(${t.wallHue} ${Math.min(60, t.wallSat + 12)}% ${Math.min(72, 72 - (d - 1) * 12)}%)`,
    sideEdge:  (d: number) => `hsl(${t.sideHue} ${Math.min(55, t.sideSat + 11)}% ${Math.min(55, 55 - (d - 1) * 10)}%)`,
    floorBand: (d: number) => { const base = Math.max(6, t.floorLBase - d * 2); const alt = d % 2 === 0 ? 4 : 0; return `hsl(${t.floorHue} ${t.floorSat}% ${base + alt}%)` },
    ceilBand:  (d: number) => { const base = Math.max(7, t.ceilLBase - d * t.ceilLStep); const alt = d % 2 === 0 ? 3 : 0; return `hsl(${t.ceilHue} ${t.ceilSat}% ${base + alt}%)` },
  }
}

// ── Floor/ceiling band y-positions ────────────────────────────────────────────
function floorBandY(d: number): number {
  return sliceRect(d).y2
}
function ceilBandY(d: number): number {
  return sliceRect(d).y1
}

// ── Direction helpers ──────────────────────────────────────────────────────────
function facingDelta(f: Facing): [number, number] {
  if (f === 'N') return [0, -1]; if (f === 'S') return [0, 1]
  if (f === 'E') return [1, 0];  return [-1, 0]
}
function rightDelta(f: Facing): [number, number] {
  if (f === 'N') return [1, 0];  if (f === 'S') return [-1, 0]
  if (f === 'E') return [0, 1];  return [0, -1]
}
function leftOf(f: Facing): EdgeDir  { const m: Record<Facing,EdgeDir> = {N:'W',S:'E',E:'N',W:'S'}; return m[f] }
function rightOf(f: Facing): EdgeDir { const m: Record<Facing,EdgeDir> = {N:'E',S:'W',E:'S',W:'N'}; return m[f] }
function frontOf(f: Facing): EdgeDir { return f as unknown as EdgeDir }

// ── Geometry / wall queries ────────────────────────────────────────────────────

type CellKind = 'wall' | 'open' | 'water' | 'lava' | 'void'

function getCellKind(map: MapData, x: number, y: number): CellKind {
  const cell = map.cells[`${x},${y}`]
  if (!cell) return 'wall'
  switch (cell.base ?? 0) {
    case 0:          return 'wall'
    case BASE.WATER: return 'water'
    case BASE.LAVA:  return 'lava'
    case BASE.VOID:  return 'void'
    default:         return 'open'  // BASE.WALL (2) is an invisible solid — transparent in 3D
  }
}

function isWall(map: MapData, x: number, y: number): boolean {
  return getCellKind(map, x, y) === 'wall'
}
function hasBoundaryWall(
  map: MapData, x: number, y: number, dir: EdgeDir,
  revealedBoundaries?: Set<string>,
): boolean {
  const bk = boundaryKey(x, y, dir)
  const b = map.boundaries?.[bk]
  if (!b) return false
  if (b.wall !== undefined) {
    if (b.wall === EDGE.ILLUSORY) return revealedBoundaries ? !revealedBoundaries.has(bk) : true
    if (b.wall === EDGE.DOOR) return b.door ? b.door.state !== 'open' : true
    return true
  }
  return b.door !== undefined && b.door.state !== 'open'
}

// ── SVG component ──────────────────────────────────────────────────────────────

interface FirstPersonViewProps {
  map: MapData
  facing: Facing
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  revealedBoundaries?: Set<string>
  flags: Record<string, boolean | number | string>
}

function FirstPersonView({ map, facing, customOverlay, isCellRevealed, revealedBoundaries, flags }: FirstPersonViewProps) {
  const [fd0, fd1] = facingDelta(facing)
  const [rd0, rd1] = rightDelta(facing)
  const px = map.playerX
  const py = map.playerY
  const theme = getTheme(map.theme)
  const pal = makeFpPalette(theme)

  function cellAt(ahead: number, side: number): [number, number] {
    return [px + fd0 * ahead + rd0 * side, py + fd1 * ahead + rd1 * side]
  }
  function hasFrontWall(ahead: number): boolean {
    const [cx, cy] = cellAt(ahead, 0)
    if (hasBoundaryWall(map, cx, cy, frontOf(facing), revealedBoundaries)) return true
    // Option A: special terrain clips at fog boundary — no phantom stone wall behind it
    const curKind = getCellKind(map, cx, cy)
    if (curKind === 'water' || curKind === 'lava' || curKind === 'void') return false
    const [nx, ny] = cellAt(ahead + 1, 0)
    return isWall(map, nx, ny) || !isCellRevealed(nx, ny)
  }
  function hasSideWall(ahead: number, side: 'left' | 'right'): boolean {
    const s = side === 'right' ? 1 : -1
    const [cx, cy] = cellAt(ahead, 0)
    const dir = side === 'right' ? rightOf(facing) : leftOf(facing)
    if (hasBoundaryWall(map, cx, cy, dir, revealedBoundaries)) return true
    const [sx, sy] = cellAt(ahead, s)
    return isWall(map, sx, sy) || !isCellRevealed(sx, sy)
  }
  function isRevealedIllusoryFront(ahead: number): boolean {
    const [cx, cy] = cellAt(ahead, 0)
    const bk = boundaryKey(cx, cy, frontOf(facing))
    const b = map.boundaries?.[bk]
    return b?.wall === EDGE.ILLUSORY && (revealedBoundaries?.has(bk) ?? false)
  }
  function getFrontBoundary(ahead: number): BoundaryData | null {
    const [cx, cy] = cellAt(ahead, 0)
    const bk = boundaryKey(cx, cy, frontOf(facing))
    return map.boundaries?.[bk] ?? null
  }

  function hasSideWallAt(d: number, s: number, side: 'left' | 'right'): boolean {
    const [cx, cy] = cellAt(d, s)
    const dir = side === 'right' ? rightOf(facing) : leftOf(facing)
    if (hasBoundaryWall(map, cx, cy, dir, revealedBoundaries)) return true
    const sideS = side === 'right' ? s + 1 : s - 1
    if (sideS < -MAX_S || sideS > MAX_S) return true
    const [sx, sy] = cellAt(d, sideS)
    return isWall(map, sx, sy) || !isCellRevealed(sx, sy)
  }

  const nodes: React.ReactNode[] = []

  // ── 1. Ceiling base ──────────────────────────────────────────────────────────
  // Bands from screen-top (closest overhead) toward horizon (d=MAX_D)
  // Band 0: y 0 → ceilBandY(1)
  // Band d: y ceilBandY(d) → ceilBandY(d+1)   (d=1..MAX_D-1)
  // Band MAX_D: y ceilBandY(MAX_D) → VP_Y
  for (let d = 0; d <= MAX_D; d++) {
    const y0 = d === 0       ? 0    : ceilBandY(d)
    const y1 = d === MAX_D   ? VP_Y : ceilBandY(d + 1)
    if (y1 <= y0) continue
    nodes.push(
      <rect key={`cb${d}`} x={0} y={y0} width={VW} height={y1 - y0} fill={pal.ceilBand(d + 1)} />,
    )
  }

  // Ceiling: stone-block mortar grid (static, not perspective-corrected — EotB vibe)
  nodes.push(
    <defs key="stone-defs">
      <pattern id="stone-grid" x={0} y={0} width={48} height={24} patternUnits="userSpaceOnUse">
        <rect width={48} height={24} fill="none" />
        <rect width={47} height={23} fill="none" stroke={theme.ceilPatternColor} strokeWidth={1} />
      </pattern>
      <linearGradient id="ceil-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
      </linearGradient>
    </defs>,
    <rect key="ceil-mortar" x={0} y={0} width={VW} height={VP_Y} fill="url(#stone-grid)" />,
    <rect key="ceil-fade"   x={0} y={0} width={VW} height={VP_Y} fill="url(#ceil-fade)"  />,
  )

  // Ceiling: 4 converging perspective lines (columns of stone)
  for (let i = 0; i <= 4; i++) {
    const xBot = (i / 4) * VW
    nodes.push(
      <line key={`cvl${i}`} x1={VP_X} y1={VP_Y} x2={xBot} y2={0}
        stroke={theme.ceilPatternColor} strokeWidth={0.8} />,
    )
  }

  // ── 2. Floor base ────────────────────────────────────────────────────────────
  // Bands from horizon (d=MAX_D, thin) toward screen-bottom (d=1, thick)
  // Band d: y floorBandY(d+1) → floorBandY(d)
  // Band 0: y floorBandY(1) → VH
  for (let d = MAX_D; d >= 0; d--) {
    const y0 = d === MAX_D  ? VP_Y : floorBandY(d + 1)
    const y1 = d === 0      ? VH   : floorBandY(d)
    if (y1 <= y0) continue
    nodes.push(
      <rect key={`fb${d}`} x={0} y={y0} width={VW} height={y1 - y0} fill={pal.floorBand(d)} />,
    )
  }

  // Floor: perspective grid lines — 4 vertical converging + horizontal depth markers
  for (let i = 0; i <= 4; i++) {
    const xBot = (i / 4) * VW
    nodes.push(
      <line key={`fvl${i}`} x1={VP_X} y1={VP_Y} x2={xBot} y2={VH}
        stroke={theme.gridLineColor} strokeWidth={0.8} />,
    )
  }
  for (let d = 1; d <= MAX_D; d++) {
    nodes.push(
      <line key={`fhl${d}`} x1={0} y1={floorBandY(d)} x2={VW} y2={floorBandY(d)}
        stroke={theme.gridLineColor} strokeWidth={0.6} />,
    )
  }

  // Floor: brighten the nearest band a little (torch-light spill)
  nodes.push(
    <rect key="floor-glow" x={0} y={floorBandY(1)} width={VW} height={VH - floorBandY(1)}
      fill={theme.floorGlowColor} />,
  )

  // ── 3. Walls — grid painter: back-to-front, outside-in (EotB style) ──────────
  const lateralOrder: number[] = []
  for (let a = MAX_S; a >= 1; a--) lateralOrder.push(-a, a)
  lateralOrder.push(0)

  for (let d = MAX_D; d >= 0; d--) {
    for (const s of lateralOrder) {
      const near = cellFaceRect(d - 1, s)
      const far  = cellFaceRect(d,     s)
      const fog  = depthFog(d)
      const fw = near.x2 - near.x1
      const fh = near.y2 - near.y1

      const [cx,  cy]  = cellAt(d,     s)
      const [ncx, ncy] = cellAt(d - 1, s)
      const solid    = isWall(map, cx, cy) || !isCellRevealed(cx, cy)
      const nearOpen = (d === 1 && s === 0) || (!isWall(map, ncx, ncy) && isCellRevealed(ncx, ncy))

      if (solid) {
        // Solid cell: flat front face at its near plane, painted over farther cells
        // (d=0 solids sit beside the player — their near plane is behind the camera)
        if (d === 0 || !nearOpen) continue
        nodes.push(
          <rect key={`fw_${d}_${s}`}  x={near.x1} y={near.y1} width={fw} height={fh} fill={pal.frontWall(d)} />,
          <line key={`fwl_${d}_${s}`} x1={near.x1 + fw * 0.33} y1={near.y1} x2={near.x1 + fw * 0.33} y2={near.y2} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />,
          <line key={`fwr_${d}_${s}`} x1={near.x1 + fw * 0.67} y1={near.y1} x2={near.x1 + fw * 0.67} y2={near.y2} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />,
          <line key={`fwt_${d}_${s}`} x1={near.x1} y1={near.y1} x2={near.x2} y2={near.y1} stroke={pal.wallEdge(d)} strokeWidth={1} />,
          fog > 0 && <rect key={`fwf_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog})`} />,
        )
        continue
      }

      // Side walls bounding this open cell
      if (hasSideWallAt(d, s, 'left')) {
        const pts = `${near.x1},${near.y1} ${far.x1},${far.y1} ${far.x1},${far.y2} ${near.x1},${near.y2}`
        nodes.push(
          <polygon key={`lw_${d}_${s}`}  points={pts} fill={pal.sideWall(d)} />,
          <line    key={`lwe_${d}_${s}`} x1={near.x1} y1={near.y1} x2={near.x1} y2={near.y2} stroke={pal.sideEdge(d)} strokeWidth={1} />,
          fog > 0 && <polygon key={`lwf_${d}_${s}`} points={pts} fill={`rgba(0,0,0,${fog * 0.8})`} />,
        )
      }
      if (hasSideWallAt(d, s, 'right')) {
        const pts = `${near.x2},${near.y1} ${far.x2},${far.y1} ${far.x2},${far.y2} ${near.x2},${near.y2}`
        nodes.push(
          <polygon key={`rw_${d}_${s}`}  points={pts} fill={pal.sideWall(d)} />,
          <line    key={`rwe_${d}_${s}`} x1={near.x2} y1={near.y1} x2={near.x2} y2={near.y2} stroke={pal.sideEdge(d)} strokeWidth={1} />,
          fog > 0 && <polygon key={`rwf_${d}_${s}`} points={pts} fill={`rgba(0,0,0,${fog * 0.8})`} />,
        )
      }

      // Special terrain floor quad — this cell's footprint only (water/lava/void)
      const kind = getCellKind(map, cx, cy)
      if (kind === 'water' || kind === 'lava' || kind === 'void') {
        const tFill =
          kind === 'water' ? `hsl(210 60% ${Math.max(8, 26 - d * 4)}%)` :
          kind === 'lava'  ? `hsl(12 72% ${Math.max(8, 30 - d * 5)}%)`  :
                             `hsl(230 8% ${Math.max(1, 6 - d)}%)`
        nodes.push(
          <polygon key={`ft_${d}_${s}`}
            points={`${near.x1},${near.y2} ${near.x2},${near.y2} ${far.x2},${far.y2} ${far.x1},${far.y2}`}
            fill={tFill} />,
        )
      }

      // Cell contents — entities first, then volume objects; the near boundary
      // (door/wall) is painted after so closed doors hide the room behind them
      const entGroup: React.ReactNode[] = []
      drawCellEntities(d, s, entGroup)
      if (entGroup.length > 0) nodes.push(<g key={`ce_${d}_${s}`}>{entGroup}</g>)

      // Own-cell pass stops here: volume objects would render oversized and the
      // near boundary plane sits behind the camera at d = 0
      if (d === 0) continue

      {
        const scObjs = map.cells[`${cx},${cy}`]?.subcubeObjects
        if (scObjs && scObjs.length > 0) {
          const sorted = [...scObjs].sort((a, b) => {
            const za = subcubeScreenFracs(a.pos, facing).zFrac
            const zb = subcubeScreenFracs(b.pos, facing).zFrac
            return zb - za || b.pos.y - a.pos.y
          })
          const clipId = `sc_clip_${d}_${s}`
          const cbx1 = Math.min(near.x1, far.x1)
          const cbx2 = Math.max(near.x2, far.x2)
          nodes.push(<defs key={`${clipId}_def`}><clipPath id={clipId}><rect x={cbx1} y={near.y1} width={cbx2 - cbx1} height={near.y2 - near.y1} /></clipPath></defs>)
          const objNodes: React.ReactNode[] = []
          for (const obj of sorted) {
            const def = getSubcubeDef(obj.kind)
            if (!def) continue
            const { xFrac, yFrac, zFrac } = subcubeScreenFracs(obj.pos, facing)
            const sx1 = near.x1 + (far.x1 - near.x1) * zFrac
            const sx2 = near.x2 + (far.x2 - near.x2) * zFrac
            const sy1 = near.y1 + (far.y1 - near.y1) * zFrac
            const sy2 = near.y2 + (far.y2 - near.y2) * zFrac
            const sw2 = sx2 - sx1, sh2 = sy2 - sy1
            const screenX = sx1 + sw2 * xFrac
            const screenY = sy2 - sh2 * yFrac
            const emojiSize = Math.max(6, Math.min(fw * 0.45, sh2 * 0.38))
            const opacity = Math.max(0.25, 1 - fog * 1.8)
            if (obj.trigger) {
              const glowColor = obj.trigger === 'onInteract' ? 'rgba(56,189,248,0.30)' : obj.trigger === 'onView' ? 'rgba(52,211,153,0.30)' : 'rgba(251,191,36,0.30)'
              objNodes.push(<circle key={`scg_${d}_${s}_${obj.id}`} cx={screenX} cy={screenY} r={emojiSize * 0.75} fill={glowColor} opacity={opacity} />)
            }
            objNodes.push(<text key={`sc_${d}_${s}_${obj.id}`} x={screenX} y={screenY} textAnchor="middle" dominantBaseline="middle" fontSize={emojiSize} opacity={opacity} style={{ userSelect: 'none' }}>{def.icon}</text>)
          }
          nodes.push(<g key={`scw_${d}_${s}`} clipPath={`url(#${clipId})`}>{objNodes}</g>)
        }
      }

      // Near boundary between (d-1,s) and (d,s): wall / door / revealed illusion
      const bk = boundaryKey(ncx, ncy, frontOf(facing))
      const fb = map.boundaries?.[bk] ?? null
      const blocked = hasBoundaryWall(map, ncx, ncy, frontOf(facing), revealedBoundaries)
      const ghost = fb?.wall === EDGE.ILLUSORY && (revealedBoundaries?.has(bk) ?? false)
      const isDoor = fb?.wall === EDGE.DOOR

      if (ghost) {
        nodes.push(<rect key={`fwg_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill="rgba(160,200,255,0.12)" />)
      } else if (blocked && isDoor) {
        const locked = (fb?.door?.state ?? 'closed') === 'locked'
        const jamb = fw * 0.10, lintel = fh * 0.08, thresh = fh * 0.04
        const dpx = near.x1 + jamb, dpy = near.y1 + lintel
        const dpw = fw - jamb * 2,  dph = fh - lintel - thresh
        const woodL = Math.max(8, 28 - (d - 1) * 5)
        nodes.push(
          <rect key={`djl_${d}_${s}`} x={near.x1}        y={near.y1} width={jamb} height={fh}     fill={pal.frontWall(d)} />,
          <rect key={`djr_${d}_${s}`} x={near.x2 - jamb} y={near.y1} width={jamb} height={fh}     fill={pal.frontWall(d)} />,
          <rect key={`dlt_${d}_${s}`} x={near.x1}        y={near.y1} width={fw}   height={lintel}  fill={pal.frontWall(d)} />,
          <rect key={`dth_${d}_${s}`} x={near.x1}        y={near.y2 - thresh} width={fw} height={thresh} fill={pal.frontWall(d)} />,
          <rect key={`dp_${d}_${s}`}  x={dpx} y={dpy} width={dpw} height={dph} fill={`hsl(28 45% ${woodL}%)`} />,
          <line key={`dpl1_${d}_${s}`} x1={dpx + dpw * 0.35} y1={dpy + dph * 0.04} x2={dpx + dpw * 0.35} y2={dpy + dph * 0.96} stroke="rgba(0,0,0,0.28)" strokeWidth={0.7} />,
          <line key={`dpl2_${d}_${s}`} x1={dpx + dpw * 0.65} y1={dpy + dph * 0.04} x2={dpx + dpw * 0.65} y2={dpy + dph * 0.96} stroke="rgba(0,0,0,0.28)" strokeWidth={0.7} />,
          <circle key={`dph_${d}_${s}`} cx={dpx + dpw * 0.74} cy={dpy + dph * 0.52} r={Math.max(1.5, fw * 0.028)} fill={locked ? '#b91c1c' : `hsl(44 80% ${Math.max(30, 50 - d * 4)}%)`} />,
          fog > 0 && <rect key={`dff_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog})`} />,
        )
        if (locked) nodes.push(<text key={`dlck_${d}_${s}`} x={dpx + dpw * 0.74} y={dpy + dph * 0.40} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(4, fw * 0.07)}>🔒</text>)
      } else if (blocked) {
        nodes.push(
          <rect key={`bw_${d}_${s}`}  x={near.x1} y={near.y1} width={fw} height={fh} fill={pal.frontWall(d)} />,
          <line key={`bwt_${d}_${s}`} x1={near.x1} y1={near.y1} x2={near.x2} y2={near.y1} stroke={pal.wallEdge(d)} strokeWidth={1} />,
          fog > 0 && <rect key={`bwf_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog})`} />,
        )
      } else if (isDoor && fb?.door?.state === 'open') {
        const jamb = fw * 0.10, lintel = fh * 0.08, thresh = fh * 0.04
        nodes.push(
          <rect key={`djlo_${d}_${s}`} x={near.x1}        y={near.y1} width={jamb} height={fh}     fill={pal.frontWall(d)} />,
          <rect key={`djro_${d}_${s}`} x={near.x2 - jamb} y={near.y1} width={jamb} height={fh}     fill={pal.frontWall(d)} />,
          <rect key={`dlto_${d}_${s}`} x={near.x1}        y={near.y1} width={fw}   height={lintel}  fill={pal.frontWall(d)} />,
          <rect key={`dtho_${d}_${s}`} x={near.x1}        y={near.y2 - thresh} width={fw} height={thresh} fill={pal.frontWall(d)} />,
          fog > 0 && <rect key={`dffo_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog * 0.6})`} />,
        )
      }
    }
  }

  // ── 4. Entity drawing helper — invoked from the wall pass for each open cell ──
  // Hoisted declaration; the `nodes` parameter shadows the outer array so all the
  // pushes below land in the caller-provided per-cell group.
  function drawCellEntities(d: number, s: number, nodes: React.ReactNode[]) {
    const [fx, fy] = cellAt(d, s)
    const frontCell = map.cells[`${fx},${fy}`]
    if (!frontCell) return

    // Anchor contents at mid-cell depth (z = d + 0.55, projected directly) so a
    // chest one cell ahead reads as adjacent instead of hugging its far wall —
    // and at d = 0 it stays visible at the player's feet.
    const ez  = d + 0.55
    const eHW = (0.5 * PF_X) / ez
    const eHH = PF_Y / ez
    const eMX = VP_X + (s * PF_X) / ez
    const entFace = { x1: eMX - eHW, y1: VP_Y - eHH, x2: eMX + eHW, y2: VP_Y + eHH }

    // ── Chest object entity ──────────────────────────────────────────────────
    const chestEnt = (frontCell.entities ?? []).find(
      (e): e is Extract<CellEntity, { t: 'object' }> => e.t === 'object' && e.object.kind === 'chest',
    )
    if (chestEnt) {
      const obj = chestEnt.object
      const isOpen   = Boolean(flags[objectUsedFlagKey(obj.id)])
      const isLocked = !isOpen && Boolean(obj.locked?.key)

      const face  = entFace
      const faceW = face.x2 - face.x1
      const faceH = face.y2 - face.y1
      const cx = (face.x1 + face.x2) / 2
      const entFog = depthFog(d)

      // Chest body bounds
      const cW  = faceW * 0.44
      const cH  = faceH * 0.26
      const fb  = face.y2           // bottom = floor
      const ft  = fb - cH           // top of body front face
      const fl  = cx - cW / 2
      const fr  = cx + cW / 2

      // Top-face back edge (perspective recession toward VP)
      const tRatio = 0.70
      const tRecede = cH * 0.40
      const tbl = cx - (cW / 2) * tRatio
      const tbr = cx + (cW / 2) * tRatio
      const tby = ft - tRecede

      // Depth-scaled colours (wood + iron)
      const lBase   = Math.max(12, 28 - d * 3)
      const woodDk  = `hsl(28 42% ${lBase}%)`
      const woodMd  = `hsl(32 46% ${lBase + 9}%)`
      const woodLt  = `hsl(36 50% ${lBase + 18}%)`
      const iron    = `hsl(215 14% ${Math.max(22, 40 - d * 4)}%)`
      const goldCol = `hsl(44 75% ${Math.max(38, 55 - d * 3)}%)`

      if (!isOpen) {
        // Closed chest ─────────────────────────────────────────────────────
        // Top face (lid surface)
        nodes.push(
          <polygon key={`chtop${d}`}
            points={`${fl},${ft} ${fr},${ft} ${tbr},${tby} ${tbl},${tby}`}
            fill={woodLt} />,
          <line key={`chtl${d}`} x1={fl}  y1={ft}  x2={tbl} y2={tby} stroke={woodDk} strokeWidth={0.8} />,
          <line key={`chtr${d}`} x1={fr}  y1={ft}  x2={tbr} y2={tby} stroke={woodDk} strokeWidth={0.8} />,
          <line key={`chtb${d}`} x1={tbl} y1={tby} x2={tbr} y2={tby} stroke={woodDk} strokeWidth={0.8} />,
          // Front body face
          <rect key={`chbody${d}`}  x={fl} y={ft} width={cW} height={cH} fill={woodMd} />,
          // Plank lines
          <line key={`chp1${d}`} x1={fl} y1={ft + cH * 0.35} x2={fr} y2={ft + cH * 0.35}
            stroke={woodDk} strokeWidth={0.7} />,
          <line key={`chp2${d}`} x1={fl} y1={ft + cH * 0.68} x2={fr} y2={ft + cH * 0.68}
            stroke={woodDk} strokeWidth={0.7} />,
          // Iron bands
          <rect key={`chb1${d}`} x={fl} y={ft + cH * 0.06} width={cW} height={cH * 0.13} fill={iron} opacity={0.75} />,
          <rect key={`chb2${d}`} x={fl} y={ft + cH * 0.80} width={cW} height={cH * 0.13} fill={iron} opacity={0.75} />,
          // Outline
          <rect key={`chout${d}`} x={fl} y={ft} width={cW} height={cH} fill="none" stroke={woodDk} strokeWidth={1} />,
          // Lock clasp or plain clasp
          isLocked
            ? <rect key={`chlb${d}`}  x={cx - cW * 0.065} y={ft + cH * 0.33} width={cW * 0.13} height={cH * 0.24} fill={goldCol} rx={1} />
            : <rect key={`chcl${d}`}  x={cx - cW * 0.05}  y={ft + cH * 0.38} width={cW * 0.10} height={cH * 0.18} fill={goldCol} rx={1} />,
          isLocked && <path key={`chls${d}`}
            d={`M${cx - cW * 0.035},${ft + cH * 0.36} a${cW * 0.035},${cH * 0.13} 0 0,1 ${cW * 0.07},0`}
            fill="none" stroke={goldCol} strokeWidth={Math.max(1, cW * 0.02)} />,
        )
      } else {
        // Open chest ───────────────────────────────────────────────────────
        const lidH = cH * 0.60
        nodes.push(
          // Dark interior (visible through open top)
          <rect key={`chint${d}`}
            x={fl + cW * 0.06} y={ft + cH * 0.04} width={cW * 0.88} height={cH * 0.32}
            fill="hsl(20 18% 5%)" />,
          // Front body
          <rect key={`chbody${d}`}  x={fl} y={ft} width={cW} height={cH} fill={woodMd} />,
          <rect key={`chb1${d}`}    x={fl} y={ft + cH * 0.06} width={cW} height={cH * 0.13} fill={iron} opacity={0.75} />,
          <rect key={`chb2${d}`}    x={fl} y={ft + cH * 0.80} width={cW} height={cH * 0.13} fill={iron} opacity={0.75} />,
          <rect key={`chout${d}`}   x={fl} y={ft} width={cW} height={cH} fill="none" stroke={woodDk} strokeWidth={1} />,
          // Open lid standing at back edge
          <polygon key={`chlid${d}`}
            points={`${tbl},${tby} ${tbr},${tby} ${tbr},${tby - lidH} ${tbl},${tby - lidH}`}
            fill={woodLt} />,
          <rect key={`chlidout${d}`}
            x={tbl} y={tby - lidH} width={tbr - tbl} height={lidH}
            fill="none" stroke={woodDk} strokeWidth={0.8} />,
        )
      }

      // Depth fog over chest area
      if (entFog > 0) {
        nodes.push(
          <polygon key={`chfog${d}`}
            points={`${fl},${Math.min(tby, ft - tRecede)} ${fr},${Math.min(tby, ft - tRecede)} ${fr},${fb} ${fl},${fb}`}
            fill={`rgba(0,0,0,${entFog * 0.55})`} />,
        )
      }

      // Lock indicator text overlay when locked
      if (isLocked) {
        const iconSz = Math.max(8, faceW * 0.09)
        nodes.push(
          <text key={`chlockicon${d}`}
            x={cx} y={ft + cH * 0.46}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={iconSz} opacity={Math.max(0.5, 1 - entFog * 0.6)}
          >🔒</text>,
        )
      }

      return
    }

    // ── Overlay icon fallback ────────────────────────────────────────────────
    const icons = (frontCell.overlays ?? [])
      .map(o => overlayDef(o, customOverlay)?.icon)
      .filter((x): x is string => Boolean(x))
    if (icons.length === 0) return

    const face  = entFace
    const faceW = face.x2 - face.x1
    const faceH = face.y2 - face.y1
    const ecx   = (face.x1 + face.x2) / 2
    const iconSize = Math.max(10, faceW * 0.26)
    const shadowH  = Math.max(2, faceH * 0.06)
    const shadowW  = Math.max(4, faceW * 0.18)
    const entFog   = depthFog(d)
    nodes.push(
      <ellipse key={`eshadow_${d}_${s}`}
        cx={ecx} cy={face.y2 - faceH * 0.08}
        rx={shadowW} ry={shadowH}
        fill={`rgba(0,0,0,${0.4 + d * 0.08})`} />,
      <text key={`eicon_${d}_${s}`}
        x={ecx} y={face.y2 - faceH * 0.20}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={iconSize} opacity={1 - entFog * 0.6}
      >{icons[0]}</text>,
      entFog > 0 && <rect key={`efog_${d}_${s}`}
        x={face.x1} y={face.y1} width={faceW} height={faceH}
        fill={`rgba(0,0,0,${entFog * 0.5})`} />,
    )
  }

  // ── 5. HUD overlay ────────────────────────────────────────────────────────────
  const compassLabel: Record<Facing, string> = { N: '↑N', S: '↓S', E: '→E', W: '←W' }
  nodes.push(
    // Compass chip
    <rect key="cbox" x={VW - 36} y={5} width={30} height={16} rx={3}
      fill="rgba(0,0,0,0.60)" />,
    <text key="ctxt" x={VW - 21} y={15}
      textAnchor="middle" fontSize={10} fontFamily="monospace"
      fill="hsl(44 95% 68%)">{compassLabel[facing]}</text>,

    // Horizon line (thin separator between floor and ceiling)
    <line key="horizon" x1={0} y1={VP_Y} x2={VW} y2={VP_Y}
      stroke="rgba(100,120,160,0.18)" strokeWidth={1} />,

    // Optional theme ambient tint (e.g. blue for ice, red for lava)
    theme.ambientTint && <rect key="ambient-tint" x={0} y={0} width={VW} height={VH} fill={theme.ambientTint} />,

    // Vignette: dark corners for cinematic depth
    <defs key="vig-defs">
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="0%"   stopColor="rgba(0,0,0,0)"    />
        <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
      </radialGradient>
    </defs>,
    <rect key="vignette" x={0} y={0} width={VW} height={VH} fill="url(#vignette)" />,
  )

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="fp-view-clip"><rect x={0} y={0} width={VW} height={VH} /></clipPath>
      </defs>
      <g clipPath="url(#fp-view-clip)">{nodes}</g>
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
      className="w-10 h-10 grid place-items-center rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-white/10 text-white/60 hover:text-white transition-colors"
    >
      {icon}
    </button>
  )
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 flex-shrink-0">
      <div />
      {btn(onForward, <ArrowUp className="w-4 h-4" />, 'Forward (W)')}
      <div />
      {btn(onLeft,    <ArrowLeft className="w-4 h-4" />, 'Turn Left (A)')}
      <button
        onClick={onInteract}
        title="Interact (E)"
        className="w-10 h-10 grid place-items-center rounded-lg bg-amber-800/60 hover:bg-amber-700/60 active:bg-amber-600/60 border border-amber-500/30 text-amber-300 hover:text-amber-200 transition-colors text-xs font-bold"
      >
        E
      </button>
      {btn(onRight, <ArrowRight className="w-4 h-4" />, 'Turn Right (D)')}
      <div />
      {btn(onBack,  <ArrowDown className="w-4 h-4" />, 'Back (S)')}
      <div />
    </div>
  )
}

// ── Dungeon viewport (map mode) ───────────────────────────────────────────────

function DungeonViewport({
  map, cellSize, facing, customBase, customOverlay, isCellRevealed,
}: {
  map: MapData; cellSize: number; facing: Facing
  customBase: Record<number, MarkerDef>; customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
}) {
  const theme = getTheme(map.theme)
  const containerRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)
  const [availH, setAvailH] = useState(0)
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(e => {
      const r = e[0]?.contentRect
      if (r) { setAvailW(r.width); setAvailH(r.height) }
    })
    ro.observe(el)
    setAvailW(el.clientWidth); setAvailH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const rulerSize = 16
  const step  = cellSize + 1
  const cols  = Math.max(8, Math.floor((Math.max(availW, step) - rulerSize - 1) / step))
  const rows  = Math.max(8, Math.floor((Math.max(availH, step) - rulerSize - 1) / step))
  const px = map.playerX; const py = map.playerY
  const minX = px - Math.floor(cols / 2); const minY = py - Math.floor(rows / 2)
  const gridW = cols * step - 1; const gridH = rows * step - 1
  const facingArrow: Record<Facing, string> = { N: '↑', S: '↓', E: '→', W: '←' }

  return (
    <div ref={containerRef} className="flex-1 min-h-0 grid place-items-center bg-zinc-900/40 overflow-hidden">
      {availW > 0 && (
        <div className="overflow-hidden select-none">
          <div className="flex flex-col" style={{ width: gridW + rulerSize + 1, height: gridH + rulerSize + 1 }}>
            <div className="flex shrink-0" style={{ marginLeft: rulerSize + 1 }}>
              {Array.from({ length: cols }, (_, ci) => (
                <div key={ci} className="text-center text-[9px] text-white/25 shrink-0 overflow-hidden"
                  style={{ width: cellSize, marginRight: 1 }}>{minX + ci}</div>
              ))}
            </div>
            <div className="flex">
              <div className="flex flex-col shrink-0" style={{ width: rulerSize, marginTop: 1 }}>
                {Array.from({ length: rows }, (_, ri) => (
                  <div key={ri} className="flex items-center justify-end pr-[3px] text-[9px] text-white/25 shrink-0"
                    style={{ height: cellSize, marginBottom: 1 }}>{minY + ri}</div>
                ))}
              </div>
              <div className="grid" style={{
                gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                gap: '1px', backgroundColor: theme.gapColor,
              }}>
                {Array.from({ length: rows }, (_, ri) => {
                  const y = minY + ri
                  return Array.from({ length: cols }, (_, ci) => {
                    const x = minX + ci
                    const key = `${x},${y}`
                    const isPlayer = x === px && y === py
                    const revealed = isCellRevealed(x, y)
                    const cell = map.cells[key] ?? EMPTY_CELL
                    if (!revealed) return <div key={key} style={{ width: cellSize, height: cellSize, background: theme.fogColor }} />
                    const bg = (cell.base ?? 0) !== 0 ? baseDef(cell.base, customBase).color : theme.emptyColor
                    return (
                      <div key={key} className={cn('relative overflow-hidden', isPlayer && 'ring-1 ring-inset ring-amber-300 z-10')}
                        style={{ width: cellSize, height: cellSize, background: bg }}>
                        {isPlayer && (
                          <div className="absolute inset-0 grid place-items-center pointer-events-none z-20">
                            <div className="rounded-full bg-amber-300 shadow shadow-amber-400 grid place-items-center"
                              style={{ width: Math.max(6, cellSize * 0.5), height: Math.max(6, cellSize * 0.5), fontSize: Math.max(6, cellSize * 0.3) }}>
                              <span style={{ lineHeight: 1, color: '#1a1005' }}>{facingArrow[facing]}</span>
                            </div>
                          </div>
                        )}
                        {cell.overlays.length > 0 && (
                          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-[1px] pointer-events-none z-10 leading-none">
                            {cell.overlays.map(o => {
                              const def = overlayDef(o, customOverlay)
                              return <span key={o} style={{ color: def?.color, fontSize: Math.max(7, cellSize * 0.42) }}>{def?.icon ?? '•'}</span>
                            })}
                          </div>
                        )}
                        {cell.note && <span className="absolute top-0 right-0 z-10 block w-0 h-0 border-t-[6px] border-l-[6px] border-t-amber-300 border-l-transparent" />}
                        {(['N', 'S', 'E', 'W'] as EdgeDir[]).map(dir => {
                          const b = map.boundaries?.[boundaryKey(x, y, dir)]
                          if (!b) return null
                          const type = b.wall !== undefined ? b.wall : b.door ? 1 : 0
                          return <EdgeStripe key={dir} dir={dir} type={type} cellSize={cellSize} />
                        })}
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
  activeMap, party, gold, facing,
  customBase, customOverlay, isCellRevealed, revealedBoundaries, bumpTrigger,
  flags,
  onMoveForward, onMoveBack, onTurnLeft, onTurnRight, onInteract,
}: PlayWorkspaceProps) {
  const [cellSize, setCellSize] = useState(DEFAULT_CELL + 6)
  const [view, setView] = useState<'3d' | 'map'>('3d')
  const zoom = useCallback((delta: number) => {
    setCellSize(s => Math.max(MIN_CELL, Math.min(MAX_CELL, s + delta)))
  }, [])

  const viewRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!bumpTrigger) return
    const el = viewRef.current
    if (!el) return
    el.classList.remove('view-bump')
    void el.offsetHeight   // force reflow to restart animation
    el.classList.add('view-bump')
  }, [bumpTrigger])

  if (!activeMap) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
        No map — create one in the Map workspace
      </div>
    )
  }

  const px = activeMap.playerX; const py = activeMap.playerY

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
          <button
            onClick={() => setView(v => v === '3d' ? 'map' : '3d')}
            title={view === '3d' ? 'Switch to map view' : 'Switch to 3D view'}
            className="flex items-center gap-1 px-2 h-6 rounded text-xs text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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

      {/* Main viewport — 3D fills all available space; map view keeps existing scroll grid */}
      {view === '3d' ? (
        <div ref={viewRef} className="flex-1 min-h-0 bg-zinc-950 overflow-hidden">
          <FirstPersonView
            map={activeMap}
            facing={facing}
            customOverlay={customOverlay}
            isCellRevealed={isCellRevealed}
            revealedBoundaries={revealedBoundaries}
            flags={flags}
          />
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

      {/* Bottom bar: party HUD + blobber controls */}
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
