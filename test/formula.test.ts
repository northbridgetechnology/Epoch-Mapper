/**
 * Safe formula evaluator + author-tunable XP curve.
 * Run with:  tsx test/formula.test.ts
 */

import assert from 'node:assert/strict'
import { evalFormula } from '../src/lib/formula'
import { xpToNextLevel } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

test('arithmetic, precedence, exponent, parens, functions', () => {
  assert.equal(evalFormula('2 + 3 * 4', {}), 14)
  assert.equal(evalFormula('(2 + 3) * 4', {}), 20)
  assert.equal(evalFormula('2 ^ 3 ^ 2', {}), 512)          // right-assoc
  assert.equal(evalFormula('-2 ^ 2', {}), -4)               // unary binds after ^ on base
  assert.equal(evalFormula('floor(7 / 2)', {}), 3)
  assert.equal(evalFormula('max(3, min(10, 5))', {}), 5)
  assert.equal(evalFormula('100 * level ^ 2', { level: 3 }), 900)
})

test('malformed / unknown formulas return undefined', () => {
  assert.equal(evalFormula('level +', { level: 1 }), undefined)
  assert.equal(evalFormula('unknownVar * 2', {}), undefined)
  assert.equal(evalFormula('alert(1)', {}), undefined)
  assert.equal(evalFormula('1 / 0', {}), undefined)         // non-finite
})

test('xpToNextLevel honors an override and falls back safely', () => {
  assert.equal(xpToNextLevel(4), Math.round(50 * Math.pow(4, 1.5)))
  assert.equal(xpToNextLevel(4, '100 * level'), 400)
  assert.equal(xpToNextLevel(4, 'garbage +'), Math.round(50 * Math.pow(4, 1.5)))
})

console.log(`\n${passed} formula tests passed`)
