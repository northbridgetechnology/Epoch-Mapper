/**
 * Procedural map generator for Epoch Mapper.
 * Produces either a plain floor-filled map (base) or a BSP dungeon (generated).
 * Pure utility — no React, no DOM.
 */

import { BASE, EDGE, OVERLAY, CHUNK_SIZE, boundaryKey } from './constants'
import type { CellMap, MapData, EdgeDir } from './types'
import type { BoundaryData, CellEntity, Ruleset } from './engine-types'
import { uid } from './utils'

export type MapSize = 'small' | 'medium' | 'large'

export interface NewMapConfig {
  name: string
  size: MapSize
  seed: number
  generate: boolean
}

export const SIZE_DIM: Record<MapSize, number> = {
  small:  40,
  medium: 64,
  large:  80,
}

// ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────────

function makePrng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let z = Math.imul(s ^ (s >>> 15), 1 | s)
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function pickRandom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

// ── Chunk helpers ──────────────────────────────────────────────────────────────

function allChunkKeys(dim: number): string[] {
  const maxC = Math.floor((dim - 1) / CHUNK_SIZE)
  const keys: string[] = []
  for (let cy = 0; cy <= maxC; cy++)
    for (let cx = 0; cx <= maxC; cx++)
      keys.push(`${cx},${cy}`)
  return keys
}

// ── BSP types ─────────────────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }

interface BSPNode {
  rect: Rect
  depth: number
  left?: BSPNode
  right?: BSPNode
  room?: Rect
}

type LeafWithRoom = BSPNode & { room: Rect }

// ── BSP split ─────────────────────────────────────────────────────────────────

function bspSplit(node: BSPNode, rng: () => number, minLeaf: number): void {
  const { x, y, w, h } = node.rect
  const canV = w >= minLeaf * 2
  const canH = h >= minLeaf * 2
  if (!canV && !canH) return

  const splitV = canV && (!canH || rng() < 0.5)
  if (splitV) {
    const s = Math.floor(w * (0.4 + rng() * 0.2))
    node.left  = { rect: { x,     y, w: s,     h }, depth: node.depth + 1 }
    node.right = { rect: { x: x + s, y, w: w - s, h }, depth: node.depth + 1 }
  } else {
    const s = Math.floor(h * (0.4 + rng() * 0.2))
    node.left  = { rect: { x, y,     w, h: s     }, depth: node.depth + 1 }
    node.right = { rect: { x, y: y + s, w, h: h - s }, depth: node.depth + 1 }
  }
  bspSplit(node.left,  rng, minLeaf)
  bspSplit(node.right, rng, minLeaf)
}

function collectLeaves(node: BSPNode): BSPNode[] {
  if (!node.left && !node.right) return [node]
  return [
    ...(node.left  ? collectLeaves(node.left)  : []),
    ...(node.right ? collectLeaves(node.right) : []),
  ]
}

// ── Room and corridor carving ──────────────────────────────────────────────────

function carveRoom(room: Rect, cells: CellMap, roomSet: Set<string>): void {
  for (let ry = room.y; ry < room.y + room.h; ry++) {
    for (let rx = room.x; rx < room.x + room.w; rx++) {
      const k = `${rx},${ry}`
      cells[k] = { base: BASE.FLOOR, overlays: [] }
      roomSet.add(k)
    }
  }
}

function carveCorridor(
  ax: number, ay: number, bx: number, by: number,
  cells: CellMap, rng: () => number,
): void {
  let cx = ax; let cy = ay
  const floor = () => { cells[`${cx},${cy}`] = { base: BASE.FLOOR, overlays: [] } }

  if (rng() < 0.5) {
    while (cx !== bx) { floor(); cx += cx < bx ? 1 : -1 }
    while (cy !== by) { floor(); cy += cy < by ? 1 : -1 }
  } else {
    while (cy !== by) { floor(); cy += cy < by ? 1 : -1 }
    while (cx !== bx) { floor(); cx += cx < bx ? 1 : -1 }
  }
  floor()
}

// Connect tree, returning room-center to connect siblings upward
function connectTree(
  node: BSPNode, cells: CellMap, rng: () => number,
): { x: number; y: number } | null {
  if (!node.left && !node.right) {
    if (!node.room) return null
    return { x: Math.floor(node.room.x + node.room.w / 2), y: Math.floor(node.room.y + node.room.h / 2) }
  }
  const l = node.left  ? connectTree(node.left,  cells, rng) : null
  const r = node.right ? connectTree(node.right, cells, rng) : null
  if (l && r) carveCorridor(l.x, l.y, r.x, r.y, cells, rng)
  return l ?? r
}

// ── Plain base map (perimeter walls + interior floor) ─────────────────────────

export function buildBaseMap(name: string, config: NewMapConfig): MapData {
  const dim = SIZE_DIM[config.size]
  const cells: CellMap = {}
  for (let y = 1; y < dim - 1; y++)
    for (let x = 1; x < dim - 1; x++)
      cells[`${x},${y}`] = { base: BASE.FLOOR, overlays: [] }
  const mid = Math.floor(dim / 2)
  return {
    id: uid(), name, cells,
    playerX: mid, playerY: mid,
    revealedChunks: allChunkKeys(dim),
    seed: config.seed,
  }
}

// ── BSP dungeon map ────────────────────────────────────────────────────────────

export function buildGeneratedMap(name: string, config: NewMapConfig, ruleset: Ruleset): MapData {
  const rng   = makePrng(config.seed)
  const dim   = SIZE_DIM[config.size]
  const minLeaf = dim <= 40 ? 10 : dim <= 64 ? 12 : 14
  const margin  = 2

  // BSP partition of interior (excluding perimeter)
  const root: BSPNode = { rect: { x: 1, y: 1, w: dim - 2, h: dim - 2 }, depth: 0 }
  bspSplit(root, rng, minLeaf)
  const leaves = collectLeaves(root)

  // Place rooms inside each leaf
  for (const leaf of leaves) {
    const { x, y, w, h } = leaf.rect
    const maxRW = w - margin * 2
    const maxRH = h - margin * 2
    if (maxRW < 4 || maxRH < 4) continue
    const rw = randInt(rng, 4, maxRW)
    const rh = randInt(rng, 4, maxRH)
    leaf.room = {
      x: x + margin + randInt(rng, 0, maxRW - rw),
      y: y + margin + randInt(rng, 0, maxRH - rh),
      w: rw, h: rh,
    }
  }

  const cells: CellMap = {}
  const boundaries: Record<string, BoundaryData> = {}
  const roomCells = new Set<string>()

  const withRooms = leaves.filter((l): l is LeafWithRoom => l.room != null)
  for (const leaf of withRooms) carveRoom(leaf.room, cells, roomCells)
  connectTree(root, cells, rng)

  // Wall boundary stripes: add EDGE.WALL on every floor-cell face that borders an empty cell.
  // This makes rooms and corridors visually distinct in the 2D map editor.
  const DIRS: EdgeDir[] = ['N', 'S', 'E', 'W']
  const DELTA: Record<EdgeDir, [number, number]> = { N: [0,-1], S: [0,1], E: [1,0], W: [-1,0] }
  for (const key of Object.keys(cells)) {
    const [x, y] = key.split(',').map(Number)
    for (const dir of DIRS) {
      const [dx, dy] = DELTA[dir]
      if (!cells[`${x + dx},${y + dy}`]) {
        const bk = boundaryKey(x, y, dir)
        if (!boundaries[bk]) boundaries[bk] = { wall: EDGE.WALL }
      }
    }
  }

  // Zone encounter entities on corridor cells (not inside rooms).
  // Only placed when the ruleset has encounter tables to reference.
  const encTableIds = ruleset.encounterTables.map(t => t.id)
  if (encTableIds.length > 0) {
    for (const key of Object.keys(cells)) {
      if (roomCells.has(key)) continue
      if (rng() > 0.20) continue
      const tableId = pickRandom(rng, encTableIds)
      const encEnt: CellEntity = { t: 'encounter', table: tableId, mode: 'zone', rate: 0.12 }
      const c = cells[key]
      cells[key] = { ...c, entities: [...(c.entities ?? []), encEnt] }
    }
  }

  // Helpers
  const center = (r: Rect) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) })
  const dist2  = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2
  const mid    = dim / 2

  // Start room: closest to map centre
  let startLeaf = withRooms[0]
  let minD = Infinity
  for (const l of withRooms) {
    const c = center(l.room); const d = dist2(c.x, c.y, mid, mid)
    if (d < minD) { minD = d; startLeaf = l }
  }
  const startC = center(startLeaf.room)

  // Boss room: farthest from start
  let bossLeaf = withRooms.find(l => l !== startLeaf) ?? withRooms[0]
  let maxD = 0
  for (const l of withRooms) {
    if (l === startLeaf) continue
    const c = center(l.room); const d = dist2(c.x, c.y, startC.x, startC.y)
    if (d > maxD) { maxD = d; bossLeaf = l }
  }
  const bossC = center(bossLeaf.room)

  const setOverlay = (x: number, y: number, overlay: number) => {
    const k = `${x},${y}`
    const c = cells[k] ?? { base: BASE.FLOOR, overlays: [] }
    cells[k] = { ...c, overlays: [overlay] }
  }

  // Player start
  setOverlay(startC.x, startC.y, OVERLAY.PLAYER_START)

  // Boss room: boss overlay + stairs down nearby
  setOverlay(bossC.x, bossC.y, OVERLAY.BOSS)
  const stairsCandidates = [`${bossC.x + 1},${bossC.y}`, `${bossC.x - 1},${bossC.y}`, `${bossC.x},${bossC.y + 1}`]
  for (const sk of stairsCandidates) {
    const sc = cells[sk]
    if (sc && !sc.overlays?.length) {
      cells[sk] = { ...sc, base: BASE.STAIRS_DOWN }
      break
    }
  }

  // Side rooms: chests, NPCs, one save point
  const sideRooms = withRooms.filter(l => l !== startLeaf && l !== bossLeaf)
  const lootIds   = ruleset.lootTables.map(t => t.id)
  let savePointPlaced = false

  for (const leaf of sideRooms) {
    const room = leaf.room
    const innerX = room.x + 1
    const innerY = room.y + 1
    const innerW = Math.max(1, room.w - 2)
    const innerH = Math.max(1, room.h - 2)

    // Chest (40% per room)
    if (rng() < 0.4) {
      const cx = innerX + randInt(rng, 0, innerW - 1)
      const cy = innerY + randInt(rng, 0, innerH - 1)
      const ck = `${cx},${cy}`
      const chestEnt: CellEntity = {
        t: 'object',
        object: {
          kind: 'chest',
          id: uid(),
          ...(lootIds.length > 0 ? { loot: pickRandom(rng, lootIds) } : {}),
        },
      }
      const existing = cells[ck] ?? { base: BASE.FLOOR, overlays: [] }
      cells[ck] = { ...existing, entities: [...(existing.entities ?? []), chestEnt] }
    }

    // NPC (25% per room with width > 5)
    if (rng() < 0.25 && room.w > 5) {
      const nx = room.x + room.w - 2
      const ny = room.y + 1
      const nk = `${nx},${ny}`
      const nc = cells[nk] ?? { base: BASE.FLOOR, overlays: [] }
      if (!nc.overlays?.length) cells[nk] = { ...nc, overlays: [OVERLAY.NPC] }
    }

    // Save point (one per map)
    if (!savePointPlaced && rng() < 0.35) {
      const rc = center(room)
      const rk = `${rc.x},${rc.y}`
      const rcc = cells[rk] ?? { base: BASE.FLOOR, overlays: [] }
      if (!rcc.overlays?.length) {
        cells[rk] = { ...rcc, overlays: [OVERLAY.SAVE_POINT] }
        savePointPlaced = true
      }
    }
  }

  return {
    id: uid(), name, cells, boundaries,
    playerX: startC.x, playerY: startC.y,
    revealedChunks: allChunkKeys(dim),
    seed: config.seed,
  }
}
