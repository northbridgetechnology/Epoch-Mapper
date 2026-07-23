'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Coins, Map, Eye, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { baseDef, overlayDef, edgeDef, boundaryKey, DEFAULT_CELL, MIN_CELL, MAX_CELL, BASE, EDGE } from '@/lib/constants'
import type { CellData, MapData, MarkerDef, EdgeDir } from '@/lib/types'
import { getTheme, type MapThemeDef } from '@/lib/themes'
import { textureImageHref } from '@/lib/textures'
import { getSubcubeDef } from '@/lib/subcube-defs'
import { pixelSprite, pixelSpriteRect, spriteAspect, creatureSprite } from '@/lib/pixel-sprites'
import { computeLightRadius, cellHasTrick, listFoes } from '@/lib/exploration'
import type { BoundaryData, CellEntity, Character, Facing, Formation, ItemInstance, Ruleset, MoveAnimSpeed } from '@/lib/engine-types'
import { MOVE_ANIM_MS } from '@/lib/engine-types'
import { objectUsedFlagKey, effectiveDoorState, npcRecruitedFlagKey } from '@/lib/event-engine'
import type { BattleViewState } from '@/lib/battle-scene'
import type { CombatState } from '@/lib/combat-engine'
import { useBattleController, BattleHud, BattleOutcomeOverlay } from '@/components/BattleHud'
import { GameMenu } from '@/components/GameMenu'
import { Minimap } from '@/components/Minimap'
import { PROFILE_URL as COFFEE_URL } from '@/components/BuyMeACoffee'
import { music } from '@/lib/audio-controller'

// ── Props ─────────────────────────────────────────────────────────────────────

interface PlayWorkspaceProps {
  activeMap: MapData | null
  party: Character[]
  gold: number
  stepsTaken?: number
  facing: Facing
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  revealedBoundaries?: Set<string>
  bumpTrigger?: number
  flags: Record<string, boolean | number | string>
  combat?: CombatState | null
  ruleset: Ruleset
  inventory: ItemInstance[]
  /** Benched members (roster/bench) — for the in-play menu's Party screen. */
  reserve?: Character[]
  /** Roster edits from the in-play menu (equip, party order, bench/field). */
  onRosterChange?: (party: Character[], formation: Formation, reserve: Character[]) => void
  /** Formation for the menu's Party screen. */
  formation?: Formation
  /** Inventory/gold edits from the menu (item use). */
  onInventoryChange?: (inventory: ItemInstance[], gold: number) => void
  onCombatAction: (next: CombatState) => void
  onCombatEnd: () => void
  onMoveForward: () => void
  onMoveBack: () => void
  onTurnLeft: () => void
  onTurnRight: () => void
  onInteract: () => void
  /** Camp/rest (Batch B). Absent = feature hidden. */
  onRest?: () => void
  /** Save slots. canSaveHere reflects the ruleset's savePolicy. */
  canSaveHere?: boolean
  onSaveSlot?: (slot: number) => void
  onLoadSlot?: (slot: number) => void
  /** Notify the host when the in-play menu opens/closes (to gate movement). */
  onMenuOpenChange?: (open: boolean) => void
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

function PartyHud({ party, gold, steps }: { party: Character[]; gold: number; steps?: number }) {
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
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" title="Enjoying Epoch? Buy me a coffee ☕"
          className="flex items-center px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-900/60 hover:border-amber-400/40 hover:bg-zinc-800 transition-colors">
          <span className="text-sm leading-none">☕</span>
        </a>
        {steps != null && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-zinc-900/60" title="Steps taken">
            <span className="text-sm leading-none">👣</span>
            <span className="text-sm font-semibold text-white/60 tabular-nums">{steps}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-950/20">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-sm font-semibold text-amber-300 tabular-nums">{gold}</span>
        </div>
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

// ── Perspective floor/ceiling texture casting ───────────────────────────────────
// SVG can't project a texture per-pixel, so we slice the floor (and ceiling) into
// thin horizontal strips and give each strip an affine patternTransform that is
// EXACT at the strip's centre depth and a close linear approximation across its
// small height. The tile represents one world cell (TEX_CELL px), and the
// transform is anchored to the player's world position + facing so the texture is
// glued to the floor — it flows toward the camera as you step and rotates on turns.
const TEX_CELL = 128

/** patternTransform (pattern→screen) for one floor/ceiling strip at depth z0,
 *  for a camera at world (camX,camY) with forward (fx,fy) and right (rx,ry). */
function stripMatrixCam(
  surface: 'floor' | 'ceiling', camX: number, camY: number,
  fx: number, fy: number, rx: number, ry: number, z0: number,
): string {
  const y0   = surface === 'floor' ? VP_Y + PF_Y / z0 : VP_Y - PF_Y / z0
  const dzdy = (surface === 'floor' ? -1 : 1) * (z0 * z0) / PF_Y  // ∂depth/∂screenY at z0
  const Lx = z0 / PF_X, L0 = -Lx * VP_X   // lateral: worldLat = Lx*sx + L0
  const Zc = z0 - dzdy * y0               // depth:   z = dzdy*sy + Zc
  const C = TEX_CELL
  // screen → pattern (u,v) = world*CELL, affine in (sx,sy)
  const P11 = C * rx * Lx, P12 = C * fx * dzdy, P13 = C * (camX + fx * Zc + rx * L0)
  const P21 = C * ry * Lx, P22 = C * fy * dzdy, P23 = C * (camY + fy * Zc + ry * L0)
  const det = P11 * P22 - P12 * P21
  if (!isFinite(det) || Math.abs(det) < 1e-9) return 'matrix(1 0 0 1 0 0)'
  // invert to pattern → screen for patternTransform
  const a = P22 / det, c = -P12 / det, b = -P21 / det, d = P11 / det
  const e = -(a * P13 + c * P23), f = -(b * P13 + d * P23)
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`
}

/** Cardinal-facing floor/ceiling strip transform (camera at the player cell). */
function stripMatrix(surface: 'floor' | 'ceiling', px: number, py: number, facing: Facing, z0: number): string {
  const [fx, fy] = facingDelta(facing)
  const [rx, ry] = rightDelta(facing)
  return stripMatrixCam(surface, px, py, fx, fy, rx, ry, z0)
}

const TEX_STRIPS = 30  // horizontal slices per surface — more = smoother recession

// ── Geometry / wall queries ────────────────────────────────────────────────────

type CellKind = 'wall' | 'open' | 'water' | 'lava' | 'void' | 'stairs_up' | 'stairs_down'

function getCellKind(map: MapData, x: number, y: number): CellKind {
  const cell = map.cells[`${x},${y}`]
  if (!cell) return 'wall'
  switch (cell.base ?? 0) {
    case 0:                return 'wall'
    case BASE.WATER:       return 'water'
    case BASE.LAVA:        return 'lava'
    case BASE.VOID:        return 'void'
    case BASE.STAIRS_UP:   return 'stairs_up'
    case BASE.STAIRS_DOWN: return 'stairs_down'
    default:               return 'open'  // BASE.WALL (2) is an invisible solid — transparent in 3D
  }
}

function isWall(map: MapData, x: number, y: number): boolean {
  return getCellKind(map, x, y) === 'wall'
}
function hasBoundaryWall(
  map: MapData, x: number, y: number, dir: EdgeDir,
  revealedBoundaries?: Set<string>,
  flags?: Record<string, boolean | number | string>,
): boolean {
  const bk = boundaryKey(x, y, dir)
  const b = map.boundaries?.[bk]
  if (!b) return false
  const doorOpen = b.door ? effectiveDoorState(b.door, flags ?? {}) === 'open' : false
  if (b.wall !== undefined) {
    if (b.wall === EDGE.ILLUSORY) return revealedBoundaries ? !revealedBoundaries.has(bk) : true
    if (b.wall === EDGE.DOOR) return b.door ? !doorOpen : true
    return true
  }
  return b.door !== undefined && !doorOpen
}

// ── SVG component ──────────────────────────────────────────────────────────────

interface FirstPersonViewProps {
  map: MapData
  facing: Facing
  customOverlay: Record<number, MarkerDef>
  isCellRevealed: (x: number, y: number) => boolean
  revealedBoundaries?: Set<string>
  flags: Record<string, boolean | number | string>
  battle?: BattleViewState | null
  ruleset?: Ruleset
  /** View distance in cells (dark maps). Absent = unlimited (lit map). */
  lightRadius?: number
}

function FirstPersonView({ map, facing, isCellRevealed, revealedBoundaries, flags, battle, ruleset, lightRadius }: FirstPersonViewProps) {
  const [fd0, fd1] = facingDelta(facing)
  const [rd0, rd1] = rightDelta(facing)
  const px = map.playerX
  const py = map.playerY
  const theme = getTheme(map.theme)
  const pal = makeFpPalette(theme)

  // ── Textures (Tier 2): optional per-surface relief composited over the themed
  // geometry with soft-light blending. Absent = classic flat HSL palette. ──────
  const texAssets = map.textureAssets
  const wallHref  = textureImageHref(map.textures?.wall,    { hue: theme.wallHue,  sat: theme.wallSat,  light: theme.wallLBase },  texAssets)
  const floorHref = textureImageHref(map.textures?.floor,   { hue: theme.floorHue, sat: theme.floorSat, light: theme.floorLBase }, texAssets)
  const ceilHref  = textureImageHref(map.textures?.ceiling, { hue: theme.ceilHue,  sat: theme.ceilSat,  light: theme.ceilLBase },  texAssets)
  // Revision token woven into every texture pattern id. SVG paint servers are
  // cached by id: if we kept ids stable and only swapped the <image href>,
  // Chromium would keep painting shapes from the stale pattern (and the strip
  // patterns that inherit the base image cache it too) — so a texture swap would
  // never show in Play. Changing the id on every selection forces fresh nodes.
  // The useId prefix keeps ids unique per instance, so the two frames rendered
  // during a movement transition don't collide (url(#id) picks the first match).
  const uid = useId().replace(/[^a-z0-9]/gi, '')
  const texRev = `${uid}-${`${map.textures?.wall ?? ''}-${map.textures?.floor ?? ''}-${map.textures?.ceiling ?? ''}`.replace(/[^a-z0-9]/gi, '')}` || '0'
  const wallPatId = `fp-tex-wall-${texRev}`
  const texWall = (key: string, x: number, y: number, w: number, h: number) => wallHref
    ? <rect key={key} x={x} y={y} width={w} height={h} fill={`url(#${wallPatId})`} style={{ mixBlendMode: 'soft-light' }} opacity={0.9} />
    : null
  const texPoly = (key: string, points: string) => wallHref
    ? <polygon key={key} points={points} fill={`url(#${wallPatId})`} style={{ mixBlendMode: 'soft-light' }} opacity={0.8} />
    : null

  // Perspective floor/ceiling: one shared base pattern (holds the image once) +
  // per-strip patterns that only carry a patternTransform, so custom uploads
  // aren't duplicated across strips. Returns the <pattern> defs and the strip
  // <rect>s to composite over the shaded bands.
  const castSurface = (surface: 'floor' | 'ceiling', href: string | null) => {
    if (!href) return { patterns: [] as React.ReactNode[], rects: [] as React.ReactNode[] }
    const baseId = `fp-tex-${surface}-${texRev}-base`
    const patterns: React.ReactNode[] = [
      <pattern key="base" id={baseId} patternUnits="userSpaceOnUse" width={TEX_CELL} height={TEX_CELL}>
        <image href={href} x={0} y={0} width={TEX_CELL} height={TEX_CELL} preserveAspectRatio="xMidYMid slice" />
      </pattern>,
    ]
    const rects: React.ReactNode[] = []
    const top0   = surface === 'floor' ? VP_Y : 0
    const stripH = (surface === 'floor' ? VH - VP_Y : VP_Y) / TEX_STRIPS
    for (let i = 0; i < TEX_STRIPS; i++) {
      const top  = top0 + i * stripH
      const midY = top + stripH / 2
      const dy   = surface === 'floor' ? midY - VP_Y : VP_Y - midY
      if (dy <= 0.5) continue
      const z0 = PF_Y / dy
      if (z0 > 12) continue   // near the horizon: too far to matter, left to fog
      const id = `fp-tex-${surface}-${texRev}-${i}`
      patterns.push(<pattern key={i} id={id} href={`#${baseId}`} patternTransform={stripMatrix(surface, px, py, facing, z0)} />)
      rects.push(<rect key={`${surface}str${i}`} x={0} y={top} width={VW} height={stripH + 0.6}
        fill={`url(#${id})`} style={{ mixBlendMode: 'soft-light' }} opacity={surface === 'floor' ? 0.8 : 0.72} />)
    }
    return { patterns, rects }
  }
  const floorCast = castSurface('floor', floorHref)
  const ceilCast  = castSurface('ceiling', ceilHref)

  // Light: on dark maps the world fades to black beyond the party's light
  // radius. lightExtra ramps 0 → 0.55 at the radius edge → 1 one cell beyond.
  const liveFoes = listFoes(map, flags).filter(f => !f.dead)

  const viewD = lightRadius === undefined ? MAX_D : Math.max(1, Math.min(MAX_D, Math.floor(lightRadius)))
  const lightExtra = (dd: number) => viewD >= MAX_D ? 0 : Math.max(0, Math.min(1, (dd - viewD + 1) * 0.55))
  const fogAt = (dd: number) => Math.min(1, depthFog(dd) + lightExtra(dd))

  function cellAt(ahead: number, side: number): [number, number] {
    return [px + fd0 * ahead + rd0 * side, py + fd1 * ahead + rd1 * side]
  }
  function hasSideWallAt(d: number, s: number, side: 'left' | 'right'): boolean {
    const [cx, cy] = cellAt(d, s)
    const dir = side === 'right' ? rightOf(facing) : leftOf(facing)
    if (hasBoundaryWall(map, cx, cy, dir, revealedBoundaries, flags)) return true
    const sideS = side === 'right' ? s + 1 : s - 1
    if (sideS < -MAX_S || sideS > MAX_S) return true
    const [sx, sy] = cellAt(d, sideS)
    return isWall(map, sx, sy) || !isCellRevealed(sx, sy)
  }

  const nodes: React.ReactNode[] = []

  // Texture pattern defs — one tile per wall face (objectBoundingBox) so bricks
  // stay a consistent size near and far; tiled floor/ceiling planes in screen space.
  if (wallHref || floorHref || ceilHref) {
    nodes.push(
      <defs key="tex-defs">
        {wallHref && (
          // Screen-space tiled wall pattern. objectBoundingBox tiles (one image
          // per face) don't render reliably in Chromium — the pattern content
          // collapses — and can't follow the side-wall trapezoids anyway, so we
          // tile in user space like the floor/ceiling. Front-wall rects and
          // side-wall polygons both fill from this one pattern; the coursing
          // stays continuous across adjacent faces.
          <pattern id={wallPatId} patternUnits="userSpaceOnUse" width={92} height={92}>
            <image href={wallHref} x="0" y="0" width={92} height={92} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        {floorCast.patterns}
        {ceilCast.patterns}
      </defs>,
    )
  }

  // ── Wall-mounted switch lever ────────────────────────────────────────────────
  // Drawn on a visible wall face when its boundary carries a switch whose face
  // points toward the player (mounted side only). Plate colours derive from
  // the theme palette so the mount matches the surrounding wall.
  const OPP_DIR: Record<EdgeDir, EdgeDir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
  function drawWallSwitch(
    ncx: number, ncy: number,
    near: { x1: number; y1: number; x2: number; y2: number },
    d: number, s: number,
  ) {
    const sw = map.boundaries?.[boundaryKey(ncx, ncy, frontOf(facing))]?.switch
    if (!sw || sw.facing !== OPP_DIR[facing as unknown as EdgeDir]) return
    const on = !!flags[sw.flag]
    const fw = near.x2 - near.x1
    const fh = near.y2 - near.y1
    const size = Math.max(8, Math.min(fw * 0.16, fh * 0.24))
    const spr = pixelSprite(on ? 'lever_on' : 'lever_off',
      near.x1 + fw / 2, near.y1 + fh * 0.52, size,
      `swl_${d}_${s}`, Math.max(0.3, 1 - fogAt(d)))
    if (spr) nodes.push(spr)
  }

  // ── Wall inscription plaque ──────────────────────────────────────────────────
  // A carved stone tablet on the wall face when the boundary carries an
  // inscription readable from this side (facing rules match switches).
  function drawWallInscription(
    ncx: number, ncy: number,
    near: { x1: number; y1: number; x2: number; y2: number },
    d: number, s: number,
  ) {
    const insc = map.boundaries?.[boundaryKey(ncx, ncy, frontOf(facing))]?.inscription
    if (!insc) return
    if (insc.facing && insc.facing !== OPP_DIR[facing as unknown as EdgeDir]) return
    const fw = near.x2 - near.x1
    const fh = near.y2 - near.y1
    const pw = fw * 0.42, ph = fh * 0.30
    const pxx = near.x1 + (fw - pw) / 2
    const pyy = near.y1 + fh * 0.26
    const op = Math.max(0.15, 1 - fogAt(d))
    const lines = Math.min(4, Math.max(2, insc.text.join(' ').length > 40 ? 4 : 3))
    const lineNodes: React.ReactNode[] = []
    for (let li = 0; li < lines; li++) {
      const ly = pyy + ph * (0.25 + (li * 0.55) / lines)
      const inset = li === lines - 1 ? 0.30 : 0.14   // last line shorter, like real epitaphs
      lineNodes.push(<line key={li} x1={pxx + pw * inset} y1={ly} x2={pxx + pw * (1 - inset)} y2={ly}
        stroke="rgba(0,0,0,0.55)" strokeWidth={Math.max(0.8, ph * 0.06)} />)
    }
    nodes.push(
      <g key={`insc_${d}_${s}`} opacity={op}>
        <rect x={pxx - fw * 0.015} y={pyy - fh * 0.015} width={pw + fw * 0.03} height={ph + fh * 0.03}
          rx={2} fill="rgba(0,0,0,0.35)" />
        <rect x={pxx} y={pyy} width={pw} height={ph} rx={1.5} fill={pal.frontWall(Math.max(1, d - 1))} />
        <rect x={pxx} y={pyy} width={pw} height={ph * 0.12} fill="rgba(255,255,255,0.08)" />
        {lineNodes}
      </g>,
    )
  }

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
      lightExtra(d) > 0 && <rect key={`cbl${d}`} x={0} y={y0} width={VW} height={y1 - y0} fill={`rgba(0,0,0,${lightExtra(d)})`} />,
    )
  }

  // Ceiling texture: perspective-cast strips blended over the shaded bands; the
  // mortar grid below is redrawn on top so seams stay crisp.
  if (ceilHref) nodes.push(...ceilCast.rects)

  // Ceiling: perspective-correct mortar grid — transverse lines at each depth
  // plane, longitudinal seams at cell boundaries converging on the VP
  nodes.push(
    <defs key="ceil-defs">
      <linearGradient id="ceil-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
      </linearGradient>
      <linearGradient id="ao-up" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.50)" />
      </linearGradient>
    </defs>,
  )
  for (let d = 0; d <= MAX_D; d++) {
    nodes.push(
      <line key={`chl${d}`} x1={0} y1={ceilBandY(d)} x2={VW} y2={ceilBandY(d)}
        stroke={theme.ceilPatternColor} strokeWidth={0.7} />,
    )
  }
  for (let k = -MAX_S; k <= MAX_S + 1; k++) {
    const kk = k - 0.5   // seams sit on cell boundaries (±0.5, ±1.5, …)
    nodes.push(
      <line key={`cll${k}`}
        x1={VP_X + (kk * PF_X) / 0.3} y1={VP_Y - PF_Y / 0.3}
        x2={VP_X + (kk * PF_X) / (MAX_D + 1)} y2={VP_Y - PF_Y / (MAX_D + 1)}
        stroke={theme.ceilPatternColor} strokeWidth={0.7} />,
    )
  }
  nodes.push(
    <rect key="ceil-fade" x={0} y={0} width={VW} height={VP_Y} fill="url(#ceil-fade)" />,
  )

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
      lightExtra(d) > 0 && <rect key={`fbl${d}`} x={0} y={y0} width={VW} height={y1 - y0} fill={`rgba(0,0,0,${lightExtra(d)})`} />,
    )
  }

  // Floor texture: perspective-cast strips blended over the shaded bands; the
  // perspective grid below is redrawn on top so seams stay crisp.
  if (floorHref) nodes.push(...floorCast.rects)

  // Floor: longitudinal seams at cell boundaries (mirror of the ceiling grid)
  for (let k = -MAX_S; k <= MAX_S + 1; k++) {
    const kk = k - 0.5
    nodes.push(
      <line key={`fll${k}`}
        x1={VP_X + (kk * PF_X) / 0.3} y1={VP_Y + PF_Y / 0.3}
        x2={VP_X + (kk * PF_X) / (MAX_D + 1)} y2={VP_Y + PF_Y / (MAX_D + 1)}
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
      const fog  = fogAt(d)
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
          texWall(`fwt_tex_${d}_${s}`, near.x1, near.y1, fw, fh),
          <line key={`fwl_${d}_${s}`} x1={near.x1 + fw * 0.33} y1={near.y1} x2={near.x1 + fw * 0.33} y2={near.y2} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />,
          <line key={`fwr_${d}_${s}`} x1={near.x1 + fw * 0.67} y1={near.y1} x2={near.x1 + fw * 0.67} y2={near.y2} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />,
          <line key={`fwt_${d}_${s}`} x1={near.x1} y1={near.y1} x2={near.x2} y2={near.y1} stroke={pal.wallEdge(d)} strokeWidth={1} />,
          <rect key={`fwao_${d}_${s}`} x={near.x1} y={near.y1 - fh * 0.08} width={fw} height={fh * 0.08} fill="url(#ao-up)" />,
          fog > 0 && <rect key={`fwf_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog})`} />,
        )
        drawWallSwitch(ncx, ncy, near, d, s)
        drawWallInscription(ncx, ncy, near, d, s)
        continue
      }

      // Side walls bounding this open cell
      if (hasSideWallAt(d, s, 'left')) {
        const pts = `${near.x1},${near.y1} ${far.x1},${far.y1} ${far.x1},${far.y2} ${near.x1},${near.y2}`
        nodes.push(
          <polygon key={`lw_${d}_${s}`}  points={pts} fill={pal.sideWall(d)} />,
          texPoly(`lw_tex_${d}_${s}`, pts),
          <polygon key={`lwao_${d}_${s}`}
            points={`${near.x1},${near.y1} ${far.x1},${far.y1} ${far.x1},${far.y1 - (far.y2 - far.y1) * 0.07} ${near.x1},${near.y1 - fh * 0.07}`}
            fill="rgba(0,0,0,0.26)" />,
          <line    key={`lwe_${d}_${s}`} x1={near.x1} y1={near.y1} x2={near.x1} y2={near.y2} stroke={pal.sideEdge(d)} strokeWidth={1} />,
          fog > 0 && <polygon key={`lwf_${d}_${s}`} points={pts} fill={`rgba(0,0,0,${fog * 0.8})`} />,
        )
      }
      if (hasSideWallAt(d, s, 'right')) {
        const pts = `${near.x2},${near.y1} ${far.x2},${far.y1} ${far.x2},${far.y2} ${near.x2},${near.y2}`
        nodes.push(
          <polygon key={`rw_${d}_${s}`}  points={pts} fill={pal.sideWall(d)} />,
          texPoly(`rw_tex_${d}_${s}`, pts),
          <polygon key={`rwao_${d}_${s}`}
            points={`${near.x2},${near.y1} ${far.x2},${far.y1} ${far.x2},${far.y1 - (far.y2 - far.y1) * 0.07} ${near.x2},${near.y1 - fh * 0.07}`}
            fill="rgba(0,0,0,0.26)" />,
          <line    key={`rwe_${d}_${s}`} x1={near.x2} y1={near.y1} x2={near.x2} y2={near.y2} stroke={pal.sideEdge(d)} strokeWidth={1} />,
          fog > 0 && <polygon key={`rwf_${d}_${s}`} points={pts} fill={`rgba(0,0,0,${fog * 0.8})`} />,
        )
      }

      // Stairs: true-perspective step geometry, always receding away from the
      // viewer. Camera sits at the back of the player's cell, so a point at
      // depth-fraction t inside cell d is z = d + t; height u is measured in
      // wall-heights above the floor (0 = floor, 1 = ceiling).
      const kind = getCellKind(map, cx, cy)
      if (kind === 'stairs_down' || kind === 'stairs_up') {
        const zAt = (t: number) => Math.max(0.55, d + t)
        const sxAt = (z: number, fx: number) => VP_X + (s - 0.5 + fx) * (PF_X / z)
        const syAt = (z: number, u: number) => VP_Y + (PF_Y / z) * (1 - 2 * u)
        const quad = (t1: number, u1: number, t2: number, u2: number, fxa: number, fxb: number) => {
          const z1 = zAt(t1), z2 = zAt(t2)
          return `${sxAt(z1, fxa)},${syAt(z1, u1)} ${sxAt(z1, fxb)},${syAt(z1, u1)} ${sxAt(z2, fxb)},${syAt(z2, u2)} ${sxAt(z2, fxa)},${syAt(z2, u2)}`
        }
        const N = 4, fxa = 0.16, fxb = 0.84, t0 = 0.12
        const stepT = (i: number) => t0 + (1 - t0) * (i / N)
        if (kind === 'stairs_down') {
          // A hole in the floor: everything below floor level is only visible
          // THROUGH the opening, so the whole well is clipped to the opening's
          // floor-plane footprint. Near treads hide under the lip (correct —
          // you only see the deeper section), the shaft bottoms out in darkness.
          const zn = zAt(t0), zf = zAt(1)
          const uBot = -1.1
          const openPts = `${sxAt(zn, fxa)},${syAt(zn, 0)} ${sxAt(zn, fxb)},${syAt(zn, 0)} ${sxAt(zf, fxb)},${syAt(zf, 0)} ${sxAt(zf, fxa)},${syAt(zf, 0)}`
          const clipId = `stdn_${d}_${s}`
          nodes.push(<defs key={`${clipId}_def`}><clipPath id={clipId}><polygon points={openPts} /></clipPath></defs>)
          const well: React.ReactNode[] = []
          well.push(<polygon key="void" points={openPts} fill="hsl(240 10% 2%)" />)
          well.push(<polygon key="farw"
            points={`${sxAt(zf, fxa)},${syAt(zf, 0)} ${sxAt(zf, fxb)},${syAt(zf, 0)} ${sxAt(zf, fxb)},${syAt(zf, uBot)} ${sxAt(zf, fxa)},${syAt(zf, uBot)}`}
            fill="hsl(240 7% 7%)" />)
          for (const [fx, kn] of [[fxa, 'l'], [fxb, 'r']] as const) {
            well.push(<polygon key={`ch${kn}`}
              points={`${sxAt(zn, fx)},${syAt(zn, 0)} ${sxAt(zf, fx)},${syAt(zf, 0)} ${sxAt(zf, fx)},${syAt(zf, uBot)} ${sxAt(zn, fx)},${syAt(zn, uBot)}`}
              fill="hsl(240 7% 5%)" />)
          }
          // Treads, deepest first. Room light spills a short way into the
          // shaft — the upper treads get a warm wash, the last melts into the
          // void — and strong near-edge lips keep the steps legible.
          for (let i = N - 1; i >= 0; i--) {
            const u = -0.42 * ((i + 1) / N)
            const zi = zAt(stepT(i))
            const treadPts = quad(stepT(i), u, stepT(i + 1), u, fxa, fxb)
            well.push(
              <polygon key={`t${i}`} points={treadPts} fill={pal.floorBand(d)} />,
              <polygon key={`ts${i}`} points={treadPts}
                fill={i < 2 ? `rgba(255,220,160,${0.14 - 0.06 * i})` : `rgba(0,0,0,${0.18 + 0.3 * (i - 2)})`} />,
              <line key={`tl${i}`} x1={sxAt(zi, fxa)} y1={syAt(zi, u)} x2={sxAt(zi, fxb)} y2={syAt(zi, u)}
                stroke={`rgba(255,235,200,${Math.max(0.06, 0.26 - 0.07 * i)})`} strokeWidth={1} />,
            )
          }
          if (fog > 0) well.push(<polygon key="fog" points={openPts} fill={`rgba(0,0,0,${fog * 0.8})`} />)
          nodes.push(<g key={`stdng_${d}_${s}`} clipPath={`url(#${clipId})`}>{well}</g>)
          nodes.push(<line key={`strim_${d}_${s}`} x1={sxAt(zn, fxa)} y1={syAt(zn, 0)} x2={sxAt(zn, fxb)} y2={syAt(zn, 0)}
            stroke={pal.wallEdge(d)} strokeWidth={1} opacity={0.5} />)
        } else {
          // A solid staircase climbing the full wall height and passing through
          // a warm-lit opening cut into the ceiling plane. Painter order:
          // opening first, then side masses, then riser/tread faces far-to-near
          // so the top steps correctly occlude the hole they climb into.
          const zf = zAt(1)
          const tOpen = 0.45
          const zo = zAt(tOpen)
          const openPts = `${sxAt(zo, fxa)},${syAt(zo, 1)} ${sxAt(zo, fxb)},${syAt(zo, 1)} ${sxAt(zf, fxb)},${syAt(zf, 1)} ${sxAt(zf, fxa)},${syAt(zf, 1)}`
          nodes.push(
            <polygon key={`stuo_${d}_${s}`} points={openPts} fill="hsl(38 42% 26%)" />,
            <polygon key={`stuog_${d}_${s}`} points={openPts} fill="rgba(255,220,150,0.30)" />,
            <line key={`stuor_${d}_${s}`} x1={sxAt(zo, fxa)} y1={syAt(zo, 1)} x2={sxAt(zo, fxb)} y2={syAt(zo, 1)}
              stroke="rgba(255,225,170,0.45)" strokeWidth={1} />,
          )
          for (const [fx, kn] of [[fxa, 'l'], [fxb, 'r']] as const) {
            const pts: string[] = [`${sxAt(zAt(t0), fx)},${syAt(zAt(t0), 0)}`]
            for (let i = 0; i < N; i++) {
              const uHi = (i + 1) / N
              pts.push(`${sxAt(zAt(stepT(i)), fx)},${syAt(zAt(stepT(i)), uHi)}`)
              pts.push(`${sxAt(zAt(stepT(i + 1)), fx)},${syAt(zAt(stepT(i + 1)), uHi)}`)
            }
            pts.push(`${sxAt(zf, fx)},${syAt(zf, 0)}`)
            nodes.push(
              <polygon key={`stup_ch${kn}_${d}_${s}`} points={pts.join(' ')} fill={pal.sideWall(d)} />,
              <polygon key={`stup_chs${kn}_${d}_${s}`} points={pts.join(' ')} fill="rgba(0,0,0,0.25)" />,
            )
          }
          for (let i = N - 1; i >= 0; i--) {
            const uLo = i / N, uHi = (i + 1) / N
            const zi = zAt(stepT(i))
            const riserPts = `${sxAt(zi, fxa)},${syAt(zi, uLo)} ${sxAt(zi, fxb)},${syAt(zi, uLo)} ${sxAt(zi, fxb)},${syAt(zi, uHi)} ${sxAt(zi, fxa)},${syAt(zi, uHi)}`
            nodes.push(
              <polygon key={`sr_${d}_${s}_${i}`}  points={riserPts} fill={pal.frontWall(d)} />,
              <polygon key={`srw_${d}_${s}_${i}`} points={riserPts} fill={`rgba(255,220,150,${0.06 + 0.07 * i})`} />,
            )
            // The tread above the top riser is the floor of the level above —
            // it lives beyond the ceiling opening, so it isn't drawn
            if (i < N - 1) {
              nodes.push(
                <polygon key={`st_${d}_${s}_${i}`}  points={quad(stepT(i), uHi, stepT(i + 1), uHi, fxa, fxb)} fill={pal.floorBand(d)} />,
                <polygon key={`stw_${d}_${s}_${i}`} points={quad(stepT(i), uHi, stepT(i + 1), uHi, fxa, fxb)}
                  fill={`rgba(255,225,160,${0.06 + 0.08 * i})`} />,
              )
            }
          }
          if (fog > 0) nodes.push(<polygon key={`stf_${d}_${s}`} points={quad(t0, 0, 1, 1, fxa, fxb)} fill={`rgba(0,0,0,${fog * 0.8})`} />)
        }
      }

      // Special terrain floor quad — this cell's footprint only (water/lava/void)
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
      if (d <= viewD) drawCellEntities(d, s, entGroup)
      if (entGroup.length > 0) nodes.push(<g key={`ce_${d}_${s}`}>{entGroup}</g>)

      // Sub-cube dressing at true perspective depth. The camera sits at the
      // back of the player's cell, so an object at depth-fraction zFrac inside
      // cell d is z = d + zFrac cells out — including the player's own cell,
      // where anything level with or behind the camera (z < 0.5) is culled.
      {
        const scObjs = d <= viewD ? map.cells[`${cx},${cy}`]?.subcubeObjects : undefined
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
            const z = d + zFrac
            if (z < 0.5) continue
            const wallHalf = PF_Y / z   // wall half-height on screen at this depth
            const cellW = PF_X / z      // full cell width on screen at this depth

            // Wall-mounted kinds snap flush to the side wall of their column
            let ax = xFrac
            if (def.mount === 'wall') {
              if (xFrac < 0.34) ax = 0.05
              else if (xFrac > 0.66) ax = 0.95
            }
            const screenX = VP_X + (s - 0.5 + ax) * cellW

            const spriteH = wallHalf * 2 * def.scale
            const spriteW = spriteH / (spriteAspect(obj.kind) ?? 1)
            const floorY = VP_Y + wallHalf
            const ceilY  = VP_Y - wallHalf
            let screenY = VP_Y + wallHalf * (1 - 2 * yFrac)   // sub-cube centre
            if (def.mount === 'floor' && obj.pos.y === 0) screenY = floorY - spriteH / 2
            else if (def.mount === 'ceiling' && obj.pos.y === 2) screenY = ceilY + spriteH / 2

            const zFog = Math.min(0.72, Math.max(0, (z - 2) * 0.18))
            const opacity = Math.max(0.25, 1 - zFog * 1.8)
            if (obj.trigger) {
              const glowColor = obj.trigger === 'onInteract' ? 'rgba(56,189,248,0.30)' : obj.trigger === 'onView' ? 'rgba(52,211,153,0.30)' : 'rgba(251,191,36,0.30)'
              objNodes.push(<circle key={`scg_${d}_${s}_${obj.id}`} cx={screenX} cy={screenY} r={spriteH * 0.55} fill={glowColor} opacity={opacity} />)
            }
            objNodes.push(
              pixelSprite(obj.kind, screenX, screenY, spriteW, `sc_${d}_${s}_${obj.id}`, opacity)
              ?? <text key={`sc_${d}_${s}_${obj.id}`} x={screenX} y={screenY} textAnchor="middle" dominantBaseline="middle" fontSize={spriteH * 0.8} opacity={opacity} style={{ userSelect: 'none' }}>{def.icon}</text>,
            )
          }
          nodes.push(<g key={`scw_${d}_${s}`} clipPath={`url(#${clipId})`}>{objNodes}</g>)
        }
      }

      // Own-cell pass stops here: the near boundary plane sits behind the camera at d = 0
      if (d === 0) continue

      // Near boundary between (d-1,s) and (d,s): wall / door / revealed illusion
      const bk = boundaryKey(ncx, ncy, frontOf(facing))
      const fb = map.boundaries?.[bk] ?? null
      const blocked = hasBoundaryWall(map, ncx, ncy, frontOf(facing), revealedBoundaries, flags)
      const ghost = fb?.wall === EDGE.ILLUSORY && (revealedBoundaries?.has(bk) ?? false)
      const isDoor = fb?.wall === EDGE.DOOR

      const doorEff = fb?.door ? effectiveDoorState(fb.door, flags) : undefined
      if (ghost) {
        nodes.push(<rect key={`fwg_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill="rgba(160,200,255,0.12)" />)
      } else if (blocked && isDoor) {
        const locked = (doorEff ?? 'closed') === 'locked'
        const jamb = fw * 0.10, lintel = fh * 0.08, thresh = fh * 0.04
        const dpx = near.x1 + jamb, dpy = near.y1 + lintel
        const dpw = fw - jamb * 2,  dph = fh - lintel - thresh
        const woodL = Math.max(8, 28 - (d - 1) * 5)
        nodes.push(
          <rect key={`djl_${d}_${s}`} x={near.x1}        y={near.y1} width={jamb} height={fh}     fill={pal.frontWall(d)} />,
          <rect key={`djr_${d}_${s}`} x={near.x2 - jamb} y={near.y1} width={jamb} height={fh}     fill={pal.frontWall(d)} />,
          <rect key={`dlt_${d}_${s}`} x={near.x1}        y={near.y1} width={fw}   height={lintel}  fill={pal.frontWall(d)} />,
          <rect key={`dth_${d}_${s}`} x={near.x1}        y={near.y2 - thresh} width={fw} height={thresh} fill={pal.frontWall(d)} />,
          <rect key={`dao_${d}_${s}`} x={near.x1} y={near.y1 - fh * 0.08} width={fw} height={fh * 0.08} fill="url(#ao-up)" />,
          <rect key={`dp_${d}_${s}`}  x={dpx} y={dpy} width={dpw} height={dph} fill={`hsl(28 45% ${woodL}%)`} />,
          pixelSpriteRect('door_panel', dpx, dpy, dpw, dph, `dpt_${d}_${s}`, 0.9),
          <line key={`dpl1_${d}_${s}`} x1={dpx + dpw * 0.35} y1={dpy + dph * 0.04} x2={dpx + dpw * 0.35} y2={dpy + dph * 0.96} stroke="rgba(0,0,0,0.28)" strokeWidth={0.7} />,
          <line key={`dpl2_${d}_${s}`} x1={dpx + dpw * 0.65} y1={dpy + dph * 0.04} x2={dpx + dpw * 0.65} y2={dpy + dph * 0.96} stroke="rgba(0,0,0,0.28)" strokeWidth={0.7} />,
          <circle key={`dph_${d}_${s}`} cx={dpx + dpw * 0.74} cy={dpy + dph * 0.52} r={Math.max(1.5, fw * 0.028)} fill={locked ? '#b91c1c' : `hsl(44 80% ${Math.max(30, 50 - d * 4)}%)`} />,
          fog > 0 && <rect key={`dff_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog})`} />,
        )
        if (locked) nodes.push(<text key={`dlck_${d}_${s}`} x={dpx + dpw * 0.74} y={dpy + dph * 0.40} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(4, fw * 0.07)}>🔒</text>)
      } else if (blocked) {
        nodes.push(
          <rect key={`bw_${d}_${s}`}  x={near.x1} y={near.y1} width={fw} height={fh} fill={pal.frontWall(d)} />,
          texWall(`bw_tex_${d}_${s}`, near.x1, near.y1, fw, fh),
          <line key={`bwt_${d}_${s}`} x1={near.x1} y1={near.y1} x2={near.x2} y2={near.y1} stroke={pal.wallEdge(d)} strokeWidth={1} />,
          <rect key={`bwao_${d}_${s}`} x={near.x1} y={near.y1 - fh * 0.08} width={fw} height={fh * 0.08} fill="url(#ao-up)" />,
          fog > 0 && <rect key={`bwf_${d}_${s}`} x={near.x1} y={near.y1} width={fw} height={fh} fill={`rgba(0,0,0,${fog})`} />,
        )
        drawWallSwitch(ncx, ncy, near, d, s)
        drawWallInscription(ncx, ncy, near, d, s)
      } else if (isDoor && doorEff === 'open') {
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

    // ── FOE patrol standing in this cell (threat — draws above all else) ─────
    const foeHere = battle ? undefined : liveFoes.find(f => f.pos.x === fx && f.pos.y === fy)
    if (foeHere) {
      const def = ruleset?.enemies.find(en => en.id === foeHere.entity.enemy)
      const face = entFace
      const fh2 = face.y2 - face.y1
      const ncx = (face.x1 + face.x2) / 2
      const floor2 = face.y2
      const foeSize = Math.max(14, fh2 * 0.52)
      const foeFog = Math.max(0.35, 1 - depthFog(d) * 1.2)
      nodes.push(
        <g key={`foe_${d}_${s}`} opacity={foeFog}>
          <ellipse cx={ncx} cy={floor2 - fh2 * 0.02} rx={foeSize * 0.45} ry={foeSize * 0.11} fill="rgba(0,0,0,0.55)" />
          <ellipse cx={ncx} cy={floor2 - fh2 * 0.02} rx={foeSize * 0.5} ry={foeSize * 0.13} fill="none" stroke="rgba(239,68,68,0.55)" strokeWidth={1.5}>
            <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
          </ellipse>
          {(def && creatureSprite({ sprite: def.sprite, id: def.id, name: def.name },
            ncx, floor2 - foeSize * 0.52, foeSize, `foe_px_${d}_${s}`)) ?? (
            <text x={ncx} y={floor2 - foeSize * 0.55} textAnchor="middle" dominantBaseline="middle"
              fontSize={foeSize} style={{ userSelect: 'none' }}>{def?.icon ?? '👹'}</text>
          )}
          <text x={ncx} y={floor2 - foeSize * 1.14} textAnchor="middle"
            fontSize={Math.max(7, foeSize * 0.14)} fill="rgba(248,113,113,0.9)"
            style={{ userSelect: 'none' }}>{def?.name ?? 'Something terrible'}</text>
        </g>,
      )
      return
    }

    // ── Visible fixed encounter: the monsters stand in the corridor ──────────
    const fixedEnc = battle ? undefined : (frontCell.entities ?? []).find(
      (e): e is Extract<CellEntity, { t: 'encounter' }> => e.t === 'encounter' && e.mode === 'fixed',
    )
    if (fixedEnc && fixedEnc.table && !(fixedEnc.oncePerVisit && flags[`enc.visited.${fixedEnc.table}`])) {
      const table = ruleset?.encounterTables.find(t => t.id === fixedEnc.table)
      const entry = table && [...table.entries].sort((a, b) => b.weight - a.weight)[0]
      const def = entry ? ruleset?.enemies.find(en => en.id === entry.enemy) : undefined
      if (def) {
        const face = entFace
        const fw2 = face.x2 - face.x1
        const fh2 = face.y2 - face.y1
        const floor2 = face.y2
        const n = Math.max(1, Math.min(3, entry!.min))
        const encSize = Math.max(12, fh2 * (n > 1 ? 0.34 : 0.42))
        const encFog = Math.max(0.3, 1 - depthFog(d) * 1.3)
        const lanes = n === 1 ? [0.5] : n === 2 ? [0.35, 0.65] : [0.25, 0.5, 0.75]
        nodes.push(
          <g key={`fenc_${d}_${s}`} opacity={encFog}>
            {lanes.map((ln, i) => {
              const ex = face.x1 + fw2 * ln
              return (
                <g key={i}>
                  <ellipse cx={ex} cy={floor2 - fh2 * 0.02} rx={encSize * 0.4} ry={encSize * 0.1} fill="rgba(0,0,0,0.5)" />
                  {creatureSprite({ sprite: def.sprite, id: def.id, name: def.name },
                    ex, floor2 - encSize * 0.52, encSize, `fenc_px_${d}_${s}_${i}`) ?? (
                    <text x={ex} y={floor2 - encSize * 0.55} textAnchor="middle" dominantBaseline="middle"
                      fontSize={encSize} style={{ userSelect: 'none' }}>{def.icon ?? '👾'}</text>
                  )}
                </g>
              )
            })}
          </g>,
        )
        return
      }
    }

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

      // Pixel-sprite chest, bottom-anchored on the cell floor
      const cW = faceW * 0.5
      const chestKind = isOpen ? 'chest_open' : 'chest'
      const chH = cW * (spriteAspect(chestKind) ?? 0.8)
      const fb = face.y2
      nodes.push(
        <ellipse key={`chsh_${d}_${s}`} cx={cx} cy={fb - chH * 0.04}
          rx={cW * 0.55} ry={chH * 0.12} fill="rgba(0,0,0,0.45)" />,
      )
      const chestSpr = pixelSpriteRect(chestKind, cx - cW / 2, fb - chH, cW, chH,
        `chest_${d}_${s}`, Math.max(0.35, 1 - entFog * 0.8))
      if (chestSpr) nodes.push(chestSpr)
      if (isLocked) {
        nodes.push(
          <text key={`chlock_${d}_${s}`} x={cx} y={fb - chH * 0.42}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(8, cW * 0.18)} opacity={Math.max(0.5, 1 - entFog * 0.6)}
            style={{ userSelect: 'none' }}>🔒</text>,
        )
      }
      return
    }

    // ── NPC standing in the cell ─────────────────────────────────────────────
    const npcEnt = (frontCell.entities ?? []).find(
      (e): e is Extract<CellEntity, { t: 'object' }> =>
        e.t === 'object' && e.object.kind === 'npc'
        && !(e.object.npc && flags[npcRecruitedFlagKey(e.object.npc)]),
    )
    if (npcEnt) {
      const def = npcEnt.object.npc ? ruleset?.npcs.find(n => n.id === npcEnt.object.npc) : undefined
      const face = entFace
      const fw2 = face.x2 - face.x1
      const fh2 = face.y2 - face.y1
      const ncx = (face.x1 + face.x2) / 2
      const floor2 = face.y2
      const size = Math.max(10, fh2 * 0.30)
      const npcFog = Math.max(0.35, 1 - depthFog(d) * 1.4)
      const npcSize = size * 1.3
      nodes.push(
        <g key={`npc_${d}_${s}`} opacity={npcFog}>
          <ellipse cx={ncx} cy={floor2 - fh2 * 0.02} rx={size * 0.42} ry={size * 0.10} fill="rgba(0,0,0,0.45)" />
          {(def && (
            creatureSprite({ sprite: def.sprite, id: def.id, name: def.name },
              ncx, floor2 - npcSize * 0.52, npcSize, `npc_px_${d}_${s}`)
            ?? pixelSprite('cr_hooded', ncx, floor2 - npcSize * 0.52, npcSize, `npc_px_${d}_${s}`)
          )) ?? (
            <text x={ncx} y={floor2 - size * 0.55} textAnchor="middle" dominantBaseline="middle"
              fontSize={size} style={{ userSelect: 'none' }}>{def?.portrait ?? '🧑'}</text>
          )}
          <text x={ncx} y={floor2 - npcSize * 1.12} textAnchor="middle"
            fontSize={Math.max(6, size * 0.16)} fill="rgba(255,255,255,0.8)"
            style={{ userSelect: 'none' }}>{def?.name ?? 'Stranger'}</text>
        </g>,
      )
      return
    }

    // Overlay markers (Inn, Boss, Save Point, …) are editor-only annotations —
    // they intentionally do NOT render in the first-person view.
  }

  // ── 4b. Battle: enemies at sub-cube slots of the cells ahead ─────────────────
  // Rank 0 = cell directly ahead (z 1..2 from the camera), rank 1 = cell behind
  // it. Enemies stand at mid-cell depth in their lane's sub-cube column.
  if (battle) {
    const sorted = [...battle.placements].sort((a, b) => b.rank - a.rank)
    const benPos: Record<number, { x: number; y: number; s: number }> = {}
    for (const pl of sorted) {
      const actor = battle.actors[pl.actorIdx]
      if (!actor) continue
      const ez = pl.size === 2 ? 2.0 : pl.rank + 1.5
      const hw = (0.5 * PF_X) / ez
      const hh = PF_Y / ez
      const floorY = VP_Y + hh
      const exX = (VP_X - hw) + hw * 2 * ((pl.lane + 0.5) / 3)
      const size = hh * 2 * (pl.size === 2 ? 0.9 : 0.55)
      const emY = floorY - size * 0.52
      benPos[pl.actorIdx] = { x: exX, y: emY, s: size }
      if (!actor.alive) continue
      const isActive = battle.activeIdx === pl.actorIdx
      const isSelected = battle.selectedIdx === pl.actorIdx
      const isTargetable = battle.targetableIdxs.includes(pl.actorIdx)
      const isDowned = battle.downedIdxs?.includes(pl.actorIdx) ?? false

      // Ground shadow + state rings
      nodes.push(
        <ellipse key={`ben_sh_${pl.actorIdx}`} cx={exX} cy={floorY}
          rx={size * 0.42} ry={size * 0.10} fill="rgba(0,0,0,0.5)" />,
      )
      if (isActive) {
        nodes.push(
          <ellipse key={`ben_act_${pl.actorIdx}`} cx={exX} cy={floorY}
            rx={size * 0.50} ry={size * 0.12} fill="none"
            stroke="hsl(44 95% 60%)" strokeWidth={2}>
            <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />
          </ellipse>,
        )
      }
      if (isSelected) {
        nodes.push(
          <ellipse key={`ben_selr_${pl.actorIdx}`} cx={exX} cy={floorY}
            rx={size * 0.50} ry={size * 0.12} fill="none"
            stroke="hsl(0 85% 58%)" strokeWidth={2} />,
          <text key={`ben_cur_${pl.actorIdx}`} x={exX} y={floorY - size * 1.16}
            textAnchor="middle" fontSize={size * 0.26} fill="hsl(0 85% 58%)"
            style={{ userSelect: 'none' }}>
            ▼
            <animate attributeName="y"
              values={`${floorY - size * 1.22};${floorY - size * 1.10};${floorY - size * 1.22}`}
              dur="0.8s" repeatCount="indefinite" />
          </text>,
        )
      }

      if (isDowned) {
        nodes.push(
          <text key={`ben_down_${pl.actorIdx}`} x={exX} y={floorY - size * 0.95}
            textAnchor="middle" fontSize={size * 0.32} style={{ userSelect: 'none' }}>
            💫
            <animate attributeName="opacity" values="1;0.4;1" dur="0.9s" repeatCount="indefinite" />
          </text>,
        )
      }

      // Enemy sprite (creator bitmap → pixel billboard → emoji) with a click-to-target hit area
      const eDef = actor.defId ? ruleset?.enemies.find(e => e.id === actor.defId) : undefined
      const enOpacity = battle.targetableIdxs.length === 0 || isTargetable || isActive ? 1 : 0.8
      nodes.push(
        <g key={`ben_${pl.actorIdx}`}
          style={isTargetable ? { cursor: 'pointer' } : undefined}
          onClick={isTargetable && battle.onSelectTarget
            ? () => battle.onSelectTarget!(pl.actorIdx)
            : undefined}
        >
          {creatureSprite({ sprite: eDef?.sprite, id: actor.defId, name: actor.name },
            exX, emY, size * 1.05, `ben_px_${pl.actorIdx}`, enOpacity) ?? (
            <text x={exX} y={emY} textAnchor="middle" dominantBaseline="middle"
              fontSize={size} style={{ userSelect: 'none' }}
              opacity={enOpacity}
            >{actor.icon ?? '👾'}</text>
          )}
          <circle cx={exX} cy={emY} r={size * 0.55} fill="transparent" />
        </g>,
      )

      // Name tag + HP sliver
      const barW = size * 0.8
      const hpPct = actor.maxHp > 0 ? Math.max(0, actor.hp / actor.maxHp) : 0
      nodes.push(
        <text key={`ben_nm_${pl.actorIdx}`} x={exX} y={emY - size * 0.66}
          textAnchor="middle" fontSize={Math.max(7, size * 0.13)}
          fill="rgba(255,255,255,0.85)" style={{ userSelect: 'none' }}>{actor.name}</text>,
        <rect key={`ben_hbg_${pl.actorIdx}`} x={exX - barW / 2} y={emY - size * 0.60}
          width={barW} height={3} rx={1.5} fill="rgba(0,0,0,0.55)" />,
        <rect key={`ben_hp_${pl.actorIdx}`} x={exX - barW / 2} y={emY - size * 0.60}
          width={barW * hpPct} height={3} rx={1.5}
          fill={hpPct > 0.5 ? 'hsl(150 60% 45%)' : hpPct > 0.25 ? 'hsl(40 90% 55%)' : 'hsl(0 80% 55%)'} />,
      )
    }

    // ── Action feedback: floating popups + hit flashes (keyed by eventSeq so
    //    each action replays its animations) ─────────────────────────────────
    battle.events.forEach((ev, i) => {
      const pos = benPos[ev.target]
      if (!pos || battle.actors[ev.target]?.kind !== 'enemy') return
      const txt =
        ev.kind === 'miss'   ? 'MISS' :
        ev.kind === 'weak'   ? 'WEAK!' :
        ev.kind === 'resist' ? 'RESIST' :
        ev.kind === 'status' ? '✦' :
        `${ev.kind === 'heal' || ev.kind === 'mp' ? '+' : '-'}${ev.amount ?? ''}`
      const fill =
        ev.kind === 'crit'   ? 'hsl(44 95% 60%)' :
        ev.kind === 'weak'   ? 'hsl(28 95% 58%)' :
        ev.kind === 'resist' ? 'rgba(160,180,210,0.8)' :
        ev.kind === 'heal'   ? 'hsl(150 65% 55%)' :
        ev.kind === 'mp'     ? 'hsl(210 80% 65%)' :
        ev.kind === 'miss'   ? 'rgba(255,255,255,0.65)' :
                               'hsl(0 85% 62%)'
      const fs = ev.kind === 'crit' || ev.kind === 'weak' ? pos.s * 0.30 : ev.kind === 'resist' ? pos.s * 0.16 : pos.s * 0.22
      const px0 = pos.x + (i - (battle.events.length - 1) / 2) * pos.s * 0.22
      nodes.push(
        <g key={`pop_${battle.eventSeq}_${i}`} pointerEvents="none">
          {(ev.kind === 'damage' || ev.kind === 'crit') && (
            <circle cx={pos.x} cy={pos.y} r={pos.s * 0.5} fill="rgba(255,80,60,0.35)">
              <animate attributeName="opacity" from="1" to="0" dur="0.35s" fill="freeze" />
            </circle>
          )}
          <text x={px0} y={pos.y - pos.s * 0.35}
            textAnchor="middle" fontSize={fs} fontWeight={700} fill={fill}
            stroke="rgba(0,0,0,0.7)" strokeWidth={0.8} paintOrder="stroke"
            style={{ userSelect: 'none' }}>
            {txt}
            <animate attributeName="y" from={pos.y - pos.s * 0.35} to={pos.y - pos.s * 0.85} dur="0.9s" fill="freeze" />
            <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.6;1" dur="0.9s" fill="freeze" />
          </text>
        </g>,
      )
    })

    // Party struck: brief red vignette across the whole view
    if (battle.events.some(ev =>
      (ev.kind === 'damage' || ev.kind === 'crit') && battle.actors[ev.target]?.kind === 'party')) {
      nodes.push(
        <rect key={`phit_${battle.eventSeq}`} x={0} y={0} width={VW} height={VH}
          fill="rgba(190,30,30,0.28)" pointerEvents="none">
          <animate attributeName="opacity" from="1" to="0" dur="0.45s" fill="freeze" />
        </rect>,
      )
    }
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

// ── Smooth movement: continuous-projection tween (rotate + step) ────────────────
// The frame is discrete (cardinal facings, whole cells), but during a move we
// overlay a lightweight SVG that re-projects the surrounding walls each frame as
// the camera position and yaw interpolate — so a turn genuinely rotates and a
// step genuinely dollies through the cell. Floor/ceiling stay a horizon split
// (pure yaw/translation keeps the horizon level). Walls are textured to match the
// resting frame; the full textured cardinal frame cross-fades back in at rest.
// Pure SVG maths — no CSS 3D — so it works in Safari too. Honors reduced motion.

type FpProps = FirstPersonViewProps
type MoveKind = 'forward' | 'back' | 'turnLeft' | 'turnRight'

const TURN_L: Record<Facing, Facing> = { N: 'W', W: 'S', S: 'E', E: 'N' }
const TURN_R: Record<Facing, Facing> = { N: 'E', E: 'S', S: 'W', W: 'N' }

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function classifyMove(
  prev: { mapId: string; px: number; py: number; facing: Facing },
  cur:  { mapId: string; px: number; py: number; facing: Facing },
): MoveKind | null {
  if (prev.mapId !== cur.mapId) return null   // teleport / map change: leave to the fade
  if (cur.facing !== prev.facing && cur.px === prev.px && cur.py === prev.py) {
    if (TURN_L[prev.facing] === cur.facing) return 'turnLeft'
    if (TURN_R[prev.facing] === cur.facing) return 'turnRight'
    return null   // 180° flip — no clean direction
  }
  const dx = cur.px - prev.px, dy = cur.py - prev.py
  if (dx === 0 && dy === 0) return null
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null   // multi-cell jump: not a step
  const [fx, fy] = facingDelta(prev.facing)
  if (dx === -fx && dy === -fy) return 'back'
  return 'forward'   // forward or a lateral step both read as a dolly
}

// ── True turn rotation: continuous-yaw wall projection (turn tween) ──────────────
// A real camera rotation, not a flat-image warp: during a turn we sweep the yaw
// through 90° and re-project the surrounding walls each frame, so you see the
// dungeon actually rotate. Floor/ceiling stay a horizon split (pure yaw keeps the
// horizon level). Flat-shaded structural geometry only — the full textured cardinal
// frame cross-fades back in at rest. Pure SVG maths, so it works in Safari too.

const FACING_YAW: Record<Facing, number> = { N: 0, E: Math.PI / 2, S: Math.PI, W: (3 * Math.PI) / 2 }
const SPIN_DIRS: EdgeDir[] = ['N', 'S', 'E', 'W']
const SPIN_DELTA: Record<EdgeDir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3) }
const r1 = (n: number) => Math.round(n * 10) / 10

interface SpinWall { pts: string; z: number; fill: string }

/** The two ground endpoints (+inward normal) of a cell edge, in world cells. */
function spinEdge(gx: number, gy: number, dir: EdgeDir) {
  switch (dir) {
    case 'N': return { ax: gx - 0.5, ay: gy - 0.5, bx: gx + 0.5, by: gy - 0.5, nx: 0,  ny: 1 }
    case 'S': return { ax: gx - 0.5, ay: gy + 0.5, bx: gx + 0.5, by: gy + 0.5, nx: 0,  ny: -1 }
    case 'E': return { ax: gx + 0.5, ay: gy - 0.5, bx: gx + 0.5, by: gy + 0.5, nx: -1, ny: 0 }
    default:  return { ax: gx - 0.5, ay: gy - 0.5, bx: gx - 0.5, by: gy + 0.5, nx: 1,  ny: 0 }
  }
}

/** Project every visible wall around the pivot at the given yaw. The camera sits
 *  half a cell behind the pivot along the current facing, so the frame matches the
 *  cardinal renderer's scale at yaw = a cardinal angle (0/90/180/270°). */
function computeSpinWalls(
  map: MapData, pivotX: number, pivotY: number, yaw: number,
  theme: MapThemeDef,
  isRevealed: (x: number, y: number) => boolean,
  flags: Record<string, boolean | number | string>,
  revealedB: Set<string> | undefined,
  lightRadius: number | undefined,
  radius = 5,
): SpinWall[] {
  // Match the cardinal renderer's lighting: distance fog + dark-map light falloff.
  const viewD = lightRadius === undefined ? MAX_D : Math.max(1, Math.min(MAX_D, Math.floor(lightRadius)))
  const fogAt = (z: number) => {
    const df = Math.min(0.72, Math.max(0, (z - 1) * 0.18))
    const le = viewD >= MAX_D ? 0 : Math.max(0, Math.min(1, (z - viewD + 1) * 0.55))
    return Math.min(1, df + le)
  }
  const sin = Math.sin(yaw), cos = Math.cos(yaw)
  const camx = pivotX - 0.5 * sin, camy = pivotY + 0.5 * cos   // 0.5 behind along fwd=(sin,-cos)
  const near = 0.06
  const cx = Math.round(pivotX), cy = Math.round(pivotY)
  const toCam = (rx: number, ry: number) => ({ x: rx * cos + ry * sin, z: rx * sin - ry * cos })
  const out: SpinWall[] = []
  for (let gy = cy - radius; gy <= cy + radius; gy++) {
    for (let gx = cx - radius; gx <= cx + radius; gx++) {
      if (!isRevealed(gx, gy) || isWall(map, gx, gy)) continue
      for (const dir of SPIN_DIRS) {
        const [ndx, ndy] = SPIN_DELTA[dir]
        const solid = isWall(map, gx + ndx, gy + ndy) || !isRevealed(gx + ndx, gy + ndy)
        if (!solid && !hasBoundaryWall(map, gx, gy, dir, revealedB, flags)) continue
        const s = spinEdge(gx, gy, dir)
        const mvx = (s.ax + s.bx) / 2 - camx, mvy = (s.ay + s.by) / 2 - camy
        if (s.nx * mvx + s.ny * mvy >= 0) continue   // back-facing
        let A = toCam(s.ax - camx, s.ay - camy)
        let B = toCam(s.bx - camx, s.by - camy)
        if (A.z < near && B.z < near) continue
        if (A.z < near) { const t = (near - A.z) / (B.z - A.z); A = { x: A.x + t * (B.x - A.x), z: near } }
        else if (B.z < near) { const t = (near - B.z) / (A.z - B.z); B = { x: B.x + t * (A.x - B.x), z: near } }
        const ax = VP_X + (PF_X * A.x) / A.z, bx = VP_X + (PF_X * B.x) / B.z
        const aTop = VP_Y - PF_Y / A.z, aBot = VP_Y + PF_Y / A.z
        const bTop = VP_Y - PF_Y / B.z, bBot = VP_Y + PF_Y / B.z
        const z = (A.z + B.z) / 2
        const ml = Math.hypot(mvx, mvy) || 1
        const dotv = Math.abs((s.nx * mvx + s.ny * mvy) / ml)   // 1 head-on → bright, 0 grazing → dark
        const frontL = theme.wallLBase - (z - 1) * theme.wallLStep
        const sideL  = theme.sideLBase - (z - 1) * theme.sideLStep
        const L = Math.max(6, Math.min(85, sideL + (frontL - sideL) * dotv)) * (1 - fogAt(z))   // fog/light falloff
        out.push({
          pts: `${r1(ax)},${r1(aTop)} ${r1(bx)},${r1(bTop)} ${r1(bx)},${r1(bBot)} ${r1(ax)},${r1(aBot)}`,
          z, fill: `hsl(${theme.wallHue} ${theme.wallSat}% ${L.toFixed(1)}%)`,
        })
      }
    }
  }
  out.sort((a, b) => b.z - a.z)   // painter's order: far first
  return out
}

interface SpinSprite { z: number; node: React.ReactNode }

/** Project the world's standing billboards (patrol foes, chests, NPCs) at the
 *  tween camera so they don't vanish during motion. Same anchoring the cardinal
 *  renderer uses (bottom on the cell floor, size ∝ 1/distance), depth returned so
 *  the caller can interleave them with the walls in painter's order. */
function computeSpinSprites(
  map: MapData, pivotX: number, pivotY: number, yaw: number,
  ruleset: Ruleset | undefined,
  flags: Record<string, boolean | number | string>,
  isRevealed: (x: number, y: number) => boolean,
  radius = 5,
): SpinSprite[] {
  const sin = Math.sin(yaw), cos = Math.cos(yaw)
  const camx = pivotX - 0.5 * sin, camy = pivotY + 0.5 * cos
  const cx = Math.round(pivotX), cy = Math.round(pivotY)
  const near = 0.35
  const foes = listFoes(map, flags).filter(f => !f.dead)
  const out: SpinSprite[] = []
  for (let gy = cy - radius; gy <= cy + radius; gy++) {
    for (let gx = cx - radius; gx <= cx + radius; gx++) {
      if (!isRevealed(gx, gy) || isWall(map, gx, gy)) continue
      const rx = gx - camx, ry = gy - camy
      const z = rx * sin - ry * cos
      if (z < near) continue
      const scX = VP_X + (PF_X * (rx * cos + ry * sin)) / z
      if (scX < -140 || scX > VW + 140) continue
      const floorY = VP_Y + PF_Y / z
      const fh = (2 * PF_Y) / z
      const fog = Math.min(0.72, Math.max(0, (z - 1) * 0.18))
      const cell = map.cells[`${gx},${gy}`]

      const foe = foes.find(f => f.pos.x === gx && f.pos.y === gy)
      if (foe) {
        const def = ruleset?.enemies.find(en => en.id === foe.entity.enemy)
        const size = Math.max(14, fh * 0.52)
        out.push({ z, node: (
          <g opacity={Math.max(0.35, 1 - fog * 1.2)}>
            <ellipse cx={scX} cy={floorY - fh * 0.02} rx={size * 0.45} ry={size * 0.11} fill="rgba(0,0,0,0.55)" />
            {(def && creatureSprite({ sprite: def.sprite, id: def.id, name: def.name }, scX, floorY - size * 0.52, size, `sfoe_${gx}_${gy}`)) ?? (
              <text x={scX} y={floorY - size * 0.55} textAnchor="middle" dominantBaseline="middle" fontSize={size} style={{ userSelect: 'none' }}>{def?.icon ?? '👹'}</text>
            )}
          </g>
        ) })
        continue
      }
      if (!cell?.entities?.length) continue

      const chestEnt = cell.entities.find((e): e is Extract<CellEntity, { t: 'object' }> => e.t === 'object' && e.object.kind === 'chest')
      if (chestEnt) {
        const kind = flags[objectUsedFlagKey(chestEnt.object.id)] ? 'chest_open' : 'chest'
        const cW = (PF_X / z) * 0.5
        const chH = cW * (spriteAspect(kind) ?? 0.8)
        out.push({ z, node: (
          <g>
            <ellipse cx={scX} cy={floorY - chH * 0.04} rx={cW * 0.55} ry={chH * 0.12} fill="rgba(0,0,0,0.45)" />
            {pixelSpriteRect(kind, scX - cW / 2, floorY - chH, cW, chH, `schest_${gx}_${gy}`, Math.max(0.35, 1 - fog * 0.8))}
          </g>
        ) })
        continue
      }

      const npcEnt = cell.entities.find((e): e is Extract<CellEntity, { t: 'object' }> =>
        e.t === 'object' && e.object.kind === 'npc' && !(e.object.npc && flags[npcRecruitedFlagKey(e.object.npc)]))
      if (npcEnt) {
        const def = npcEnt.object.npc ? ruleset?.npcs.find(n => n.id === npcEnt.object.npc) : undefined
        const size = Math.max(10, fh * 0.30), npcSize = size * 1.3
        out.push({ z, node: (
          <g opacity={Math.max(0.35, 1 - fog * 1.4)}>
            <ellipse cx={scX} cy={floorY - fh * 0.02} rx={size * 0.42} ry={size * 0.10} fill="rgba(0,0,0,0.45)" />
            {(def && (creatureSprite({ sprite: def.sprite, id: def.id, name: def.name }, scX, floorY - npcSize * 0.52, npcSize, `snpc_${gx}_${gy}`)
              ?? pixelSprite('cr_hooded', scX, floorY - npcSize * 0.52, npcSize, `snpc_${gx}_${gy}`))) ?? (
              <text x={scX} y={floorY - size * 0.55} textAnchor="middle" dominantBaseline="middle" fontSize={size} style={{ userSelect: 'none' }}>{def?.portrait ?? '🧑'}</text>
            )}
          </g>
        ) })
        continue
      }
    }
  }
  return out
}

/** Perspective-cast floor/ceiling strips for the tween camera (arbitrary yaw +
 *  fractional position), mirroring the cardinal renderer's texture casting. */
// Fewer strips during motion than at rest — the tween re-projects every frame,
// so 30 strips × 2 surfaces would swamp the reconciler; 14 stays smooth and the
// coarser recession is invisible in fast motion.
const TWEEN_STRIPS = 14

function castTweenSurface(
  surface: 'floor' | 'ceiling', href: string, camX: number, camY: number, yaw: number,
): { patterns: React.ReactNode[]; rects: React.ReactNode[] } {
  const fx = Math.sin(yaw), fy = -Math.cos(yaw), rx = Math.cos(yaw), ry = Math.sin(yaw)
  const baseId = `spin-tex-${surface}-base`
  const patterns: React.ReactNode[] = [
    <pattern key="base" id={baseId} patternUnits="userSpaceOnUse" width={TEX_CELL} height={TEX_CELL}>
      <image href={href} x={0} y={0} width={TEX_CELL} height={TEX_CELL} preserveAspectRatio="xMidYMid slice" />
    </pattern>,
  ]
  const rects: React.ReactNode[] = []
  const top0 = surface === 'floor' ? VP_Y : 0
  const stripH = (surface === 'floor' ? VH - VP_Y : VP_Y) / TWEEN_STRIPS
  for (let i = 0; i < TWEEN_STRIPS; i++) {
    const top = top0 + i * stripH
    const midY = top + stripH / 2
    const dy = surface === 'floor' ? midY - VP_Y : VP_Y - midY
    if (dy <= 0.5) continue
    const z0 = PF_Y / dy
    if (z0 > 12) continue
    const id = `spin-tex-${surface}-${i}`
    patterns.push(<pattern key={i} id={id} href={`#${baseId}`} patternTransform={stripMatrixCam(surface, camX, camY, fx, fy, rx, ry, z0)} />)
    rects.push(<rect key={`${surface}${i}`} x={0} y={top} width={VW} height={stripH + 0.6}
      fill={`url(#${id})`} style={{ mixBlendMode: 'soft-light' }} opacity={surface === 'floor' ? 0.8 : 0.72} />)
  }
  return { patterns, rects }
}

function MoveTween({ map, fromCellX, fromCellY, toCellX, toCellY, fromYaw, toYaw, durationMs, theme, wallHref, floorHref, ceilHref, lightRadius, ruleset, isRevealed, flags, revealedB, onDone }: {
  map: MapData
  fromCellX: number; fromCellY: number; toCellX: number; toCellY: number
  fromYaw: number; toYaw: number; durationMs: number
  theme: MapThemeDef; wallHref: string | null; floorHref: string | null; ceilHref: string | null
  lightRadius: number | undefined; ruleset: Ruleset | undefined
  isRevealed: (x: number, y: number) => boolean
  flags: Record<string, boolean | number | string>; revealedB: Set<string> | undefined; onDone: () => void
}) {
  const [p, setP] = useState(0)
  const doneRef = useRef(onDone); doneRef.current = onDone
  useEffect(() => {
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => {
      const pr = Math.min(1, (t - t0) / durationMs)
      setP(pr)
      if (pr < 1) raf = requestAnimationFrame(tick); else doneRef.current()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs])
  const e = easeOutCubic(p)
  const cellX = fromCellX + (toCellX - fromCellX) * e   // camera dollies through the cell for a step
  const cellY = fromCellY + (toCellY - fromCellY) * e
  const yaw = fromYaw + (toYaw - fromYaw) * e            // …and sweeps the yaw for a turn
  const walls = useMemo(
    () => computeSpinWalls(map, cellX, cellY, yaw, theme, isRevealed, flags, revealedB, lightRadius),
    [map, cellX, cellY, yaw, theme, isRevealed, flags, revealedB, lightRadius],
  )
  const sprites = useMemo(
    () => computeSpinSprites(map, cellX, cellY, yaw, ruleset, flags, isRevealed),
    [map, cellX, cellY, yaw, ruleset, flags, isRevealed],
  )
  const camX = cellX - 0.5 * Math.sin(yaw), camY = cellY + 0.5 * Math.cos(yaw)
  const floorCast = useMemo(() => floorHref ? castTweenSurface('floor', floorHref, camX, camY, yaw) : null, [floorHref, camX, camY, yaw])
  const ceilCast  = useMemo(() => ceilHref ? castTweenSurface('ceiling', ceilHref, camX, camY, yaw) : null, [ceilHref, camX, camY, yaw])
  // Merge walls + sprites into one back-to-front list so nearer walls occlude
  // farther sprites (and vice-versa), matching the cardinal renderer.
  const drawables = useMemo(() => {
    const items: { z: number; node: React.ReactNode }[] = []
    walls.forEach((w, i) => items.push({ z: w.z, node: (
      <g key={`w${i}`}>
        <polygon points={w.pts} fill={w.fill} />
        {wallHref && <polygon points={w.pts} fill="url(#spin-tex-wall)" style={{ mixBlendMode: 'soft-light' }} opacity={0.9} />}
      </g>
    ) }))
    sprites.forEach((s, i) => items.push({ z: s.z, node: <g key={`s${i}`}>{s.node}</g> }))
    items.sort((a, b) => b.z - a.z)
    return items
  }, [walls, sprites, wallHref])
  const opacity = p > 0.8 ? Math.max(0, 1 - (p - 0.8) / 0.2) : 1   // cross-fade to the textured frame at the end
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      style={{ position: 'absolute', inset: 0, display: 'block', opacity }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="spin-view-clip"><rect x={0} y={0} width={VW} height={VH} /></clipPath>
        {wallHref && (
          <pattern id="spin-tex-wall" patternUnits="userSpaceOnUse" width={92} height={92}>
            <image href={wallHref} x="0" y="0" width={92} height={92} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        <radialGradient id="spin-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
        {/* horizon-darkening so far floor/ceiling read as distant, like the resting frame */}
        <linearGradient id="spin-ceil-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </linearGradient>
        <linearGradient id="spin-floor-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.5)" /><stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
        {ceilCast?.patterns}
        {floorCast?.patterns}
      </defs>
      <g clipPath="url(#spin-view-clip)">
        <rect x={0} y={0} width={VW} height={VP_Y} fill={`hsl(${theme.ceilHue} ${theme.ceilSat}% ${theme.ceilLBase}%)`} />
        {ceilCast?.rects}
        <rect x={0} y={0} width={VW} height={VP_Y} fill="url(#spin-ceil-fade)" />
        <rect x={0} y={VP_Y} width={VW} height={VH - VP_Y} fill={`hsl(${theme.floorHue} ${theme.floorSat}% ${theme.floorLBase}%)`} />
        {floorCast?.rects}
        <rect x={0} y={VP_Y} width={VW} height={VH - VP_Y} fill="url(#spin-floor-fade)" />
        <rect x={0} y={VP_Y + PF_Y / 2} width={VW} height={VH - VP_Y - PF_Y / 2} fill={theme.floorGlowColor} />
        {drawables.map(d => d.node)}
        <line x1={0} y1={VP_Y} x2={VW} y2={VP_Y} stroke="rgba(100,120,160,0.18)" strokeWidth={1} />
        {theme.ambientTint && <rect x={0} y={0} width={VW} height={VH} fill={theme.ambientTint} />}
        <rect x={0} y={0} width={VW} height={VH} fill="url(#spin-vignette)" />
      </g>
    </svg>
  )
}

function AnimatedFirstPersonView({ speed, ...fp }: FpProps & { speed: MoveAnimSpeed }) {
  const ms = MOVE_ANIM_MS[speed] ?? MOVE_ANIM_MS.balanced
  const poseRef = useRef({ mapId: fp.map.id, px: fp.map.playerX, py: fp.map.playerY, facing: fp.facing })
  const tokenRef = useRef(0)
  const [tween, setTween] = useState<
    { fromCellX: number; fromCellY: number; toCellX: number; toCellY: number; fromYaw: number; toYaw: number; token: number } | null
  >(null)

  useEffect(() => {
    const prev = poseRef.current
    const cur = { mapId: fp.map.id, px: fp.map.playerX, py: fp.map.playerY, facing: fp.facing }
    const kind = classifyMove(prev, cur)
    poseRef.current = cur
    if (!kind || prefersReducedMotion()) return
    const token = ++tokenRef.current
    if (kind === 'turnLeft' || kind === 'turnRight') {
      // rotate in place: fixed cell, yaw sweeps 90°
      const fromYaw = FACING_YAW[prev.facing]
      const toYaw = fromYaw + (kind === 'turnRight' ? Math.PI / 2 : -Math.PI / 2)
      setTween({ fromCellX: prev.px, fromCellY: prev.py, toCellX: prev.px, toCellY: prev.py, fromYaw, toYaw, token })
    } else {
      // step: fixed yaw, camera dollies from the old cell to the new one
      const yaw = FACING_YAW[prev.facing]
      setTween({ fromCellX: prev.px, fromCellY: prev.py, toCellX: cur.px, toCellY: cur.py, fromYaw: yaw, toYaw: yaw, token })
    }
  }, [fp.map, fp.facing, ms])

  const theme = getTheme(fp.map.theme)
  const tex = fp.map.textures, texA = fp.map.textureAssets
  const wallHref  = textureImageHref(tex?.wall,    { hue: theme.wallHue,  sat: theme.wallSat,  light: theme.wallLBase },  texA)
  const floorHref = textureImageHref(tex?.floor,   { hue: theme.floorHue, sat: theme.floorSat, light: theme.floorLBase }, texA)
  const ceilHref  = textureImageHref(tex?.ceiling, { hue: theme.ceilHue,  sat: theme.ceilSat,  light: theme.ceilLBase },  texA)

  return (
    <div className="absolute inset-0">
      <FirstPersonView {...fp} />
      {tween && (
        <MoveTween key={tween.token} map={fp.map}
          fromCellX={tween.fromCellX} fromCellY={tween.fromCellY} toCellX={tween.toCellX} toCellY={tween.toCellY}
          fromYaw={tween.fromYaw} toYaw={tween.toYaw} durationMs={ms} theme={theme}
          wallHref={wallHref} floorHref={floorHref} ceilHref={ceilHref}
          lightRadius={fp.lightRadius} ruleset={fp.ruleset}
          isRevealed={fp.isCellRevealed} flags={fp.flags} revealedB={fp.revealedBoundaries}
          onDone={() => setTween(null)} />
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayWorkspace({
  activeMap, party, gold, stepsTaken, facing,
  customBase, customOverlay, isCellRevealed, revealedBoundaries, bumpTrigger,
  flags,
  combat, ruleset, inventory, reserve = [], formation = { front: [], back: [] },
  onRosterChange, onInventoryChange, onCombatAction, onCombatEnd,
  onMoveForward, onMoveBack, onTurnLeft, onTurnRight, onInteract,
  onRest, canSaveHere, onSaveSlot, onLoadSlot, onMenuOpenChange,
}: PlayWorkspaceProps) {
  const [cellSize, setCellSize] = useState(DEFAULT_CELL + 6)
  const [view, setView] = useState<'3d' | 'map'>('3d')
  const zoom = useCallback((delta: number) => {
    setCellSize(s => Math.max(MIN_CELL, Math.min(MAX_CELL, s + delta)))
  }, [])

  const { view: battleView, hud: battleHud } = useBattleController({
    combat: combat ?? null,
    ruleset,
    party,
    inventory,
    onAction: onCombatAction,
  })

  // Battles play out in first person — snap to the 3D view when one starts
  useEffect(() => { if (combat) setView('3d') }, [combat])

  // Battle SFX: fire one-shots off the combat feedback events (hit/crit/heal).
  const sfxSeqRef = useRef(0)
  useEffect(() => {
    if (!combat) { sfxSeqRef.current = 0; return }
    if (combat.eventSeq === sfxSeqRef.current) return
    sfxSeqRef.current = combat.eventSeq
    const kinds = new Set(combat.events.map(ev => ev.kind))
    if (kinds.has('crit')) music.sfx('crit')
    else if (kinds.has('damage') || kinds.has('weak') || kinds.has('resist')) music.sfx('hit')
    if (kinds.has('heal')) music.sfx('heal')
  }, [combat])

  // While Play is mounted the floating Buy-Me-a-Coffee button (vendor widget
  // or fallback link) hides — the party HUD carries an inline coffee chip next
  // to the Steps counter instead. The vendor widget mounts asynchronously, so
  // keep re-asserting until it exists; restore on unmount.
  useEffect(() => {
    const setHidden = (hidden: boolean) => {
      for (const id of ['bmc-wbtn', 'bmc-fallback']) {
        const el = document.getElementById(id)
        if (el) el.style.display = hidden ? 'none' : ''
      }
    }
    setHidden(true)
    const timer = window.setInterval(() => setHidden(true), 1000)
    return () => { window.clearInterval(timer); setHidden(false) }
  }, [])

  // Tab opens the main menu (the hub for items/magic/equip/party/journal/camp/
  // save/config); M toggles the full map view on/off.
  const [showMenu, setShowMenu] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Tab' && !combat) { e.preventDefault(); setShowMenu(true) }
      else if (e.key === 'm' || e.key === 'M') setView(v => v === '3d' ? 'map' : '3d')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combat])
  useEffect(() => { onMenuOpenChange?.(showMenu) }, [showMenu, onMenuOpenChange])
  // A battle takes over — never leave the menu open into combat.
  useEffect(() => { if (combat) setShowMenu(false) }, [combat])

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

  // The full-map view (M) is fogged by the walked trail — the same per-cell
  // exploration set the minimap uses, NOT the editor's generous chunk fog
  // (which feeds the 3D renderer so it can draw the corridor ahead).
  const seenSet = new Set(activeMap.seenCells ?? [])
  seenSet.add(`${px},${py}`)
  const isSeenCell = (x: number, y: number) => seenSet.has(`${x},${y}`)

  // Dark maps (or local darkness zones) limit view to the party's light
  const playerCell = activeMap.cells[`${px},${py}`]
  const lightRadius = (activeMap.dark || cellHasTrick(playerCell, 'darkness'))
    ? computeLightRadius(party, ruleset, playerCell)
    : undefined

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
          {!combat && (
            <button
              onClick={() => setShowMenu(true)}
              title="Menu — items, magic, equip, party, journal, camp, save (Tab)"
              className="flex items-center gap-1 px-2 h-6 rounded text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Menu className="w-3.5 h-3.5" /> Menu
            </button>
          )}
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
        <div ref={viewRef} className="relative flex-1 min-h-0 bg-zinc-950 overflow-hidden">
          <AnimatedFirstPersonView
            speed={ruleset?.meta?.moveAnimSpeed ?? 'balanced'}
            map={activeMap}
            facing={facing}
            customOverlay={customOverlay}
            isCellRevealed={isCellRevealed}
            revealedBoundaries={revealedBoundaries}
            flags={flags}
            battle={battleView}
            ruleset={ruleset}
            lightRadius={lightRadius}
          />
          {!combat && (
            <Minimap map={activeMap} facing={facing} flags={flags} ruleset={ruleset} />
          )}
          {combat && <BattleOutcomeOverlay state={combat} ruleset={ruleset} onContinue={onCombatEnd} />}
        </div>
      ) : (
        <DungeonViewport
          map={activeMap}
          cellSize={cellSize}
          facing={facing}
          customBase={customBase}
          customOverlay={customOverlay}
          isCellRevealed={isSeenCell}
        />
      )}

      {/* Bottom bar: battle command bar during combat, else party HUD + D-pad */}
      <div className="flex items-end gap-3 px-3 py-2 border-t border-white/10 bg-zinc-950/60 flex-shrink-0">
        {combat && battleHud ? (
          <BattleHud {...battleHud} />
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <PartyHud party={party} gold={gold} steps={stepsTaken} />
            </div>
            <BlobberDPad
              onForward={onMoveForward}
              onBack={onMoveBack}
              onLeft={onTurnLeft}
              onRight={onTurnRight}
              onInteract={onInteract}
            />
          </>
        )}
      </div>

      {showMenu && !combat && onRosterChange && onInventoryChange && (
        <GameMenu
          ruleset={ruleset}
          party={party}
          reserve={reserve}
          formation={formation}
          inventory={inventory}
          gold={gold}
          flags={flags}
          mapName={activeMap.name}
          canSaveHere={!!canSaveHere}
          onRosterChange={onRosterChange}
          onInventoryChange={onInventoryChange}
          onRest={onRest}
          onSaveSlot={onSaveSlot}
          onLoadSlot={onLoadSlot}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  )
}
