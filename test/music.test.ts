/**
 * Music resolution hierarchy — exploration / battle / boss / custom fallbacks.
 * Run with:  tsx test/music.test.ts
 */

import assert from 'node:assert/strict'
import { resolveMusicId } from '../src/lib/music'
import type { GameMeta } from '../src/lib/engine-types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const base: GameMeta = {
  title: 'T', version: '1', startMapId: 'm', startPosition: { x: 0, y: 0, facing: 'N' },
  partySize: 4, rows: 2, permadeath: false, startingGold: 0,
}
const meta = (over: Partial<GameMeta> = {}): GameMeta => ({ ...base, ...over })

test('exploring: map track wins over the global default', () => {
  assert.equal(resolveMusicId({ meta: meta({ defaultMusicId: 'trk.town' }), mapMusicId: 'trk.cave' }), 'trk.cave')
})

test('exploring: falls back to the global default', () => {
  assert.equal(resolveMusicId({ meta: meta({ defaultMusicId: 'trk.town' }) }), 'trk.town')
})

test('exploring: silence when nothing configured', () => {
  assert.equal(resolveMusicId({ meta: meta() }), undefined)
})

test('battle: generic battle track', () => {
  assert.equal(resolveMusicId({ meta: meta({ battleMusicId: 'trk.fight' }), mapMusicId: 'trk.cave', battle: {} }), 'trk.fight')
})

test('battle: custom encounter track overrides the generic', () => {
  assert.equal(resolveMusicId({ meta: meta({ battleMusicId: 'trk.fight' }), battle: { musicId: 'trk.rival' } }), 'trk.rival')
})

test('boss: uses the boss track', () => {
  assert.equal(resolveMusicId({ meta: meta({ battleMusicId: 'trk.fight', bossMusicId: 'trk.boss' }), battle: { boss: true } }), 'trk.boss')
})

test('boss: falls back to the battle track when no boss track set', () => {
  assert.equal(resolveMusicId({ meta: meta({ battleMusicId: 'trk.fight' }), battle: { boss: true } }), 'trk.fight')
})

test('boss: custom encounter track overrides even the boss track', () => {
  assert.equal(resolveMusicId({ meta: meta({ bossMusicId: 'trk.boss' }), battle: { boss: true, musicId: 'trk.finalboss' } }), 'trk.finalboss')
})

test('battle with no battle track keeps exploration music playing', () => {
  assert.equal(resolveMusicId({ meta: meta({ defaultMusicId: 'trk.town' }), mapMusicId: 'trk.cave', battle: {} }), 'trk.cave')
})

console.log(`\n${passed} music tests passed`)
