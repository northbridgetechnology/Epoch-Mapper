/**
 * Weapon charges (ammo) — that battle logic honours the remaining count, that
 * spent charges persist, and that the `reload` effect (Pistol/Rifle Ammo)
 * replenishes them both out of combat and in combat.
 * Run with:  tsx test/reload.test.ts
 */

import assert from 'node:assert/strict'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import { applyConsumable, applyEffectToChar } from '../src/lib/apply-effects'
import { resolvePlayerUseItem, applyCombatOutcome } from '../src/lib/combat-engine'
import type { CombatState } from '../src/lib/combat-engine'
import type { Character, ItemInstance, Ruleset } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const ruleset: Ruleset = makeDefaultRuleset()

function gunner(weapon: ItemInstance): Character {
  return {
    id: 'c1', name: 'Roland', classId: 'class.gunslinger', raceId: ruleset.races[0].id,
    level: 3, xp: 0, attributes: {}, hp: 30, maxHp: 30, mp: 0, maxMp: 0,
    equipment: { weapon }, knownSpells: [], statuses: [], alive: true,
  }
}

// ── seed integrity ──────────────────────────────────────────────────────────
test('seeded guns carry a clip (charges) and a Fire action (onUse)', () => {
  const pistol = ruleset.items.find(i => i.id === 'item.pistol')!
  const rifle = ruleset.items.find(i => i.id === 'item.assault_rifle')!
  assert.equal(pistol.charges, 6)
  assert.ok((pistol.onUse?.length ?? 0) > 0, 'pistol fires via onUse')
  assert.equal(rifle.charges, 5)
})

test('Pistol/Rifle Ammo are reload consumables typed to their firearm', () => {
  const pa = ruleset.items.find(i => i.id === 'item.pistol_ammo')!
  const ra = ruleset.items.find(i => i.id === 'item.rifle_ammo')!
  assert.equal(pa.kind, 'consumable'); assert.equal(pa.stackable, true)
  assert.deepEqual(pa.onUse, [{ t: 'reload', weaponType: 'wtype.gun' }])
  assert.deepEqual(ra.onUse, [{ t: 'reload', weaponType: 'wtype.heavy_gun' }])
})

// ── out-of-combat reload ─────────────────────────────────────────────────────
test('Pistol Ammo refills a spent pistol to a full clip', () => {
  const party = [gunner({ def: 'item.pistol', qty: 1, charges: 2 })]
  const inv: ItemInstance[] = [{ def: 'item.pistol_ammo', qty: 3 }]
  const res = applyConsumable('item.pistol_ammo', 0, party, inv, ruleset)!
  assert.equal(res.party[0].equipment.weapon!.charges, 6)      // 2 → 6 (max)
  assert.equal(res.inventory.find(i => i.def === 'item.pistol_ammo')!.qty, 2) // one box spent
})

test('reload caps at the weapon max and never overfills', () => {
  const party = [gunner({ def: 'item.pistol', qty: 1, charges: 6 })]
  const { party: p } = applyEffectToChar({ t: 'reload', weaponType: 'wtype.gun' }, 0, party, [], ruleset)
  assert.equal(p[0].equipment.weapon!.charges, 6)
})

test('reload amount adds a partial refill, capped', () => {
  const party = [gunner({ def: 'item.pistol', qty: 1, charges: 1 })]
  const { party: p } = applyEffectToChar({ t: 'reload', weaponType: 'wtype.gun', amount: 3 }, 0, party, [], ruleset)
  assert.equal(p[0].equipment.weapon!.charges, 4) // 1 + 3
})

test('wrong-type ammo will not reload (pistol ammo vs rifle)', () => {
  const party = [gunner({ def: 'item.assault_rifle', qty: 1, charges: 1 })]
  const { party: p, messages } = applyEffectToChar({ t: 'reload', weaponType: 'wtype.gun' }, 0, party, [], ruleset)
  assert.equal(p[0].equipment.weapon!.charges, 1) // unchanged
  assert.match(messages.join(' '), /doesn't fit|no reloadable/i)
})

// ── battle honours the remaining count + persists spend ───────────────────────
function baseState(actors: CombatState['actors']): CombatState {
  return {
    actors, turnIdx: 0, phase: 'player_action', log: [], fleeAttempts: 0, xpReward: 0, goldReward: 0,
    itemsUsed: {}, equipChargesUsed: {}, rngState: 12345, events: [], eventSeq: 0, drops: [], round: 1,
  }
}
function partyActor() {
  return { kind: 'party' as const, idx: 0, name: 'Roland', hp: 30, maxHp: 30, mp: 0, maxMp: 0,
    attack: 8, defense: 4, speed: 6, xp: 0, gold: 0, alive: true, statuses: [], rank: 0 as const }
}
function enemyActor() {
  return { kind: 'enemy' as const, idx: 0, name: 'Thug', hp: 40, maxHp: 40, mp: 0, maxMp: 0,
    attack: 6, defense: 2, speed: 5, xp: 10, gold: 5, alive: true, statuses: [], rank: 0 as const }
}

test('firing the equipped gun in battle spends one charge; it persists to the weapon', () => {
  let st = baseState([partyActor(), enemyActor()])
  st = resolvePlayerUseItem(st, 'item.pistol', [1], ruleset, undefined, { equipSlot: 'weapon' })
  assert.equal(st.equipChargesUsed!['0:weapon'], 1)
  // Apply to a party member holding a 6-round pistol → 5 left after one shot.
  const party = [gunner({ def: 'item.pistol', qty: 1, charges: 6 })]
  const { party: after } = applyCombatOutcome(party, st, ruleset)
  assert.equal(after[0].equipment.weapon!.charges, 5)
})

test('in-combat reload refunds fired charges; guarded when nothing was fired', () => {
  let st = baseState([partyActor(), enemyActor()])
  // fire twice
  st = resolvePlayerUseItem(st, 'item.pistol', [1], ruleset, undefined, { equipSlot: 'weapon' })
  st = resolvePlayerUseItem(st, 'item.pistol', [1], ruleset, undefined, { equipSlot: 'weapon' })
  assert.equal(st.equipChargesUsed!['0:weapon'], 2)
  // reload (full) → fired charges refunded
  st.turnIdx = 0
  const reloaded = resolvePlayerUseItem(st, 'item.pistol_ammo', [], ruleset)
  assert.equal(reloaded.equipChargesUsed!['0:weapon'], 0)
  assert.equal(reloaded.itemsUsed['item.pistol_ammo'], 1) // one box consumed
  // guard: reloading with nothing fired is a no-op (ammo not wasted)
  const fresh = baseState([partyActor(), enemyActor()])
  const noop = resolvePlayerUseItem(fresh, 'item.pistol_ammo', [], ruleset)
  assert.equal(noop.itemsUsed['item.pistol_ammo'] ?? 0, 0)
})

console.log(`\nreload: ${passed} passed`)
