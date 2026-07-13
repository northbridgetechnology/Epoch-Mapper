/**
 * Equip proficiency gate — canEquip() enforces slot plus per-type proficiency
 * for weapons (WeaponTypeDef) and armor (ArmorTypeDef). Weight lives on the
 * type, so weight proficiency is expressed by which types a class lists.
 * Run with:  tsx test/equipment.test.ts
 */

import assert from 'node:assert/strict'
import { canEquip } from '../src/lib/equipment'
import { makeDefaultRuleset, normalizeRuleset } from '../src/lib/default-ruleset'
import type { ClassDef, ItemDef, Ruleset } from '../src/lib/engine-types'

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
  assert.equal(canEquip(undefined, weapon({ weaponType: 'wtype.greatsword' })).ok, true)
})

test('slot not in allowedEquip is rejected', () => {
  const cls: ClassDef = { ...fighter, allowedEquip: ['weapon'] }
  const res = canEquip(cls, armor({ armorType: 'atype.light' }))
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /slot/i)
})

test('weapon-type proficiency is enforced', () => {
  const cls: ClassDef = { ...fighter, weaponTypes: ['wtype.sword'] }
  assert.equal(canEquip(cls, weapon({ weaponType: 'wtype.sword' })).ok, true)
  const res = canEquip(cls, weapon({ weaponType: 'wtype.axe' }), ruleset)
  assert.equal(res.ok, false)
  // reason resolves the type name from the ruleset
  assert.match(res.reason ?? '', /Axe/)
})

test('empty weaponTypes means no weapon-type restriction', () => {
  const cls: ClassDef = { ...fighter, weaponTypes: [] }
  assert.equal(canEquip(cls, weapon({ weaponType: 'wtype.axe' })).ok, true)
})

test('armor-type proficiency is enforced', () => {
  const cls: ClassDef = { ...fighter, allowedEquip: ['body'], armorTypes: ['atype.light'] }
  assert.equal(canEquip(cls, armor({ armorType: 'atype.light' })).ok, true)
  const res = canEquip(cls, armor({ armorType: 'atype.heavy' }), ruleset)
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /Heavy Armor/)
})

test('absent/empty armorTypes means no armor-type restriction', () => {
  const cls: ClassDef = { ...fighter, allowedEquip: ['body'], armorTypes: undefined }
  assert.equal(canEquip(cls, armor({ armorType: 'atype.heavy' })).ok, true)
  const cls2: ClassDef = { ...fighter, allowedEquip: ['body'], armorTypes: [] }
  assert.equal(canEquip(cls2, armor({ armorType: 'atype.heavy' })).ok, true)
})

test('untyped weapon/armor is unrestricted by proficiency', () => {
  const cls: ClassDef = { ...mage, allowedEquip: ['weapon', 'body'], weaponTypes: ['wtype.staff'], armorTypes: ['atype.robe'] }
  assert.equal(canEquip(cls, weapon({ weaponType: undefined })).ok, true)
  assert.equal(canEquip(cls, armor({ armorType: undefined })).ok, true)
})

test('accessories bypass type proficiency entirely', () => {
  const cls: ClassDef = { ...mage, allowedEquip: ['ring'], weaponTypes: ['wtype.staff'], armorTypes: ['atype.robe'] }
  const ring: ItemDef = { id: 'r', name: 'Ring', kind: 'misc', slot: 'ring', value: 100, stackable: false }
  assert.equal(canEquip(cls, ring).ok, true)
})

test('default fighter wields greatswords, mage cannot', () => {
  assert.equal(canEquip(fighter, weapon({ weaponType: 'wtype.greatsword' })).ok, true)
  const mageGreat = canEquip(mage, weapon({ weaponType: 'wtype.greatsword' }), ruleset)
  assert.equal(mageGreat.ok, false)
})

test('default mage wears robes but not plate', () => {
  const robe = byId(ruleset.items, 'item.mage_robe')
  const plate = byId(ruleset.items, 'item.plate_armor')
  assert.equal(canEquip(mage, robe, ruleset).ok, true)
  assert.equal(canEquip(mage, plate, ruleset).ok, false)
})

// ── Legacy weapon/armor migration (normalizeRuleset) ─────────────────────────

test('normalizeRuleset seeds default types and remaps a legacy ruleset', () => {
  const legacy = {
    ...makeDefaultRuleset(),
    weaponTypes: [], armorTypes: [],
    items: [
      { id: 'i.sword', name: 'Old Sword', kind: 'weapon', slot: 'weapon', weaponKind: 'blade', weight: 'heavy', value: 10, stackable: false },
      { id: 'i.dagger', name: 'Old Dirk', kind: 'weapon', slot: 'weapon', weaponKind: 'dagger', weight: 'light', value: 5, stackable: false },
      { id: 'i.plate', name: 'Old Plate', kind: 'armor', slot: 'body', weight: 'heavy', value: 20, stackable: false },
      { id: 'i.buckler', name: 'Old Buckler', kind: 'armor', slot: 'offhand', weight: 'light', value: 8, stackable: false },
    ],
    classes: [
      { id: 'c.knight', name: 'Knight', hitDie: 10, spellDie: 0, spellSchools: [], allowedEquip: ['weapon', 'body'], weaponKinds: ['blade'], armorWeights: ['light'], attrGrowth: {}, attrModifiers: {} },
    ],
  } as unknown as Ruleset

  const n = normalizeRuleset(legacy)
  assert.ok(n.weaponTypes.length > 0 && n.armorTypes.length > 0)          // seeded
  const sword = n.items.find(i => i.id === 'i.sword')!
  assert.equal(sword.weaponType, 'wtype.greatsword')                      // heavy blade
  assert.equal((sword as unknown as { weaponKind?: string }).weaponKind, undefined) // dead field dropped
  assert.equal(n.items.find(i => i.id === 'i.dagger')!.weaponType, 'wtype.dagger')
  assert.equal(n.items.find(i => i.id === 'i.plate')!.armorType, 'atype.heavy')
  assert.equal(n.items.find(i => i.id === 'i.buckler')!.armorType, 'atype.buckler')
  const knight = n.classes.find(c => c.id === 'c.knight')!
  assert.deepEqual([...knight.weaponTypes].sort(), ['wtype.greatsword', 'wtype.katana', 'wtype.sword'])
  assert.ok(knight.armorTypes!.includes('atype.robe'))
})

test('normalizeRuleset leaves a modern ruleset untouched', () => {
  const modern = makeDefaultRuleset()
  const n = normalizeRuleset(modern)
  assert.equal(n.weaponTypes, modern.weaponTypes) // same ref — not reseeded
  assert.equal(n.items, modern.items)
})


test('normalizeRuleset seeds spell schools and keeps custom school strings', () => {
  const legacy = {
    ...makeDefaultRuleset(),
    spellSchools: undefined,
    spells: [
      { id: 'sp.a', name: 'Agi', school: 'element', level: 1, mpCost: 3, target: 'enemy', inCombat: true, outOfCombat: false, effects: [] },
      { id: 'sp.x', name: 'Bone Chill', school: 'necromancy', level: 1, mpCost: 3, target: 'enemy', inCombat: true, outOfCombat: false, effects: [] },
    ],
  } as unknown as Ruleset
  const n = normalizeRuleset(legacy)
  assert.ok(n.spellSchools.some(s => s.id === 'element' && s.keyAttribute === 'attr.intellect'))
  const necro = n.spellSchools.find(s => s.id === 'necromancy')
  assert.equal(necro?.name, 'Necromancy')     // custom string became a bare def
  // modern ruleset untouched
  const modern = makeDefaultRuleset()
  assert.equal(normalizeRuleset(modern).spellSchools, modern.spellSchools)
})


// ── Two-handed weapons claim the off-hand ─────────────────────────────────────

test('a two-handed weapon is refused while the off-hand is occupied', () => {
  const zwei = byId(ruleset.items, 'item.zweihander')
  const equipment = { offhand: { def: 'item.buckler', qty: 1 } }
  const res = canEquip(fighter, zwei, ruleset, equipment)
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /both hands/i)
  // hands free → fine
  assert.equal(canEquip(fighter, zwei, ruleset, {}).ok, true)
})

test('an off-hand item is refused while a two-handed weapon is wielded', () => {
  const buckler = byId(ruleset.items, 'item.buckler')
  const equipment = { weapon: { def: 'item.zweihander', qty: 1 } }
  const res = canEquip(fighter, buckler, ruleset, equipment)
  assert.equal(res.ok, false)
  assert.match(res.reason ?? '', /two-handed/i)
  // one-handed weapon held → fine
  assert.equal(canEquip(fighter, buckler, ruleset, { weapon: { def: 'item.longsword', qty: 1 } }).ok, true)
})

console.log(`\n${passed} equipment tests passed`)
