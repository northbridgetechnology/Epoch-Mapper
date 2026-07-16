/**
 * Tests for world-grid edge crossing (src/lib/world.ts). Pure, no DOM.
 * Run with:  tsx test/world.test.ts
 */

import assert from 'node:assert/strict'
import { mapBounds, resolveEdgeCrossing, oppositeEdge } from '../src/lib/world'
import type { MapData } from '../src/lib/types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

/** A dim×dim map of floor cells, optional edgeLinks. */
function grid(id: string, dim: number, edgeLinks?: MapData['edgeLinks']): MapData {
  const cells: MapData['cells'] = {}
  for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) cells[`${x},${y}`] = { base: 1, overlays: [] }
  return { id, name: id, cells, playerX: 0, playerY: 0, ...(edgeLinks ? { edgeLinks } : {}) }
}

test('mapBounds reads the populated bounding box; empty maps report 0,0', () => {
  assert.deepEqual(mapBounds(grid('a', 8)), { minX: 0, minY: 0, maxX: 7, maxY: 7 })
  assert.deepEqual(mapBounds({ id: 'e', name: 'e', cells: {}, playerX: 0, playerY: 0 }), { minX: 0, minY: 0, maxX: 0, maxY: 0 })
})

test('east crossing lands on the neighbour west edge, y preserved', () => {
  const a = grid('a', 8, { E: { mapId: 'b' } })
  const b = grid('b', 8)
  // Standing at (7,3), stepping east → attempt (8,3), off the east edge.
  const cx = resolveEdgeCrossing(a, 8, 3, 'E', [a, b])
  assert.deepEqual(cx, { mapId: 'b', x: 0, y: 3, transition: 'seamless' })
})

test('all four directions wrap to the opposite edge', () => {
  const a = grid('a', 8, { W: { mapId: 'b' }, N: { mapId: 'b' }, S: { mapId: 'b' } })
  const b = grid('b', 8)
  assert.deepEqual(resolveEdgeCrossing(a, -1, 5, 'W', [a, b]), { mapId: 'b', x: 7, y: 5, transition: 'seamless' })
  assert.deepEqual(resolveEdgeCrossing(a, 2, -1, 'N', [a, b]), { mapId: 'b', x: 2, y: 7, transition: 'seamless' })
  assert.deepEqual(resolveEdgeCrossing(a, 2, 8, 'S', [a, b]), { mapId: 'b', x: 2, y: 0, transition: 'seamless' })
})

test('in-bounds steps and unlinked edges never cross', () => {
  const a = grid('a', 8, { E: { mapId: 'b' } })
  const b = grid('b', 8)
  assert.equal(resolveEdgeCrossing(a, 5, 3, 'E', [a, b]), null)   // 5 ≤ maxX 7 → in bounds
  assert.equal(resolveEdgeCrossing(a, -1, 3, 'W', [a, b]), null)  // no W link
})

test('missing target map yields no crossing (dangling link is inert)', () => {
  const a = grid('a', 8, { E: { mapId: 'gone' } })
  assert.equal(resolveEdgeCrossing(a, 8, 3, 'E', [a]), null)
})

test('cross-axis clamps to a smaller neighbour', () => {
  const a = grid('a', 8, { E: { mapId: 'b' } })
  const b = grid('b', 4)   // maxY 3
  assert.deepEqual(resolveEdgeCrossing(a, 8, 7, 'E', [a, b]), { mapId: 'b', x: 0, y: 3, transition: 'seamless' })
})

test('explicit transition style overrides the seamless default', () => {
  const a = grid('a', 8, { E: { mapId: 'b', transition: 'fade' } })
  const b = grid('b', 8)
  assert.equal(resolveEdgeCrossing(a, 8, 3, 'E', [a, b])?.transition, 'fade')
})

test('oppositeEdge pairs reciprocals', () => {
  assert.equal(oppositeEdge('E'), 'W')
  assert.equal(oppositeEdge('N'), 'S')
})

console.log(`\n${passed} world tests passed`)
