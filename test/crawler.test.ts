/**
 * Tests for the first-person crawler logic (facing math + grid collision).
 * Run with:  bun test/crawler.test.ts
 */

import assert from 'node:assert/strict'
import { turnLeft, turnRight, vectorToFacing, canPass, isWalkableBase } from '../src/lib/crawler'
import { BASE, OVERLAY, EDGE } from '../src/lib/constants'
import type { CellData, CellMap, MarkerDef } from '../src/lib/types'

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

const cell = (base: number, edges: CellData['edges'] = {}): CellData => ({ base, overlays: [], edges })
const floor = () => cell(BASE.FLOOR)

console.log('crawler logic')

test('turnLeft / turnRight cycle through N W S E', () => {
  assert.equal(turnLeft('N'), 'W')
  assert.equal(turnLeft('W'), 'S')
  assert.equal(turnRight('N'), 'E')
  assert.equal(turnRight('E'), 'S')
  assert.equal(turnLeft(turnRight('N')), 'N')
})

test('vectorToFacing maps unit moves', () => {
  assert.equal(vectorToFacing(0, -1), 'N')
  assert.equal(vectorToFacing(0, 1), 'S')
  assert.equal(vectorToFacing(1, 0), 'E')
  assert.equal(vectorToFacing(-1, 0), 'W')
  assert.equal(vectorToFacing(1, 1), null)
})

test('isWalkableBase: floor/door/stairs walkable; empty/wall/water/lava/void not', () => {
  assert.ok(isWalkableBase(BASE.FLOOR))
  assert.ok(isWalkableBase(BASE.DOOR))
  assert.ok(isWalkableBase(BASE.STAIRS_UP))
  assert.ok(!isWalkableBase(BASE.EMPTY))
  assert.ok(!isWalkableBase(BASE.WALL))
  assert.ok(!isWalkableBase(BASE.WATER))
  assert.ok(!isWalkableBase(BASE.LAVA))
  assert.ok(!isWalkableBase(BASE.VOID))
})

test('custom base markers are walkable', () => {
  const custom: Record<number, MarkerDef> = { 130: { id: 130, label: 'Bridge', color: '#fff' } }
  assert.ok(isWalkableBase(130, custom))
  assert.ok(!isWalkableBase(130)) // unknown custom id without table
})

test('can step onto a floor neighbor', () => {
  const cells: CellMap = { '0,0': floor(), '0,-1': floor() }
  assert.ok(canPass(cells, 0, 0, 'N'))
})

test('blocked stepping onto an empty (floorless) cell', () => {
  const cells: CellMap = { '0,0': floor() } // '0,-1' missing => base 0
  assert.ok(!canPass(cells, 0, 0, 'N'))
})

test('blocked stepping onto a Wall base', () => {
  const cells: CellMap = { '0,0': floor(), '0,-1': cell(BASE.WALL) }
  assert.ok(!canPass(cells, 0, 0, 'N'))
})

test('wall edge on the near cell blocks', () => {
  const cells: CellMap = { '0,0': cell(BASE.FLOOR, { N: EDGE.WALL }), '0,-1': floor() }
  assert.ok(!canPass(cells, 0, 0, 'N'))
})

test('wall edge on the neighbor (shared border) blocks', () => {
  const cells: CellMap = { '0,0': floor(), '0,-1': cell(BASE.FLOOR, { S: EDGE.WALL }) }
  assert.ok(!canPass(cells, 0, 0, 'N'))
})

test('locked-door edge blocks', () => {
  const cells: CellMap = { '0,0': cell(BASE.FLOOR, { E: EDGE.LOCKED_DOOR }), '1,0': floor() }
  assert.ok(!canPass(cells, 0, 0, 'E'))
})

test('passable edges (one-way, illusory, secret) do not block', () => {
  for (const et of [EDGE.ONE_WAY, EDGE.ILLUSORY, EDGE.SECRET, EDGE.DAMAGE]) {
    const cells: CellMap = { '0,0': cell(BASE.FLOOR, { E: et }), '1,0': floor() }
    assert.ok(canPass(cells, 0, 0, 'E'), `edge ${et} should be passable`)
  }
})

test('overlays on the target do not affect passability', () => {
  const target: CellData = { base: BASE.FLOOR, overlays: [OVERLAY.BOSS], edges: {} }
  const cells: CellMap = { '0,0': floor(), '0,-1': target }
  assert.ok(canPass(cells, 0, 0, 'N'))
})

console.log(`\n${passed} passed`)
