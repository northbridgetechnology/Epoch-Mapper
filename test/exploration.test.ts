/**
 * Trick tiles + party light (dark maps).
 * Run with:  tsx test/exploration.test.ts
 */

import assert from 'node:assert/strict'
import { applyMoveTricks, cellHasTrick, computeLightRadius, tickLightBurn, restParty, DARK_BASE_RADIUS } from '../src/lib/exploration'
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

console.log(`\n${passed} passed`)
