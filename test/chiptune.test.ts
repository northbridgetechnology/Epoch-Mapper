/**
 * Tests for the built-in chiptune library (composition layer — pure, no DOM).
 * Run with:  tsx test/chiptune.test.ts
 */

import assert from 'node:assert/strict'
import { CHIP_TRACKS, CHIP_BOSS_INTRO, composeChip, chipSpecById, isBuiltinTrackId, SFX_DEFS } from '../src/lib/chiptune'
import { DEFAULT_AUDIO_TRACKS, DEFAULT_MUSIC_SLOTS, makeDefaultRuleset, normalizeRuleset } from '../src/lib/default-ruleset'
import type { Ruleset } from '../src/lib/engine-types'

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

test('the library ships exactly 16 tracks plus the boss-intro stinger, unique ids', () => {
  assert.equal(CHIP_TRACKS.length, 16)
  const ids = [...CHIP_TRACKS, CHIP_BOSS_INTRO].map(t => t.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.ok(id.startsWith('chip.'), id)
})

test('every track composes into a valid score', () => {
  for (const spec of [...CHIP_TRACKS, CHIP_BOSS_INTRO]) {
    const score = composeChip(spec)
    assert.ok(score.duration > 2, `${spec.id}: loop too short (${score.duration}s)`)
    assert.ok(score.events.length >= spec.bars, `${spec.id}: too few events`)
    for (const ev of score.events) {
      assert.ok(Number.isFinite(ev.freq) && ev.freq > 20 && ev.freq < 8000, `${spec.id}: freq ${ev.freq}`)
      assert.ok(ev.dur > 0 && ev.gain > 0 && ev.gain <= 0.2, `${spec.id}: bad envelope`)
      assert.ok(ev.time >= 0 && ev.time < score.duration, `${spec.id}: event outside loop`)
    }
    for (const n of score.noise) {
      assert.ok(n.time >= 0 && n.time < score.duration && n.dur > 0, `${spec.id}: bad noise hit`)
    }
  }
})

test('composition is deterministic — same spec, same score', () => {
  const a = composeChip(CHIP_TRACKS[0])
  const b = composeChip(CHIP_TRACKS[0])
  assert.deepEqual(a, b)
})

test('spec lookup and builtin detection', () => {
  assert.equal(chipSpecById('chip.battle')?.name, 'Battle!')
  assert.ok(isBuiltinTrackId('chip.boss_intro'))
  assert.ok(!isBuiltinTrackId('my_upload'))
})

test('the SFX kit is well-formed', () => {
  assert.ok(Object.keys(SFX_DEFS).length >= 10)
  for (const [name, segs] of Object.entries(SFX_DEFS)) {
    assert.ok(segs.length > 0, name)
    for (const sg of segs) {
      assert.ok(sg.dur > 0 && sg.dur < 1, `${name}: seg duration`)
      assert.ok(sg.gain > 0 && sg.gain <= 0.2, `${name}: seg gain`)
    }
  }
})

test('fresh rulesets ship the library and a fully scored slot set', () => {
  const rs = makeDefaultRuleset()
  assert.equal(rs.audioTracks.length, 17)
  assert.ok(rs.audioTracks.every(t => t.source === 'builtin'))
  for (const [slot, id] of Object.entries(DEFAULT_MUSIC_SLOTS)) {
    assert.equal((rs.meta as unknown as Record<string, unknown>)[slot], id, slot)
    assert.ok(rs.audioTracks.some(t => t.id === id), `${slot} → ${id} resolves`)
  }
})

test('normalizeRuleset: silent drafts get the library + slots; authored audio untouched', () => {
  const silent = { ...makeDefaultRuleset(), audioTracks: [] as typeof DEFAULT_AUDIO_TRACKS }
  silent.meta = { ...silent.meta, defaultMusicId: undefined, battleMusicId: undefined, bossMusicId: undefined, titleMusicId: undefined, victoryMusicId: undefined, gameOverMusicId: undefined, bossIntroId: undefined }
  const healed = normalizeRuleset(silent as Ruleset)
  assert.equal(healed.audioTracks.length, 17)
  assert.equal(healed.meta.battleMusicId, 'chip.battle')

  const authored = makeDefaultRuleset()
  authored.audioTracks = [{ id: 'mine', name: 'Mine', source: 'upload', loop: true, volume: 1 }]
  authored.meta = { ...authored.meta, battleMusicId: 'mine' }
  const kept = normalizeRuleset(authored)
  assert.equal(kept.audioTracks.length, 1)
  assert.equal(kept.meta.battleMusicId, 'mine')
})

console.log(`\n${passed} chiptune tests passed`)
