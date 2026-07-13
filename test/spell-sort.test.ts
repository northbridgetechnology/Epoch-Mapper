/**
 * View-only spell sorting for the Database list (school/level/mp/name).
 * Run with:  tsx test/spell-sort.test.ts
 */

import assert from 'node:assert/strict'
import { sortSpells, spellLearnLevel } from '../src/lib/spell-schema'
import type { SpellDef, SpellSchoolDef } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const schools: SpellSchoolDef[] = [
  { id: 'arcane', name: 'Arcane' },
  { id: 'divine', name: 'Divine' },
]
const sp = (id: string, school: string, level: number, mpCost: number, learn?: { classId: string; level: number }[]): SpellDef =>
  ({ id, name: id, school, level, mpCost, target: 'enemy', inCombat: true, outOfCombat: false, effects: [], learn }) as SpellDef

const spells = [
  sp('zap', 'divine', 5, 8),
  sp('agi', 'arcane', 3, 4, [{ classId: 'c', level: 1 }]),   // learn level 1 beats field 3
  sp('bufu', 'arcane', 2, 6),
  sp('mystery', 'necromancy', 1, 2),                          // unknown school → sorts last
]

test('spellLearnLevel prefers the earliest learn entry, falls back to the field', () => {
  assert.equal(spellLearnLevel(spells[1]), 1)
  assert.equal(spellLearnLevel(spells[2]), 2)
})

test('school sort: table order, then learn level, unknown schools last', () => {
  assert.deepEqual(sortSpells(spells, 'school', schools).map(s => s.id), ['agi', 'bufu', 'zap', 'mystery'])
})

test('level / mp / name sorts', () => {
  assert.deepEqual(sortSpells(spells, 'level', schools).map(s => s.id), ['agi', 'mystery', 'bufu', 'zap'])
  assert.deepEqual(sortSpells(spells, 'mp', schools).map(s => s.id), ['mystery', 'agi', 'bufu', 'zap'])
  assert.deepEqual(sortSpells(spells, 'name', schools).map(s => s.id), ['agi', 'bufu', 'mystery', 'zap'])
})

test('sorting never mutates the input array', () => {
  const before = spells.map(s => s.id)
  sortSpells(spells, 'name', schools)
  assert.deepEqual(spells.map(s => s.id), before)
})

console.log(`\n${passed} spell-sort tests passed`)
