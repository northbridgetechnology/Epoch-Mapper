/**
 * Equip proficiency — the single gate that decides whether a class may equip an
 * item. FF-style rules: allowed slot, plus per-type proficiency for weapons
 * (WeaponTypeDef) and armor (ArmorTypeDef). Weight lives on the type, so weight
 * proficiency is expressed by which types a class lists. Accessories and any
 * untyped equippable are unrestricted. Pure; used by every equip surface.
 */

import type { ClassDef, ItemDef, ItemInstance, ItemSlot, Ruleset } from './engine-types'

export interface EquipCheck {
  ok: boolean
  /** Short, player-facing reason when ok is false (for grey-out tooltips). */
  reason?: string
}

export function canEquip(
  cls: ClassDef | undefined,
  def: ItemDef | undefined,
  ruleset?: Ruleset,
  /** The character's current equipment — enables the two-handed hand check. */
  equipment?: Partial<Record<ItemSlot, ItemInstance>>,
): EquipCheck {
  if (!def || !def.slot) return { ok: false, reason: 'Not equippable' }

  // Two-handed weapons claim the off-hand: a 2H weapon can't join an occupied
  // off-hand, and nothing fits the off-hand while a 2H weapon is wielded.
  if (equipment) {
    if (def.kind === 'weapon' && def.twoHanded && equipment.offhand) {
      return { ok: false, reason: `${def.name} needs both hands — free the off-hand first` }
    }
    if (def.slot === 'offhand' && equipment.weapon && ruleset) {
      const held = ruleset.items.find(i => i.id === equipment.weapon!.def)
      if (held?.twoHanded) return { ok: false, reason: `Hands are full — ${held.name} is two-handed` }
    }
  }

  if (!cls) return { ok: true }

  if (!cls.allowedEquip.includes(def.slot)) {
    return { ok: false, reason: `${cls.name} can't use that slot` }
  }

  // Weapon-type proficiency (e.g. a Mage isn't trained with greatswords).
  if (def.kind === 'weapon' && def.weaponType && cls.weaponTypes && cls.weaponTypes.length > 0 && !cls.weaponTypes.includes(def.weaponType)) {
    const typeName = ruleset?.weaponTypes.find(t => t.id === def.weaponType)?.name ?? 'that weapon'
    return { ok: false, reason: `${cls.name} can't wield ${typeName}` }
  }

  // Armor-type proficiency (e.g. a Mage can't wear plate).
  if (def.kind === 'armor' && def.armorType && cls.armorTypes && cls.armorTypes.length > 0 && !cls.armorTypes.includes(def.armorType)) {
    const typeName = ruleset?.armorTypes.find(t => t.id === def.armorType)?.name ?? 'that armor'
    return { ok: false, reason: `${cls.name} can't wear ${typeName}` }
  }

  return { ok: true }
}
