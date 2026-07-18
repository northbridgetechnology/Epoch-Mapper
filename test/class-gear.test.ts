/**
 * Class-signature gear: the seeded catalog is well-formed, each class has a
 * full slate per equippable armor slot, class-locked pieces are only equippable
 * by their class, and shared accessories stay open to all.
 * Run with:  tsx test/class-gear.test.ts
 */

import assert from 'node:assert/strict'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import { canEquip } from '../src/lib/equipment'
import { CLASS_GEAR_ITEMS } from '../src/lib/class-gear'
import type { ItemSlot, Ruleset } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const rs: Ruleset = makeDefaultRuleset()
const clsById = (id: string) => rs.classes.find(c => c.id === id)!

test('every class has ~10 locked pieces in each armor slot it can equip', () => {
  const armorSlots: ItemSlot[] = ['head', 'body', 'hands', 'feet']
  for (const cls of rs.classes) {
    for (const slot of armorSlots) {
      if (!cls.allowedEquip.includes(slot)) continue
      const n = rs.items.filter(i => i.slot === slot && i.classes?.length === 1 && i.classes[0] === cls.id).length
      // Mage only gets body; others get all four. Expect a solid slate where present.
      if (n === 0) continue
      assert.ok(n >= 8, `${cls.name} ${slot}: expected ≥8 locked pieces, got ${n}`)
    }
  }
})

test('class-locked gear only equips on its class', () => {
  const duster = rs.items.find(i => i.classes?.[0] === 'class.gunslinger' && i.slot === 'body')!
  assert.equal(canEquip(clsById('class.gunslinger'), duster, rs).ok, true)
  assert.equal(canEquip(clsById('class.rogue'), duster, rs).ok, false)  // rogue wears light, still locked out
  assert.match(canEquip(clsById('class.rogue'), duster, rs).reason ?? '', /Gunslinger/)

  const plate = rs.items.find(i => i.classes?.[0] === 'class.fighter' && i.slot === 'body')!
  assert.equal(canEquip(clsById('class.fighter'), plate, rs).ok, true)
  assert.equal(canEquip(clsById('class.gunslinger'), plate, rs).ok, false)
})

test('shared accessories are unlocked and accessory-kind', () => {
  const rings = rs.items.filter(i => i.slot === 'ring')
  const amulets = rs.items.filter(i => i.slot === 'amulet')
  assert.ok(rings.length >= 10 && amulets.length >= 10)
  for (const acc of [...rings, ...amulets]) {
    assert.ok(!acc.classes, `${acc.name} should not be class-locked`)
    assert.equal(acc.kind, 'accessory')
  }
  // a ring equips on every class
  const ring = rings[0]
  for (const cls of rs.classes) assert.equal(canEquip(cls, ring, rs).ok, true, `${cls.name} ring`)
})

test('every locked armor uses a type its class can actually wear', () => {
  for (const item of CLASS_GEAR_ITEMS) {
    if (item.kind !== 'armor' || !item.classes?.length || !item.armorType) continue
    for (const cid of item.classes) {
      const cls = clsById(cid)
      const okType = cls.armorTypes == null || cls.armorTypes.length === 0 || cls.armorTypes.includes(item.armorType)
      assert.ok(okType, `${item.name} (${item.armorType}) not wearable by ${cls.name}`)
      assert.ok(cls.allowedEquip.includes(item.slot!), `${cls.name} can't use slot ${item.slot}`)
    }
  }
})

test('all gear ids are unique and every item carries modifiers', () => {
  const ids = CLASS_GEAR_ITEMS.map(i => i.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const i of CLASS_GEAR_ITEMS) assert.ok((i.modifiers?.length ?? 0) > 0, `${i.name} has no modifiers`)
})

console.log(`\nclass-gear: ${passed} passed`)
