'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Coins, Map, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { baseDef, overlayDef, edgeDef, boundaryKey, DEFAULT_CELL, MIN_CELL, MAX_CELL } from '@/lib/constants'
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
const DEPTH_F = 0.62   // per-depth perspective shrink factor
const VP_X = VW / 2
const VP_Y = VH / 2

// Depth-scaled wall slice rect (wall face at depth d occupies this rect on screen)
function sliceRect(d: number) {
  if (d === 0) return { x1: 0, y1: 0, x2: VW, y2: VH }
  const f = Math.pow(DEPTH_F, d)
  const mx = (VW * (1 - f)) / 2
  const my = (VH * (1 - f)) / 2
  return { x1: mx, y1: my, x2: VW - mx, y2: VH - my }
}

// Dark fog blended on top of each face — linear ramp so d=1→0, d=5→0.72
function depthFog(d: number): number {
  return Math.min(0.72, Math.max(0, (d - 1) * 0.18))
}

// ── Wall colours (Phantasy Star II blue-stone palette) ─────────────────────────
function frontWallColor(d: number): string {
  const l = Math.max(10, 58 - (d - 1) * 11)
  return `hsl(215 18% ${l}%)`
}
function sideWallColor(d: number): string {
  const l = Math.max(7, 42 - (d - 1) * 9)
  return `hsl(215 14% ${l}%)`
}

// ── Floor bands (cool checker, Phantasy Star perspective grid) ─────────────────
// Band d: y from sliceRect(d).y2 (top of band) down to sliceRect(d-1).y2 (bottom)
//   d=1 → closest to player (bottom of screen)
//   d=MAX_D → nearest the horizon (thin band)
function floorBandY(d: number): number {
  return sliceRect(d).y2
}
function floorBandColor(d: number): string {
  // Nearest=brightest, farthest=darkest. Alternating checkerish tint.
  const base = Math.max(6, 17 - d * 2)
  const alt  = d % 2 === 0 ? 4 : 0
  return `hsl(225 12% ${base + alt}%)`
}

// ── Ceiling bands (warm stone, Eye of the Beholder style) ─────────────────────
// Band d: y from sliceRect(d-1).y1 (top) down to sliceRect(d).y1 (bottom)
//   d=1 → closest (top of screen)  d=MAX_D → near horizon (thin)
function ceilBandY(d: number): number {
  return sliceRect(d).y1
}
function ceilBandColor(d: number): string {
  const base = Math.max(7, 22 - d * 3)
  const alt  = d % 2 === 0 ? 3 : 0
  return `hsl(28 14% ${base + alt}%)`
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
function isWall(map: MapData, x: number, y: number, customBase: Record<number, MarkerDef>): boolean {
  const cell = map.cells[`${x},${y}`]
  if (!cell) return true
  const def = baseDef(cell.base ?? 0, customBase)
  return (cell.base ?? 0) === 0 || def.label.toLowerCase().includes('wall')
}
function hasBoundaryWall(map: MapData, x: number, y: number, dir: EdgeDir): boolean {
  const b = map.boundaries?.[boundaryKey(x, y, dir)]
  if (!b) return false
  return (b.wall !== undefined && b.wall !== 3) || (b.door !== undefined && b.door.state !== 'open')
}

// ── SVG component ──────────────────────────────────────────────────────────────

interface FirstPersonViewProps {
  map: MapData
  facing: Facing
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
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
    if (hasBoundaryWall(map, cx, cy, frontOf(facing))) return true
    const [nx, ny] = cellAt(ahead + 1, 0)
    return isWall(map, nx, ny, customBase) || !isCellRevealed(nx, ny)
  }
  function hasSideWall(ahead: number, side: 'left' | 'right'): boolean {
    const s = side === 'right' ? 1 : -1
    const [cx, cy] = cellAt(ahead, 0)
    const dir = side === 'right' ? rightOf(facing) : leftOf(facing)
    if (hasBoundaryWall(map, cx, cy, dir)) return true
    const [sx, sy] = cellAt(ahead, s)
    return isWall(map, sx, sy, customBase) || !isCellRevealed(sx, sy)
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
      <rect key={`cb${d}`} x={0} y={y0} width={VW} height={y1 - y0} fill={ceilBandColor(d + 1)} />,
    )
  }

  // Ceiling: stone-block mortar grid (static, not perspective-corrected — EotB vibe)
  nodes.push(
    <defs key="stone-defs">
      <pattern id="stone-grid" x={0} y={0} width={48} height={24} patternUnits="userSpaceOnUse">
        <rect width={48} height={24} fill="none" />
        <rect width={47} height={23} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={1} />
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
        stroke="rgba(0,0,0,0.22)" strokeWidth={0.8} />,
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
      <rect key={`fb${d}`} x={0} y={y0} width={VW} height={y1 - y0} fill={floorBandColor(d)} />,
    )
  }

  // Floor: perspective grid lines — 4 vertical converging + horizontal depth markers
  for (let i = 0; i <= 4; i++) {
    const xBot = (i / 4) * VW
    nodes.push(
      <line key={`fvl${i}`} x1={VP_X} y1={VP_Y} x2={xBot} y2={VH}
        stroke="rgba(0,0,0,0.30)" strokeWidth={0.8} />,
    )
  }
  for (let d = 1; d <= MAX_D; d++) {
    nodes.push(
      <line key={`fhl${d}`} x1={0} y1={floorBandY(d)} x2={VW} y2={floorBandY(d)}
        stroke="rgba(0,0,0,0.22)" strokeWidth={0.6} />,
    )
  }

  // Floor: brighten the nearest band a little (torch-light spill)
  nodes.push(
    <rect key="floor-glow" x={0} y={floorBandY(1)} width={VW} height={VH - floorBandY(1)}
      fill="rgba(180,160,100,0.06)" />,
  )

  // ── 3. Walls — back to front ──────────────────────────────────────────────────
  for (let d = MAX_D; d >= 1; d--) {
    const cur = sliceRect(d - 1)
    const far = sliceRect(d)
    const fog = depthFog(d)

    // Front wall
    if (hasFrontWall(d - 1)) {
      const fw = far.x2 - far.x1
      const fh = far.y2 - far.y1
      nodes.push(
        // Base fill
        <rect key={`fw${d}`} x={far.x1} y={far.y1} width={fw} height={fh}
          fill={frontWallColor(d)} />,
        // Subtle vertical panel lines (Phantasy Star stonework)
        <line key={`fwl${d}`} x1={far.x1 + fw * 0.33} y1={far.y1} x2={far.x1 + fw * 0.33} y2={far.y2}
          stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />,
        <line key={`fwr${d}`} x1={far.x1 + fw * 0.67} y1={far.y1} x2={far.x1 + fw * 0.67} y2={far.y2}
          stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />,
        // Top highlight edge
        <line key={`fwt${d}`} x1={far.x1} y1={far.y1} x2={far.x2} y2={far.y1}
          stroke={`hsl(215 30% ${Math.min(72, 72 - (d - 1) * 12)}%)`} strokeWidth={1} />,
        // Depth fog overlay
        fog > 0 && <rect key={`fwf${d}`} x={far.x1} y={far.y1} width={fw} height={fh}
          fill={`rgba(0,0,0,${fog})`} />,
      )
    }

    // Left side wall (trapezoid connecting cur-left to far-left edges)
    if (hasSideWall(d - 1, 'left')) {
      const pts = [
        `${cur.x1},${cur.y1}`,
        `${far.x1},${far.y1}`,
        `${far.x1},${far.y2}`,
        `${cur.x1},${cur.y2}`,
      ].join(' ')
      nodes.push(
        <polygon key={`lw${d}`} points={pts} fill={sideWallColor(d)} />,
        // Outer bright edge (left column seam)
        <line key={`lwe${d}`} x1={cur.x1} y1={cur.y1} x2={cur.x1} y2={cur.y2}
          stroke={`hsl(215 25% ${Math.min(55, 55 - (d - 1) * 10)}%)`} strokeWidth={1} />,
        fog > 0 && <polygon key={`lwf${d}`} points={pts} fill={`rgba(0,0,0,${fog * 0.8})`} />,
      )
    }

    // Right side wall
    if (hasSideWall(d - 1, 'right')) {
      const pts = [
        `${cur.x2},${cur.y1}`,
        `${far.x2},${far.y1}`,
        `${far.x2},${far.y2}`,
        `${cur.x2},${cur.y2}`,
      ].join(' ')
      nodes.push(
        <polygon key={`rw${d}`} points={pts} fill={sideWallColor(d)} />,
        <line key={`rwe${d}`} x1={cur.x2} y1={cur.y1} x2={cur.x2} y2={cur.y2}
          stroke={`hsl(215 25% ${Math.min(55, 55 - (d - 1) * 10)}%)`} strokeWidth={1} />,
        fog > 0 && <polygon key={`rwf${d}`} points={pts} fill={`rgba(0,0,0,${fog * 0.8})`} />,
      )
    }
  }

  // ── 4. Entities at visible depths ─────────────────────────────────────────────
  // Show the first overlay icon/emoji we can see looking forward, at its correct depth
  for (let d = 1; d <= MAX_D; d++) {
    if (hasFrontWall(d - 1)) break   // wall blocks line of sight
    const [fx, fy] = cellAt(d, 0)
    const frontCell = map.cells[`${fx},${fy}`]
    if (!frontCell) continue
    const icons = (frontCell.overlays ?? [])
      .map(o => overlayDef(o, customOverlay)?.icon)
      .filter((x): x is string => Boolean(x))
    if (icons.length === 0) continue

    const face = sliceRect(d - 1)
    const face1 = sliceRect(d)
    const cx = VP_X
    const cy = VP_Y
    const faceW = face.x2 - face.x1
    const faceH = face.y2 - face.y1
    const iconSize = Math.max(10, faceW * 0.26)
    const shadowH = Math.max(2, faceH * 0.06)
    const shadowW = Math.max(4, faceW * 0.18)
    // Depth shadow ellipse under the sprite
    nodes.push(
      <ellipse key={`eshadow${d}`}
        cx={cx} cy={face.y2 - faceH * 0.1}
        rx={shadowW} ry={shadowH}
        fill={`rgba(0,0,0,${0.4 + d * 0.08})`} />,
    )
    // Depth fog on entity matches wall fog
    const entFog = depthFog(d)
    nodes.push(
      <text key={`eicon${d}`}
        x={cx} y={cy + faceH * 0.08}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={iconSize}
        opacity={1 - entFog * 0.6}
      >
        {icons[0]}
      </text>,
      // Subtle dark drop-shadow effect
      entFog > 0 && <rect key={`efog${d}`}
        x={face1.x1} y={face1.y1}
        width={face1.x2 - face1.x1} height={face1.y2 - face1.y1}
        fill={`rgba(0,0,0,${entFog * 0.5})`} />,
    )
    break  // only render the nearest visible entity
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
      {nodes}
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
                gap: '1px', backgroundColor: '#0a0a0c',
              }}>
                {Array.from({ length: rows }, (_, ri) => {
                  const y = minY + ri
                  return Array.from({ length: cols }, (_, ci) => {
                    const x = minX + ci
                    const key = `${x},${y}`
                    const isPlayer = x === px && y === py
                    const revealed = isCellRevealed(x, y)
                    const cell = map.cells[key] ?? EMPTY_CELL
                    if (!revealed) return <div key={key} style={{ width: cellSize, height: cellSize, background: '#0a0a0c' }} />
                    const bg = (cell.base ?? 0) !== 0 ? baseDef(cell.base, customBase).color : '#18181b'
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
  customBase, customOverlay, isCellRevealed,
  onMoveForward, onMoveBack, onTurnLeft, onTurnRight, onInteract,
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
        <div className="flex-1 min-h-0 bg-zinc-950 overflow-hidden">
          <FirstPersonView
            map={activeMap}
            facing={facing}
            customBase={customBase}
            customOverlay={customOverlay}
            isCellRevealed={isCellRevealed}
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
