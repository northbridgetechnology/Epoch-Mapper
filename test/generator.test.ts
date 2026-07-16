/**
 * Tests for buildGeneratedWorld — the "Randomly Generate and Populate" path.
 * Run with:  tsx test/generator.test.ts
 */

import assert from 'node:assert/strict'
import { buildGeneratedWorld, type NewMapConfig } from '../src/lib/map-generator'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import { BASE, OVERLAY } from '../src/lib/constants'

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
  // The Depths ship 3 relics; the systems-showcase pass adds a map-reveal item.
  assert.ok(world.items.length >= 4, `expected ≥4 generated items, got ${world.items.length}`)
  const blade = world.items.find(i => i.cursed)
  assert.ok(blade?.unidentifiedName, 'cursed blade must drop unidentified')
  assert.ok(world.items.some(i => i.onUse?.some(e => e.t === 'teachSpell')), 'no teachSpell scroll')
  assert.ok(world.items.some(i => i.onUse?.some(e => e.t === 'identify') && i.onUse?.some(e => e.t === 'removeCurse')), 'no censer')
  assert.ok(world.items.some(i => i.onUse?.some(e => e.t === 'reveal')), 'no map-reveal item')

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

// ── Layout styles ──────────────────────────────────────────────────────────────

import { EDGE } from '../src/lib/constants'
import { boundaryKey } from '../src/lib/constants'

/** BFS over floor cells; boundaries with a solid/hidden wall block the path
 *  (doors are passable — sealed vault doors open via the puzzle). */
function reachableCount(map: import('../src/lib/types').MapData): { reached: number; total: number } {
  const keys = Object.keys(map.cells)
  const blockedWall = (bk: string) => {
    const b = map.boundaries?.[bk]
    if (!b) return false
    if (b.door) return false
    return b.wall === EDGE.WALL || b.wall === EDGE.ILLUSORY || b.wall === EDGE.SECRET
  }
  const start = keys[0]
  const seen = new Set([start])
  const queue = [start]
  const DELTA: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }
  while (queue.length > 0) {
    const [x, y] = queue.pop()!.split(',').map(Number)
    for (const [dir, [dx, dy]] of Object.entries(DELTA)) {
      const nk = `${x + dx},${y + dy}`
      if (!map.cells[nk] || seen.has(nk)) continue
      if (blockedWall(boundaryKey(x, y, dir as import('../src/lib/types').EdgeDir))) continue
      seen.add(nk)
      queue.push(nk)
    }
  }
  return { reached: seen.size, total: keys.length }
}

function corridorDeadEnds(map: import('../src/lib/types').MapData): number {
  let n = 0
  for (const k of Object.keys(map.cells)) {
    const [x, y] = k.split(',').map(Number)
    const nbrs = [[0, -1], [0, 1], [1, 0], [-1, 0]].filter(([dx, dy]) => map.cells[`${x + dx},${y + dy}`]).length
    if (nbrs <= 1) n++
  }
  return n
}

test('eotb style: packed chambers + sparse corridors, connected, playable dead-end budget', () => {
  const w = buildGeneratedWorld('EotB', { name: 'EotB', size: 'small', seed: 99, generate: true, style: 'eotb' }, ruleset)
  const conn = reachableCount(w.map)
  assert.equal(conn.reached, conn.total, 'must be fully connected without cheating through hidden walls')
  // Real EotB floors are roughly half open, half solid — not a wall-salad maze
  const floorFrac = Object.keys(w.map.cells).length / (25 * 25)
  assert.ok(floorFrac > 0.3 && floorFrac < 0.75, `floor fraction ${floorFrac.toFixed(2)} out of the EotB band`)
  assert.ok(corridorDeadEnds(w.map) <= 8, 'dead ends must be trimmed to a searchable handful')
  const bounds = Object.values(w.map.boundaries ?? {})
  assert.ok(bounds.some(b => b.door), 'chamber doors expected')
  assert.ok(bounds.some(b => b.wall === EDGE.ILLUSORY || b.wall === EDGE.SECRET), 'hidden walls expected')
  assert.ok(w.extraMaps[0].dark, 'depths still dark in eotb style')
})

test('smt style: arterial corridors with room blocks behind doors, fully connected', () => {
  const w = buildGeneratedWorld('SMT', { name: 'SMT', size: 'small', seed: 99, generate: true, style: 'smt' }, ruleset)
  const conn = reachableCount(w.map)
  assert.equal(conn.reached, conn.total, 'network must be fully connected')
  assert.equal(corridorDeadEnds(w.map), 0, 'SMT corridors never waste your steps — zero dead ends')
  const bounds = Object.values(w.map.boundaries ?? {})
  assert.ok(bounds.some(b => b.door), 'room-entry doors expected')
  // Every door must stand between two walkable cells — no doors to nowhere
  for (const [bk, b] of Object.entries(w.map.boundaries ?? {})) {
    if (!b.door) continue
    const [cellPart, dirPart] = bk.split(':')
    const [bx, by] = cellPart.split(',').map(Number)
    const other = dirPart === 'S' ? `${bx},${by + 1}` : `${bx + 1},${by}`
    assert.ok(w.map.cells[cellPart] && w.map.cells[other], `door ${bk} leads nowhere`)
  }
  // Long straight corridor runs are the SMT signature
  let longest = 0
  for (let y = 0; y < 40; y++) {
    let run = 0
    for (let x = 0; x < 40; x++) {
      run = w.map.cells[`${x},${y}`] ? run + 1 : 0
      longest = Math.max(longest, run)
    }
  }
  assert.ok(longest >= 12, `expected long straight avenues, longest run ${longest}`)
  // Story wiring still lands (needs >= 3 rooms)
  assert.ok(w.quests.length >= 1)
})

test('styles are deterministic per seed', () => {
  for (const style of ['eotb', 'smt'] as const) {
    const a = buildGeneratedWorld('X', { name: 'X', size: 'small', seed: 7, generate: true, style }, ruleset)
    const b = buildGeneratedWorld('X', { name: 'X', size: 'small', seed: 7, generate: true, style }, ruleset)
    assert.deepEqual(Object.keys(a.map.cells).sort(), Object.keys(b.map.cells).sort())
    // Structure must match exactly; entity/switch ids are uid()-random by design
    const scrub = (o: unknown) => JSON.parse(JSON.stringify(o).replace(/"id":"[^"]+"/g, '"id":"_"'))
    assert.deepEqual(scrub(a.map.boundaries), scrub(b.map.boundaries))
  }
})

test('systems showcase: one working example of every world system is generated', () => {
  // A large world should demonstrate the whole toolkit. Inventory everything the
  // showcase pass places across the main map + the Depths.
  const w = buildGeneratedWorld('Showcase', { name: 'Showcase', size: 'large', seed: 7, generate: true }, ruleset)
  const objKinds = new Set<string>(), entTypes = new Set<string>(), effects = new Set<string>()
  const conds = new Set<string>(), bases = new Set<number>(), overlays = new Set<number>(), bFeat = new Set<string>()
  let lockedChests = 0
  const scanE = (a?: { t: string }[]) => { for (const e of a ?? []) effects.add(e.t) }
  const scanC = (a?: { c: string }[]) => { for (const c of a ?? []) conds.add(c.c) }
  for (const map of [w.map, ...w.extraMaps]) {
    for (const cell of Object.values(map.cells)) {
      bases.add(cell.base ?? 0)
      for (const o of cell.overlays ?? []) overlays.add(o)
      for (const ent of cell.entities ?? []) {
        entTypes.add(ent.t)
        if (ent.t === 'object') { objKinds.add(ent.object.kind); if (ent.object.locked) lockedChests++; scanE(ent.object.onInteract); scanE(ent.object.trapEffects) }
        if (ent.t === 'event') { scanE(ent.event.effects); scanC(ent.event.conditions) }
      }
    }
    for (const b of Object.values(map.boundaries ?? {})) {
      if (b.door) bFeat.add('door'); if (b.switch) bFeat.add('switch'); if (b.inscription) bFeat.add('inscription')
      if (b.damage) bFeat.add('damage'); if (b.onPass) bFeat.add('onPass')
    }
  }
  for (const n of w.npcs) for (const l of n.lines ?? []) { scanE(l.effects); scanC(l.conditions) }
  for (const ev of w.events) { scanE(ev.effects); scanC(ev.conditions) }
  for (const it of w.items) scanE(it.onUse)

  // Object kinds a player actually interacts with (door lives on edges, not here).
  for (const k of ['chest', 'npc', 'inn', 'shop', 'sign', 'lever', 'teleporter', 'trap']) {
    assert.ok(objKinds.has(k), `showcase missing object kind: ${k}`)
  }
  assert.ok(lockedChests >= 1, 'no key-locked chest')
  for (const t of ['trick', 'encounter', 'partyStart', 'foe', 'mapLink', 'object', 'event']) {
    assert.ok(entTypes.has(t), `showcase missing entity type: ${t}`)
  }
  // Every effect the engine can apply out of combat, except the authored
  // dialogue-node tree (not meaningfully auto-generatable).
  for (const e of ['damage', 'heal', 'restoreMp', 'status', 'cure', 'reviveRandom', 'fullHeal',
    'giveItem', 'takeItem', 'gold', 'setFlag', 'teleport', 'startCombat', 'message', 'openShop',
    'reveal', 'runEvent', 'questStage', 'moveNpc', 'identify', 'removeCurse', 'teachSpell',
    'playSound', 'gameEnd', 'recruit']) {
    assert.ok(effects.has(e), `showcase missing effect: ${e}`)
  }
  for (const c of ['flag', 'hasItem', 'partyLevel', 'random', 'questStage']) {
    assert.ok(conds.has(c), `showcase missing condition: ${c}`)
  }
  for (const b of ['door', 'switch', 'inscription', 'damage', 'onPass']) {
    assert.ok(bFeat.has(b), `showcase missing boundary feature: ${b}`)
  }
  for (const base of [BASE.WATER, BASE.LAVA, BASE.VOID]) {
    assert.ok(bases.has(base), `showcase missing terrain base: ${base}`)
  }
  for (const ov of [OVERLAY.MINI_BOSS, OVERLAY.TRAP, OVERLAY.WARP, OVERLAY.SHOP_WEAPON, OVERLAY.EVENT]) {
    assert.ok(overlays.has(ov), `showcase missing overlay: ${ov}`)
  }
})

console.log(`\n${passed} passed`)
