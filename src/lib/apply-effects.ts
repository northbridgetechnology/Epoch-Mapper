/**
 * Out-of-combat effect resolver (Phase E2 subset).
 *
 * Handles the verbs available in Phase E2: heal, restoreMp, giveItem.
 * Runs purely on arrays — no DOM, no React.
 */

import type { Character, Effect, ItemDef, ItemInstance, Ruleset } from './engine-types'

/** Result of applying an out-of-combat effect to the party. */
export interface ApplyResult {
  party: Character[]
  inventory: ItemInstance[]
  messages: string[]
}

function rollDice(dice: number | string, rng = Math.random): number {
  if (typeof dice === 'number') return dice
  // "2d6", "1d8+2", "10"
  const m = String(dice).match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!m) { const n = parseInt(dice, 10); return isNaN(n) ? 0 : n }
  let total = 0
  const count = parseInt(m[1], 10)
  const sides = parseInt(m[2], 10)
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1
  if (m[3]) total += parseInt(m[3], 10)
  return Math.max(0, total)
}

function giveItems(
  inventory: ItemInstance[],
  itemId: string,
  qty: number,
  ruleset: Ruleset,
): ItemInstance[] {
  const def = ruleset.items.find(i => i.id === itemId)
  if (!def) return inventory
  const existing = inventory.find(i => i.def === itemId)
  if (existing && def.stackable) {
    return inventory.map(i => i.def === itemId ? { ...i, qty: i.qty + qty } : i)
  }
  return [...inventory, { def: itemId, qty }]
}

function removeItems(
  inventory: ItemInstance[],
  itemId: string,
  qty: number,
): ItemInstance[] {
  return inventory
    .map(i => i.def === itemId ? { ...i, qty: i.qty - qty } : i)
    .filter(i => i.qty > 0)
}

/**
 * Apply a single out-of-combat effect to one target character.
 * Returns updated party + inventory + a message string.
 */
export function applyEffectToChar(
  effect: Effect,
  targetIdx: number,
  party: Character[],
  inventory: ItemInstance[],
  ruleset: Ruleset,
): ApplyResult {
  const msgs: string[] = []
  let newParty = [...party]
  let newInv = inventory

  const target = party[targetIdx]
  if (!target || !target.alive) return { party, inventory, messages: [] }

  if (effect.t === 'heal') {
    const amount = rollDice(effect.amount)
    const healed = Math.min(target.maxHp, target.hp + amount)
    newParty = newParty.map((c, i) => i === targetIdx ? { ...c, hp: healed } : c)
    msgs.push(`${target.name} restored ${healed - target.hp} HP`)
  } else if (effect.t === 'restoreMp') {
    const amount = rollDice(effect.amount)
    const restored = Math.min(target.maxMp, target.mp + amount)
    newParty = newParty.map((c, i) => i === targetIdx ? { ...c, mp: restored } : c)
    msgs.push(`${target.name} restored ${restored - target.mp} MP`)
  } else if (effect.t === 'fullHeal') {
    newParty = newParty.map((c, i) =>
      i === targetIdx ? { ...c, hp: c.maxHp, mp: c.maxMp } : c,
    )
    msgs.push(`${target.name} fully restored`)
  } else if (effect.t === 'giveItem') {
    newInv = giveItems(newInv, effect.item, effect.qty ?? 1, ruleset)
    const def = ruleset.items.find(d => d.id === effect.item)
    msgs.push(`Received ${def?.name ?? effect.item} ×${effect.qty ?? 1}`)
  } else if (effect.t === 'gold') {
    // handled at the caller level (needs gold state)
    msgs.push(`Received ${effect.amount} gold`)
  } else if (effect.t === 'message') {
    msgs.push(effect.text)
  } else if (effect.t === 'teachSpell') {
    const spell = ruleset.spells.find(s => s.id === effect.spell)
    if (spell && !target.knownSpells.includes(effect.spell)) {
      const cls = ruleset.classes.find(c => c.id === target.classId)
      if (!cls || cls.spellSchools.length === 0 || cls.spellSchools.includes(spell.school)) {
        newParty = newParty.map((c, i) => i === targetIdx ? { ...c, knownSpells: [...c.knownSpells, effect.spell] } : c)
        msgs.push(`${target.name} learns ${spell.name}!`)
      } else {
        msgs.push(`${target.name} cannot grasp ${spell.name}.`)
      }
    }
  }

  return { party: newParty, inventory: newInv, messages: msgs }
}

/**
 * Use a consumable item from the shared inventory on a target character.
 * Returns updated state or null if the item can't be used.
 */
export function applyConsumable(
  itemId: string,
  targetIdx: number,
  party: Character[],
  inventory: ItemInstance[],
  ruleset: Ruleset,
): ApplyResult | null {
  const def: ItemDef | undefined = ruleset.items.find(i => i.id === itemId)
  if (!def || def.kind !== 'consumable' || !def.onUse?.length) return null

  const instance = inventory.find(i => i.def === itemId)
  if (!instance || instance.qty < 1) return null

  let currentParty = party
  let currentInv = inventory
  const allMessages: string[] = []

  for (const effect of def.onUse) {
    const result = applyEffectToChar(effect, targetIdx, currentParty, currentInv, ruleset)
    currentParty = result.party
    currentInv = result.inventory
    allMessages.push(...result.messages)
  }

  // Consume one from inventory
  currentInv = removeItems(currentInv, itemId, 1)

  return { party: currentParty, inventory: currentInv, messages: allMessages }
}
