/**
 * Equip proficiency gate — canEquip() enforces slot, weapon-type, and weight
 * (heavy/medium/light) restrictions FF-style.
 * Run with:  tsx test/equipment.test.ts
 */

import assert from 'node:assert/strict'
import { canEquip } from '../src/lib/equipment'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import type { ClassDef, ItemDef } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const ruleset = makeDefaultRuleset()
const byId = <T extends { id: string }>(arr: T[], id: string): T => {
  const found = arr.find(x => x.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

const fighter = byId(ruleset.classes, 'class.fighter')
const mage = byId(ruleset.classes, 'class.mage')

// Minimal ad-hoc defs so the test doesn't depend on exact default-ruleset item ids.
function weapon(over: Partial<ItemDef> = {}): ItemDef {
  return { id: 'w', name: 'Test Weapon', kind: 'weapon', slot: 'weapon', value: 10, stackable: false, ...over }
}
function armor(over: Partial<ItemDef> = {}): ItemDef {
  return { id: 'a', name: 'Test Armor', kind: 'armor', slot: 'body', value: 10, stackable: false, ...over }
}

test('non-equippable item (no slot) is rejected', () => {
  const potion: ItemDef = { id: 'p', name: 'Potion', kind: 'consumable', value: 5, stackable: true }
  assert.equal(canEquip(fighter, potion).ok, false)
  assert.equal(canEquip(undefined, potion).ok, false)
})

test('undefined class allows any equippable item', () => {
  assert.equal(canEquip(undefined, weapon({ weight: 'heavy' })).ok, true)
})

test('slot not in allowedEquip is rejected', () => {
  // A class that only allows the weapon slot
  const cls: ClassDef = { ...fighter, allowedEquip: ['weapon'] }
  const res = canEquip(cls, armor())
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /slot/i)
})

test('weapon-type proficiency is enforced', () => {
  const cls: ClassDef = { ...fighter, weaponKinds: ['sword'] }
  assert.equal(canEquip(cls, weapon({ weaponKind: 'sword' })).ok, true)
  const res = canEquip(cls, weapon({ weaponKind: 'axe' }))
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /axe/i)
})

test('empty weaponKinds means no weapon-type restriction', () => {
  const cls: ClassDef = { ...fighter, weaponKinds: [] }
  assert.equal(canEquip(cls, weapon({ weaponKind: 'axe' })).ok, true)
})

test('weapon weight tier is enforced', () => {
  const cls: ClassDef = { ...mage, weaponKinds: [], weaponWeights: ['light'] }
  assert.equal(canEquip(cls, weapon({ weight: 'light' })).ok, true)
  const res = canEquip(cls, weapon({ weight: 'heavy' }))
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /heavy/i)
})

test('armor weight tier is enforced separately from weapons', () => {
  const cls: ClassDef = { ...fighter, armorWeights: ['light'], weaponWeights: ['heavy'] }
  assert.equal(canEquip(cls, armor({ weight: 'light' })).ok, true)
  assert.equal(canEquip(cls, armor({ weight: 'heavy' })).ok, false)
  // Weapon weight list must not gate armor and vice-versa
  assert.equal(canEquip(cls, weapon({ weaponKind: undefined, weight: 'heavy' })).ok, true)
})

test('absent weight list means all weights allowed', () => {
  const cls: ClassDef = { ...fighter, weaponWeights: undefined, armorWeights: undefined }
  assert.equal(canEquip(cls, weapon({ weaponKind: undefined, weight: 'heavy' })).ok, true)
  assert.equal(canEquip(cls, armor({ weight: 'heavy' })).ok, true)
})

test('untagged (no weight) weapon/armor is always allowed by weight', () => {
  const cls: ClassDef = { ...mage, allowedEquip: ['weapon', 'body'], weaponKinds: [], weaponWeights: ['light'], armorWeights: ['light'] }
  assert.equal(canEquip(cls, weapon({ weight: undefined })).ok, true)
  assert.equal(canEquip(cls, armor({ weight: undefined })).ok, true)
})

test('accessories bypass weight even when tagged', () => {
  // Accessories (rings/amulets) are kind 'misc' — weight only gates weapon/armor kinds
  const cls: ClassDef = { ...mage, allowedEquip: ['ring'], weaponWeights: ['light'], armorWeights: ['light'] }
  const ring: ItemDef = { id: 'r', name: 'Ring', kind: 'misc', slot: 'ring', weight: 'heavy', value: 100, stackable: false }
  assert.equal(canEquip(cls, ring).ok, true)
})

test('default fighter can equip heavy, mage cannot', () => {
  assert.equal(canEquip(fighter, weapon({ weaponKind: undefined, weight: 'heavy' })).ok, true)
  const mageHeavy = canEquip(mage, weapon({ weaponKind: undefined, weight: 'heavy' }))
  assert.equal(mageHeavy.ok, false)
})

console.log(`\n${passed} equipment tests passed`)
