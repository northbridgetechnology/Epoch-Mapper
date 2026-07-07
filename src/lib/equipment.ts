/**
 * Equip proficiency — the single gate that decides whether a class may equip an
 * item. FF-style rules: allowed slot, weapon-type proficiency, and weight tier
 * (heavy/medium/light) for weapons and armor. Accessories (ring/amulet) and any
 * item without a weight are unrestricted. Pure; used by every equip surface.
 */

import type { ClassDef, ItemDef } from './engine-types'

export interface EquipCheck {
  ok: boolean
  /** Short, player-facing reason when ok is false (for grey-out tooltips). */
  reason?: string
}

export function canEquip(cls: ClassDef | undefined, def: ItemDef | undefined): EquipCheck {
  if (!def || !def.slot) return { ok: false, reason: 'Not equippable' }
  if (!cls) return { ok: true }

  if (!cls.allowedEquip.includes(def.slot)) {
    return { ok: false, reason: `${cls.name} can't use that slot` }
  }

  // Weapon-type proficiency (e.g. a Mage can't wield axes).
  if (def.kind === 'weapon' && def.weaponKind && cls.weaponKinds.length > 0 && !cls.weaponKinds.includes(def.weaponKind)) {
    return { ok: false, reason: `${cls.name} can't wield ${def.weaponKind}s` }
  }

  // Weight tier (heavy/medium/light) for weapons and armor.
  if (def.weight) {
    const allowed = def.kind === 'weapon' ? cls.weaponWeights : def.kind === 'armor' ? cls.armorWeights : undefined
    if (allowed && !allowed.includes(def.weight)) {
      return { ok: false, reason: `${cls.name} can't equip ${def.weight} ${def.kind === 'weapon' ? 'weapons' : 'armor'}` }
    }
  }

  return { ok: true }
}
