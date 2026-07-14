/**
 * Tests for bestiary duplicate / Make-Elite helpers.
 * Run with:  tsx test/bestiary.test.ts
 */

import assert from 'node:assert/strict'
import { duplicateEnemy, eliteEnemy } from '../src/lib/enemy-schema'
import type { EnemyDef } from '../src/lib/engine-types'

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

const goblin: EnemyDef = {
  id: 'enemy.goblin', name: 'Goblin', hp: 28, attack: 9, defense: 3, speed: 6,
  xp: 12, gold: { min: 3, max: 10 },
  resistances: { fire: -0.5 },
  abilities: [{ weight: 3, target: 'enemy', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6+1', canCrit: true }] }],
}

test('duplicateEnemy: fresh unique id, renamed, stats identical', () => {
  const copy = duplicateEnemy(goblin, ['enemy.goblin'])
  assert.equal(copy.id, 'enemy.goblin_copy')
  assert.equal(copy.name, 'Goblin (Copy)')
  assert.equal(copy.hp, goblin.hp)
  assert.equal(copy.attack, goblin.attack)
  assert.deepEqual(copy.abilities, goblin.abilities)
  assert.deepEqual(copy.resistances, goblin.resistances)
})

test('duplicateEnemy: id collisions get numbered suffixes', () => {
  const copy = duplicateEnemy(goblin, ['enemy.goblin', 'enemy.goblin_copy', 'enemy.goblin_copy2'])
  assert.equal(copy.id, 'enemy.goblin_copy3')
})

test('duplicateEnemy: deep copy — editing the copy never bleeds into the source', () => {
  const copy = duplicateEnemy(goblin, ['enemy.goblin'])
  copy.abilities![0].weight = 99
  copy.resistances!.fire = 1
  copy.gold.min = 999
  assert.equal(goblin.abilities![0].weight, 3)
  assert.equal(goblin.resistances!.fire, -0.5)
  assert.equal(goblin.gold.min, 3)
})

test('eliteEnemy: standard promotion multipliers, kit carried over', () => {
  const elite = eliteEnemy(goblin, ['enemy.goblin'])
  assert.equal(elite.id, 'enemy.goblin_elite')
  assert.equal(elite.name, 'Elite Goblin')
  assert.equal(elite.hp, 42)        // 28 × 1.5
  assert.equal(elite.attack, 11)    // 9 × 1.25 rounded
  assert.equal(elite.defense, 4)    // 3 × 1.25 rounded
  assert.equal(elite.xp, 24)        // ×2
  assert.deepEqual(elite.gold, { min: 6, max: 20 })
  assert.equal(elite.speed, goblin.speed)               // untouched
  assert.deepEqual(elite.abilities, goblin.abilities)   // kit unchanged
  assert.deepEqual(elite.resistances, goblin.resistances)
})

test('eliteEnemy: survives minimal defs (no gold/abilities/resistances)', () => {
  const bare = { id: 'enemy.blob', name: 'Blob', hp: 1, attack: 0, defense: 0, speed: 1, xp: 0, gold: { min: 0, max: 0 } } as EnemyDef
  const elite = eliteEnemy(bare, [])
  assert.equal(elite.hp, 2)         // 1 × 1.5 rounded, min 1
  assert.deepEqual(elite.gold, { min: 0, max: 0 })
  assert.equal(elite.abilities, undefined)
})

console.log(`\n${passed} bestiary tests passed`)
