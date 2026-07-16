/**
 * Tests for switch-puzzle door logic (effectiveDoorState).
 * Run with:  tsx test/switches.test.ts
 */

import assert from 'node:assert/strict'
import { effectiveDoorState } from '../src/lib/event-engine'
import type { DoorDef } from '../src/lib/engine-types'

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

test('doors without flag requirements keep their stored state', () => {
  assert.equal(effectiveDoorState({ state: 'closed' }, {}), 'closed')
  assert.equal(effectiveDoorState({ state: 'locked', keyItem: 'item.key' }, {}), 'locked')
  assert.equal(effectiveDoorState({ state: 'open' }, {}), 'open')
})

test('switch door is sealed until ALL required flags are on', () => {
  const door: DoorDef = { state: 'closed', requiredFlags: ['switch.a', 'switch.b'] }
  assert.equal(effectiveDoorState(door, {}), 'locked')
  assert.equal(effectiveDoorState(door, { 'switch.a': true }), 'locked')
  assert.equal(effectiveDoorState(door, { 'switch.a': true, 'switch.b': true }), 'open')
})

test('toggle switches re-seal the door when flipped back off', () => {
  const door: DoorDef = { state: 'closed', requiredFlags: ['switch.a', 'switch.b'] }
  const open = { 'switch.a': true, 'switch.b': true }
  assert.equal(effectiveDoorState(door, open), 'open')
  assert.equal(effectiveDoorState(door, { ...open, 'switch.b': false }), 'locked')
})

test('key bypass (stored open) beats missing switch flags', () => {
  // A door opened permanently — by key or the author — stays open
  const door: DoorDef = { state: 'open', requiredFlags: ['switch.a'], keyItem: 'item.key' }
  assert.equal(effectiveDoorState(door, {}), 'open')
})

test('legacy keyFlag acts as a single required flag', () => {
  const door: DoorDef = { state: 'locked', keyFlag: 'lever.pulled' }
  assert.equal(effectiveDoorState(door, {}), 'locked')
  assert.equal(effectiveDoorState(door, { 'lever.pulled': true }), 'open')
})

test('falsy flag values (0, empty string, false) do not satisfy the lock', () => {
  const door: DoorDef = { state: 'closed', requiredFlags: ['switch.a'] }
  assert.equal(effectiveDoorState(door, { 'switch.a': false }), 'locked')
  assert.equal(effectiveDoorState(door, { 'switch.a': 0 }), 'locked')
  assert.equal(effectiveDoorState(door, { 'switch.a': '' }), 'locked')
  assert.equal(effectiveDoorState(door, { 'switch.a': 1 }), 'open')
})

console.log(`\n${passed} passed`)
