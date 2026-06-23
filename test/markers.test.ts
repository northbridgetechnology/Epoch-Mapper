/**
 * Tests for custom-marker import conflict resolution (EPOCH_MAPPER_SPEC §5.3).
 * Run with:  bun test/markers.test.ts
 */

import assert from 'node:assert/strict'
import { resolveMarkerImport, remapMapMarkers, nextFreeMarkerId, sameMarker } from '../src/lib/markers'
import type { CustomMarker, MapData } from '../src/lib/types'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

const dragon = (id: number): CustomMarker => ({ id, kind: 'base', label: 'Dragon Lair', icon: '🐉', color: '#ff8800' })
const guild = (id: number): CustomMarker => ({ id, kind: 'overlay', label: 'Merchant Guild', icon: 'M', color: '#00aaff' })

console.log('marker import resolution (§5.3)')

test('free ID keeps its value (imported table wins)', () => {
  const { merged, remap } = resolveMarkerImport([], [dragon(135)])
  assert.equal(remap.size, 0)
  assert.deepEqual(merged, [dragon(135)])
})

test('identical definition at same ID is reused (no remap)', () => {
  const existing = [dragon(135)]
  const { merged, remap } = resolveMarkerImport(existing, [dragon(135)])
  assert.equal(remap.size, 0)
  assert.equal(merged.length, 1)
})

test('conflicting definition at same ID is reassigned to next free ID', () => {
  const existing = [dragon(135)] // 135 = Dragon Lair (base)
  const incoming = [guild(135)] // 135 = Merchant Guild (overlay) — different def
  const { merged, remap } = resolveMarkerImport(existing, incoming)
  // default allocator picks the smallest free ID ≥128 (128, since only 135 is used)
  assert.equal(remap.get(135), 128)
  assert.equal(merged.length, 2)
  assert.ok(merged.some((m) => m.id === 128 && m.label === 'Merchant Guild'))
  assert.ok(merged.some((m) => m.id === 135 && m.label === 'Dragon Lair'))
})

test('remap rewrites base and overlay IDs in imported maps', () => {
  const remap = new Map([[135, 136]])
  const map: MapData = {
    id: 'm',
    name: 'm',
    playerX: 0,
    playerY: 0,
    cells: {
      '0,0': { base: 135, overlays: [135, 10], edges: {} },
      '1,0': { base: 2, overlays: [], edges: {} },
    },
  }
  const out = remapMapMarkers(map, remap)
  assert.equal(out.cells['0,0'].base, 136)
  assert.deepEqual(out.cells['0,0'].overlays, [136, 10])
  assert.equal(out.cells['1,0'].base, 2) // untouched
})

test('allocId keeps IDs monotonic across multiple conflicts', () => {
  let next = 140
  const alloc = () => next++
  const existing = [dragon(135), guild(136)]
  const incoming = [guild(135), dragon(136)] // both collide with different defs
  const { remap } = resolveMarkerImport(existing, incoming, alloc)
  assert.equal(remap.get(135), 140)
  assert.equal(remap.get(136), 141)
})

test('nextFreeMarkerId skips used IDs and respects the 128 floor', () => {
  assert.equal(nextFreeMarkerId([]), 128)
  assert.equal(nextFreeMarkerId([128, 129, 131]), 130)
  assert.equal(nextFreeMarkerId([128], 200), 200)
})

test('sameMarker compares every field except id', () => {
  assert.ok(sameMarker(dragon(1), dragon(2)))
  assert.ok(!sameMarker(dragon(1), { ...dragon(1), color: '#000000' }))
})

console.log(`\n${passed} passed`)
