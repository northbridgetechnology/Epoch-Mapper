/**
 * World-grid helpers — stitching maps into a continuous world via edge links.
 *
 * A map is a world tile; an `edgeLinks` entry connects one edge (N/S/E/W) to a
 * neighbouring map. Stepping off a linked edge crosses into the neighbour at
 * the opposite edge with the cross-axis position preserved, so a lattice of
 * maps reads as one large open world (Creation Engine-style cell seams).
 *
 * Pure and DOM-free so it can be unit-tested and run anywhere.
 */

import type { MapData, EdgeDir } from './types'

export interface MapBounds { minX: number; minY: number; maxX: number; maxY: number }

/** Bounding box of a map's populated cells. Empty maps report a 0,0 point. */
export function mapBounds(map: MapData): MapBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const key of Object.keys(map.cells)) {
    const comma = key.indexOf(',')
    const x = Number(key.slice(0, comma))
    const y = Number(key.slice(comma + 1))
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface EdgeCrossing {
  mapId: string
  x: number
  y: number
  /** Facing is preserved by the caller; edge crossings never rotate the party. */
  transition?: import('./engine-types').TransitionStyle
}

/**
 * Resolve stepping toward `(attemptX, attemptY)` in direction `dir` off `map`.
 * Returns the destination on the linked neighbour (opposite edge, cross-axis
 * position preserved and clamped to the neighbour's bounds) — or null when the
 * step stays in-bounds, no edge link exists for `dir`, or the target is gone.
 */
export function resolveEdgeCrossing(
  map: MapData,
  attemptX: number,
  attemptY: number,
  dir: EdgeDir,
  maps: MapData[],
): EdgeCrossing | null {
  const link = map.edgeLinks?.[dir]
  if (!link) return null
  const b = mapBounds(map)
  // The step must actually leave the map's edge in this direction.
  const leaving =
    (dir === 'E' && attemptX > b.maxX) ||
    (dir === 'W' && attemptX < b.minX) ||
    (dir === 'N' && attemptY < b.minY) ||
    (dir === 'S' && attemptY > b.maxY)
  if (!leaving) return null

  const target = maps.find(m => m.id === link.mapId)
  if (!target) return null
  const tb = mapBounds(target)

  // Arrive at the opposite edge; keep the perpendicular coordinate.
  let x: number, y: number
  if (dir === 'E')      { x = tb.minX; y = clamp(attemptY, tb.minY, tb.maxY) }
  else if (dir === 'W') { x = tb.maxX; y = clamp(attemptY, tb.minY, tb.maxY) }
  else if (dir === 'N') { y = tb.maxY; x = clamp(attemptX, tb.minX, tb.maxX) }
  else                  { y = tb.minY; x = clamp(attemptX, tb.minX, tb.maxX) }

  return { mapId: link.mapId, x, y, transition: link.transition ?? 'seamless' }
}

const OPPOSITE: Record<EdgeDir, EdgeDir> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/** The reciprocal edge for a bidirectional link (E ↔ W, N ↔ S). */
export function oppositeEdge(dir: EdgeDir): EdgeDir {
  return OPPOSITE[dir]
}
