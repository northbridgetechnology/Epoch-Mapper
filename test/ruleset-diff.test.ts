/**
 * Unit tests for the ruleset diff/patch codec (v3's ruleset compression).
 * Run with:  bun test/ruleset-diff.test.ts
 */

import assert from 'node:assert/strict'
import { diffRuleset, patchRuleset } from '../src/lib/ruleset-diff'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import type { Ruleset } from '../src/lib/engine-types'

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

const roundtrip = (r: Ruleset) => patchRuleset(diffRuleset(r))

console.log('ruleset diff/patch')

test('an untouched default ruleset diffs to (almost) nothing', () => {
  const diff = diffRuleset(makeDefaultRuleset())
  // meta is always stored whole; no table should appear when nothing changed.
  assert.equal(diff.tables, undefined)
  const json = JSON.stringify(diff)
  assert.ok(json.length < 1500, `expected a tiny diff, got ${json.length} chars`)
})

test('default ruleset round-trips exactly', () => {
  const rs = makeDefaultRuleset()
  assert.deepEqual(roundtrip(rs), rs)
})

test('editing one entry stores only that entry, not the whole table', () => {
  const rs = makeDefaultRuleset()
  // Immutable update (as the editor does) — never mutate the shared defaults,
  // which double as the diff baseline.
  rs.enemies = rs.enemies.map((e, i) => (i === 2 ? { ...e, hp: 12345 } : e))
  const diff = diffRuleset(rs)
  const enemyDiff = diff.tables?.enemies
  assert.ok(enemyDiff, 'enemies table should be present in the diff')
  assert.equal(enemyDiff!.ids, undefined) // membership/order unchanged → no id list
  assert.deepEqual(Object.keys(enemyDiff!.set ?? {}), [rs.enemies[2].id])
  assert.deepEqual(roundtrip(rs), rs)
})

test('reordering a table (no content change) stores ids but no overrides', () => {
  const rs = makeDefaultRuleset()
  rs.spells = [...rs.spells].reverse()
  const diff = diffRuleset(rs)
  const spellDiff = diff.tables?.spells
  assert.ok(spellDiff?.ids, 'reorder must record the id order')
  assert.equal(spellDiff!.set, undefined) // nothing edited → no set
  assert.deepEqual(roundtrip(rs), rs)
})

test('adding and removing entries round-trips (membership preserved)', () => {
  const rs = makeDefaultRuleset()
  rs.items = rs.items.slice(1) // drop the first
  rs.items.push({ id: 'item.custom_gizmo', name: 'Gizmo', kind: 'misc', description: 'x', value: 1 } as Ruleset['items'][number])
  const back = roundtrip(rs)
  assert.deepEqual(back.items, rs.items)
  assert.ok(back.items.some(i => i.id === 'item.custom_gizmo'))
})

test('formulas and combatTuning are carried when present', () => {
  const rs = makeDefaultRuleset()
  rs.formulas = { hitChance: 'custom' } as unknown as Ruleset['formulas']
  rs.combatTuning = { critMult: 2.5 } as unknown as Ruleset['combatTuning']
  const back = roundtrip(rs)
  assert.deepEqual(back.formulas, rs.formulas)
  assert.deepEqual(back.combatTuning, rs.combatTuning)
})

test('meta is stored whole and survives verbatim', () => {
  const rs = makeDefaultRuleset()
  rs.meta = { ...rs.meta, title: 'Verbatim', startingGold: 777, startMapId: 'atrium' }
  const back = roundtrip(rs)
  assert.deepEqual(back.meta, rs.meta)
})

console.log(`\n${passed} passed`)
