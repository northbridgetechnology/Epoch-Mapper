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
  assert.equal(world.quests.length, 2)   // vault + depths
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

test('showcase Depths: dark second level linked by stairs and pit', () => {
  assert.equal(world.extraMaps.length, 1)
  const depths = world.extraMaps[0]
  assert.ok(depths.dark, 'depths must be a dark map')
  assert.ok(depths.name.includes('Depths'))

  // Stairs Down on the main map links to the Depths, and back
  const mainLink = Object.values(world.map.cells).find(c =>
    c.base === 5 /* STAIRS_DOWN */ && c.entities?.some(e => e.t === 'mapLink' && e.mapId === depths.id))
  assert.ok(mainLink, 'stairs down not linked to depths')
  const backLink = Object.values(depths.cells).find(c =>
    c.base === 4 /* STAIRS_UP */ && c.entities?.some(e => e.t === 'mapLink' && e.mapId === world.map.id))
  assert.ok(backLink, 'depths stairs up not linked back')

  // A pit on the main map drops into the Depths
  const pit = Object.values(world.map.cells).flatMap(c => c.entities ?? [])
    .find(e => e.t === 'trick' && e.kind === 'pit')
  assert.ok(pit && pit.t === 'trick' && pit.mapId === depths.id, 'pit missing or unlinked')
})

test('showcase Depths: tricks, FOE, fixed guard, save point, inscriptions', () => {
  const depths = world.extraMaps[0]
  const ents = Object.values(depths.cells).flatMap(c => c.entities ?? [])
  const trickKinds = new Set(ents.filter(e => e.t === 'trick').map(e => (e as { kind: string }).kind))
  for (const k of ['safeRoom', 'spinner', 'darkness', 'antiMagic']) {
    assert.ok(trickKinds.has(k), `missing trick ${k}`)
  }
  assert.ok(ents.some(e => e.t === 'foe'), 'no FOE patrol')
  assert.ok(ents.some(e => e.t === 'encounter' && e.mode === 'fixed'), 'no visible fixed encounter')
  assert.ok(Object.values(depths.cells).some(c => c.overlays?.includes(12)), 'no save point in the depths')
  const inscriptions = Object.values(depths.boundaries ?? {}).filter(b => b.inscription)
  assert.ok(inscriptions.length >= 1, 'no inscriptions below')
  assert.ok(Object.values(world.map.boundaries ?? {}).some(b => b.inscription), 'no inscriptions above')
})

test('showcase: relics, torchbearer, inn, and the gameEnd finale', () => {
  assert.equal(world.items.length, 3)
  const blade = world.items.find(i => i.cursed)
  assert.ok(blade?.unidentifiedName, 'cursed blade must drop unidentified')
  assert.ok(world.items.some(i => i.onUse?.some(e => e.t === 'teachSpell')), 'no teachSpell scroll')
  assert.ok(world.items.some(i => i.onUse?.some(e => e.t === 'identify') && i.onUse?.some(e => e.t === 'removeCurse')), 'no censer')

  const torchbearer = world.npcs.find(n => n.name === 'Torchbearer')
  assert.ok(torchbearer, 'no torchbearer NPC')
  assert.ok(torchbearer!.lines.some(l => l.effects?.some(e => e.t === 'giveItem' && e.item === 'item.torch')), 'torchbearer gives no torches')

  assert.ok(Object.values(world.map.cells).some(c =>
    c.entities?.some(e => e.t === 'object' && e.object.kind === 'inn')), 'no inn placed')

  const depths = world.extraMaps[0]
  const heart = Object.values(depths.cells).flatMap(c => c.entities ?? [])
    .find(e => e.t === 'event' && e.event.effects.some(ef => ef.t === 'gameEnd'))
  assert.ok(heart, 'no gameEnd finale in the depths')
  const dq = world.quests.find(q => q.id.startsWith('q.depths'))
  assert.ok(dq && dq.stages.length === 3, 'depths quest missing')
})

console.log(`\n${passed} passed`)
