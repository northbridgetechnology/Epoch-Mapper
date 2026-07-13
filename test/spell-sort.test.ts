/**
 * View-only spell sorting for the Database list (school/level/mp/name).
 * Run with:  tsx test/spell-sort.test.ts
 */

import assert from 'node:assert/strict'
import { sortSpells, spellLearnLevel, sortStatuses } from '../src/lib/spell-schema'
import { skillGroups } from '../src/lib/skill-schema'
import { itemGroups } from '../src/lib/item-schema'
import type { ClassDef, ItemDef, SkillDef, SpellDef, SpellSchoolDef, StatusEffectDef } from '../src/lib/engine-types'

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


// ── Status sorting ────────────────────────────────────────────────────────────

const st = (id: string, kind: string, dur: number): StatusEffectDef =>
  ({ id, name: id, kind, durationTurns: dur, blocksAction: false }) as StatusEffectDef
const statuses = [st('frozen', 'control', 2), st('haste', 'buff', 3), st('venom', 'dot', 4), st('slow', 'debuff', 1)]

test('status sort: kind order (buff→debuff→dot→hot→control), duration, name', () => {
  assert.deepEqual(sortStatuses(statuses, 'kind').map(s => s.id), ['haste', 'slow', 'venom', 'frozen'])
  assert.deepEqual(sortStatuses(statuses, 'duration').map(s => s.id), ['slow', 'frozen', 'haste', 'venom'])
  assert.deepEqual(sortStatuses(statuses, 'name').map(s => s.id), ['frozen', 'haste', 'slow', 'venom'])
})

// ── Skill grouping by class ───────────────────────────────────────────────────

const classes = [
  { id: 'c.fighter', name: 'Fighter' },
  { id: 'c.rogue', name: 'Rogue' },
] as ClassDef[]
const sk = (id: string, learn?: { classId: string; level: number }[]): SkillDef =>
  ({ id, name: id, target: 'enemy', effects: [], learn }) as SkillDef
const skills = [
  sk('shared', [{ classId: 'c.fighter', level: 6 }, { classId: 'c.rogue', level: 2 }]),
  sk('slash', [{ classId: 'c.fighter', level: 1 }]),
  sk('orphan'),
]

test('skillGroups: class groups in class order, learn-level ordering, multi-class duplication', () => {
  const { groups, rows } = skillGroups(skills, classes, 'class')
  assert.deepEqual(groups?.map(g => g.id), ['c.fighter', 'c.rogue', '_unassigned'])
  // fighter: slash (lv1) before shared (lv6); rogue: shared; orphan → unassigned
  assert.deepEqual(rows.map(r => r.key), ['c.fighter_slash', 'c.fighter_shared', 'c.rogue_shared', 'u_orphan'])
  // shared appears in both class groups
  assert.equal(rows.filter(r => r.skill.id === 'shared').length, 2)
})

test('skillGroups: name sort is flat (no groups)', () => {
  const { groups, rows } = skillGroups(skills, classes, 'name')
  assert.equal(groups, undefined)
  assert.deepEqual(rows.map(r => r.skill.id), ['orphan', 'shared', 'slash'])
})

// ── Item grouping ─────────────────────────────────────────────────────────────

const it = (id: string, kind: string, value: number, slot?: string): ItemDef =>
  ({ id, name: id, kind, slot, value, stackable: false }) as ItemDef
const items = [
  it('potion', 'consumable', 10),
  it('plate', 'armor', 90, 'body'),
  it('blade', 'weapon', 50, 'weapon'),
  it('coin', 'misc', 1),
]

test('itemGroups: kind groups in ITEM_KINDS order, name within', () => {
  const { groups, rows } = itemGroups(items, 'kind')
  assert.deepEqual(groups?.map(g => g.id).slice(0, 3), ['weapon', 'armor', 'consumable'])
  assert.deepEqual(rows.map(r => r.item.id), ['blade', 'plate', 'potion', 'coin'])
})

test('itemGroups: slot groups put non-equippables last; value/name are flat', () => {
  const bySlot = itemGroups(items, 'slot')
  assert.deepEqual(bySlot.rows.map(r => r.groupId), ['weapon', 'body', '_none', '_none'])
  const byValue = itemGroups(items, 'value')
  assert.equal(byValue.groups, undefined)
  assert.deepEqual(byValue.rows.map(r => r.item.id), ['coin', 'potion', 'blade', 'plate'])
  assert.deepEqual(itemGroups(items, 'name').rows.map(r => r.item.id), ['blade', 'coin', 'plate', 'potion'])
})

console.log(`\n${passed} spell-sort tests passed`)
