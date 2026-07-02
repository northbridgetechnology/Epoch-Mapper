/**
 * Tests for combat-engine Defend and Item actions.
 * Run with:  tsx test/combat.test.ts
 */

import assert from 'node:assert/strict'
import {
  initCombat,
  resolvePlayerAttack,
  resolvePlayerDefend,
  resolvePlayerUseItem,
  resolveEnemyTurn,
  consumeCombatItems,
  upcomingTurns,
  type CombatState,
} from '../src/lib/combat-engine'
import type { Character, ItemInstance, ResolvedEncounter, Ruleset } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ruleset = {
  items: [
    { id: 'item.potion', name: 'Potion', kind: 'consumable', onUse: [{ t: 'heal', amount: 10 }], value: 10, stackable: true },
    { id: 'item.bomb',   name: 'Bomb',   kind: 'consumable', onUse: [{ t: 'damage', amount: 8 }], value: 20, stackable: true },
    { id: 'item.sword',  name: 'Sword',  kind: 'weapon', value: 50, stackable: false },
  ],
  spells: [], statusEffects: [], enemies: [], encounterTables: [],
  lootTables: [], shops: [], attributes: [], classes: [], races: [],
  meta: { title: 'test' },
} as unknown as Ruleset

const hero = {
  id: 'c1', name: 'Hero', level: 1, hp: 20, maxHp: 30, mp: 5, maxMp: 5,
  alive: true, statuses: [], knownSpells: [],
  attributes: { might: 10, endurance: 10, agility: 20 },
} as unknown as Character

const encounter: ResolvedEncounter = {
  tableId: 'enc.test', tableName: 'Test Rats', goldReward: 0, xpReward: 0,
  enemies: [{ defId: 'enemy.rat', name: 'Rat', hp: 15, maxHp: 15, attack: 6, defense: 2, speed: 1, xp: 1, gold: 0 }],
}

// Hero (speed 20) always acts before the rat (speed 1) → actors[0] = hero
function freshState(): CombatState {
  return initCombat([hero], encounter)
}

// Constant rng: no miss (0.99 ≥ 0.05), no crit (0.99 ≥ 0.1), max variance
const rng = () => 0.99

// ── Defend ────────────────────────────────────────────────────────────────────

test('defend sets the flag, logs, and passes the turn to the enemy', () => {
  const s = resolvePlayerDefend(freshState(), ruleset, rng)
  assert.equal(s.actors[0].defending, true)
  assert.equal(s.phase, 'enemy_turn')
  assert.ok(s.log.some(e => e.text === 'Hero defends.'))
})

test('defend halves incoming physical damage', () => {
  // Rat vs hero: base = max(1, 6 - floor(5/2)) = 4; ×(1+0.297) → round = 5
  const plain = resolveEnemyTurn({ ...freshState(), turnIdx: 1, phase: 'enemy_turn' }, ruleset, rng)
  assert.equal(plain.actors[0].hp, 20 - 5)

  const guarded = resolveEnemyTurn(resolvePlayerDefend(freshState(), ruleset, rng), ruleset, rng)
  assert.equal(guarded.actors[0].hp, 20 - 2)  // floor(5/2) = 2
})

test('defending clears when the actor\'s next turn starts', () => {
  const afterEnemy = resolveEnemyTurn(resolvePlayerDefend(freshState(), ruleset, rng), ruleset, rng)
  assert.equal(afterEnemy.phase, 'player_action')
  assert.equal(afterEnemy.actors[0].defending, false)
})

// ── Items ─────────────────────────────────────────────────────────────────────

test('using a potion heals the target, records usage, and advances the turn', () => {
  const s = resolvePlayerUseItem(freshState(), 'item.potion', [0], ruleset, rng)
  assert.equal(s.actors[0].hp, 30)                    // 20 + 10 capped at max 30
  assert.equal(s.itemsUsed['item.potion'], 1)
  assert.equal(s.phase, 'enemy_turn')
  assert.ok(s.log.some(e => e.text === 'Hero uses Potion!'))
})

test('an offensive item damages an enemy target', () => {
  const s = resolvePlayerUseItem(freshState(), 'item.bomb', [1], ruleset, rng)
  assert.equal(s.actors[1].hp, 15 - 8)
  assert.equal(s.itemsUsed['item.bomb'], 1)
})

test('non-consumables and unknown items are rejected unchanged', () => {
  const s0 = freshState()
  assert.equal(resolvePlayerUseItem(s0, 'item.sword', [0], ruleset, rng), s0)
  assert.equal(resolvePlayerUseItem(s0, 'item.nope', [0], ruleset, rng), s0)
})

test('consumeCombatItems decrements quantities and drops empty stacks', () => {
  const inv: ItemInstance[] = [
    { def: 'item.potion', qty: 3 },
    { def: 'item.bomb', qty: 1 },
    { def: 'item.sword', qty: 1 },
  ]
  const state = { ...freshState(), itemsUsed: { 'item.potion': 2, 'item.bomb': 1 } }
  const after = consumeCombatItems(inv, state)
  assert.deepEqual(after, [
    { def: 'item.potion', qty: 1 },
    { def: 'item.sword', qty: 1 },
  ])
})

// ── Batch A: seeded RNG, ranks, events, turn preview ─────────────────────────

test('same seed + same actions → identical battles', () => {
  const run = () => {
    let s = initCombat([hero], encounter, { seed: 1234 })
    s = resolvePlayerAttack(s, 1, ruleset)     // no rng injected → seeded stream
    if (s.phase === 'enemy_turn') s = resolveEnemyTurn(s, ruleset)
    return s
  }
  const a = run(), b = run()
  assert.deepEqual(a.actors.map(x => x.hp), b.actors.map(x => x.hp))
  assert.equal(a.rngState, b.rngState)
})

test('back-rank melee is halved for attacker and defender', () => {
  const s0 = freshState()
  // Move the rat to the back rank: its melee on the front-row hero halves 5 → 2
  const backRat = {
    ...s0, turnIdx: 1, phase: 'enemy_turn' as const,
    actors: s0.actors.map((a, i) => (i === 1 ? { ...a, rank: 1 as const } : a)),
  }
  assert.equal(resolveEnemyTurn(backRat, ruleset, rng).actors[0].hp, 20 - 2)
  // Back-row hero takes half from a front-rank rat: 5 → 2
  const backHero = initCombat([hero], encounter, { formation: { front: [], back: [0] } })
  const s2 = resolveEnemyTurn({ ...backHero, turnIdx: 1, phase: 'enemy_turn' }, ruleset, rng)
  assert.equal(s2.actors[0].hp, 20 - 2)
})

test('formation places back-row members at rank 1', () => {
  const s = initCombat([hero], encounter, { formation: { front: [], back: [0] } })
  assert.equal(s.actors[0].rank, 1)
  assert.equal(freshState().actors[0].rank, 0)
})

test('enemies fill front-rank lanes centre-first', () => {
  const three: ResolvedEncounter = {
    ...encounter,
    enemies: [1, 2, 3, 4].map(n => ({ ...encounter.enemies[0], name: `Rat ${n}` })),
  }
  const s = initCombat([hero], three, {})
  const rats = s.actors.filter(a => a.kind === 'enemy')
  assert.deepEqual(rats.map(r => [r.rank, r.lane]), [[0, 1], [0, 0], [0, 2], [1, 1]])
})

test('actions publish feedback events with bumped sequence', () => {
  const s = resolvePlayerAttack(freshState(), 1, ruleset, rng)
  assert.equal(s.eventSeq, 1)
  assert.equal(s.events.length, 1)
  assert.equal(s.events[0].target, 1)
  assert.equal(s.events[0].kind, 'damage')
})

test('upcomingTurns previews turn order and skips the dead', () => {
  const s = freshState()
  assert.deepEqual(upcomingTurns(s, 4), [0, 1, 0, 1])
  const oneDead = { ...s, actors: s.actors.map((a, i) => (i === 1 ? { ...a, alive: false } : a)) }
  assert.deepEqual(upcomingTurns(oneDead, 3), [0, 0, 0])
})

console.log(`\n${passed} passed`)
