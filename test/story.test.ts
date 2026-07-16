/**
 * Batch F — story & protagonist: text tokens, point-buy character builder,
 * portrait library.
 * Run with:  tsx test/story.test.ts
 */

import assert from 'node:assert/strict'
import { resolveText, resolveTextList } from '../src/lib/text-tokens'
import {
  emptyAlloc, attrScore, pointsSpent, pointsRemaining, canRaise, canLower,
  raise, lower, buildCharacter, pointPool,
} from '../src/lib/char-build'
import { portraitIds, portraitGrid, isBuiltinPortrait, suggestPortrait } from '../src/lib/portraits'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import type { Ruleset } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const ruleset: Ruleset = makeDefaultRuleset()

// ── Text tokens ───────────────────────────────────────────────────────────────

test('resolveText: name tokens and pronoun forms', () => {
  const mc = { name: 'Vela', pronoun: 'she' as const }
  assert.equal(resolveText('So you\'ve come, {mc}.', mc), 'So you\'ve come, Vela.')
  assert.equal(resolveText('{name} draws {their} blade.', mc), 'Vela draws her blade.')
  assert.equal(resolveText('{They} strike {them}.', mc), 'She strike her.') // subject/object caps
  assert.equal(resolveText('It is {theirs}.', mc), 'It is hers.')
})

test('resolveText: they/them default and reflexive', () => {
  const mc = { name: 'Rin', pronoun: 'they' as const }
  assert.equal(resolveText('{They} brace {themself}.', mc), 'They brace themself.')
  const noP = { name: 'Rin' }
  assert.equal(resolveText('{their} path', noP), 'their path', 'defaults to they/them without a pronoun')
})

test('resolveText: no MC leaves tokens untouched; unknown tokens pass through', () => {
  assert.equal(resolveText('Hello {mc}', null), 'Hello {mc}')
  assert.equal(resolveText('{unknown} {mc}', { name: 'Ada', pronoun: 'she' }), '{unknown} Ada')
  assert.equal(resolveTextList(['hi {name}', 'bye {name}'], { name: 'Ada' }).join('|'), 'hi Ada|bye Ada')
})

// ── Point-buy ─────────────────────────────────────────────────────────────────

test('point-buy: pool math and clamps', () => {
  const attr = ruleset.attributes[0]
  let alloc = emptyAlloc(ruleset)
  assert.equal(pointsSpent(alloc), 0)
  assert.equal(pointsRemaining(ruleset, alloc), pointPool(ruleset))
  assert.equal(attrScore(attr, alloc), attr.default)

  alloc = raise(alloc, attr.id)
  assert.equal(pointsSpent(alloc), 1)
  assert.equal(attrScore(attr, alloc), attr.default + 1)
  assert.ok(canLower(attr, alloc))

  alloc = lower(alloc, attr.id)
  assert.equal(pointsSpent(alloc), 0)
  assert.ok(!canLower(attr, alloc), 'cannot refund below default')
})

test('point-buy: cannot overspend the pool', () => {
  const attrs = ruleset.attributes
  let alloc = emptyAlloc(ruleset)
  // Spend the whole pool onto the first attribute (respecting its max)
  let guard = 0
  while (canRaise(ruleset, attrs[0], alloc) && guard++ < 999) alloc = raise(alloc, attrs[0].id)
  assert.ok(pointsSpent(alloc) <= pointPool(ruleset))
  // Once the pool is gone, no other attribute can rise
  if (pointsRemaining(ruleset, alloc) === 0) {
    assert.ok(!canRaise(ruleset, attrs[1], alloc), 'no points left → no raise elsewhere')
  }
})

test('point-buy: respects each attribute max', () => {
  const attr = ruleset.attributes[0]
  const rs: Ruleset = { ...ruleset, meta: { ...ruleset.meta, pointBuyPool: 999 } }
  let alloc = emptyAlloc(rs)
  let guard = 0
  while (canRaise(rs, attr, alloc) && guard++ < 9999) alloc = raise(alloc, attr.id)
  assert.equal(attrScore(attr, alloc), attr.max, 'clamps at the attribute max')
})

test('buildCharacter: allocation applied, then class/race mods; identity set', () => {
  const attr = ruleset.attributes[0]
  let alloc = emptyAlloc(ruleset)
  alloc = raise(raise(alloc, attr.id), attr.id) // +2 chosen
  const hero = buildCharacter(ruleset, {
    name: 'Kael', classId: ruleset.classes[0].id, raceId: ruleset.races[0].id,
    portrait: 'mage', pronoun: 'he', bio: 'A wanderer.', alloc,
  })
  assert.equal(hero.isMc, true)
  assert.equal(hero.portrait, 'mage')
  assert.equal(hero.pronoun, 'he')
  assert.equal(hero.bio, 'A wanderer.')
  assert.ok(hero.maxHp > 0 && hero.hp === hero.maxHp)
  // chosen base (default+2) plus whatever class/race mod, clamped to attr max
  const cls = ruleset.classes[0], race = ruleset.races[0]
  const short = attr.id.replace('attr.', '')
  const mod = (cls.attrModifiers[attr.id] ?? cls.attrModifiers[short] ?? 0)
    + (race.attrModifiers[attr.id] ?? race.attrModifiers[short] ?? 0)
  const base = Math.min(attr.max, Math.max(attr.min, attr.default + 2))
  const expected = Math.min(attr.max, Math.max(attr.min, base + mod))
  assert.equal(hero.attributes[attr.id], expected)
})

test('buildCharacter: default name falls back, not empty', () => {
  const hero = buildCharacter(ruleset, {
    name: '   ', classId: ruleset.classes[0].id, raceId: ruleset.races[0].id,
    pronoun: 'they', alloc: emptyAlloc(ruleset),
  })
  assert.ok(hero.name.trim().length > 0)
})

// ── Portraits ─────────────────────────────────────────────────────────────────

test('portraits: every built-in grid is a well-formed 12×12', () => {
  const ids = portraitIds()
  assert.ok(ids.length >= 6)
  for (const id of ids) {
    const g = portraitGrid(id)!
    assert.equal(g.grid.length, g.h, `${id} row count`)
    for (const row of g.grid) assert.equal(row.length, g.w, `${id} row width`)
  }
})

test('portraits: builtin detection and class suggestion', () => {
  assert.ok(isBuiltinPortrait('mage'))
  assert.ok(!isBuiltinPortrait('data:image/png;base64,xxx'))
  assert.ok(!isBuiltinPortrait(undefined))
  assert.equal(suggestPortrait('Wizard'), 'mage')
  assert.equal(suggestPortrait('Thief'), 'rogue')
  assert.ok(portraitIds().includes(suggestPortrait('something unmatched')), 'falls back to a real portrait')
})

console.log(`\n${passed} passed`)
