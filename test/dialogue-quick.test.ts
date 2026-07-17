/**
 * Quick-mode dialogue ↔ DialogueDef round-tripping and shape detection.
 * Run with:  tsx test/dialogue-quick.test.ts
 */

import assert from 'node:assert/strict'
import { toQuick, fromQuick, isQuickShaped, EMPTY_QUICK } from '../src/lib/dialogue-quick'
import type { QuickModel } from '../src/lib/dialogue-quick'
import type { DialogueDef, Effect } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

/** fromQuick(toQuick(def)) should reproduce the def for quick-shaped input. */
function roundtrips(model: QuickModel) {
  const def = fromQuick(model, 'dlg.t', 'T')
  const back = toQuick(def)
  assert.ok(back, 'expected quick-shaped')
  assert.deepEqual(fromQuick(back!, 'dlg.t', 'T'), def)
}

test('lines-only: talks, no choices', () => {
  const def = fromQuick({ lines: ['Hello.', 'Welcome.'], action: null }, 'dlg.a', 'A')
  assert.equal(def.start, 'greet')
  assert.equal(def.nodes.length, 1)
  assert.deepEqual(def.nodes[0].text, ['Hello.', 'Welcome.'])
  assert.ok(!def.nodes[0].choices)
  const q = toQuick(def)!
  assert.deepEqual(q.lines, ['Hello.', 'Welcome.'])
  assert.equal(q.action, null)
})

test('empty model yields a placeholder page', () => {
  const def = fromQuick(EMPTY_QUICK, 'dlg.e', 'E')
  assert.deepEqual(def.nodes[0].text, ['…'])
})

test('offer with recruit effect + both replies', () => {
  const effect: Effect = { t: 'recruit', npc: 'npc.sage' }
  const model: QuickModel = {
    lines: ['Will you join me?'],
    action: { label: 'I will', effect, reply: 'Then we ride.', declineLabel: 'Not now', declineReply: 'Another time.' },
  }
  const def = fromQuick(model, 'dlg.r', 'R')
  // greet + accept + decline
  assert.deepEqual(def.nodes.map(n => n.id), ['greet', 'accept', 'decline'])
  const choices = def.nodes[0].choices!
  assert.equal(choices.length, 2)
  assert.deepEqual(choices[0], { label: 'I will', effects: [effect], goto: 'accept' })
  assert.deepEqual(choices[1], { label: 'Not now', goto: 'decline' })
  roundtrips(model)
})

test('offer with effect but no replies ends after the choice', () => {
  const model: QuickModel = {
    lines: ['Here.'],
    action: { label: 'Take gold', effect: { t: 'gold', amount: 50 }, reply: '', declineLabel: 'No', declineReply: '' },
  }
  const def = fromQuick(model, 'dlg.g', 'G')
  assert.deepEqual(def.nodes.map(n => n.id), ['greet'])
  assert.ok(!def.nodes[0].choices![0].goto)
  roundtrips(model)
})

test('offer with a reply but no effect (pure branch)', () => {
  const model: QuickModel = {
    lines: ['Ask me anything.'],
    action: { label: 'Tell me more', effect: null, reply: 'It is a long story…', declineLabel: 'Maybe later', declineReply: '' },
  }
  const def = fromQuick(model, 'dlg.p', 'P')
  assert.ok(!def.nodes[0].choices![0].effects)
  assert.equal(def.nodes[0].choices![0].goto, 'accept')
  roundtrips(model)
})

test('NOT quick: a choice condition', () => {
  const def: DialogueDef = {
    id: 'dlg.c', name: 'C', start: 'greet',
    nodes: [{ id: 'greet', text: ['Hi'], choices: [{ label: 'x', conditions: [{ c: 'flag', flag: 'f', equals: true }] }] }],
  }
  assert.equal(toQuick(def), null)
  assert.equal(isQuickShaped(def), false)
})

test('NOT quick: on-enter effects on the start node', () => {
  const def: DialogueDef = {
    id: 'dlg.o', name: 'O', start: 'greet',
    nodes: [{ id: 'greet', text: ['Hi'], effects: [{ t: 'gold', amount: 1 }] }],
  }
  assert.equal(toQuick(def), null)
})

test('NOT quick: an accept branch that itself branches', () => {
  const def: DialogueDef = {
    id: 'dlg.d', name: 'D', start: 'greet',
    nodes: [
      { id: 'greet', text: ['Hi'], choices: [{ label: 'go', goto: 'mid' }] },
      { id: 'mid', text: ['more'], choices: [{ label: 'again', goto: 'greet' }] },
    ],
  }
  assert.equal(toQuick(def), null)
})

test('NOT quick: an unsupported effect type', () => {
  const def: DialogueDef = {
    id: 'dlg.u', name: 'U', start: 'greet',
    nodes: [{ id: 'greet', text: ['Hi'], choices: [{ label: 'zap', effects: [{ t: 'damage', dmgType: 'fire', amount: '1d6' }] }] }],
  }
  assert.equal(toQuick(def), null)
})

test('NOT quick: three choices', () => {
  const def: DialogueDef = {
    id: 'dlg.3', name: '3', start: 'greet',
    nodes: [{ id: 'greet', text: ['Hi'], choices: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] }],
  }
  assert.equal(toQuick(def), null)
})

console.log(`\ndialogue-quick: ${passed} passed`)
