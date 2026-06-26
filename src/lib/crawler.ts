/**
 * First-person crawler logic — facing/direction math and grid collision.
 *
 * Pure and DOM-free so it can be unit-tested and reused by the renderer, the
 * editor's movement handler, and (later) Epoch. "Walkability" is intentionally
 * tile-driven: an unpainted cell (base 0) is not walkable, which is what makes
 * "you can't step onto a floorless cell until a floor is placed" fall out for
 * free.
 */

import type { CellMap, EdgeDir, MarkerDef } from './types'
import { BASE, EDGE, CUSTOM_ID_MIN } from './constants'

export type Facing = EdgeDir // 'N' | 'S' | 'E' | 'W'

/** Unit step for each facing (screen coords: +y is down / south). */
export const DIR_VECTOR: Record<Facing, readonly [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
}

export const OPPOSITE: Record<Facing, Facing> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/** Turn 90° counter-clockwise (to the player's left). */
export function turnLeft(f: Facing): Facing {
  return ({ N: 'W', W: 'S', S: 'E', E: 'N' } as const)[f]
}

/** Turn 90° clockwise (to the player's right). */
export function turnRight(f: Facing): Facing {
  return ({ N: 'E', E: 'S', S: 'W', W: 'N' } as const)[f]
}

export const leftOf = turnLeft
export const rightOf = turnRight

/** Map a unit move vector back to a facing (for "auto-face last move"). */
export function vectorToFacing(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy === -1) return 'N'
  if (dx === 0 && dy === 1) return 'S'
  if (dx === 1 && dy === 0) return 'E'
  if (dx === -1 && dy === 0) return 'W'
  return null
}

// Edges that physically block passage. Doors-as-base and the passable edge
// types (one-way, illusory, damage, secret) do NOT block in v1.
const BLOCKING_EDGES: ReadonlySet<number> = new Set([EDGE.WALL, EDGE.LOCKED_DOOR])

// Base types you can stand on. Built-in: Floor, Door, Stairs Up/Down. Custom
// base markers (128+) are treated as floor-like. Everything else — Empty (no
// tile), Wall, Water, Lava, Void — blocks.
const WALKABLE_BUILTIN_BASES: ReadonlySet<number> = new Set([
  BASE.FLOOR,
  BASE.DOOR,
  BASE.STAIRS_UP,
  BASE.STAIRS_DOWN,
])

export function isWalkableBase(base: number, customBase?: Record<number, MarkerDef>): boolean {
  if (WALKABLE_BUILTIN_BASES.has(base)) return true
  if (base >= CUSTOM_ID_MIN && customBase?.[base]) return true
  return false
}

function edgeAt(cells: CellMap, x: number, y: number, dir: EdgeDir): number | undefined {
  return cells[`${x},${y}`]?.edges?.[dir]
}

/**
 * Can the player step from (x,y) into the adjacent cell in `dir`?
 *
 * Blocked if a wall/locked edge sits on either side of the shared border, or if
 * the destination cell isn't a walkable tile. Also used by the renderer to
 * decide where to draw wall faces, so collision and visuals stay consistent.
 */
export function canPass(
  cells: CellMap,
  x: number,
  y: number,
  dir: EdgeDir,
  customBase?: Record<number, MarkerDef>,
): boolean {
  const here = edgeAt(cells, x, y, dir)
  if (here !== undefined && BLOCKING_EDGES.has(here)) return false

  const [dx, dy] = DIR_VECTOR[dir]
  const nx = x + dx
  const ny = y + dy

  const there = edgeAt(cells, nx, ny, OPPOSITE[dir])
  if (there !== undefined && BLOCKING_EDGES.has(there)) return false

  const neighborBase = cells[`${nx},${ny}`]?.base ?? 0
  return isWalkableBase(neighborBase, customBase)
}
