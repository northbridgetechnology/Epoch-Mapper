/**
 * Codec coverage for the SFX system: AudioTrackDef.role, meta.sfxSlots, and a
 * per-object `sound` override must all survive the ruleset diff/patch layer and
 * the full .epochmap binary round-trip.
 * Run with:  tsx test/codec-sfx.test.ts
 */

import assert from 'node:assert/strict'
import { serializeDotEpochmap, parseDotEpochmap } from '../src/lib/epochmap-codec'
import { diffRuleset, patchRuleset } from '../src/lib/ruleset-diff'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import type { Ruleset } from '../src/lib/engine-types'
import type { EpochmapFile } from '../src/lib/types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

function ruleset(): Ruleset {
  const r = makeDefaultRuleset()
  // A custom uploaded SFX track + a re-skinned door event.
  r.audioTracks = [...r.audioTracks, { id: 'sfx.custom_door', name: 'Big Door', role: 'sfx', source: 'upload', loop: false, volume: 1 }]
  r.meta = { ...r.meta, sfxSlots: { ...(r.meta.sfxSlots ?? {}), door: 'sfx.custom_door' } }
  return r
}

function file(r: Ruleset): EpochmapFile {
  return {
    version: 3, gameTitle: 'T', romHash: '', customMarkers: [], ruleset: r,
    maps: [{
      id: 'm1', name: 'M', playerX: 0, playerY: 0, revealedChunks: [],
      cells: { '1,1': { base: 1, overlays: [], entities: [{ t: 'object', object: { kind: 'chest', id: 'c1', loot: 'loot.x', sound: 'sfx.custom_door' } }] } },
    }],
  } as EpochmapFile
}

test('default ruleset seeds SFX tracks and event slots', () => {
  const r = makeDefaultRuleset()
  assert.ok(r.audioTracks.some(t => t.id === 'sfx.door' && t.role === 'sfx'), 'built-in door SFX seeded')
  assert.equal(r.meta.sfxSlots?.door, 'sfx.door')
})

test('diff/patch preserves role, sfxSlots, and a custom SFX track', () => {
  const r = ruleset()
  const back = patchRuleset(diffRuleset(r))
  assert.deepEqual(back.audioTracks.find(t => t.id === 'sfx.custom_door'), r.audioTracks.find(t => t.id === 'sfx.custom_door'))
  assert.equal(back.meta.sfxSlots?.door, 'sfx.custom_door')
})

test('.epochmap round-trip preserves the SFX track and its role', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(file(ruleset())))
  const t = back.ruleset!.audioTracks.find(x => x.id === 'sfx.custom_door')
  assert.ok(t)
  assert.equal(t!.role, 'sfx')
})

test('.epochmap round-trip preserves meta.sfxSlots', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(file(ruleset())))
  assert.equal(back.ruleset!.meta.sfxSlots?.door, 'sfx.custom_door')
})

test('.epochmap round-trip preserves a per-object sound override', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(file(ruleset())))
  const ent = back.maps[0].cells['1,1'].entities?.[0]
  assert.ok(ent && ent.t === 'object')
  assert.equal((ent as { object: { sound?: string } }).object.sound, 'sfx.custom_door')
})

console.log(`\ncodec-sfx: ${passed} passed`)
