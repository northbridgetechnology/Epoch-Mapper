/**
 * Ammo system: weapon-type ammo categories, bows drawing from inventory,
 * firearms firing from a clip + reloading from reserve (optionally alongside a
 * non-firing skill), and battle-end reconciliation to the clip + inventory.
 * Run with:  tsx test/reload.test.ts
 */

import assert from 'node:assert/strict'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import { applyConsumable, applyEffectToChar } from '../src/lib/apply-effects'
import {
  resolvePlayerAttack, resolvePlayerReload, applyCombatOutcome, consumeCombatAmmo,
  reloadableRounds, isReloadCompatibleSkill, canUseSkill, resolvePlayerUseSkill,
} from '../src/lib/combat-engine'
import type { CombatState, CombatActor } from '../src/lib/combat-engine'
import type { Character, ItemInstance, Ruleset, SkillDef } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const ruleset: Ruleset = makeDefaultRuleset()

// ── seed integrity ──────────────────────────────────────────────────────────
test('bow/firearm weapon types declare an ammo category', () => {
  assert.equal(ruleset.weaponTypes.find(w => w.id === 'wtype.bow')!.ammoType, 'arrow')
  assert.equal(ruleset.weaponTypes.find(w => w.id === 'wtype.gun')!.ammoType, 'pistol_round')
  assert.equal(ruleset.weaponTypes.find(w => w.id === 'wtype.heavy_gun')!.ammoType, 'rifle_round')
})

test('guns hold a clip and no longer fire via onUse; ammo items are kind ammo', () => {
  const pistol = ruleset.items.find(i => i.id === 'item.pistol')!
  assert.equal(pistol.charges, 6)
  assert.ok(!pistol.onUse?.length, 'gun fires via basic attack, not onUse')
  const pa = ruleset.items.find(i => i.id === 'item.pistol_ammo')!
  assert.equal(pa.kind, 'ammo'); assert.equal(pa.ammoType, 'pistol_round'); assert.equal(pa.stackable, true)
  assert.equal(ruleset.items.find(i => i.id === 'item.arrows')!.ammoType, 'arrow')
})

// ── combat: firing consumes ammo, honours the count ──────────────────────────
function actor(ammo?: CombatActor['ammo']): CombatActor {
  return { kind: 'party', idx: 0, name: 'Roland', hp: 30, maxHp: 30, mp: 10, maxMp: 10,
    attack: 20, defense: 4, speed: 6, xp: 0, gold: 0, alive: true, statuses: [], rank: 0, ammo }
}
function enemy(): CombatActor {
  return { kind: 'enemy', idx: 0, name: 'Thug', hp: 200, maxHp: 200, mp: 0, maxMp: 0,
    attack: 6, defense: 2, speed: 5, xp: 10, gold: 5, alive: true, statuses: [], rank: 0 }
}
function state(a: CombatActor, reserve: Record<string, number> = {}): CombatState {
  return { actors: [a, enemy()], turnIdx: 0, phase: 'player_action', log: [], fleeAttempts: 0,
    xpReward: 0, goldReward: 0, itemsUsed: {}, rngState: 999, events: [], eventSeq: 0, drops: [],
    round: 1, ammoReserve: reserve, ammoUsed: {} }
}

// Each attack advances the turn; reset to the player's turn to fire again.
const myTurn = (st: CombatState): CombatState => ({ ...st, turnIdx: 0, phase: 'player_action' })

test('firearm attack spends a clip round; empty clip blocks the attack', () => {
  let st = state(actor({ type: 'pistol_round', clipSize: 6, loaded: 1 }))
  st = myTurn(resolvePlayerAttack(st, 1, ruleset, () => 0.5))
  assert.equal(st.actors[0].ammo!.loaded, 0)
  const after = resolvePlayerAttack(st, 1, ruleset, () => 0.5)
  assert.equal(after, st, 'no ammo → attack blocked')
})

test('bow attack draws from the shared reserve; empty reserve blocks it', () => {
  let st = state(actor({ type: 'arrow', clipSize: 0, loaded: 0 }), { arrow: 2 })
  st = myTurn(resolvePlayerAttack(st, 1, ruleset, () => 0.5))
  assert.equal(st.ammoUsed!.arrow, 1)
  st = myTurn(resolvePlayerAttack(st, 1, ruleset, () => 0.5))
  assert.equal(st.ammoUsed!.arrow, 2)               // reserve 2 fully drawn
  const blocked = resolvePlayerAttack(st, 1, ruleset, () => 0.5)
  assert.equal(blocked, st, 'no arrows left → blocked')
})

// ── reload ───────────────────────────────────────────────────────────────────
test('reload moves reserve into the clip, capped by clip size and reserve', () => {
  const st = state(actor({ type: 'pistol_round', clipSize: 6, loaded: 2 }), { pistol_round: 10 })
  assert.equal(reloadableRounds(st, st.actors[0]), 4) // 6-2, plenty of reserve
  const r = resolvePlayerReload(st, ruleset)
  assert.equal(r.actors[0].ammo!.loaded, 6)
  assert.equal(r.ammoUsed!.pistol_round, 4)
})

test('reload can pair a non-firing skill; damage skills are rejected as pairs', () => {
  const buff: SkillDef = { id: 'sk.brace', name: 'Brace', effects: [{ t: 'status', status: 'status.guard', chance: 1 }], target: 'self' }
  const shoot: SkillDef = { id: 'sk.shoot', name: 'Aimed Shot', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6' }], target: 'enemy' }
  assert.equal(isReloadCompatibleSkill(buff), true)
  assert.equal(isReloadCompatibleSkill(shoot), false)
  const rs: Ruleset = { ...ruleset, skills: [...(ruleset.skills ?? []), buff] }
  const st = state(actor({ type: 'pistol_round', clipSize: 6, loaded: 0 }), { pistol_round: 6 })
  const r = resolvePlayerReload(st, rs, { skillId: 'sk.brace' })
  assert.equal(r.actors[0].ammo!.loaded, 6)
  assert.match(r.log.map(l => l.text).join(' '), /reloads.*Brace/s)
})

// ── battle-end reconciliation ────────────────────────────────────────────────
test('clip persists to the equipped weapon; reserve draw leaves the inventory', () => {
  const char: Character = {
    id: 'c1', name: 'Roland', classId: 'class.gunslinger', raceId: ruleset.races[0].id,
    level: 3, xp: 0, attributes: {}, hp: 30, maxHp: 30, mp: 0, maxMp: 0,
    equipment: { weapon: { def: 'item.pistol', qty: 1, charges: 6 } }, knownSpells: [], statuses: [], alive: true,
  }
  // fired 4, reloaded 4 back → loaded 6 but 4 drawn from reserve
  const st = state(actor({ type: 'pistol_round', clipSize: 6, loaded: 2 }), { pistol_round: 10 })
  st.ammoUsed = { pistol_round: 4 }
  const { party } = applyCombatOutcome([char], st, ruleset)
  assert.equal(party[0].equipment.weapon!.charges, 2)       // clip snapshot
  const inv = consumeCombatAmmo([{ def: 'item.pistol_ammo', qty: 10 }], st, ruleset)
  assert.equal(inv.find(i => i.def === 'item.pistol_ammo')!.qty, 6) // 10 - 4
})

// ── out of combat reload ─────────────────────────────────────────────────────
test('out-of-combat reload pulls rounds from inventory into the clip', () => {
  const party: Character[] = [{
    id: 'c1', name: 'Roland', classId: 'class.gunslinger', raceId: ruleset.races[0].id,
    level: 3, xp: 0, attributes: {}, hp: 30, maxHp: 30, mp: 0, maxMp: 0,
    equipment: { weapon: { def: 'item.pistol', qty: 1, charges: 1 } }, knownSpells: [], statuses: [], alive: true,
  }]
  const inv: ItemInstance[] = [{ def: 'item.pistol_ammo', qty: 3 }]
  const { party: p, inventory } = applyEffectToChar({ t: 'reload' }, 0, party, inv, ruleset)
  assert.equal(p[0].equipment.weapon!.charges, 4)                 // 1 + 3
  assert.equal(inventory.find(i => i.def === 'item.pistol_ammo'), undefined) // all 3 spent
})

test('a full clip with a fresh box: applyConsumable path reloads and spends ammo', () => {
  const party: Character[] = [{
    id: 'c1', name: 'Roland', classId: 'class.gunslinger', raceId: ruleset.races[0].id,
    level: 3, xp: 0, attributes: {}, hp: 30, maxHp: 30, mp: 0, maxMp: 0,
    equipment: { weapon: { def: 'item.pistol', qty: 1, charges: 0 } }, knownSpells: [], statuses: [], alive: true,
  }]
  // a "field reload" consumable that runs the reload effect
  const rs: Ruleset = { ...ruleset, items: [...ruleset.items, { id: 'item.reload_kit', name: 'Reload', kind: 'consumable', value: 0, stackable: true, onUse: [{ t: 'reload' }] }] }
  const inv: ItemInstance[] = [{ def: 'item.reload_kit', qty: 1 }, { def: 'item.pistol_ammo', qty: 10 }]
  const res = applyConsumable('item.reload_kit', 0, party, inv, rs)!
  assert.equal(res.party[0].equipment.weapon!.charges, 6)        // filled to clip
  assert.equal(res.inventory.find(i => i.def === 'item.pistol_ammo')!.qty, 4) // 10 - 6
})

// ── skill ammo cost (the per-skill toggle) ───────────────────────────────────
const gunSkill: SkillDef = { id: 'sk.burst', name: 'Burst', ammoCost: 2, target: 'enemy',
  effects: [{ t: 'damage', dmgType: 'physical', amount: '1d4' }] }
const buffSkill: SkillDef = { id: 'sk.steady', name: 'Steady', target: 'self',
  effects: [{ t: 'status', status: 'status.charged' }] }
const rsWithSkills: Ruleset = { ...ruleset, skills: [...(ruleset.skills ?? []), gunSkill, buffSkill] }

test('a skill with ammoCost spends the clip and is gated when it can’t pay', () => {
  const st = state(actor({ type: 'pistol_round', clipSize: 6, loaded: 6 }))
  assert.equal(canUseSkill(st, gunSkill).ok, true)
  const r = resolvePlayerUseSkill(st, 'sk.burst', [1], rsWithSkills, () => 0.5)
  assert.equal(r.actors[0].ammo!.loaded, 4) // 6 - 2

  const low = state(actor({ type: 'pistol_round', clipSize: 6, loaded: 1 }))
  const gate = canUseSkill(low, gunSkill)
  assert.equal(gate.ok, false)
  assert.match(gate.reason ?? '', /ammo/i)
  assert.equal(resolvePlayerUseSkill(low, 'sk.burst', [1], rsWithSkills, () => 0.5), low) // blocked
})

test('an ammo skill requires a ranged weapon; a bow skill draws reserve', () => {
  const melee = state(actor(undefined))
  assert.equal(canUseSkill(melee, gunSkill).ok, false) // no ranged weapon
  const bow = state(actor({ type: 'arrow', clipSize: 0, loaded: 0 }), { arrow: 5 })
  const r = resolvePlayerUseSkill(bow, 'sk.burst', [1], rsWithSkills, () => 0.5)
  assert.equal(r.ammoUsed!.arrow, 2)
})

test('firing skills can’t pair with Reload; ammo-free buffs can', () => {
  assert.equal(isReloadCompatibleSkill(gunSkill), false)
  assert.equal(isReloadCompatibleSkill(buffSkill), true)
})

// ── seeded gunslinger kit ────────────────────────────────────────────────────
test('new gunslinger skills and statuses are seeded and ammo-tagged', () => {
  const byId = (id: string) => ruleset.skills!.find(s => s.id === id)
  assert.equal(byId('skill.fan_hammer')!.ammoCost, 3)
  assert.equal(byId('skill.kill_eye')!.ammoCost, 1)
  assert.ok(!byId('skill.gs_litany')!.ammoCost, 'the Litany is ammo-free (reload-pairable)')
  assert.equal(isReloadCompatibleSkill(byId('skill.palaver')!), true)
  assert.ok(!byId('skill.deadeye')!.ammoCost, 'existing skills left untouched — ammo is opt-in')
  for (const s of ['status.winged', 'status.marked', 'status.bleeding']) {
    assert.ok(ruleset.statusEffects.find(x => x.id === s), `${s} exists`)
  }
  // Every skill referenced by the new kit resolves to a real status.
  const gunslingerSkills = ruleset.skills!.filter(s => s.learn?.some(l => l.classId === 'class.gunslinger'))
  for (const sk of gunslingerSkills) {
    for (const e of sk.effects) {
      if (e.t === 'status' || e.t === 'cure') {
        const ref = e.t === 'status' ? e.status : e.status
        if (ref !== 'all') assert.ok(ruleset.statusEffects.find(x => x.id === ref), `${sk.id} → ${ref}`)
      }
    }
  }
})

console.log(`\nreload: ${passed} passed`)
