/**
 * Tests for buildGeneratedWorld — the "Randomly Generate and Populate" path.
 * Run with:  tsx test/generator.test.ts
 */

import assert from 'node:assert/strict'
import { buildGeneratedWorld, type NewMapConfig } from '../src/lib/map-generator'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'

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

const ruleset = makeDefaultRuleset()
const config: NewMapConfig = { name: 'Gen Test', size: 'medium', seed: 42, generate: true }
const world = buildGeneratedWorld('Gen Test', config, ruleset)

test('same seed generates the same world (cells, boundaries, story)', () => {
  const again = buildGeneratedWorld('Gen Test', config, ruleset)
  assert.deepEqual(Object.keys(again.map.cells).sort(), Object.keys(world.map.cells).sort())
  assert.equal(again.quests.length, world.quests.length)
  assert.equal(again.npcs.length, world.npcs.length)
})

test('sub-cube dressing is scattered through the dungeon', () => {
  const dressed = Object.values(world.map.cells).filter(c => c.subcubeObjects?.length)
  assert.ok(dressed.length > 5, `expected >5 dressed cells, got ${dressed.length}`)
})

test('vault puzzle: sealed doors requiring exactly the two lever flags', () => {
  const doors = Object.values(world.map.boundaries ?? {}).filter(b => b.door?.requiredFlags?.length)
  assert.ok(doors.length >= 1, 'no switch-sealed doors generated')
  const flags = doors[0].door!.requiredFlags!
  assert.equal(flags.length, 2)
  const switches = Object.values(world.map.boundaries ?? {}).filter(b => b.switch)
  assert.equal(switches.length, 2)
  assert.deepEqual(switches.map(b => b.switch!.flag).sort(), [...flags].sort())
})

test('story content: quest, unseal event, and a placed hermit with lines', () => {
  assert.equal(world.quests.length, 1)
  assert.equal(world.quests[0].stages.length, 3)
  assert.ok(world.events.some(e => e.trigger === 'onFlag'))
  const hermit = world.npcs.find(n => n.name === 'Old Hermit')
  assert.ok(hermit && hermit.lines.length >= 3)
  const placed = Object.values(world.map.cells).some(c =>
    c.entities?.some(e => e.t === 'object' && e.object.kind === 'npc' && e.object.npc === hermit!.id))
  assert.ok(placed, 'hermit defined but not placed on the map')
})

test('switches face into the room they are mounted on', () => {
  for (const b of Object.values(world.map.boundaries ?? {})) {
    if (b.switch) assert.ok(['N', 'S', 'E', 'W'].includes(b.switch.facing))
  }
})

console.log(`\n${passed} passed`)
