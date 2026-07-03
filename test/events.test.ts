/**
 * Tests for the event engine: sequential chaining, runEvent nesting,
 * questStage, and reactive onFlag expansion.
 * Run with:  tsx test/events.test.ts
 */

import assert from 'node:assert/strict'
import {
  runCellEvents,
  resolveExploreEffects,
  applyFlagWriteWithReactions,
  questStageFlagKey,
  visitedEventFlagKey,
  pickNpcLine,
  finishNpcLine,
  npcLineHeardFlagKey,
  type EventContext,
} from '../src/lib/event-engine'
import type { NpcDef } from '../src/lib/engine-types'
import type { CellData } from '../src/lib/types'
import type { CellEvent, Ruleset } from '../src/lib/engine-types'

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

const ctx = (flags: Record<string, boolean | number | string> = {}): EventContext => ({
  flags, party: [], inventory: [], gold: 0,
})

const cellWith = (...events: CellEvent[]): CellData => ({
  base: 1, overlays: [],
  entities: events.map(event => ({ t: 'event' as const, event })),
})

const ruleset = {
  events: [
    { id: 'ev.treasure', name: 'Grant treasure', effects: [{ t: 'gold', amount: 100 }], once: true },
    { id: 'ev.recurse', name: 'Recursive', effects: [{ t: 'runEvent', event: 'ev.recurse' }, { t: 'gold', amount: 1 }] },
    {
      id: 'ev.crypt_opens', name: 'Crypt opens', trigger: 'onFlag', once: true,
      conditions: [
        { c: 'flag', flag: 'switch.a', equals: true },
        { c: 'flag', flag: 'switch.b', equals: true },
      ],
      effects: [{ t: 'message', text: 'A grinding of stone echoes from the crypt.' }],
    },
  ],
  quests: [
    {
      id: 'q.crypt', name: 'The Sunken Crypt',
      stages: [
        { id: 's1', description: 'Find the crypt.' },
        { id: 's2', description: 'Open it.', effects: [{ t: 'gold', amount: 50 }] },
      ],
    },
  ],
  npcs: [], items: [], spells: [], statusEffects: [], enemies: [],
  encounterTables: [], lootTables: [], shops: [], attributes: [], classes: [], races: [],
} as unknown as Ruleset

// ── Sequential chaining ───────────────────────────────────────────────────────

test('later events see earlier events\' flag writes in the same step', () => {
  const cell = cellWith(
    { id: 'e1', trigger: 'onEnter', effects: [{ t: 'setFlag', flag: 'x', value: true }] },
    { id: 'e2', trigger: 'onEnter', conditions: [{ c: 'flag', flag: 'x', equals: true }], effects: [{ t: 'gold', amount: 5 }] },
  )
  const r = runCellEvents(cell, 'onEnter', ctx(), ruleset)
  assert.equal(r.goldDelta, 5)
})

test('once events fire a single time and are skipped after', () => {
  const ev: CellEvent = { id: 'e1', trigger: 'onEnter', once: true, effects: [{ t: 'gold', amount: 5 }] }
  const first = runCellEvents(cellWith(ev), 'onEnter', ctx(), ruleset)
  assert.equal(first.goldDelta, 5)
  assert.equal(first.flagSets[visitedEventFlagKey('e1')], true)
  const again = runCellEvents(cellWith(ev), 'onEnter', ctx({ [visitedEventFlagKey('e1')]: true }), ruleset)
  assert.equal(again.goldDelta, 0)
})

// ── runEvent ──────────────────────────────────────────────────────────────────

test('runEvent invokes a library event, honouring its once flag', () => {
  const effects = [{ t: 'runEvent', event: 'ev.treasure' } as const, { t: 'runEvent', event: 'ev.treasure' } as const]
  const r = resolveExploreEffects(effects, ctx(), Math.random, ruleset)
  assert.equal(r.goldDelta, 100)   // second call blocked by once
})

test('self-recursive runEvent terminates at the depth cap', () => {
  const r = resolveExploreEffects([{ t: 'runEvent', event: 'ev.recurse' }], ctx(), Math.random, ruleset)
  assert.ok(r.goldDelta >= 1 && r.goldDelta <= 9)   // capped, not infinite
})

// ── questStage ────────────────────────────────────────────────────────────────

test('questStage sets the stage flag, records the update, runs stage effects', () => {
  const r = resolveExploreEffects([{ t: 'questStage', quest: 'q.crypt', stage: 2 }], ctx(), Math.random, ruleset)
  assert.equal(r.flagSets[questStageFlagKey('q.crypt')], 2)
  assert.deepEqual(r.questUpdates, [{ quest: 'q.crypt', stage: 2 }])
  assert.equal(r.goldDelta, 50)   // stage 2 effects
})

test('quests never regress to an earlier stage', () => {
  const r = resolveExploreEffects(
    [{ t: 'questStage', quest: 'q.crypt', stage: 1 }],
    ctx({ [questStageFlagKey('q.crypt')]: 2 }), Math.random, ruleset,
  )
  assert.equal(r.questUpdates.length, 0)
  assert.equal(r.flagSets[questStageFlagKey('q.crypt')], undefined)
})

// ── Reactive onFlag ───────────────────────────────────────────────────────────

test('a flag write edge-triggers a global onFlag event when conditions newly pass', () => {
  // switch.a already on; throwing switch.b completes the pair
  const r = applyFlagWriteWithReactions('switch.b', true, null, ctx({ 'switch.a': true }), ruleset)
  assert.ok(r.messages.some(m => m.includes('grinding of stone')))
})

test('onFlag events do not fire when conditions were already passing', () => {
  const flags = { 'switch.a': true, 'switch.b': true }
  const r = applyFlagWriteWithReactions('unrelated', true, null, ctx(flags), ruleset)
  assert.equal(r.messages.length, 0)
})

// ── Single-slot collisions ────────────────────────────────────────────────────

test('first teleport wins when two events both teleport', () => {
  const cell = cellWith(
    { id: 't1', trigger: 'onEnter', effects: [{ t: 'teleport', mapId: 'm1', x: 1, y: 1 }] },
    { id: 't2', trigger: 'onEnter', effects: [{ t: 'teleport', mapId: 'm2', x: 9, y: 9 }] },
  )
  const r = runCellEvents(cell, 'onEnter', ctx(), ruleset)
  assert.equal(r.teleportTo?.mapId, 'm1')
})

// ── NPC lines ─────────────────────────────────────────────────────────────────

const guard: NpcDef = {
  id: 'npc.guard', name: 'Guard', lines: [
    { id: 'default', text: ['Move along.'] },
    { id: 'warn', text: ['The crypt is open?!', 'Fool.'], priority: 5,
      conditions: [{ c: 'flag', flag: 'crypt.open', equals: true }] },
    { id: 'secret', text: ['Take this.'], priority: 9, once: true,
      conditions: [{ c: 'flag', flag: 'crypt.open', equals: true }],
      effects: [{ t: 'gold', amount: 25 }] },
    { id: 'hail', text: ['Halt!'], bark: true, once: true },
  ],
} as NpcDef

test('pickNpcLine: highest passing priority wins, default as fallback', () => {
  assert.equal(pickNpcLine(guard, ctx())?.id, 'default')
  assert.equal(pickNpcLine(guard, ctx({ 'crypt.open': true }))?.id, 'secret')
  const heardSecret = ctx({ 'crypt.open': true, [npcLineHeardFlagKey('npc.guard', 'secret')]: true })
  assert.equal(pickNpcLine(guard, heardSecret)?.id, 'warn')   // once line spent → next priority
})

test('pickNpcLine: barks are picked separately from spoken lines', () => {
  assert.equal(pickNpcLine(guard, ctx(), { bark: true })?.id, 'hail')
  assert.equal(pickNpcLine(guard, ctx({ [npcLineHeardFlagKey('npc.guard', 'hail')]: true }), { bark: true }), null)
})

test('finishNpcLine marks the line heard and applies its effects', () => {
  const line = guard.lines.find(l => l.id === 'secret')!
  const r = finishNpcLine(guard, line, null, ctx({ 'crypt.open': true }), ruleset)
  assert.equal(r.flagSets[npcLineHeardFlagKey('npc.guard', 'secret')], true)
  assert.equal(r.goldDelta, 25)
})

console.log(`\n${passed} passed`)
