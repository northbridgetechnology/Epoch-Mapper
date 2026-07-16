/**
 * Procedural map generator for Epoch.
 * Produces either a plain floor-filled map (base) or a BSP dungeon (generated).
 * Pure utility — no React, no DOM.
 */

import { BASE, EDGE, OVERLAY, CHUNK_SIZE, boundaryKey } from './constants'
import type { CellMap, MapData, EdgeDir, SubcubeObject, SubcubePos } from './types'
import type { BoundaryData, CellEntity, EventDef, ItemDef, NpcDef, QuestDef, Ruleset } from './engine-types'
import { uid } from './utils'

/** Everything a generated map contributes: the map itself plus the ruleset
 *  content (NPCs, quest, events) that its story wiring references. */
export interface GeneratedWorld {
  map: MapData
  /** Additional levels (the dark Depths) linked from the main map. */
  extraMaps: MapData[]
  npcs: NpcDef[]
  quests: QuestDef[]
  events: EventDef[]
  /** Generated ruleset items the placed content references (cursed loot, scrolls). */
  items: ItemDef[]
}

export type MapSize = 'small' | 'medium' | 'large'

export interface NewMapConfig {
  name: string
  size: MapSize
  seed: number
  generate: boolean
  /** Layout style for generated maps (default 'rooms'). */
  style?: LayoutStyle
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

/** Back-compat wrapper: generated map only, ruleset additions discarded. */
export function buildGeneratedMap(name: string, config: NewMapConfig, ruleset: Ruleset): MapData {
  return buildGeneratedWorld(name, config, ruleset).map
}

const DIRS: EdgeDir[] = ['N', 'S', 'E', 'W']
const DELTA: Record<EdgeDir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }

// ── Layout styles ──────────────────────────────────────────────────────────────

/** How the dungeon is carved:
 *  - rooms: BSP rooms joined by corridors (the original generator)
 *  - eotb:  Eye of the Beholder — a dense thin-wall maze filling the whole
 *           square, small chambers, doors, illusory walls, secret passages
 *  - smt:   Shin Megami Tensei — long arterial corridors on a lattice with
 *           rectangular blocks hanging off them behind doors */
export type LayoutStyle = 'rooms' | 'eotb' | 'smt'

/** EotB floors are tight: smaller grids than the BSP sizes. */
export const EOTB_DIM: Record<MapSize, number> = { small: 25, medium: 31, large: 39 }

export function layoutDim(style: LayoutStyle, size: MapSize): number {
  return style === 'eotb' ? EOTB_DIM[size] : SIZE_DIM[size]
}

interface CarvedLayout {
  cells: CellMap
  boundaries: Record<string, BoundaryData>
  roomCells: Set<string>
  rooms: Rect[]
}

function carveLayout(style: LayoutStyle, dim: number, rng: () => number): CarvedLayout {
  if (style === 'eotb') return carveEotb(dim, rng)
  if (style === 'smt') return carveSmt(dim, rng)
  return carveBsp(dim, rng)
}

// ── Style: rooms (original BSP) ────────────────────────────────────────────────

function carveBsp(dim: number, rng: () => number): CarvedLayout {
  const minLeaf = dim <= 40 ? 10 : dim <= 64 ? 12 : 14
  const margin = 2
  const root: BSPNode = { rect: { x: 1, y: 1, w: dim - 2, h: dim - 2 }, depth: 0 }
  bspSplit(root, rng, minLeaf)
  const leaves = collectLeaves(root)
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
  const roomCells = new Set<string>()
  const withRooms = leaves.filter((l): l is LeafWithRoom => l.room != null)
  for (const leaf of withRooms) carveRoom(leaf.room, cells, roomCells)
  connectTree(root, cells, rng)
  return { cells, boundaries: {}, roomCells, rooms: withRooms.map(l => l.room) }
}

// ── Shared core: rooms + trimmed maze corridors (Nystrom "Rooms and Mazes") ────
//
// The layout both classics actually use: rooms placed first, corridors grown
// through the leftover space, the two joined ONLY at verified connectors (so
// every door provably leads somewhere), then dead ends trimmed away. Style
// parameters turn the same machine into an EotB floor or an SMT block.

interface RoomsMazesOpts {
  roomTries: number
  roomMin: number             // odd
  roomMax: number             // odd
  /** 0 = corridors run straight as long as possible; 1 = turn every step. */
  winding: number
  /** Chance to open an extra (loop) connector beyond the spanning set. */
  extraConnectorChance: number
  /** Trim corridor dead ends until at most this many remain. */
  keepDeadEnds: number
  /** Chance a room connector gets a door. */
  doorChance: number
  /** Illusory/secret alcove shortcuts to hide in the walls. */
  secrets: number
}

function carveRoomsAndMazes(dim: number, rng: () => number, opts: RoomsMazesOpts): CarvedLayout {
  const S = dim % 2 === 0 ? dim - 1 : dim   // odd lattice
  const lo = 1, hi = S - 2
  const cells: CellMap = {}
  const roomCells = new Set<string>()
  const boundaries: Record<string, BoundaryData> = {}
  const region: Record<string, number> = {}
  let regionId = 0
  const floor = (x: number, y: number, r: number) => {
    cells[`${x},${y}`] = { base: BASE.FLOOR, overlays: [] }
    region[`${x},${y}`] = r
  }

  // 1. Rooms on the odd lattice, no touching (1-cell wall gap guaranteed)
  const rooms: Rect[] = []
  for (let t = 0; t < opts.roomTries && rooms.length < Math.floor(S * S / 55); t++) {
    const rw = opts.roomMin + 2 * randInt(rng, 0, (opts.roomMax - opts.roomMin) / 2)
    const rh = opts.roomMin + 2 * randInt(rng, 0, (opts.roomMax - opts.roomMin) / 2)
    const rx = lo + 2 * randInt(rng, 0, (hi - rw - lo) / 2)
    const ry = lo + 2 * randInt(rng, 0, (hi - rh - lo) / 2)
    if (rooms.some(r => !(rx + rw < r.x || r.x + r.w < rx || ry + rh < r.y || r.y + r.h < ry))) continue
    const rect: Rect = { x: rx, y: ry, w: rw, h: rh }
    regionId++
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++) { floor(x, y, regionId); roomCells.add(`${x},${y}`) }
    rooms.push(rect)
  }

  // 2. Corridors: growing-tree maze through every uncarved odd cell
  for (let sy = lo; sy <= hi; sy += 2) {
    for (let sx = lo; sx <= hi; sx += 2) {
      if (cells[`${sx},${sy}`]) continue
      regionId++
      floor(sx, sy, regionId)
      const stack: [number, number][] = [[sx, sy]]
      let lastDir: EdgeDir | null = null
      while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1]
        const open = DIRS.filter(dir => {
          const [dx, dy] = DELTA[dir]
          const nx = cx + dx * 2, ny = cy + dy * 2
          return nx >= lo && nx <= hi && ny >= lo && ny <= hi && !cells[`${nx},${ny}`]
        })
        if (open.length === 0) { stack.pop(); lastDir = null; continue }
        const dir: EdgeDir = lastDir && open.includes(lastDir) && rng() > opts.winding
          ? lastDir
          : open[Math.floor(rng() * open.length)]
        const [dx, dy] = DELTA[dir]
        floor(cx + dx, cy + dy, regionId)
        floor(cx + dx * 2, cy + dy * 2, regionId)
        stack.push([cx + dx * 2, cy + dy * 2])
        lastDir = dir
      }
    }
  }

  // 3. Connectors: wall cells bridging two different regions. Open a spanning
  //    set (every region reachable), plus a few extras for loops.
  interface Connector { x: number; y: number; a: string; b: string }
  const connectors: Connector[] = []
  for (let y = lo; y <= hi; y++) {
    for (let x = lo; x <= hi; x++) {
      if (cells[`${x},${y}`]) continue
      const n = `${x},${y - 1}`, s = `${x},${y + 1}`, w = `${x - 1},${y}`, e = `${x + 1},${y}`
      if (cells[n] && cells[s] && region[n] !== region[s]) connectors.push({ x, y, a: n, b: s })
      else if (cells[w] && cells[e] && region[w] !== region[e]) connectors.push({ x, y, a: w, b: e })
    }
  }
  const merged = new Map<number, number>()
  const find = (r: number): number => {
    let root = r
    while (merged.has(root)) root = merged.get(root)!
    return root
  }
  const shuffledConn = [...connectors].sort(() => rng() - 0.5)
  const openConnector = (c: Connector) => {
    cells[`${c.x},${c.y}`] = { base: BASE.FLOOR, overlays: [] }
    region[`${c.x},${c.y}`] = find(region[c.a])
    // A door where a corridor meets a room (never floating: both sides are floor)
    const roomSide = roomCells.has(c.a) ? c.a : roomCells.has(c.b) ? c.b : null
    if (roomSide && rng() < opts.doorChance) {
      const [rx2, ry2] = roomSide.split(',').map(Number)
      const dir: EdgeDir = ry2 < c.y ? 'N' : ry2 > c.y ? 'S' : rx2 < c.x ? 'W' : 'E'
      boundaries[boundaryKey(c.x, c.y, dir)] = { wall: EDGE.DOOR, door: { state: 'closed' } }
    }
  }
  for (const c of shuffledConn) {
    const ra = find(region[c.a]), rb = find(region[c.b])
    if (ra !== rb) {
      merged.set(rb, ra)
      openConnector(c)
    } else if (rng() < opts.extraConnectorChance) {
      // Loop connector — only if not directly beside an existing opening
      const near = [`${c.x},${c.y - 1}`, `${c.x},${c.y + 1}`, `${c.x - 1},${c.y}`, `${c.x + 1},${c.y}`]
      if (near.filter(k => cells[k]).length <= 2) openConnector(c)
    }
  }

  // 4. Trim corridor dead ends down to the style's budget
  const corridorNeighbors = (x: number, y: number) =>
    DIRS.filter(dir => cells[`${x + DELTA[dir][0]},${y + DELTA[dir][1]}`]).length
  const deadEnds = (): string[] =>
    Object.keys(cells).filter(k => {
      if (roomCells.has(k)) return false
      const [x, y] = k.split(',').map(Number)
      return corridorNeighbors(x, y) <= 1
    })
  let ends = deadEnds()
  while (ends.length > opts.keepDeadEnds) {
    for (const k of ends.slice(0, Math.max(1, ends.length - opts.keepDeadEnds))) {
      delete cells[k]
      delete region[k]
    }
    ends = deadEnds()
  }
  // Doors must sit between two floor cells — drop any orphaned by trimming
  for (const bk of Object.keys(boundaries)) {
    const [cellPart, dirPart] = bk.split(':')
    const [bx, by] = cellPart.split(',').map(Number)
    const other = dirPart === 'S' ? `${bx},${by + 1}` : `${bx + 1},${by}`
    if (!cells[cellPart] || !cells[other]) delete boundaries[bk]
  }

  // 5. Secrets: carve an unused connector and hide it behind an illusory wall
  //    (one side opens normally — an alcove; the other side is the lie)
  let placedSecrets = 0
  for (const c of shuffledConn) {
    if (placedSecrets >= opts.secrets) break
    if (cells[`${c.x},${c.y}`] || !cells[c.a] || !cells[c.b]) continue
    cells[`${c.x},${c.y}`] = { base: BASE.FLOOR, overlays: [] }
    const [ax, ay] = c.a.split(',').map(Number)
    const dir: EdgeDir = ay < c.y ? 'N' : ay > c.y ? 'S' : ax < c.x ? 'W' : 'E'
    boundaries[boundaryKey(c.x, c.y, dir)] = { wall: placedSecrets === 0 ? EDGE.SECRET : EDGE.ILLUSORY }
    placedSecrets++
  }

  return { cells, boundaries, roomCells, rooms }
}

// ── Style: eotb — packed chambers, sparse winding corridors, hidden walls ─────

function carveEotb(dim: number, rng: () => number): CarvedLayout {
  return carveRoomsAndMazes(dim, rng, {
    roomTries: dim * 4,
    roomMin: 3, roomMax: 5,
    winding: 0.4,
    extraConnectorChance: 0.05,
    keepDeadEnds: 4,
    doorChance: 0.6,
    secrets: randInt(rng, 2, 3),
  })
}

// ── Style: smt — long straight avenues, loopy network, no dead ends ───────────

function carveSmt(dim: number, rng: () => number): CarvedLayout {
  return carveRoomsAndMazes(dim, rng, {
    roomTries: dim * 3,
    roomMin: 3, roomMax: 7,
    winding: 0.04,
    extraConnectorChance: 0.18,
    keepDeadEnds: 0,
    doorChance: 0.5,
    secrets: 0,
  })
}

export function buildGeneratedWorld(name: string, config: NewMapConfig, ruleset: Ruleset): GeneratedWorld {
  const rng   = makePrng(config.seed)
  const style = config.style ?? 'rooms'
  const dim   = layoutDim(style, config.size)

  const carved = carveLayout(style, dim, rng)
  const cells = carved.cells
  const boundaries = carved.boundaries
  const roomCells = carved.roomCells
  // Downstream story wiring speaks in leaf-with-room shapes
  const withRooms: LeafWithRoom[] = carved.rooms.map(r => ({ rect: r, depth: 0, room: r }))

  // Wall boundary stripes: add EDGE.WALL on every floor-cell face that borders an empty cell.
  // This makes rooms and corridors visually distinct in the 2D map editor.
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
  let stairsDownKey: string | null = null
  for (const sk of stairsCandidates) {
    const sc = cells[sk]
    if (sc && !sc.overlays?.length) {
      cells[sk] = { ...sc, base: BASE.STAIRS_DOWN }
      stairsDownKey = sk
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

  // ── Sub-cube dressing: torches, clutter, webs, vermin ──────────────────────
  const addSubcube = (key: string, kind: string, pos: SubcubePos) => {
    const c = cells[key]
    if (!c) return
    const obj: SubcubeObject = { id: uid(), kind, pos }
    cells[key] = { ...c, subcubeObjects: [...(c.subcubeObjects ?? []), obj] }
  }
  const side = (): 0 | 2 => (rng() < 0.5 ? 0 : 2)

  for (const leaf of withRooms) {
    const room = leaf.room
    // wall lights along the top edge
    for (let rx = room.x; rx < room.x + room.w; rx++) {
      if (rng() < 0.15) addSubcube(`${rx},${room.y}`, rng() < 0.6 ? 'torch' : 'sconce', { x: side(), y: 1, z: 2 })
    }
    // corner clutter + cobwebs
    if (rng() < 0.35) addSubcube(`${room.x},${room.y}`, rng() < 0.5 ? 'barrel' : 'crate', { x: 0, y: 0, z: 2 })
    if (rng() < 0.25) addSubcube(`${room.x + room.w - 1},${room.y + room.h - 1}`, 'cobweb', { x: 2, y: 2, z: 2 })
    if (rng() < 0.15 && room.w >= 6 && room.h >= 6) {
      const c = center(room)
      addSubcube(`${c.x},${c.y}`, 'pillar', { x: 1, y: 0, z: 1 })
    }
  }
  for (const key of Object.keys(cells)) {
    if (roomCells.has(key)) continue
    const roll = rng()
    if (roll < 0.03)      addSubcube(key, 'cobweb', { x: side(), y: 2, z: 1 })
    else if (roll < 0.05) addSubcube(key, 'rat',    { x: 1, y: 0, z: 1 })
    else if (roll < 0.07) addSubcube(key, 'chains', { x: side(), y: 1, z: 1 })
  }
  // the boss den is dressed to read dangerous
  addSubcube(`${bossC.x - 1},${bossC.y}`, 'bones', { x: 1, y: 0, z: 1 })
  addSubcube(`${bossC.x},${bossC.y - 1}`, 'altar', { x: 1, y: 0, z: 2 })

  // ── Story wiring: sealed vault, twin levers, hermit, quest ─────────────────
  const npcs: NpcDef[] = []
  const quests: QuestDef[] = []
  const events: EventDef[] = []
  const OPP: Record<EdgeDir, EdgeDir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
  const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

  const puzzleRooms = sideRooms.length >= 3 ? sideRooms : []
  if (puzzleRooms.length >= 3) {
    const seedTag = config.seed >>> 0
    const qid = `q.vault_${seedTag}`
    const flagA = `${qid}.lever_a`
    const flagB = `${qid}.lever_b`

    // Vault: the side room farthest from the start
    let vaultLeaf = puzzleRooms[0]
    let vMax = -1
    for (const l of puzzleRooms) {
      const c = center(l.room)
      const d = dist2(c.x, c.y, startC.x, startC.y)
      if (d > vMax) { vMax = d; vaultLeaf = l }
    }
    const vault = vaultLeaf.room
    const vaultC = center(vault)

    // Seal every entrance (room-edge cell with corridor floor outside)
    let sealed = 0
    for (let ry = vault.y; ry < vault.y + vault.h; ry++) {
      for (let rx = vault.x; rx < vault.x + vault.w; rx++) {
        for (const dir of DIRS) {
          const [dx, dy] = DELTA[dir]
          const nx = rx + dx, ny = ry + dy
          if (inRect(vault, nx, ny) || !cells[`${nx},${ny}`]) continue
          boundaries[boundaryKey(rx, ry, dir)] = {
            wall: EDGE.DOOR,
            door: { state: 'locked', requiredFlags: [flagA, flagB] },
          }
          sealed++
        }
      }
    }

    // Twin levers mounted in two other rooms (on existing wall stripes)
    const hosts = puzzleRooms.filter(l => l !== vaultLeaf)
    const placeSwitch = (leaf: LeafWithRoom, flag: string): boolean => {
      const room = leaf.room
      const spots: { x: number; y: number; dir: EdgeDir }[] = []
      for (let ry = room.y; ry < room.y + room.h; ry++) {
        for (let rx = room.x; rx < room.x + room.w; rx++) {
          for (const dir of DIRS) {
            const [dx, dy] = DELTA[dir]
            if (!cells[`${rx + dx},${ry + dy}`]) spots.push({ x: rx, y: ry, dir })
          }
        }
      }
      if (spots.length === 0) return false
      const spot = pickRandom(rng, spots)
      const bk = boundaryKey(spot.x, spot.y, spot.dir)
      boundaries[bk] = {
        ...(boundaries[bk] ?? { wall: EDGE.WALL }),
        switch: { id: uid(), flag, mode: 'toggle', facing: OPP[spot.dir] },
      }
      return true
    }
    const okA = placeSwitch(hosts[0], flagA)
    const okB = placeSwitch(hosts[1 % hosts.length], flagB)

    if (sealed > 0 && okA && okB) {
      // Guaranteed hoard + claim event inside the vault
      const vk = `${vaultC.x},${vaultC.y}`
      const vc = cells[vk] ?? { base: BASE.FLOOR, overlays: [] }
      const hoard: CellEntity = {
        t: 'object',
        object: { kind: 'chest', id: uid(), ...(lootIds.length > 0 ? { loot: pickRandom(rng, lootIds) } : {}) },
      }
      const claim: CellEntity = {
        t: 'event',
        event: {
          id: `${qid}.claim`, name: 'Vault claimed', trigger: 'onEnter', once: true,
          conditions: [{ c: 'questStage', quest: qid, min: 2 }],
          effects: [{ t: 'questStage', quest: qid, stage: 3 }],
        },
      }
      cells[vk] = { ...vc, entities: [...(vc.entities ?? []), hoard, claim] }

      quests.push({
        id: qid, name: 'The Sealed Vault',
        description: 'Rumors of a hoard behind twin levers.',
        stages: [
          { id: 's1', description: 'An old hermit spoke of a vault sealed by twin levers, hidden in separate halls.' },
          { id: 's2', description: 'Stone released somewhere in the deep — find the vault and claim its hoard.' },
          { id: 's3', description: 'The vault yielded its hoard.' },
        ],
      })

      events.push({
        id: `${qid}.open`, name: 'Vault unsealed', trigger: 'onFlag', once: true,
        conditions: [
          { c: 'flag', flag: flagA, equals: true },
          { c: 'flag', flag: flagB, equals: true },
        ],
        effects: [
          { t: 'message', text: 'A deep rumble rolls through the halls — somewhere, stone releases.' },
          { t: 'questStage', quest: qid, stage: 2 },
        ],
      })

      // The hermit who starts it all, placed beside the party start
      const hermitId = `npc.hermit_${seedTag}`
      npcs.push({
        id: hermitId, name: 'Old Hermit', portrait: '🧙', sprite: 'cr_hermit',
        description: 'A stooped figure who has watched these halls too long.',
        level: 3, attributes: {},
        lines: [
          { id: 'hail', text: ['…another one comes.'], bark: true, once: true },
          {
            id: 'rumor',
            text: ['A vault lies sealed in these halls.', 'Twin levers, twin rooms. Throw them both, and the stone will yield.'],
            effects: [{ t: 'questStage', quest: qid, stage: 1 }],
          },
          {
            id: 'opened', priority: 5,
            text: ['You woke the vault. Claim what is owed — before something else does.'],
            conditions: [{ c: 'questStage', quest: qid, min: 2 }],
          },
          {
            id: 'done', priority: 9,
            text: ['Spend it well, wanderer.'],
            conditions: [{ c: 'questStage', quest: qid, min: 3 }],
          },
        ],
      })
      const hermitSpots = [
        `${startC.x + 1},${startC.y}`, `${startC.x - 1},${startC.y}`,
        `${startC.x},${startC.y + 1}`, `${startC.x},${startC.y - 1}`,
      ]
      for (const hk of hermitSpots) {
        const hc = cells[hk]
        if (hc && !hc.overlays?.length && !hc.entities?.length) {
          cells[hk] = { ...hc, entities: [{ t: 'object', object: { kind: 'npc', id: uid(), npc: hermitId } }] }
          break
        }
      }
    }
  }

  // A wandering flavour NPC in a random side room (when space allows)
  if (sideRooms.length > 0 && rng() < 0.6) {
    const seedTag = config.seed >>> 0
    const wandererId = `npc.wanderer_${seedTag}`
    npcs.push({
      id: wandererId, name: 'Wanderer', portrait: '🧝', sprite: 'cr_hooded',
      description: 'A traveller with no destination left.',
      level: 1, attributes: {},
      lines: [
        { id: 'hail', text: ['Keep your torch lit.'], bark: true, once: true },
        { id: 'talk', text: ['These halls change when levers turn.', 'I have heard doors sigh open three rooms away.'] },
      ],
    })
    const wl = pickRandom(rng, sideRooms)
    const wc = center(wl.room)
    const wk = `${wc.x},${wc.y - 1}`
    const wcell = cells[wk]
    if (wcell && !wcell.entities?.length) {
      cells[wk] = { ...wcell, entities: [{ t: 'object', object: { kind: 'npc', id: uid(), npc: wandererId } }] }
    }
  }

  // ── Showcase: the Depths — a dark second level wiring every engine system ───
  // Dark map + torches, trick tiles, inscriptions, inn, safe room + save point,
  // visible fixed encounter, FOE patrol, cursed/unidentified loot, teachSpell
  // scroll, identify/removeCurse censer, a three-stage quest, and a gameEnd.
  const items: ItemDef[] = []
  const extraMaps: MapData[] = []
  const mainMapId = uid()
  {
    const seedTag = config.seed >>> 0
    const dRng = makePrng(config.seed + 7)
    const dDim = layoutDim(style, 'small')
    const depthsId = uid()

    // Carve the Depths in the same layout style as the main level
    const dCarved = carveLayout(style, dDim, dRng)
    const dCells = dCarved.cells
    const dBounds = dCarved.boundaries
    const dRoomCells = dCarved.roomCells
    const dRooms: LeafWithRoom[] = dCarved.rooms.map(r => ({ rect: r, depth: 0, room: r }))
    for (const key of Object.keys(dCells)) {
      const [x, y] = key.split(',').map(Number)
      for (const dir of DIRS) {
        const [dx, dy] = DELTA[dir]
        if (!dCells[`${x + dx},${y + dy}`]) {
          const bk = boundaryKey(x, y, dir)
          if (!dBounds[bk]) dBounds[bk] = { wall: EDGE.WALL }
        }
      }
    }
    const dAddEnt = (key: string, ent: CellEntity) => {
      const c = dCells[key] ?? { base: BASE.FLOOR, overlays: [] }
      dCells[key] = { ...c, entities: [...(c.entities ?? []), ent] }
    }
    const dAddSub = (key: string, kind: string, pos: SubcubePos) => {
      const c = dCells[key]
      if (!c) return
      dCells[key] = { ...c, subcubeObjects: [...(c.subcubeObjects ?? []), { id: uid(), kind, pos }] }
    }

    // Anchor rooms: arrival (closest to centre), sanctum (farthest from arrival)
    const dMid = dDim / 2
    let dStartLeaf = dRooms[0]
    let dMin = Infinity
    for (const l of dRooms) {
      const c = center(l.room); const d = dist2(c.x, c.y, dMid, dMid)
      if (d < dMin) { dMin = d; dStartLeaf = l }
    }
    const dStart = center(dStartLeaf.room)
    let dBossLeaf = dRooms.find(l => l !== dStartLeaf) ?? dRooms[0]
    let dMax = 0
    for (const l of dRooms) {
      if (l === dStartLeaf) continue
      const c = center(l.room); const d = dist2(c.x, c.y, dStart.x, dStart.y)
      if (d > dMax) { dMax = d; dBossLeaf = l }
    }
    const dBoss = center(dBossLeaf.room)
    const dSide = dRooms.filter(l => l !== dStartLeaf && l !== dBossLeaf)

    // Zone encounters in the dark corridors (denser than upstairs)
    if (encTableIds.length > 0) {
      for (const key of Object.keys(dCells)) {
        if (dRoomCells.has(key)) continue
        if (dRng() > 0.25) continue
        dAddEnt(key, { t: 'encounter', table: pickRandom(dRng, encTableIds), mode: 'zone', rate: 0.15 })
      }
    }

    // ── The quest that threads the whole descent ──
    const dqid = `q.depths_${seedTag}`
    quests.push({
      id: dqid, name: 'The Heart of the Depths', icon: '🖤',
      description: 'Something old beats beneath the dungeon floor.',
      stages: [
        { id: 's1', description: 'A dark stair descends below the boss den. The Depths devour unlit travellers — carry fire.' },
        { id: 's2', description: 'The Depths are real, and something patrols them. Find the sanctum where magic dies.' },
        { id: 's3', description: 'The Heart of the Depths is claimed. Its story is over — and so is this one.' },
      ],
    })

    // ── Stairs Down (main) ⇄ Stairs Up (Depths), plus a warning inscription ──
    if (stairsDownKey) {
      const [sx, sy] = stairsDownKey.split(',').map(Number)
      const sc = cells[stairsDownKey]
      if (sc) cells[stairsDownKey] = { ...sc, entities: [...(sc.entities ?? []), { t: 'mapLink', mapId: depthsId, x: dStart.x, y: dStart.y }] }
      const stairSpots: { x: number; y: number; dir: EdgeDir }[] = []
      for (const dir of DIRS) {
        const [dx, dy] = DELTA[dir]
        if (!cells[`${sx + dx},${sy + dy}`]) stairSpots.push({ x: sx, y: sy, dir })
      }
      if (stairSpots.length === 0) {
        // Interior stairs cell — carve the warning into the boss room's edge instead
        edge: for (let ry = bossLeaf.room.y; ry < bossLeaf.room.y + bossLeaf.room.h; ry++) {
          for (let rx = bossLeaf.room.x; rx < bossLeaf.room.x + bossLeaf.room.w; rx++) {
            for (const dir of DIRS) {
              const [dx, dy] = DELTA[dir]
              if (!cells[`${rx + dx},${ry + dy}`]) { stairSpots.push({ x: rx, y: ry, dir }); break edge }
            }
          }
        }
      }
      if (stairSpots.length > 0) {
        const spot = stairSpots[0]
        const bk = boundaryKey(spot.x, spot.y, spot.dir)
        boundaries[bk] = {
          ...(boundaries[bk] ?? { wall: EDGE.WALL }),
          inscription: { text: ['Below, the dark eats light.', 'Carry fire, or be carried.'], facing: OPP[spot.dir] },
        }
      }
    }
    const dStartKey = `${dStart.x},${dStart.y}`
    const dsc = dCells[dStartKey] ?? { base: BASE.FLOOR, overlays: [] }
    dCells[dStartKey] = { ...dsc, base: BASE.STAIRS_UP }
    if (stairsDownKey) {
      const [sx, sy] = stairsDownKey.split(',').map(Number)
      dAddEnt(dStartKey, { t: 'mapLink', mapId: mainMapId, x: sx, y: sy })
    }
    // Descending advances the quest
    dAddEnt(dStartKey, {
      t: 'event',
      event: { id: `${dqid}.descend`, name: 'Into the Depths', trigger: 'onEnter', once: true,
        effects: [{ t: 'questStage', quest: dqid, stage: 2 }, { t: 'message', text: 'The air is wet stone and old hunger. Light matters here.' }] },
    })

    // ── Torchbearer NPC guards the stairs and hands out fire ──
    const torchbearerId = `npc.torchbearer_${seedTag}`
    npcs.push({
      id: torchbearerId, name: 'Torchbearer', portrait: '🕯️', sprite: 'cr_guard',
      description: 'Keeps the last lit brazier above the Depths.',
      level: 4, attributes: {},
      lines: [
        { id: 'hail', text: ['Take light. The dark below is hungry.'], bark: true, once: true },
        {
          id: 'gift', once: true,
          text: ['Here — my last torches. Do not waste them.', 'And mark the floor. Some stones are lies.'],
          effects: [
            { t: 'giveItem', item: 'item.torch', qty: 2 },
            { t: 'giveItem', item: 'item.lantern', qty: 1 },
            { t: 'questStage', quest: dqid, stage: 1 },
          ],
        },
        { id: 'talk', priority: -1, text: ['The pit takes the careless faster than the stairs take the brave.'] },
      ],
    })
    if (stairsDownKey) {
      const [sx, sy] = stairsDownKey.split(',').map(Number)
      for (const [nx, ny] of [[sx + 1, sy], [sx, sy + 1], [sx - 1, sy], [sx, sy - 1]] as const) {
        const nk = `${nx},${ny}`
        const nc = cells[nk]
        if (nc && !nc.entities?.length && !nc.overlays?.length && (nc.base ?? 0) === BASE.FLOOR) {
          cells[nk] = { ...nc, entities: [{ t: 'object', object: { kind: 'npc', id: uid(), npc: torchbearerId } }] }
          break
        }
      }
    }

    // ── An inn near the start ("The Weary Lantern") ──
    if (sideRooms.length > 0) {
      let innLeaf = sideRooms[0]
      let iMin = Infinity
      for (const l of sideRooms) {
        const c = center(l.room); const d = dist2(c.x, c.y, startC.x, startC.y)
        if (d < iMin) { iMin = d; innLeaf = l }
      }
      const ic = center(innLeaf.room)
      const ik = `${ic.x + (innLeaf.room.w > 2 ? 1 : 0)},${ic.y}`
      const icell = cells[ik]
      if (icell && !icell.entities?.length) {
        cells[ik] = { ...icell, entities: [{ t: 'object', object: { kind: 'inn', id: uid(), price: 20 } }] }
        addSubcube(ik, 'banner', { x: side(), y: 1, z: 2 })
      }
    }

    // ── A hidden pit on the main map drops into the Depths ──
    const corridorKeys = Object.keys(cells).filter(k => {
      if (roomCells.has(k)) return false
      const c = cells[k]
      if (c.entities?.length || c.overlays?.length || (c.base ?? 0) !== BASE.FLOOR) return false
      const [x, y] = k.split(',').map(Number)
      return dist2(x, y, startC.x, startC.y) > 36
    })
    if (corridorKeys.length > 0) {
      const pk = corridorKeys[Math.floor(rng() * corridorKeys.length)]
      const pc = cells[pk]
      cells[pk] = { ...pc, entities: [...(pc.entities ?? []), { t: 'trick', kind: 'pit', damage: '1d6', mapId: depthsId, x: dStart.x, y: dStart.y }] }
      const [px2, py2] = pk.split(',').map(Number)
      for (const dir of DIRS) {
        const [dx, dy] = DELTA[dir]
        if (!cells[`${px2 + dx},${py2 + dy}`]) {
          const bk = boundaryKey(px2, py2, dir)
          boundaries[bk] = {
            ...(boundaries[bk] ?? { wall: EDGE.WALL }),
            inscription: { text: ['Watch thy step.'] },
          }
          break
        }
      }
    }

    // ── Depths tricks: safe room, spinner, darkness zone, silent teleport ──
    if (dSide.length > 0) {
      let safeLeaf = dSide[0]
      let sMin = Infinity
      for (const l of dSide) {
        const c = center(l.room); const d = dist2(c.x, c.y, dStart.x, dStart.y)
        if (d < sMin) { sMin = d; safeLeaf = l }
      }
      const scr = center(safeLeaf.room)
      const sk2 = `${scr.x},${scr.y}`
      dAddEnt(sk2, { t: 'trick', kind: 'safeRoom' })
      const scc = dCells[sk2]
      if (scc) dCells[sk2] = { ...scc, overlays: [OVERLAY.SAVE_POINT] }
      dAddSub(sk2, 'torch', { x: 0, y: 1, z: 2 })
      dAddSub(sk2, 'torch', { x: 2, y: 1, z: 2 })
      dAddSub(`${scr.x},${scr.y + 1}`, 'bones', { x: 1, y: 0, z: 1 })
    }
    const dCorridors = Object.keys(dCells).filter(k => !dRoomCells.has(k) && !dCells[k].entities?.length)
    if (dCorridors.length >= 3) {
      const spinK = dCorridors[Math.floor(dRng() * dCorridors.length)]
      dAddEnt(spinK, { t: 'trick', kind: 'spinner', rotate: 'random' })
      const darkK = dCorridors[Math.floor(dRng() * dCorridors.length)]
      if (darkK !== spinK) dAddEnt(darkK, { t: 'trick', kind: 'darkness' })
      const tpK = dCorridors[Math.floor(dRng() * dCorridors.length)]
      if (tpK !== spinK && tpK !== darkK) {
        dAddEnt(tpK, { t: 'trick', kind: 'silentTeleport', x: dStart.x, y: dStart.y })
      }
    }

    // ── FOE patrol pacing the widest Depths room ──
    const foeRoom = [...dRooms].sort((a, b) => b.room.w - a.room.w)[0]
    if (foeRoom && foeRoom.room.w >= 5) {
      const r = foeRoom.room
      const rowY = center(r).y
      const path = Array.from({ length: r.w - 2 }, (_, i) => ({ x: r.x + 1 + i, y: rowY })).slice(1)
      const foeDef = [...ruleset.enemies].sort((a, b) => b.hp - a.hp)[0]
      if (foeDef && path.length >= 1) {
        dAddEnt(`${r.x + 1},${rowY}`, { t: 'foe', enemy: foeDef.id, count: 1, mode: 'pingpong', path })
      }
    }

    // ── Sanctum: anti-magic, inscription, visible guardians, the Heart ──
    const dBossKey = `${dBoss.x},${dBoss.y}`
    dAddEnt(dBossKey, { t: 'trick', kind: 'antiMagic' })
    // Carve the warning into the first wall face found along the sanctum's edge
    sanctum: for (let ry = dBossLeaf.room.y; ry < dBossLeaf.room.y + dBossLeaf.room.h; ry++) {
      for (let rx = dBossLeaf.room.x; rx < dBossLeaf.room.x + dBossLeaf.room.w; rx++) {
        for (const dir of DIRS) {
          const [dx, dy] = DELTA[dir]
          if (!dCells[`${rx + dx},${ry + dy}`]) {
            const bk = boundaryKey(rx, ry, dir)
            dBounds[bk] = {
              ...(dBounds[bk] ?? { wall: EDGE.WALL }),
              inscription: { text: ['Here, magic dies.', 'Only steel and breath remain.'], facing: OPP[dir] },
            }
            break sanctum
          }
        }
      }
    }
    if (encTableIds.length > 0) {
      const guardK = `${dBoss.x},${dBoss.y - 1}`
      if (dCells[guardK]) dAddEnt(guardK, { t: 'encounter', table: pickRandom(dRng, encTableIds), mode: 'fixed', oncePerVisit: true })
    }
    dAddSub(dBossKey, 'altar', { x: 1, y: 0, z: 2 })
    dAddSub(`${dBoss.x - 1},${dBoss.y}`, 'chains', { x: 0, y: 1, z: 1 })

    // Generated relics referenced by the Heart cache
    const bladeId = `item.gen.blade_${seedTag}`
    const scrollId = `item.gen.scroll_${seedTag}`
    const censerId = `item.gen.censer_${seedTag}`
    const taughtSpell = ruleset.spells.find(s => s.inCombat) ?? ruleset.spells[0]
    items.push(
      {
        id: bladeId, name: 'Heartsbane Blade', icon: '🗡️', color: '#7c3aed',
        description: 'A blade that drinks. It does not let go.', kind: 'weapon',
        slot: 'weapon', weaponType: 'wtype.sword', value: 400, stackable: false,
        unidentifiedName: '?Blade', cursed: true,
        modifiers: [{ target: 'derived', key: 'attack', op: 'add', amount: 8 }],
      },
      {
        id: scrollId, name: taughtSpell ? `Scroll of ${taughtSpell.name}` : 'Faded Scroll', icon: '📜', color: '#eab308',
        description: 'Knowledge pressed into vellum. Read once, kept forever.', kind: 'consumable',
        value: 250, stackable: true, unidentifiedName: '?Scroll',
        onUse: taughtSpell ? [{ t: 'teachSpell', spell: taughtSpell.id }] : [],
      },
      {
        id: censerId, name: 'Censer of Clarity', icon: '🕯️', color: '#f5f6fa',
        description: 'Smoke that names all things and loosens every grip.', kind: 'consumable',
        value: 300, stackable: true,
        onUse: [{ t: 'identify' }, { t: 'removeCurse' }],
      },
    )

    // The Heart: interact on the altar cell to claim everything and roll credits
    const heartK = `${dBoss.x + 1},${dBoss.y}`
    const heartCell = dCells[heartK] ? heartK : dBossKey
    dAddEnt(heartCell, {
      t: 'event',
      event: {
        id: `${dqid}.heart`, name: 'Claim the Heart', trigger: 'onInteract', once: true,
        conditions: [{ c: 'questStage', quest: dqid, min: 2 }],
        effects: [
          { t: 'message', text: 'The Heart of the Depths comes free with a sound like a held breath released.' },
          { t: 'giveItem', item: bladeId, qty: 1 },
          { t: 'giveItem', item: scrollId, qty: 1 },
          { t: 'giveItem', item: censerId, qty: 1 },
          { t: 'gold', amount: 500 },
          { t: 'questStage', quest: dqid, stage: 3 },
          { t: 'gameEnd', text: 'The Heart is claimed and the Depths fall quiet.\n\nThe halls above will fill with new wanderers, new levers, new lies carved in stone.\n\nBut that is another dungeon.' },
        ],
      },
    })
    dAddEnt(heartCell, { t: 'object', object: { kind: 'chest', id: uid(), ...(lootIds.length > 0 ? { loot: pickRandom(dRng, lootIds) } : {}) } })

    extraMaps.push({
      id: depthsId, name: `${name} — Depths`,
      cells: dCells, boundaries: dBounds,
      playerX: dStart.x, playerY: dStart.y,
      revealedChunks: allChunkKeys(dDim),
      seed: config.seed + 7,
      dark: true,
    })
  }

  return {
    map: {
      id: mainMapId, name, cells, boundaries,
      playerX: startC.x, playerY: startC.y,
      revealedChunks: allChunkKeys(dim),
      seed: config.seed,
    },
    extraMaps,
    npcs,
    quests,
    events,
    items,
  }
}

