'use client'

import { useEffect, useRef, useState } from 'react'
import type { CellMap, MarkerDef } from '@/lib/types'
import { DIR_VECTOR, leftOf, rightOf, canPass, type Facing } from '@/lib/crawler'
import { baseDef, overlayDef } from '@/lib/constants'

const DEPTH = 6 // how many cells deep the corridor renders
const PERSP = 0.62 // per-step shrink toward the vanishing point

const FLOOR_BASE = '#2b2b33'
const CEIL_BASE = '#15151b'
const WALL_BASE = '#54546a'
const WIRE = 'rgba(245,200,120,0.35)' // amber wireframe edges (retro CRT vibe)

interface Box {
  l: number
  r: number
  t: number
  b: number
}

export function FirstPersonView({
  cells,
  playerX,
  playerY,
  facing,
  customBase,
  customOverlay,
}: {
  cells: CellMap
  playerX: number
  playerY: number
  facing: Facing
  customBase: Record<number, MarkerDef>
  customOverlay: Record<number, MarkerDef>
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const { w: W, h: H } = size
    if (!canvas || W < 4 || H < 4) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw(ctx, W, H, { cells, playerX, playerY, facing, customBase, customOverlay })
  }, [cells, playerX, playerY, facing, customBase, customOverlay, size])

  // Live readout of the cell the player is currently standing on.
  const here = cells[`${playerX},${playerY}`]
  const baseLabel = here ? baseDef(here.base, customBase).label : 'Empty'
  const overlayLabels = (here?.overlays ?? [])
    .map((o) => overlayDef(o, customOverlay)?.label)
    .filter(Boolean) as string[]

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden bg-[#0a0a0c]">
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none select-none">
        <span className="text-[10px] font-mono text-amber-300/80 bg-black/40 rounded px-1.5 py-0.5">
          ({playerX}, {playerY}) · facing {facing}
        </span>
      </div>
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none select-none">
        <span className="inline-block max-w-full truncate text-[11px] text-white/85 bg-black/45 rounded px-2 py-1">
          <span className="text-white/45">On:</span> {baseLabel}
          {overlayLabels.length > 0 && <span className="text-amber-200/90"> · {overlayLabels.join(', ')}</span>}
        </span>
      </div>
    </div>
  )
}

// ── Rendering ──────────────────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: {
    cells: CellMap
    playerX: number
    playerY: number
    facing: Facing
    customBase: Record<number, MarkerDef>
    customOverlay: Record<number, MarkerDef>
  },
) {
  const { cells, playerX, playerY, facing, customBase, customOverlay } = s
  const cx = W / 2
  const cy = H / 2

  const box = (z: number): Box => {
    const k = Math.pow(PERSP, z)
    return { l: cx - (W / 2) * k, r: cx + (W / 2) * k, t: cy - (H / 2) * k, b: cy + (H / 2) * k }
  }

  // Backdrop: ceiling (top) and far floor (bottom), split at the horizon.
  ctx.fillStyle = CEIL_BASE
  ctx.fillRect(0, 0, W, cy)
  ctx.fillStyle = shade(FLOOR_BASE, 0.55)
  ctx.fillRect(0, cy, W, H - cy)

  const fwd = DIR_VECTOR[facing]
  const Ld = leftOf(facing)
  const Rd = rightOf(facing)
  const cellAt = (z: number) => ({ x: playerX + fwd[0] * z, y: playerY + fwd[1] * z })

  // Deepest visible cell: walk forward until a wall stops us.
  let maxZ = DEPTH - 1
  for (let z = 0; z < DEPTH; z++) {
    const { x, y } = cellAt(z)
    if (!canPass(cells, x, y, facing, customBase)) {
      maxZ = z
      break
    }
  }
  const terminalWall = !canPass(cells, cellAt(maxZ).x, cellAt(maxZ).y, facing, customBase)

  // Painter's algorithm: far → near.
  for (let z = maxZ; z >= 0; z--) {
    const { x, y } = cellAt(z)
    const near = box(z)
    const far = box(z + 1)

    // Floor + ceiling strips for this cell.
    const floorColor = floorColorFor(cells, x, y, customBase)
    quad(ctx, near.l, near.b, near.r, near.b, far.r, far.b, far.l, far.b, shade(floorColor, 0.15 + z * 0.1), WIRE)
    quad(ctx, near.l, near.t, near.r, near.t, far.r, far.t, far.l, far.t, shade(CEIL_BASE, z * 0.08), null)

    // Side walls where movement is blocked (keeps visuals == collision).
    if (!canPass(cells, x, y, Ld, customBase)) {
      quad(ctx, near.l, near.t, far.l, far.t, far.l, far.b, near.l, near.b, shade(WALL_BASE, 0.2 + z * 0.11), WIRE)
    }
    if (!canPass(cells, x, y, Rd, customBase)) {
      quad(ctx, near.r, near.t, far.r, far.t, far.r, far.b, near.r, near.b, shade(WALL_BASE, 0.2 + z * 0.11), WIRE)
    }

    // Front (facing) wall at the terminal cell.
    if (z === maxZ && terminalWall) {
      ctx.fillStyle = shade(WALL_BASE, 0.18 + z * 0.11)
      ctx.fillRect(far.l, far.t, far.r - far.l, far.b - far.t)
      ctx.strokeStyle = WIRE
      ctx.lineWidth = 1
      ctx.strokeRect(far.l, far.t, far.r - far.l, far.b - far.t)
    }

    // Overlay billboard (first overlay on this cell).
    drawOverlay(ctx, cells, x, y, near, far, customOverlay)
  }

  // Subtle vignette.
  const v = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.2, cx, cy, Math.max(W, H) * 0.7)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  cells: CellMap,
  x: number,
  y: number,
  near: Box,
  far: Box,
  customOverlay: Record<number, MarkerDef>,
) {
  const cell = cells[`${x},${y}`]
  if (!cell || cell.overlays.length === 0) return
  const def = overlayDef(cell.overlays[0], customOverlay)
  if (!def) return
  const midB = (near.b + far.b) / 2
  const cellH = near.b - far.b
  const fontSize = Math.max(10, Math.min(cellH * 0.7, (near.r - near.l) * 0.5))
  const px = (near.l + near.r) / 2
  const py = midB - cellH * 0.35
  ctx.font = `${fontSize}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 4
  ctx.fillStyle = def.color
  ctx.fillText(def.icon ?? '•', px, py)
  ctx.shadowBlur = 0
}

// Floor tint: walkable built-ins use a neutral stone floor; custom base markers
// and special floors (e.g. door/stairs) tint by their definition colour.
function floorColorFor(cells: CellMap, x: number, y: number, customBase: Record<number, MarkerDef>): string {
  const base = cells[`${x},${y}`]?.base ?? 0
  if (base <= 1) return FLOOR_BASE // empty/floor → stone
  const def = baseDef(base, customBase)
  return def?.color ?? FLOOR_BASE
}

// ── Canvas helpers ───────────────────────────────────────────────────────────

function quad(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  x4: number, y4: number,
  fill: string,
  stroke: string | null,
) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function shade(color: string, amt: number): string {
  const [r, g, b] = parseHex(color)
  const f = Math.max(0, 1 - amt)
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`
}

function parseHex(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '')
  if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
  if (h.length >= 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  return [68, 68, 80]
}
