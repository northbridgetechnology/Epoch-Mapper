/**
 * Custom-marker helpers — ID conflict resolution on import (EPOCH_MAPPER_SPEC §5.3).
 *
 * These are pure and DOM-free so they can run in the editor, in Node, and in
 * Epoch's server-side `.epochmap` import route (Phase 3).
 */

import type { CellMap, CustomMarker, MapData } from './types'
import { CUSTOM_ID_MIN } from './constants'

/** Two markers are "the same definition" if every field except the id matches. */
export function sameMarker(a: CustomMarker, b: CustomMarker): boolean {
  return a.kind === b.kind && a.label === b.label && a.icon === b.icon && a.color === b.color
}

/** The next free custom ID (≥128) not present in `used`. */
export function nextFreeMarkerId(used: Iterable<number>, from = CUSTOM_ID_MIN): number {
  const set = new Set(used)
  let id = Math.max(from, CUSTOM_ID_MIN)
  while (set.has(id)) id++
  return id
}

/**
 * Merge imported markers into an existing session.
 *
 * - An ID with no existing marker keeps its value (the imported table wins).
 * - An ID that collides with an *identical* definition is reused (no remap).
 * - An ID that collides with a *different* definition is reassigned to the next
 *   free ID via `allocId`, recorded in the returned `remap` (oldId → newId).
 *
 * `allocId` lets the caller keep IDs monotonic within a session; if omitted, the
 * next free ID not already in use is chosen.
 */
export function resolveMarkerImport(
  existing: CustomMarker[],
  incoming: CustomMarker[],
  allocId?: () => number,
): { merged: CustomMarker[]; remap: Map<number, number> } {
  const byId = new Map(existing.map((m) => [m.id, m]))
  const merged = [...existing]
  const remap = new Map<number, number>()

  const alloc = allocId ?? (() => nextFreeMarkerId(byId.keys()))

  for (const m of incoming) {
    const cur = byId.get(m.id)
    if (!cur) {
      byId.set(m.id, m)
      merged.push(m)
    } else if (sameMarker(cur, m)) {
      // identical definition already present — reuse, no remap
    } else {
      const newId = alloc()
      const renamed = { ...m, id: newId }
      byId.set(newId, renamed)
      merged.push(renamed)
      remap.set(m.id, newId)
    }
  }
  return { merged, remap }
}

/** Apply a marker-ID remap to a single map's cells (base + overlays). */
export function remapMapMarkers(map: MapData, remap: Map<number, number>): MapData {
  if (remap.size === 0) return map
  const cells: CellMap = {}
  for (const [key, cell] of Object.entries(map.cells)) {
    const base = remap.get(cell.base) ?? cell.base
    const overlays = cell.overlays.map((o) => remap.get(o) ?? o)
    cells[key] = { ...cell, base, overlays }
  }
  return { ...map, cells }
}
