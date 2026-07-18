/**
 * Targeted revive: the `revive` effect brings a chosen fallen ally back (in and
 * out of combat), Bead/Recarm use it, and no ruleset effect references a status
 * that isn't defined.
 * Run with:  tsx test/revive.test.ts
 */

import assert from 'node:assert/strict'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import { applyEffectToChar, revivesTheDead } from '../src/lib/apply-effects'
import { resolvePlayerUseItem } from '../src/lib/combat-engine'
import type { CombatState, CombatActor } from '../src/lib/combat-engine'
import type { Character, Effect, Ruleset } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const rs: Ruleset = makeDefaultRuleset()

function member(over: Partial<Character>): Character {
  return {
    id: 'c', name: 'Ally', classId: rs.classes[0].id, raceId: rs.races[0].id,
    level: 5, xp: 0, attributes: {}, hp: 40, maxHp: 40, mp: 0, maxMp: 0,
    equipment: {}, knownSpells: [], statuses: [], alive: true, ...over,
  }
}

// ── content ───────────────────────────────────────────────────────────────────
test('Bead and Recarm use targeted revive, not reviveRandom', () => {
  assert.deepEqual(rs.items.find(i => i.id === 'item.bead')!.onUse, [{ t: 'revive', hpPercent: 0.5 }])
  assert.deepEqual(rs.spells.find(s => s.id === 'spell.recarm')!.effects, [{ t: 'revive', hpPercent: 0.5 }])
})

test('revivesTheDead flags revive and fullHeal, not a plain heal', () => {
  assert.equal(revivesTheDead([{ t: 'revive' }]), true)
  assert.equal(revivesTheDead([{ t: 'fullHeal' }]), true)
  assert.equal(revivesTheDead([{ t: 'heal', amount: 10 }]), false)
  assert.equal(revivesTheDead(undefined), false)
})

// ── out of combat ───────────────────────────────────────────────────────────
test('out-of-combat revive raises the chosen fallen ally to half HP', () => {
  const party = [member({ alive: false, hp: 0, maxHp: 40 })]
  const { party: p, messages } = applyEffectToChar({ t: 'revive', hpPercent: 0.5 }, 0, party, [], rs)
  assert.equal(p[0].alive, true)
  assert.equal(p[0].hp, 20)
  assert.match(messages.join(' '), /revived/i)
})

test('reviving a living ally is a safe no-op', () => {
  const party = [member({ alive: true, hp: 30, maxHp: 40 })]
  const { party: p } = applyEffectToChar({ t: 'revive' }, 0, party, [], rs)
  assert.equal(p[0].hp, 30) // unchanged
})

test('a non-revive effect still refuses a dead target', () => {
  const party = [member({ alive: false, hp: 0 })]
  const { party: p } = applyEffectToChar({ t: 'heal', amount: 10 }, 0, party, [], rs)
  assert.equal(p[0].hp, 0) // heal doesn't touch the dead
})

// ── in combat ─────────────────────────────────────────────────────────────────
function actor(over: Partial<CombatActor>): CombatActor {
  return { kind: 'party', idx: 0, name: 'A', hp: 40, maxHp: 40, mp: 0, maxMp: 0,
    attack: 10, defense: 4, speed: 6, xp: 0, gold: 0, alive: true, statuses: [], rank: 0, ...over }
}
test('using a Bead in battle revives the targeted downed ally', () => {
  const st: CombatState = {
    actors: [actor({ idx: 0 }), actor({ idx: 1, name: 'Fallen', hp: 0, alive: false }),
             { kind: 'enemy', idx: 0, name: 'Foe', hp: 50, maxHp: 50, mp: 0, maxMp: 0, attack: 5, defense: 2, speed: 4, xp: 0, gold: 0, alive: true, statuses: [], rank: 0 }],
    turnIdx: 0, phase: 'player_action', log: [], fleeAttempts: 0, xpReward: 0, goldReward: 0,
    itemsUsed: {}, rngState: 42, events: [], eventSeq: 0, drops: [], round: 1,
  }
  const after = resolvePlayerUseItem(st, 'item.bead', [1], rs)
  const revived = after.actors[1]
  assert.equal(revived.alive, true)
  assert.equal(revived.hp, 20) // 50% of 40
  assert.equal(after.itemsUsed['item.bead'], 1)
})

// ── integrity ───────────────────────────────────────────────────────────────
test('no ruleset effect references a status effect that is not defined', () => {
  const ids = new Set(rs.statusEffects.map(s => s.id))
  const missing: string[] = []
  const scan = (effects: Effect[] | undefined, where: string) => {
    for (const e of effects ?? []) {
      if (e.t === 'status' && !ids.has(e.status)) missing.push(`${e.status} <- ${where}`)
      if (e.t === 'cure' && e.status !== 'all' && !ids.has(e.status)) missing.push(`${e.status} <- ${where}`)
    }
  }
  for (const it of rs.items) scan(it.onUse, `item ${it.id}`)
  for (const sp of rs.spells) scan(sp.effects, `spell ${sp.id}`)
  for (const sk of rs.skills ?? []) scan(sk.effects, `skill ${sk.id}`)
  for (const stt of rs.statusEffects) scan(stt.tickEffects, `status ${stt.id}`)
  for (const en of rs.enemies) for (const ab of en.abilities ?? []) scan(ab.effects, `enemy ${en.id}`)
  for (const ev of rs.events ?? []) scan(ev.effects, `event ${ev.id}`)
  assert.deepEqual(missing, [], `undefined status refs:\n${missing.join('\n')}`)
})

console.log(`\nrevive: ${passed} passed`)
