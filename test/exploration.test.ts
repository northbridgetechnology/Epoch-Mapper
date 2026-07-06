/**
 * Trick tiles + party light (dark maps).
 * Run with:  tsx test/exploration.test.ts
 */

import assert from 'node:assert/strict'
import { applyMoveTricks, cellHasTrick, computeLightRadius, tickLightBurn, restParty, listFoes, advanceFoes, foeFlagKey, seenCellsFrom, DARK_BASE_RADIUS } from '../src/lib/exploration'
import { EDGE } from '../src/lib/constants'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import type { CellData, MapData } from '../src/lib/types'
import type { CellEntity, Character } from '../src/lib/engine-types'

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

function cellWith(...entities: CellEntity[]): CellData {
  return { base: 1, overlays: [], entities }
}
function mapStub(id: string): MapData {
  return { id, name: id, cells: {}, playerX: 0, playerY: 0 }
}
const maps = [mapStub('m1'), mapStub('m2')]

function char(over: Partial<Character> = {}): Character {
  return {
    id: 'c1', name: 'Tess', classId: 'class.fighter', raceId: 'race.human',
    level: 1, xp: 0, attributes: {}, hp: 10, maxHp: 10, mp: 0, maxMp: 0,
    equipment: {}, knownSpells: [], statuses: [], alive: true, ...over,
  }
}

test('spinner rotates the party (fixed modes are deterministic)', () => {
  const r = applyMoveTricks(cellWith({ t: 'trick', kind: 'spinner', rotate: 'left' }),
    { maps, mapId: 'm1', x: 3, y: 3, facing: 'N' })
  assert.equal(r.facing, 'W')
  const rev = applyMoveTricks(cellWith({ t: 'trick', kind: 'spinner', rotate: 'reverse' }),
    { maps, mapId: 'm1', x: 3, y: 3, facing: 'N' })
  assert.equal(rev.facing, 'S')
  assert.equal(rev.messages.length, 0, 'spinners are silent')
})

test('pit falls to the next map at the same coordinates by default', () => {
  const r = applyMoveTricks(cellWith({ t: 'trick', kind: 'pit', damage: 4 }),
    { maps, mapId: 'm1', x: 5, y: 7, facing: 'N', rng: () => 0.5 })
  assert.deepEqual(r.teleportTo, { mapId: 'm2', x: 5, y: 7 })
  assert.equal(r.damage, 4)
  assert.ok(r.fell)
  assert.ok(r.messages.length > 0, 'falling is loud')
})

test('pit with no map below does nothing', () => {
  const r = applyMoveTricks(cellWith({ t: 'trick', kind: 'pit' }),
    { maps, mapId: 'm2', x: 5, y: 7, facing: 'N' })
  assert.equal(r.teleportTo, undefined)
})

test('silent teleport relocates without a message; pit preempts it', () => {
  const r = applyMoveTricks(cellWith({ t: 'trick', kind: 'silentTeleport', x: 9, y: 9 }),
    { maps, mapId: 'm1', x: 1, y: 1, facing: 'E' })
  assert.deepEqual(r.teleportTo, { mapId: 'm1', x: 9, y: 9 })
  assert.equal(r.messages.length, 0)
  const both = applyMoveTricks(
    cellWith({ t: 'trick', kind: 'silentTeleport', x: 9, y: 9 }, { t: 'trick', kind: 'pit', mapId: 'm2', x: 2, y: 2 }),
    { maps, mapId: 'm1', x: 1, y: 1, facing: 'E', rng: () => 0 })
  assert.equal(both.teleportTo!.mapId, 'm2')
})

test('zone queries: antiMagic / darkness / safeRoom', () => {
  assert.ok(cellHasTrick(cellWith({ t: 'trick', kind: 'antiMagic' }), 'antiMagic'))
  assert.ok(!cellHasTrick(cellWith({ t: 'trick', kind: 'antiMagic' }), 'darkness'))
  assert.ok(!cellHasTrick(undefined, 'safeRoom'))
})

test('light: bare party sees 1 cell, torch extends it, darkness zone snuffs it', () => {
  const bare = [char()]
  assert.equal(computeLightRadius(bare, ruleset), DARK_BASE_RADIUS)
  const torchBearer = [char({ equipment: { offhand: { def: 'item.torch', qty: 1 } } })]
  assert.equal(computeLightRadius(torchBearer, ruleset), 3)
  assert.equal(
    computeLightRadius(torchBearer, ruleset, cellWith({ t: 'trick', kind: 'darkness' })),
    DARK_BASE_RADIUS,
  )
})

test('burn-down: burnSteps items tick and gutter out; default torch is eternal', () => {
  const rs = { ...ruleset, items: [...ruleset.items, { ...ruleset.items.find(i => i.id === 'item.torch')!, id: 'item.candle', name: 'Candle', burnSteps: 2 }] }
  const party = [char({ equipment: { offhand: { def: 'item.candle', qty: 1 } } })]
  let r = tickLightBurn(party, rs)
  assert.equal(r.party[0].equipment.offhand?.charges, 1)
  r = tickLightBurn(r.party, rs)
  assert.equal(r.party[0].equipment.offhand, undefined, 'candle destroyed')
  assert.ok(r.messages[0].includes('gutters out'))

  const eternal = [char({ equipment: { offhand: { def: 'item.torch', qty: 1 } } })]
  const r2 = tickLightBurn(eternal, ruleset)
  assert.equal(r2.party, eternal, 'no burnSteps → untouched')
})

test('rest: full restore by default, statuses cleared, dead stay dead', () => {
  const p = [
    char({ hp: 2, mp: 0, maxMp: 8, statuses: [{ def: 'status.poison', remaining: 3 }] }),
    char({ id: 'c2', alive: false, hp: 0 }),
  ]
  const r = restParty(p, ruleset.meta, cellWith({ t: 'trick', kind: 'safeRoom' }), () => 0)
  assert.equal(r.ambushed, false)
  assert.equal(r.party[0].hp, 10)
  assert.equal(r.party[0].mp, 8)
  assert.equal(r.party[0].statuses.length, 0)
  assert.equal(r.party[1].alive, false)
})

test('rest: ambush rolls only on cells with a zone encounter; safe rooms never', () => {
  const zoneCell = cellWith({ t: 'encounter', table: 'enc.t', mode: 'zone' })
  const r = restParty([char({ hp: 1 })], ruleset.meta, zoneCell, () => 0)   // rng 0 < 0.25
  assert.equal(r.ambushed, true)
  const safeZone = cellWith({ t: 'encounter', table: 'enc.t', mode: 'zone' }, { t: 'trick', kind: 'safeRoom' })
  assert.equal(restParty([char({ hp: 1 })], ruleset.meta, safeZone, () => 0).ambushed, false)
  assert.equal(restParty([char({ hp: 1 })], ruleset.meta, cellWith(), () => 0).ambushed, false)
})

test('rest: fractional tunables cap the restore', () => {
  const meta = { ...ruleset.meta, restHpFrac: 0.5 }
  const r = restParty([char({ hp: 2 })], meta, undefined, () => 0.99)
  assert.equal(r.party[0].hp, 5)
})

test('FOE patrols: loop advance, contact position, dead flag', () => {
  const m: MapData = {
    id: 'm1', name: 'm1', playerX: 0, playerY: 0,
    cells: {
      '2,2': { base: 1, overlays: [], entities: [
        { t: 'foe', enemy: 'enemy.ogre', count: 2, mode: 'loop', path: [{ x: 3, y: 2 }, { x: 3, y: 3 }] },
      ] },
    },
  }
  let flags: Record<string, boolean | number | string> = {}
  assert.deepEqual(listFoes(m, flags)[0].pos, { x: 2, y: 2 })
  flags = { ...flags, ...advanceFoes(m, flags) }
  assert.deepEqual(listFoes(m, flags)[0].pos, { x: 3, y: 2 })
  flags = { ...flags, ...advanceFoes(m, flags) }
  flags = { ...flags, ...advanceFoes(m, flags) }
  assert.deepEqual(listFoes(m, flags)[0].pos, { x: 2, y: 2 }, 'loop wraps home')

  flags[foeFlagKey('m1', '2,2', 'dead')] = true
  assert.equal(listFoes(m, flags)[0].dead, true)
  const before = { ...flags }
  assert.deepEqual(advanceFoes(m, flags), {}, 'dead FOEs do not move')
  assert.deepEqual(flags, before)
})

test('FOE patrols: pingpong reverses at the ends', () => {
  const m: MapData = {
    id: 'm1', name: 'm1', playerX: 0, playerY: 0,
    cells: {
      '0,0': { base: 1, overlays: [], entities: [
        { t: 'foe', enemy: 'enemy.slime', mode: 'pingpong', path: [{ x: 1, y: 0 }] },
      ] },
    },
  }
  let flags: Record<string, boolean | number | string> = {}
  flags = { ...flags, ...advanceFoes(m, flags) }
  assert.deepEqual(listFoes(m, flags)[0].pos, { x: 1, y: 0 })
  flags = { ...flags, ...advanceFoes(m, flags) }
  assert.deepEqual(listFoes(m, flags)[0].pos, { x: 0, y: 0 }, 'bounces back')
})

// ── Minimap fog: per-cell exploration reveal (line of sight) ──────────────────

function floorMap(over: Partial<MapData> = {}): MapData {
  const cells: MapData['cells'] = {}
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) cells[`${x},${y}`] = { base: 1, overlays: [] }
  return { id: 'm', name: 'm', playerX: 0, playerY: 0, cells, ...over }
}

test('seenCellsFrom: open floor reveals cardinal LOS out to maxDist, plus self', () => {
  const seen = new Set(seenCellsFrom(floorMap(), 0, 0, {}, 2))
  assert.ok(seen.has('0,0'), 'self always seen')
  assert.ok(seen.has('2,0') && seen.has('-2,0') && seen.has('0,2') && seen.has('0,-2'), 'cardinal rays reach maxDist')
  assert.ok(!seen.has('3,0'), 'stops at maxDist')
  assert.ok(!seen.has('1,1'), 'no diagonal reveal')
})

test('seenCellsFrom: a wall boundary halts the ray (cell behind stays fogged)', () => {
  const m = floorMap({ boundaries: { '1,0:E': { wall: EDGE.WALL } } })
  const seen = new Set(seenCellsFrom(m, 0, 0, {}, 6))
  assert.ok(seen.has('1,0'), 'sees up to the wall')
  assert.ok(!seen.has('2,0'), 'cannot see past the wall')
})

test('seenCellsFrom: a wall-base cell is revealed but blocks further sight', () => {
  const m = floorMap()
  m.cells['0,2'] = { base: 2 /* WALL */, overlays: [] }
  const seen = new Set(seenCellsFrom(m, 0, 0, {}, 6))
  assert.ok(seen.has('0,1') && seen.has('0,2'), 'wall face is visible')
  assert.ok(!seen.has('0,3'), 'nothing seen beyond a wall cell')
})

test('seenCellsFrom: closed doors block, open doors let sight through', () => {
  const closed = floorMap({ boundaries: { '0,-1:S': { door: { state: 'closed' } } } })
  assert.ok(!new Set(seenCellsFrom(closed, 0, 0, {}, 6)).has('0,-1'), 'closed door blocks')
  const open = floorMap({ boundaries: { '0,-1:S': { door: { state: 'open' } } } })
  assert.ok(new Set(seenCellsFrom(open, 0, 0, {}, 6)).has('0,-1'), 'open door reveals through')
})

// ── Batch D: loot ritual + spell learning ─────────────────────────────────────

import { applyCombatOutcome } from '../src/lib/combat-engine'
import { applyEffectToChar } from '../src/lib/apply-effects'
import { itemDisplayName } from '../src/lib/item-schema'
import { xpToNextLevel } from '../src/lib/engine-types'

test('itemDisplayName masks unidentified stacks', () => {
  const def = { name: 'Vorpal Sword', unidentifiedName: '?Sword' }
  assert.equal(itemDisplayName(def, { unidentified: true }), '?Sword')
  assert.equal(itemDisplayName(def, {}), 'Vorpal Sword')
  assert.equal(itemDisplayName({ name: 'Rusty Blade' }, { unidentified: true }), '?Blade')
})

test('teachSpell effect respects class schools and no-duplicates', () => {
  const spell = ruleset.spells.find(s => (s.learn ?? []).length === 0) ?? ruleset.spells[0]
  const mage = char({ classId: ruleset.classes.find(c => c.spellSchools.includes(spell.school))?.id ?? ruleset.classes[0].id })
  const r = applyEffectToChar({ t: 'teachSpell', spell: spell.id }, 0, [mage], [], ruleset)
  assert.ok(r.party[0].knownSpells.includes(spell.id))
  const again = applyEffectToChar({ t: 'teachSpell', spell: spell.id }, 0, r.party, [], ruleset)
  assert.equal(again.party[0].knownSpells.filter(s => s === spell.id).length, 1)
})

test('level-up auto-learns spells from the learn table', () => {
  const cls = ruleset.classes[0]
  const rs = {
    ...ruleset,
    spells: [...ruleset.spells, {
      id: 'spell.test_bolt', name: 'Test Bolt', school: cls.spellSchools[0] ?? 'arcane',
      level: 1, mpCost: 2, target: 'enemy' as const, inCombat: true, outOfCombat: false,
      effects: [], learn: [{ classId: cls.id, level: 2 }],
    }],
  }
  const hero = char({ classId: cls.id, level: 1, xp: xpToNextLevel(1) - 1 })
  const state = {
    actors: [{ kind: 'party' as const, idx: 0, name: hero.name, hp: 10, maxHp: 10, mp: 0, maxMp: 0,
      attack: 1, defense: 1, speed: 1, xp: 0, gold: 0, alive: true, statuses: [], rank: 0 as const }],
    turnIdx: 0, phase: 'victory' as const, log: [], fleeAttempts: 0,
    xpReward: 10, goldReward: 0, itemsUsed: {}, rngState: 1, events: [], eventSeq: 0, drops: [], round: 1,
  }
  const { party: after, levelUps } = applyCombatOutcome([hero], state, rs)
  assert.equal(levelUps.length, 1)
  assert.equal(after[0].level, 2)
  assert.ok(after[0].knownSpells.includes('spell.test_bolt'))
})

console.log(`\n${passed} passed`)
