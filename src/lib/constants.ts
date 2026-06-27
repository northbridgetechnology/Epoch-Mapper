/**
 * Epoch Mapper — built-in type tables and grid constants.
 *
 * The ID values here are normative: they are the on-disk IDs written into the
 * `.epochmap` binary format (EPOCH_MAPPER_SPEC.md §4.3). Do not renumber.
 */

import type { EdgeDir, MarkerDef } from './types'

// ── Grid / viewport ───────────────────────────────────────────────────────────

export const VIEWPORT_CELLS = 12 // fixed 12×12 visible window
export const DEFAULT_CELL = 27 // baseline cell size (px)
export const VIEWPORT_PX = VIEWPORT_CELLS * (DEFAULT_CELL + 1) - 1
export const CHUNK_SIZE = 3 // fog reveals in 3×3 chunks
export const MIN_CELL = 14
export const MAX_CELL = 60

export const CUSTOM_ID_MIN = 128
export const CUSTOM_ID_MAX = 255

export const MAX_NOTE_LEN = 500
export const MAX_MARKER_LABEL_LEN = 32

// ── Base type IDs (0–127 built-in) ─────────────────────────────────────────────

export const BASE = {
  EMPTY: 0,
  FLOOR: 1,
  WALL: 2,
  DOOR: 3,
  STAIRS_UP: 4,
  STAIRS_DOWN: 5,
  WATER: 6,
  LAVA: 7,
  VOID: 8,
} as const

/** Built-in base types, keyed by ID. */
export const BASE_TYPES: Record<number, MarkerDef> = {
  0: { id: 0, label: 'Empty', color: '#18181b' },
  1: { id: 1, label: 'Floor', color: '#3f3f46' },
  2: { id: 2, label: 'Invisible Wall', color: '#52525b' },
  3: { id: 3, label: 'Door', color: '#b45309', icon: '🚪' },
  4: { id: 4, label: 'Stairs Up', color: '#0369a1', icon: '▲' },
  5: { id: 5, label: 'Stairs Down', color: '#4338ca', icon: '▼' },
  6: { id: 6, label: 'Water', color: '#0e7490', icon: '≋' },
  7: { id: 7, label: 'Lava', color: '#b91c1c', icon: '♨' },
  8: { id: 8, label: 'Void', color: '#09090b' },
}

/** Base types offered in the terrain palette (Empty is implicit / erase). */
export const BASE_PALETTE: number[] = [1, 2, 3, 4, 5, 6, 7, 8]

// ── Overlay type IDs (0–127 built-in, 0 = none) ────────────────────────────────

export const OVERLAY = {
  NONE: 0,
  NPC: 1,
  SHOP_GENERAL: 2,
  SHOP_WEAPON: 3,
  SHOP_ARMOR: 4,
  SHOP_MAGIC: 5,
  SHOP_ITEM: 6,
  INN: 7,
  BOSS: 8,
  MINI_BOSS: 9,
  CHEST: 10,
  TRAP: 11,
  SAVE_POINT: 12,
  WARP: 13,
  EVENT: 14,
  PLAYER_START: 15,
} as const

/** Built-in overlay types, keyed by ID. */
export const OVERLAY_TYPES: Record<number, MarkerDef> = {
  1: { id: 1, label: 'NPC', color: '#facc15', icon: '☻' },
  2: { id: 2, label: 'Shop — General', color: '#10b981', icon: '$' },
  3: { id: 3, label: 'Shop — Weapon', color: '#f87171', icon: '⚔' },
  4: { id: 4, label: 'Shop — Armor', color: '#60a5fa', icon: '🛡' },
  5: { id: 5, label: 'Shop — Magic', color: '#c084fc', icon: '✦' },
  6: { id: 6, label: 'Shop — Item', color: '#34d399', icon: '🧪' },
  7: { id: 7, label: 'Inn', color: '#fbbf24', icon: '🛏' },
  8: { id: 8, label: 'Boss', color: '#ef4444', icon: '☠' },
  9: { id: 9, label: 'Mini-Boss', color: '#fb923c', icon: '✸' },
  10: { id: 10, label: 'Chest', color: '#fcd34d', icon: '🎁' },
  11: { id: 11, label: 'Trap', color: '#f43f5e', icon: '✕' },
  12: { id: 12, label: 'Save Point', color: '#a78bfa', icon: '✚' },
  13: { id: 13, label: 'Warp / Teleport', color: '#22d3ee', icon: '✺' },
  14: { id: 14, label: 'Event', color: '#e879f9', icon: '!' },
  15: { id: 15, label: 'Player Start', color: '#fde047', icon: '⚑' },
}

/** Overlay types offered in the overlay palette. */
export const OVERLAY_PALETTE: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

// ── Edge type IDs (0–15) ───────────────────────────────────────────────────────

export const EDGE = {
  WALL: 0,
  LOCKED_DOOR: 1,
  ONE_WAY: 2,
  ILLUSORY: 3,
  DAMAGE: 4,
  SECRET: 5,
  DOOR: 6,
} as const

/** Built-in edge types, keyed by ID. */
export const EDGE_TYPES: Record<number, MarkerDef> = {
  0: { id: 0, label: 'Standard wall', color: 'rgba(228,228,231,0.95)' },
  1: { id: 1, label: 'Locked door', color: '#ef4444' },
  2: { id: 2, label: 'One-way', color: '#f59e0b' },
  3: { id: 3, label: 'Illusory wall', color: '#a3a3a3' },
  4: { id: 4, label: 'Damage', color: '#dc2626' },
  5: { id: 5, label: 'Secret passage', color: '#22c55e' },
  6: { id: 6, label: 'Door', color: '#b45309', icon: '🚪' },
}

/** Edge types offered in the edges palette. */
export const EDGE_PALETTE: number[] = [0, 6, 2, 3, 4, 5]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** Resolve a base ID to a definition, consulting custom markers for 128+. */
export function baseDef(id: number, custom?: Record<number, MarkerDef>): MarkerDef {
  return BASE_TYPES[id] ?? custom?.[id] ?? BASE_TYPES[0]
}

/** Resolve an overlay ID to a definition, consulting custom markers for 128+. */
export function overlayDef(id: number, custom?: Record<number, MarkerDef>): MarkerDef | undefined {
  return OVERLAY_TYPES[id] ?? custom?.[id]
}

/** Resolve an edge ID to a definition. */
export function edgeDef(id: number): MarkerDef {
  return EDGE_TYPES[id] ?? EDGE_TYPES[0]
}

export function isCustomId(id: number): boolean {
  return id >= CUSTOM_ID_MIN && id <= CUSTOM_ID_MAX
}

/**
 * Returns the canonical storage key for the boundary between cell (x,y) and its
 * neighbour in direction `dir`. Only S and E faces are stored; N and W are
 * redirected to the south/east face of the adjacent cell.
 */
export function boundaryKey(x: number, y: number, dir: EdgeDir): string {
  switch (dir) {
    case 'N': return `${x},${y - 1}:S`
    case 'S': return `${x},${y}:S`
    case 'E': return `${x},${y}:E`
    case 'W': return `${x - 1},${y}:E`
  }
}
