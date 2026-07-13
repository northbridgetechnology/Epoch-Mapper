/**
 * Batch G1 — NPCs as party members: NpcDef → Character conversion and the
 * `recruit` effect.
 * Run with:  tsx test/recruit.test.ts
 */

import assert from 'node:assert/strict'
import { npcToCharacter } from '../src/lib/save-state'
import { resolveExploreEffects, npcRecruitedFlagKey } from '../src/lib/event-engine'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import type { EventContext } from '../src/lib/event-engine'
import type { NpcDef, Ruleset } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const ruleset: Ruleset = makeDefaultRuleset()
const cls = ruleset.classes[0]
const race = ruleset.races[0]
const attrId = ruleset.attributes[0].id

function ctx(over: Partial<EventContext> = {}): EventContext {
  return { flags: {}, party: [], inventory: [], gold: 0, ...over }
}

test('npcToCharacter: mirrors the def into a runtime Character', () => {
  const spell = ruleset.spells[0]?.id
  const def: NpcDef = {
    id: 'npc.ally', name: 'Aldric', portrait: 'knight',
    classId: cls.id, raceId: race.id, level: 5,
    attributes: { [attrId]: 14 },
    knownSpells: spell ? [spell] : [],
    lines: [],
    recruitable: true,
  }
  const ch = npcToCharacter(def, ruleset)
  assert.equal(ch.name, 'Aldric')
  assert.equal(ch.sourceNpc, 'npc.ally')
  assert.equal(ch.portrait, 'knight')
  assert.equal(ch.level, 5)
  assert.equal(ch.classId, cls.id)
  assert.equal(ch.attributes[attrId], 14, 'explicit attribute is authoritative')
  assert.ok(ch.maxHp > 0 && ch.hp === ch.maxHp, 'HP derived and full')
  assert.equal(ch.alive, true)
  if (spell) assert.ok(ch.knownSpells.includes(spell))
  assert.notEqual(ch.id, def.id, 'fresh runtime id, not the def id')
})

test('npcToCharacter: missing attributes fall back to class/race defaults', () => {
  const def: NpcDef = { id: 'npc.b', name: 'Bran', classId: cls.id, raceId: race.id, lines: [] }
  const ch = npcToCharacter(def, ruleset)
  const short = attrId.replace('attr.', '')
  const expected = Math.min(
    ruleset.attributes[0].max,
    Math.max(ruleset.attributes[0].min,
      ruleset.attributes[0].default
      + (cls.attrModifiers[attrId] ?? cls.attrModifiers[short] ?? 0)
      + (race.attrModifiers[attrId] ?? race.attrModifiers[short] ?? 0)),
  )
  assert.equal(ch.attributes[attrId], expected)
  assert.equal(ch.level, 1, 'defaults to level 1')
})

test('recruit effect: accumulates the npc id and sets the recruited flag', () => {
  const res = resolveExploreEffects([{ t: 'recruit', npc: 'npc.ally' }], ctx(), () => 0.5, ruleset)
  assert.deepEqual(res.recruits, ['npc.ally'])
  assert.equal(res.flagSets[npcRecruitedFlagKey('npc.ally')], true)
})

test('recruit effect: de-duplicates repeated recruits of the same npc', () => {
  const res = resolveExploreEffects(
    [{ t: 'recruit', npc: 'npc.ally' }, { t: 'recruit', npc: 'npc.ally' }],
    ctx(), () => 0.5, ruleset,
  )
  assert.deepEqual(res.recruits, ['npc.ally'])
})


test('npcToCharacter: recruits above level 1 get class growth baked in', () => {
  const fighter = ruleset.classes.find(c => c.id === 'class.fighter')!
  const def: NpcDef = {
    id: 'npc.vet', name: 'Veteran', classId: fighter.id, raceId: race.id, level: 5,
    lines: [], recruitable: true,
  }
  const ch = npcToCharacter(def, ruleset)
  // default 10 + class mod 2 + human race mod 1 + growth 1×4 levels
  assert.equal(ch.attributes['attr.might'], 17)
})


test('npcToCharacter: seeds class skills up to the recruit level', () => {
  const fighter = ruleset.classes.find(c => c.id === 'class.fighter')!
  const def: NpcDef = { id: 'npc.brute', name: 'Brute', classId: fighter.id, raceId: race.id, level: 5, lines: [], recruitable: true }
  const ch = npcToCharacter(def, ruleset)
  assert.ok(ch.knownSkills?.includes('skill.power_strike'))  // lv1
  assert.ok(ch.knownSkills?.includes('skill.cleave'))        // lv4
})

console.log(`\n${passed} passed`)
