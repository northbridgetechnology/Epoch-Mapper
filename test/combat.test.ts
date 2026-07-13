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
import { simulateEncounterTable } from '../src/lib/battle-sim'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
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

// ── Batch B: resistances, equipment, targeting AI, loot ──────────────────────

const fullRuleset = {
  ...ruleset,
  items: [
    ...(ruleset as unknown as { items: unknown[] }).items,
    { id: 'item.blade', name: 'Blade', kind: 'weapon', slot: 'weapon', value: 50, stackable: false,
      modifiers: [{ target: 'derived', key: 'attack', op: 'add', amount: 6 }] },
  ],
  enemies: [
    { id: 'enemy.rat', name: 'Rat', hp: 15, attack: 6, defense: 2, speed: 1, xp: 1,
      gold: { min: 0, max: 0 }, attributes: {}, resistances: { physical: -1 }, loot: 'loot.rat' },
  ],
  lootTables: [
    { id: 'loot.rat', name: 'Rat Loot', drops: [{ item: 'item.potion', qty: 2, chance: 1 }] },
  ],
} as unknown as Ruleset

test('physical weakness doubles basic attack damage', () => {
  // Hero attack 10 vs def 2 → base 9, ×1.297 → 12; weakness (resist -1) → 24
  const s = initCombat([hero], encounter, { ruleset: fullRuleset })
  const after = resolvePlayerAttack(s, 1, fullRuleset, rng)
  assert.equal(after.actors[1].hp, 0)                 // 24 ≥ 15 HP — obliterated
  assert.ok(after.events.some(e => e.kind === 'weak'))
  assert.ok(after.log.some(e => e.text.includes('weakness')))
})

test('equipment modifiers raise combat stats', () => {
  const armed = {
    ...hero,
    equipment: { weapon: { def: 'item.blade', qty: 1 } },
  } as unknown as Character
  const s = initCombat([armed], encounter, { ruleset: fullRuleset })
  assert.equal(s.actors[0].attack, 16)                // 10 base + 6 from blade
  const bare = initCombat([hero], encounter, { ruleset: fullRuleset })
  assert.equal(bare.actors[0].attack, 10)
})

test('weakest-first targeting hunts the lowest-HP member', () => {
  const healthy = { ...hero, id: 'c2', name: 'Tank', hp: 30 } as unknown as Character
  const hunter = {
    ...fullRuleset,
    enemies: [{ ...(fullRuleset.enemies[0] as object), resistances: undefined, targeting: 'weakest' }],
  } as unknown as Ruleset
  const s = initCombat([healthy, hero], encounter, { ruleset: hunter })
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolveEnemyTurn({ ...s, turnIdx: enemyIdx, phase: 'enemy_turn' }, hunter, rng)
  const tank = after.actors.find(a => a.name === 'Tank')!
  const weak = after.actors.find(a => a.name === 'Hero')!
  assert.equal(tank.hp, 30)                           // untouched
  assert.ok(weak.hp < 20)                             // 20 HP hero took the hit
})

test('victory rolls enemy loot tables into drops and gold', () => {
  const s = initCombat([hero], encounter, { ruleset: fullRuleset, seed: 7 })
  const after = resolvePlayerAttack(s, 1, fullRuleset, rng)   // weakness one-shot
  assert.equal(after.phase, 'victory')
  assert.deepEqual(after.drops, [{ item: 'item.potion', qty: 2 }])
})

// ── Batch C: tuning, boss ability gates, simulator ────────────────────────────

test('combatTuning overrides engine constants (defend multiplier)', () => {
  const ironWall = { ...fullRuleset, combatTuning: { defendMult: 0.1 } } as unknown as Ruleset
  const s = initCombat([hero], encounter, {})
  const guarded = resolveEnemyTurn(resolvePlayerDefend(s, ironWall, rng), ironWall, rng)
  // raw 5 → floor(5 × 0.1) clamped to 1 (vs 2 with the default 0.5)
  assert.equal(guarded.actors[0].hp, 20 - 1)
})

test('when-gated abilities unlock below the HP threshold', () => {
  const bossRules = {
    ...fullRuleset,
    enemies: [{
      id: 'enemy.rat', name: 'Rat', hp: 15, attack: 6, defense: 2, speed: 1, xp: 1,
      gold: { min: 0, max: 0 }, attributes: {},
      abilities: [{
        weight: 1, target: 'enemy',
        effects: [{ t: 'damage', dmgType: 'fire', amount: 99 }],
        when: { selfHpBelow: 0.5 },
      }],
    }],
  } as unknown as Ruleset

  // Full HP: gate closed → basic attack (hero takes 5, not 99)
  const healthy = initCombat([hero], encounter, { ruleset: bossRules })
  const t1 = resolveEnemyTurn({ ...healthy, turnIdx: 1, phase: 'enemy_turn' }, bossRules, rng)
  assert.equal(t1.actors[0].hp, 20 - 5)

  // Below half HP: enraged → fire ability fires for 99
  const bloodied = {
    ...healthy, turnIdx: 1, phase: 'enemy_turn' as const,
    actors: healthy.actors.map((a, i) => (i === 1 ? { ...a, hp: 5 } : a)),
  }
  const t2 = resolveEnemyTurn(bloodied, bossRules, rng)
  assert.equal(t2.actors[0].hp, 0)
  assert.equal(t2.phase, 'defeat')
})

test('round counter advances when the turn order wraps', () => {
  let s = freshState()
  assert.equal(s.round, 1)
  s = resolvePlayerAttack(s, 1, ruleset, () => 0.5)   // hero acts → rat's turn
  s = resolveEnemyTurn(s, ruleset, () => 0.5)         // rat acts → wraps to hero
  assert.equal(s.round, 2)
})

test('simulator reports a rout for an outmatched encounter table', () => {
  const simRules = {
    ...fullRuleset,
    enemies: [{ id: 'enemy.rat', name: 'Rat', hp: 5, attack: 1, defense: 0, speed: 1, xp: 1, gold: { min: 0, max: 0 }, attributes: {} }],
    encounterTables: [{ id: 'enc.rats', name: 'Rats', entries: [{ enemy: 'enemy.rat', min: 1, max: 2, weight: 1 }] }],
  } as unknown as Ruleset
  const res = simulateEncounterTable('enc.rats', simRules, { partySize: 4, level: 5, iterations: 50 })
  assert.ok(res)
  assert.equal(res!.runs, 50)
  assert.equal(res!.winRate, 1)          // level-5 party of 4 vs 1-2 weak rats
  assert.ok(res!.avgRounds >= 1)
  // Determinism: same config twice → identical result
  assert.deepEqual(res, simulateEncounterTable('enc.rats', simRules, { partySize: 4, level: 5, iterations: 50 }))
})

// ── Weapon/armor types feed combat ───────────────────────────────────────────

const typeRules = makeDefaultRuleset()

function heroWith(equipment: Record<string, { def: string; qty: number }>, attrs: Record<string, number>): Character {
  return {
    id: 'th', name: 'TypeHero', level: 1, hp: 30, maxHp: 30, mp: 0, maxMp: 0,
    classId: 'class.fighter', raceId: 'race.human',
    alive: true, statuses: [], knownSpells: [], equipment,
    attributes: attrs,
  } as unknown as Character
}

test('scalingAttr: a dagger scales attack off Agility, a sword off Might', () => {
  const attrs = { might: 8, agility: 18, endurance: 10 }
  const dagger = initCombat([heroWith({ weapon: { def: 'item.stiletto', qty: 1 } }, attrs)], encounter, { ruleset: typeRules })
  const sword  = initCombat([heroWith({ weapon: { def: 'item.longsword', qty: 1 } }, attrs)], encounter, { ruleset: typeRules })
  // stiletto (wtype.dagger → agility 18) out-scales longsword (wtype.sword → might 8)
  assert.ok(dagger.actors[0].attack > sword.actors[0].attack)
})

test('weaponRange + weaponDamageType are set on the actor from the weapon type', () => {
  const gun = initCombat([heroWith({ weapon: { def: 'item.pistol', qty: 1 } }, { agility: 12 })], encounter, { ruleset: typeRules })
  assert.equal(gun.actors[0].weaponRange, 'ranged')
  assert.equal(gun.actors[0].weaponDamageType, 'physical')
})

test('heavy armor applies its type speed penalty; a robe does not', () => {
  const attrs = { agility: 12, endurance: 10 }
  const plate = initCombat([heroWith({ body: { def: 'item.plate_armor', qty: 1 } }, attrs)], encounter, { ruleset: typeRules })
  const robe  = initCombat([heroWith({ body: { def: 'item.mage_robe',   qty: 1 } }, attrs)], encounter, { ruleset: typeRules })
  // atype.heavy speedMod -2; atype.robe none. Ignore item stat modifiers by
  // comparing the two relative to each other.
  assert.ok(plate.actors[0].speed < robe.actors[0].speed)
})

test('a fire weapon strikes a fire-weak enemy for extra damage', () => {
  // Override a weapon to deal fire, and give the EnemyDef a fire weakness
  // (actor resistances are sourced from ruleset.enemies, not the encounter).
  const rules = {
    ...typeRules,
    items: typeRules.items.map(i => i.id === 'item.longsword' ? { ...i, damageType: 'fire' } : i),
    enemies: [
      ...typeRules.enemies.filter(e => e.id !== 'enemy.emberrat'),
      { id: 'enemy.emberrat', name: 'Ember Rat', hp: 100, attack: 6, defense: 0, speed: 1, xp: 1, gold: { min: 0, max: 0 }, attributes: {}, resistances: { fire: -0.5 } },
    ],
  } as unknown as Ruleset
  const weakEnc: ResolvedEncounter = {
    ...encounter,
    enemies: [{ ...encounter.enemies[0], defId: 'enemy.emberrat', hp: 100, maxHp: 100, defense: 0 }],
  }
  const hero0 = heroWith({ weapon: { def: 'item.longsword', qty: 1 } }, { might: 14, agility: 20 })
  const s = initCombat([hero0], weakEnc, { ruleset: rules, seed: 3 })
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolvePlayerAttack(s, enemyIdx, rules, () => 0.5)
  assert.ok(after.events.some(e => e.kind === 'weak'), 'fire attack should register as a weakness hit')
})

// ── Combat modes: classic / oneMore / pressTurn ──────────────────────────────

const modeRules = {
  ...typeRules,
  enemies: [
    ...typeRules.enemies.filter(e => e.id !== 'enemy.weakling' && e.id !== 'enemy.tank'),
    { id: 'enemy.weakling', name: 'Weakling', hp: 300, attack: 1, defense: 0, speed: 1, xp: 1, gold: { min: 0, max: 0 }, attributes: {}, resistances: { physical: -0.5 } },
    { id: 'enemy.tank',     name: 'Tank',     hp: 300, attack: 1, defense: 0, speed: 1, xp: 1, gold: { min: 0, max: 0 }, attributes: {} },
  ],
} as unknown as Ruleset

function modeEnc(defId: string): ResolvedEncounter {
  return { tableId: 't', tableName: 't', goldReward: 0, xpReward: 0,
    enemies: [{ defId, name: defId, hp: 300, maxHp: 300, attack: 1, defense: 0, speed: 1, xp: 1, gold: 0 }] }
}
function twoFastHeroes(): Character[] {
  const mk = (id: string) => ({ ...heroWith({}, { might: 16, agility: 20, endurance: 10 }), id }) as Character
  return [mk('h1'), mk('h2')]
}
const fastRng = () => 0.5 // no miss (>=0.05), no crit (>=0.1)

test('classic mode: a weakness hit does not grant a bonus turn', () => {
  const s = initCombat(twoFastHeroes(), modeEnc('enemy.weakling'), { ruleset: modeRules, combatMode: 'classic', seed: 1 })
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolvePlayerAttack(s, enemyIdx, modeRules, fastRng)
  assert.notEqual(after.turnIdx, s.turnIdx)                       // turn advanced
  assert.ok(!after.log.some(l => l.text === 'One More!'))
  assert.equal(after.icons, undefined)                            // no icon economy
})

test('oneMore mode: a weakness hit lets the same actor act again', () => {
  const s = initCombat(twoFastHeroes(), modeEnc('enemy.weakling'), { ruleset: modeRules, combatMode: 'oneMore', seed: 1 })
  assert.equal(s.actors[s.turnIdx].kind, 'party')
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolvePlayerAttack(s, enemyIdx, modeRules, fastRng)
  assert.equal(after.turnIdx, s.turnIdx)                          // same actor
  assert.equal(after.phase, 'player_action')
  assert.ok(after.log.some(l => l.text === 'One More!'))
  assert.equal(after.oneMoreStreak, 1)
})

test('oneMore mode: a plain hit passes the turn normally', () => {
  const s = initCombat(twoFastHeroes(), modeEnc('enemy.tank'), { ruleset: modeRules, combatMode: 'oneMore', seed: 1 })
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolvePlayerAttack(s, enemyIdx, modeRules, fastRng)
  assert.notEqual(after.turnIdx, s.turnIdx)
  assert.ok(!after.log.some(l => l.text === 'One More!'))
})

test('pressTurn mode: initialises the acting side with one icon per member', () => {
  const s = initCombat(twoFastHeroes(), modeEnc('enemy.tank'), { ruleset: modeRules, combatMode: 'pressTurn', seed: 1 })
  assert.equal(s.activeSide, 'party')
  assert.deepEqual(s.icons, { full: 2, blink: 0 })
})

test('pressTurn mode: a weakness hit converts a full icon into a bonus (blink)', () => {
  const s = initCombat(twoFastHeroes(), modeEnc('enemy.weakling'), { ruleset: modeRules, combatMode: 'pressTurn', seed: 1 })
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolvePlayerAttack(s, enemyIdx, modeRules, fastRng)
  assert.deepEqual(after.icons, { full: 1, blink: 1 })           // total presses preserved (a bonus)
  assert.equal(after.activeSide, 'party')
  assert.equal(after.actors[after.turnIdx].kind, 'party')
  assert.ok(after.log.some(l => l.text === 'Press turn!'))
})

test('pressTurn mode: a plain hit spends one full icon', () => {
  const s = initCombat(twoFastHeroes(), modeEnc('enemy.tank'), { ruleset: modeRules, combatMode: 'pressTurn', seed: 1 })
  const enemyIdx = s.actors.findIndex(a => a.kind === 'enemy')
  const after = resolvePlayerAttack(s, enemyIdx, modeRules, fastRng)
  assert.deepEqual(after.icons, { full: 1, blink: 0 })
})

console.log(`\n${passed} passed`)
