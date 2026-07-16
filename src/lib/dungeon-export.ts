/**
 * Dungeon map PDF export — Canvas 2D → jsPDF.
 *
 * A4 pages (210×297mm) at 2× scale (1190×1684 css-px canvas). Each map becomes a
 * page: parchment background, stone-corner ornaments, vine edge decorations,
 * ink-wash cell colours, game-title + map-name header, a per-page legend (built-in
 * and custom markers), coordinate rulers, and a collected notes index.
 *
 * Pure presentation — decoupled from Epoch; consumes only the shared model and
 * the built-in type tables.
 */

import { jsPDF } from 'jspdf'
import type { CellData, CellMap, CustomMarker, EdgeDir, MapData, MarkerDef } from './types'
import { BASE_TYPES, EDGE_TYPES, OVERLAY_TYPES, baseDef, boundaryKey, edgeDef, overlayDef } from './constants'

// ── Page constants ─────────────────────────────────────────────────────────────

const PW = 1190
const PH = 1684
const MARGIN = 60
const HEADER_H = 110
const FOOTER_H = 40
const LEGEND_H = 130

const MAP_X = MARGIN
const MAP_Y = MARGIN + HEADER_H
const MAP_W = PW - MARGIN * 2
const NOTES_H = 100
const MAP_H = PH - MARGIN - HEADER_H - FOOTER_H - LEGEND_H - NOTES_H - 16

// ── Colour helpers ─────────────────────────────────────────────────────────────

function toRgba(color: string, alpha: number): string {
  if (color.startsWith('rgba') || color.startsWith('rgb')) return color
  const h = color.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Custom-marker lookup ───────────────────────────────────────────────────────

function buildCustomTables(markers: CustomMarker[]) {
  const base: Record<number, MarkerDef> = {}
  const overlay: Record<number, MarkerDef> = {}
  for (const m of markers) {
    const def: MarkerDef = { id: m.id, label: m.label, color: m.color, icon: m.icon }
    if (m.kind === 'base') base[m.id] = def
    else overlay[m.id] = def
  }
  return { base, overlay }
}

// ── Font loading ──────────────────────────────────────────────────────────────

let fontsLoaded = false
async function loadFonts() {
  if (fontsLoaded) return
  try {
    await document.fonts.load('bold 24px "Cinzel Decorative"')
    await document.fonts.load('normal 18px "Cinzel"')
  } catch {
    /* fonts optional — falls back to Georgia/serif */
  }
  fontsLoaded = true
}

// ── Parchment background ──────────────────────────────────────────────────────

function drawParchment(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, PW, PH)
  grad.addColorStop(0.0, '#f0e0c0')
  grad.addColorStop(0.3, '#e8d4aa')
  grad.addColorStop(0.55, '#ddc898')
  grad.addColorStop(0.8, '#e4d0a8')
  grad.addColorStop(1.0, '#d8c090')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, PW, PH)

  ctx.save()
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * PW
    const y = Math.random() * PH
    const r = Math.random() * 1.5
    ctx.globalAlpha = Math.random() * 0.06
    ctx.fillStyle = Math.random() > 0.5 ? '#5a3a10' : '#e8d4aa'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  const vign = ctx.createRadialGradient(PW / 2, PH / 2, PH * 0.25, PW / 2, PH / 2, PH * 0.85)
  vign.addColorStop(0, 'rgba(0,0,0,0)')
  vign.addColorStop(1, 'rgba(60,30,0,0.22)')
  ctx.fillStyle = vign
  ctx.fillRect(0, 0, PW, PH)
}

// ── Stone-block corner ornament ───────────────────────────────────────────────

function drawStoneCorner(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  size: number,
  flipX: boolean,
  flipY: boolean,
) {
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  const b = size / 3
  const blocks: [number, number][] = [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [1, 1],
    [0, 2],
  ]
  for (const [col, row] of blocks) {
    const x = col * b
    const y = row * b
    const shade = (col + row) % 2 === 0 ? 0.18 : 0.1
    ctx.fillStyle = `rgba(80,50,20,${shade})`
    ctx.fillRect(x, y, b - 1, b - 1)
    ctx.strokeStyle = 'rgba(80,50,20,0.30)'
    ctx.lineWidth = 0.8
    ctx.strokeRect(x, y, b - 1, b - 1)
  }
  const cx = b * 1.5
  const cy = b * 1.5
  const cr = b * 0.35
  ctx.strokeStyle = 'rgba(80,50,20,0.40)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(cx, cy, cr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - cr * 0.6, cy)
  ctx.lineTo(cx + cr * 0.6, cy)
  ctx.moveTo(cx, cy - cr * 0.6)
  ctx.lineTo(cx, cy + cr * 0.6)
  ctx.stroke()
  ctx.restore()
}

// ── Vine / scroll edge decoration ────────────────────────────────────────────

function drawVineEdge(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1)
  const len = Math.hypot(x2 - x1, y2 - y1)
  ctx.save()
  ctx.translate(x1, y1)
  if (!horiz) ctx.rotate(Math.PI / 2)
  const inset = 4
  ctx.strokeStyle = 'rgba(80,50,20,0.35)'
  ctx.lineWidth = 1.0
  ctx.beginPath()
  ctx.moveTo(0, inset)
  ctx.lineTo(len, inset)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, inset + 4)
  ctx.lineTo(len, inset + 4)
  ctx.stroke()
  const spacing = 90
  const count = Math.floor(len / spacing)
  const start = (len - count * spacing) / 2 + spacing / 2
  ctx.fillStyle = 'rgba(80,50,20,0.28)'
  for (let i = 0; i < count; i++) {
    const cx = start + i * spacing
    const cy = inset + 2
    const s = 5
    ctx.beginPath()
    ctx.moveTo(cx, cy - s)
    ctx.lineTo(cx + s, cy)
    ctx.lineTo(cx, cy + s)
    ctx.lineTo(cx - s, cy)
    ctx.closePath()
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(80,50,20,0.18)'
  ctx.lineWidth = 0.7
  for (let i = 0; i < Math.floor(len / 30); i++) {
    const cx = 15 + i * 30
    if (cx > len - 15) break
    ctx.save()
    ctx.translate(cx, inset + 2)
    ctx.beginPath()
    ctx.ellipse(0, -3, 2.5, 5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

function drawBorder(ctx: CanvasRenderingContext2D) {
  const cs = 54
  drawStoneCorner(ctx, MARGIN - cs + 2, MARGIN - cs + 2, cs, false, false)
  drawStoneCorner(ctx, PW - MARGIN - 2, MARGIN - cs + 2, cs, true, false)
  drawStoneCorner(ctx, MARGIN - cs + 2, PH - MARGIN - 2, cs, false, true)
  drawStoneCorner(ctx, PW - MARGIN - 2, PH - MARGIN - 2, cs, true, true)
  const inset = MARGIN - cs + 2 + cs
  drawVineEdge(ctx, inset, MARGIN, PW - inset, MARGIN)
  drawVineEdge(ctx, inset, PH - MARGIN, PW - inset, PH - MARGIN)
  drawVineEdge(ctx, MARGIN, inset, MARGIN, PH - inset)
  drawVineEdge(ctx, PW - MARGIN, inset, PW - MARGIN, PH - inset)
}

function drawHeader(ctx: CanvasRenderingContext2D, gameTitle: string, mapName: string) {
  const cx = PW / 2
  const topY = MARGIN + 14
  ctx.strokeStyle = 'rgba(80,50,20,0.30)'
  ctx.lineWidth = 1.5
  const ruleY = topY + HEADER_H - 10
  ctx.beginPath()
  ctx.moveTo(MARGIN + 55, ruleY)
  ctx.lineTo(PW - MARGIN - 55, ruleY)
  ctx.stroke()
  ctx.font = 'bold 28px "Cinzel Decorative", "Cinzel", Georgia, serif'
  ctx.fillStyle = 'rgba(60,30,0,0.80)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(gameTitle || 'Dungeon Map', cx, topY)
  ctx.font = '18px "Cinzel", Georgia, serif'
  ctx.fillStyle = 'rgba(80,50,20,0.65)'
  ctx.fillText(mapName, cx, topY + 38)
}

function drawFooter(ctx: CanvasRenderingContext2D, pageNum: number, total: number) {
  const y = PH - MARGIN - FOOTER_H + 18
  ctx.font = '13px "Cinzel", Georgia, serif'
  ctx.fillStyle = 'rgba(80,50,20,0.45)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`— ${pageNum} of ${total} —`, PW / 2, y)
  ctx.font = '11px "Cinzel", Georgia, serif'
  ctx.fillStyle = 'rgba(80,50,20,0.30)'
  ctx.fillText('Epoch', PW / 2, y + 16)
}

// ── Used-type collection ───────────────────────────────────────────────────────

interface UsedTypes {
  bases: Set<number>
  overlays: Set<number>
  edges: Set<number>
}

function collectUsed(cells: CellMap, boundaries?: Record<string, import('./engine-types').BoundaryData>): UsedTypes {
  const bases = new Set<number>()
  const overlays = new Set<number>()
  const edges = new Set<number>()
  for (const cell of Object.values(cells)) {
    if ((cell.base ?? 0) !== 0) bases.add(cell.base)
    for (const o of cell.overlays) overlays.add(o)
  }
  if (boundaries) {
    for (const b of Object.values(boundaries)) {
      if (b.wall !== undefined) edges.add(b.wall)
    }
  }
  return { bases, overlays, edges }
}

// ── Legend ────────────────────────────────────────────────────────────────────

function drawLegend(
  ctx: CanvasRenderingContext2D,
  used: UsedTypes,
  customBase: Record<number, MarkerDef>,
  customOverlay: Record<number, MarkerDef>,
) {
  const lx = MAP_X
  const ly = MAP_Y + MAP_H + 14
  const swatchSize = 14
  const rowH = 22
  const colW = 180

  type Entry = { label: string; fill?: string; stroke?: string; edgeColor?: string; icon?: string; iconColor?: string }
  const entries: Entry[] = []

  for (const id of used.bases) {
    const def = BASE_TYPES[id] ?? customBase[id]
    if (!def) continue
    entries.push({ label: def.label, fill: toRgba(def.color, 0.35), stroke: toRgba(def.color, 0.7) })
  }
  for (const id of used.overlays) {
    const def = OVERLAY_TYPES[id] ?? customOverlay[id]
    if (!def) continue
    entries.push({ label: def.label, icon: def.icon ?? '•', iconColor: def.color })
  }
  for (const id of used.edges) {
    const def = EDGE_TYPES[id]
    if (!def) continue
    entries.push({ label: def.label, edgeColor: def.color })
  }

  ctx.font = '10px "Cinzel", Georgia, serif'
  ctx.fillStyle = 'rgba(80,50,20,0.45)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('LEGEND', lx, ly - 4)
  ctx.strokeStyle = 'rgba(80,50,20,0.20)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(lx, ly + 2)
  ctx.lineTo(lx + MAP_W, ly + 2)
  ctx.stroke()

  let col = 0
  let row = 0
  const maxCols = Math.max(1, Math.floor(MAP_W / colW))
  for (const entry of entries) {
    const ex = lx + col * colW
    const ey = ly + 8 + row * rowH

    if (entry.fill !== undefined) {
      ctx.fillStyle = 'rgba(200,185,150,0.8)'
      ctx.fillRect(ex, ey, swatchSize, swatchSize)
      ctx.fillStyle = entry.fill
      ctx.fillRect(ex, ey, swatchSize, swatchSize)
      ctx.strokeStyle = entry.stroke || 'rgba(80,50,20,0.40)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(ex, ey, swatchSize, swatchSize)
    } else if (entry.edgeColor) {
      ctx.fillStyle = entry.edgeColor
      ctx.fillRect(ex, ey + 4, swatchSize, 6)
    } else if (entry.icon) {
      ctx.fillStyle = toRgba(entry.iconColor || '#3c1e00', 0.85)
      ctx.font = 'bold 12px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(entry.icon, ex + swatchSize / 2, ey + swatchSize / 2)
    }

    ctx.font = '11px "Cinzel", Georgia, serif'
    ctx.fillStyle = 'rgba(60,30,0,0.70)'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(entry.label, ex + swatchSize + 6, ey + swatchSize / 2)

    col++
    if (col >= maxCols) {
      col = 0
      row++
    }
  }
}

// ── Map grid ──────────────────────────────────────────────────────────────────

const GRID_PAD = 1

function drawMap(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  customBase: Record<number, MarkerDef>,
  customOverlay: Record<number, MarkerDef>,
) {
  const cells = map.cells
  const keys = Object.keys(cells)

  if (keys.length === 0 && map.playerX === 0 && map.playerY === 0) {
    ctx.font = '16px "Cinzel", Georgia, serif'
    ctx.fillStyle = 'rgba(80,50,20,0.35)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('(empty map)', PW / 2, MAP_Y + MAP_H / 2)
    return
  }

  const xs = keys.map((k) => parseInt(k.split(',')[0]))
  const ys = keys.map((k) => parseInt(k.split(',')[1]))
  const px = map.playerX
  const py = map.playerY
  const minX = Math.min(...(xs.length ? xs : [px]), px) - GRID_PAD
  const minY = Math.min(...(ys.length ? ys : [py]), py) - GRID_PAD
  const maxX = Math.max(...(xs.length ? xs : [px]), px) + GRID_PAD
  const maxY = Math.max(...(ys.length ? ys : [py]), py) + GRID_PAD
  const cols = maxX - minX + 1
  const rows = maxY - minY + 1

  const rulerSize = 22
  const cellW = Math.floor((MAP_W - rulerSize) / cols)
  const cellH = Math.floor((MAP_H - rulerSize) / rows)
  const cs = Math.max(6, Math.min(cellW, cellH, 56))

  const gridW = cols * cs + (cols - 1)
  const gridH = rows * cs + (rows - 1)
  const offX = MAP_X + rulerSize + Math.floor((MAP_W - rulerSize - gridW) / 2)
  const offY = MAP_Y + rulerSize + Math.floor((MAP_H - rulerSize - gridH) / 2)

  // Coordinate rulers
  ctx.font = `bold ${Math.max(7, Math.min(cs - 2, 11))}px "Cinzel", Georgia, serif`
  ctx.fillStyle = 'rgba(80,50,20,0.50)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (let col = 0; col < cols; col++) {
    ctx.fillText(String(minX + col), offX + col * (cs + 1) + cs / 2, offY - 3)
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let row = 0; row < rows; row++) {
    ctx.fillText(String(minY + row), offX - 5, offY + row * (cs + 1) + cs / 2)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const gx = minX + col
      const gy = minY + row
      const cell: CellData = cells[`${gx},${gy}`] ?? { base: 0, overlays: [] }
      const cx = offX + col * (cs + 1)
      const cy = offY + row * (cs + 1)

      // Background tint
      ctx.fillStyle = 'rgba(200,185,150,0.50)'
      ctx.fillRect(cx, cy, cs, cs)

      const bdef = baseDef(cell.base, customBase)
      if ((cell.base ?? 0) !== 0) {
        ctx.fillStyle = toRgba(bdef.color, 0.35)
        ctx.fillRect(cx, cy, cs, cs)
      }
      ctx.strokeStyle = (cell.base ?? 0) !== 0 ? toRgba(bdef.color, 0.6) : 'rgba(80,50,20,0.20)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(cx, cy, cs, cs)

      // Overlay icon (first overlay)
      if (cell.overlays.length > 0 && cs >= 10) {
        const odef = overlayDef(cell.overlays[0], customOverlay)
        if (odef) {
          ctx.font = `${Math.max(6, Math.floor(cs * 0.5))}px Georgia, serif`
          ctx.fillStyle = toRgba(odef.color, 0.9)
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(odef.icon ?? '•', cx + cs / 2, cy + cs / 2 + 1)
        }
      }

      // Boundary edges
      for (const dir of ['N', 'S', 'E', 'W'] as EdgeDir[]) {
        const b = map.boundaries?.[boundaryKey(gx, gy, dir)]
        if (!b) continue
        const et = b.wall !== undefined ? b.wall : b.door ? 1 : 0
        const thickness = Math.max(1, Math.round(cs / 7))
        const gap = et === 0 ? 0 : Math.round(cs * 0.18)
        ctx.fillStyle = edgeDef(et).color
        if (dir === 'N') ctx.fillRect(cx + gap, cy, cs - gap * 2, thickness)
        if (dir === 'S') ctx.fillRect(cx + gap, cy + cs - thickness, cs - gap * 2, thickness)
        if (dir === 'W') ctx.fillRect(cx, cy + gap, thickness, cs - gap * 2)
        if (dir === 'E') ctx.fillRect(cx + cs - thickness, cy + gap, thickness, cs - gap * 2)
      }

      // Player marker
      if (gx === px && gy === py) {
        const r = Math.max(2, Math.round(cs * 0.2))
        ctx.fillStyle = 'rgba(200,140,20,0.85)'
        ctx.beginPath()
        ctx.arc(cx + cs / 2, cy + cs / 2, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

// ── Notes index ───────────────────────────────────────────────────────────────

function drawNotesIndex(ctx: CanvasRenderingContext2D, cells: CellMap) {
  const notes: Array<{ x: number; y: number; note: string }> = []
  for (const [key, cell] of Object.entries(cells)) {
    if (cell.note) {
      const [x, y] = key.split(',').map(Number)
      notes.push({ x, y, note: cell.note })
    }
  }
  if (notes.length === 0) return
  notes.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))

  const nx = MAP_X
  const ny = MAP_Y + MAP_H + LEGEND_H + 8
  const lineH = 17

  ctx.font = '10px "Cinzel", Georgia, serif'
  ctx.fillStyle = 'rgba(80,50,20,0.45)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('NOTES', nx, ny)
  ctx.strokeStyle = 'rgba(80,50,20,0.20)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(nx, ny + 12)
  ctx.lineTo(nx + MAP_W, ny + 12)
  ctx.stroke()

  const maxY = PH - MARGIN - FOOTER_H - 8
  for (let i = 0; i < notes.length; i++) {
    const lineY = ny + 16 + i * lineH
    if (lineY + lineH > maxY) break
    const { x, y, note } = notes[i]
    ctx.fillStyle = 'rgba(80,50,20,0.50)'
    ctx.font = 'bold 10px "Cinzel", Georgia, serif'
    ctx.fillText(`(${x}, ${y})`, nx, lineY)
    ctx.fillStyle = 'rgba(60,30,0,0.75)'
    ctx.font = '11px Georgia, serif'
    ctx.fillText(note, nx + 60, lineY)
  }
}

// ── Render one map to a canvas ────────────────────────────────────────────────

async function renderMapToCanvas(
  map: MapData,
  gameTitle: string,
  pageNum: number,
  total: number,
  customBase: Record<number, MarkerDef>,
  customOverlay: Record<number, MarkerDef>,
): Promise<HTMLCanvasElement> {
  await loadFonts()
  const canvas = document.createElement('canvas')
  canvas.width = PW
  canvas.height = PH
  const ctx = canvas.getContext('2d')!
  drawParchment(ctx)
  drawBorder(ctx)
  drawHeader(ctx, gameTitle, map.name)
  drawMap(ctx, map, customBase, customOverlay)
  drawLegend(ctx, collectUsed(map.cells, map.boundaries), customBase, customOverlay)
  drawNotesIndex(ctx, map.cells)
  drawFooter(ctx, pageNum, total)
  return canvas
}

// ── Public export function ────────────────────────────────────────────────────

export async function exportMapsAsPdf(
  maps: MapData[],
  gameTitle: string,
  customMarkers: CustomMarker[] = [],
): Promise<void> {
  if (maps.length === 0) return
  const { base: customBase, overlay: customOverlay } = buildCustomTables(customMarkers)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PW, PH] })
  for (let i = 0; i < maps.length; i++) {
    if (i > 0) pdf.addPage([PW, PH], 'portrait')
    const canvas = await renderMapToCanvas(maps[i], gameTitle, i + 1, maps.length, customBase, customOverlay)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    pdf.addImage(dataUrl, 'JPEG', 0, 0, PW, PH, '', 'FAST')
  }
  const safeTitle = (gameTitle || 'dungeon').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  pdf.save(`${safeTitle}-maps.pdf`)
}
