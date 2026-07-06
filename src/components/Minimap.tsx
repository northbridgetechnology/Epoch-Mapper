'use client'

import type { MapData, EdgeDir } from '@/lib/types'
import type { Facing, Ruleset } from '@/lib/engine-types'
import { BASE, EDGE, OVERLAY, boundaryKey } from '@/lib/constants'
import { seenCellsFrom } from '@/lib/exploration'
import { getTheme } from '@/lib/themes'

/**
 * Round, north-up minimap for Play mode. Shows a 9×9 window centred on the
 * party. Fog is strictly exploration-based: a cell only appears once the party
 * has actually seen it (persisted `map.seenCells`) plus whatever is in current
 * line of sight this step. Revealed geography persists even on dark maps (you
 * remember where you've walked). The player is an arrow that rotates with facing.
 */

const R = 4                       // radius → 9×9 window
const N = R * 2 + 1
const SIZE = 300
const CELL = SIZE / N
const CX = SIZE / 2

const ARROW_ROT: Record<Facing, number> = { N: 0, E: 90, S: 180, W: 270 }

type Fill = 'fog' | 'wall' | 'floor' | 'water' | 'lava' | 'void'

function classify(map: MapData, x: number, y: number, revealed: boolean): Fill {
  if (!revealed) return 'fog'
  const base = map.cells[`${x},${y}`]?.base ?? 0
  if (base === 0 || base === BASE.WALL) return 'wall'
  if (base === BASE.WATER) return 'water'
  if (base === BASE.LAVA) return 'lava'
  if (base === BASE.VOID) return 'void'
  return 'floor'
}

const FILL_COLOR: Record<Fill, string> = {
  fog:   '#07070a',
  wall:  '#26262c',
  floor: '#41414b',
  water: '#12405f',
  lava:  '#5a1f1f',
  void:  '#040406',
}

export function Minimap({
  map, facing, flags, ruleset,
}: {
  map: MapData
  facing: Facing
  flags: Record<string, boolean | number | string>
  ruleset?: Ruleset
}) {
  const px = map.playerX
  const py = map.playerY
  const theme = getTheme(map.theme)
  const x0 = px - R
  const y0 = py - R

  // Exploration reveal: everything ever seen, plus the current line of sight.
  const revealedSet = new Set(map.seenCells ?? [])
  for (const k of seenCellsFrom(map, px, py, flags)) revealedSet.add(k)
  const isRevealed = (gx: number, gy: number) => revealedSet.has(`${gx},${gy}`)

  const sx = (gx: number) => (gx - x0) * CELL
  const sy = (gy: number) => (gy - y0) * CELL

  const fills: React.ReactNode[] = []
  const walls: React.ReactNode[] = []
  const marks: React.ReactNode[] = []

  // Small POI dot with a dark ring for legibility
  const dot = (gx: number, gy: number, color: string, key: string) => (
    <circle key={key} cx={sx(gx) + CELL / 2} cy={sy(gy) + CELL / 2}
      r={CELL * 0.22} fill={color} stroke="rgba(0,0,0,0.6)" strokeWidth={1.2} />
  )

  for (let gy = y0 - 1; gy <= py + R; gy++) {
    for (let gx = x0 - 1; gx <= px + R; gx++) {
      const revealed = isRevealed(gx, gy)
      const inWindow = gx >= x0 && gx <= px + R && gy >= y0 && gy <= py + R
      const kind = classify(map, gx, gy, revealed)

      if (inWindow) {
        fills.push(<rect key={`f_${gx}_${gy}`} x={sx(gx)} y={sy(gy)} width={CELL + 0.5} height={CELL + 0.5} fill={FILL_COLOR[kind]} />)
      }

      // Boundary walls between this cell's S / E faces (canonical keys). Draw
      // when either side is revealed so the layout appears as you explore.
      const nb = isRevealed(gx, gy + 1)
      const eb = isRevealed(gx + 1, gy)
      if (revealed || nb || eb) {
        const b = map.boundaries
        const sK = boundaryKey(gx, gy, 'S' as EdgeDir)
        const eK = boundaryKey(gx, gy, 'E' as EdgeDir)
        const sBound = b?.[sK]
        const eBound = b?.[eK]
        const lineFor = (bd?: { wall?: number; door?: unknown }) => {
          if (!bd) return null
          if (bd.wall === EDGE.DOOR || bd.door) return '#d9a441'          // doorway
          if (bd.wall === EDGE.DAMAGE) return '#dc2626'                    // hazard edge
          if (bd.wall !== undefined) return 'rgba(230,230,235,0.75)'       // any solid wall (incl hidden)
          return null
        }
        const sColor = (revealed || nb) ? lineFor(sBound) : null
        const eColor = (revealed || eb) ? lineFor(eBound) : null
        if (sColor) walls.push(<line key={`ws_${gx}_${gy}`} x1={sx(gx)} y1={sy(gy) + CELL} x2={sx(gx) + CELL} y2={sy(gy) + CELL} stroke={sColor} strokeWidth={2.6} />)
        if (eColor) walls.push(<line key={`we_${gx}_${gy}`} x1={sx(gx) + CELL} y1={sy(gy)} x2={sx(gx) + CELL} y2={sy(gy) + CELL} stroke={eColor} strokeWidth={2.6} />)
      }

      // Points of interest (only on revealed, in-window cells)
      if (inWindow && revealed) {
        const cell = map.cells[`${gx},${gy}`]
        if (!cell) continue
        const base = cell.base ?? 0
        if (base === BASE.STAIRS_DOWN || base === BASE.STAIRS_UP) {
          const up = base === BASE.STAIRS_UP
          marks.push(
            <text key={`st_${gx}_${gy}`} x={sx(gx) + CELL / 2} y={sy(gy) + CELL / 2}
              textAnchor="middle" dominantBaseline="central" fontSize={CELL * 0.7}
              fill={up ? '#7dd3fc' : '#c4b5fd'} style={{ userSelect: 'none' }}>{up ? '▲' : '▼'}</text>,
          )
        }
        if (cell.overlays?.includes(OVERLAY.SAVE_POINT)) marks.push(dot(gx, gy, '#a78bfa', `sp_${gx}_${gy}`))
        for (const e of cell.entities ?? []) {
          if (e.t !== 'object') continue
          if (e.object.kind === 'inn') marks.push(dot(gx, gy, '#34d399', `inn_${gx}_${gy}`))
          else if (e.object.kind === 'npc') {
            const npc = e.object.npc ? ruleset?.npcs?.find(n => n.id === e.object.npc) : undefined
            marks.push(dot(gx, gy, npc?.color ?? '#facc15', `npc_${gx}_${gy}`))
          }
        }
      }
    }
  }

  const arrowCx = sx(px) + CELL / 2
  const arrowCy = sy(py) + CELL / 2

  return (
    <div className="absolute top-3 right-3 z-20 pointer-events-none select-none"
      style={{ width: SIZE, height: SIZE, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))' }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
        <defs>
          <clipPath id="mm-clip"><circle cx={CX} cy={CX} r={CX - 1} /></clipPath>
        </defs>
        <circle cx={CX} cy={CX} r={CX - 1} fill={theme.fogColor} />
        <g clipPath="url(#mm-clip)">
          {fills}
          {walls}
          {marks}
          {/* Player arrow (north-up: rotates with facing) */}
          <g transform={`rotate(${ARROW_ROT[facing]} ${arrowCx} ${arrowCy})`}>
            <polygon
              points={`${arrowCx},${arrowCy - CELL * 0.42} ${arrowCx - CELL * 0.30},${arrowCy + CELL * 0.32} ${arrowCx},${arrowCy + CELL * 0.14} ${arrowCx + CELL * 0.30},${arrowCy + CELL * 0.32}`}
              fill="#fbbf24" stroke="rgba(0,0,0,0.65)" strokeWidth={1.4} />
          </g>
        </g>
        {/* Bezel + fixed north tick */}
        <circle cx={CX} cy={CX} r={CX - 1} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={2.5} />
        <circle cx={CX} cy={CX} r={CX - 1} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
        <text x={CX} y={16} textAnchor="middle" fontSize={15} fontWeight={700}
          fill="rgba(255,255,255,0.6)" style={{ userSelect: 'none' }}>N</text>
      </svg>
    </div>
  )
}
