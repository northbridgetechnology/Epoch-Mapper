/**
 * Codec coverage for per-map surface textures: builtin refs survive the binary
 * round-trip, custom uploads are deduped into the shared texture pool and
 * rehydrated back onto each referencing map's textureAssets.
 * Run with:  tsx test/codec-textures.test.ts
 */

import assert from 'node:assert/strict'
import { serializeDotEpochmap, parseDotEpochmap } from '../src/lib/epochmap-codec'
import type { EpochmapFile, MapData } from '../src/lib/types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const CUSTOM_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA'

function file(maps: MapData[]): EpochmapFile {
  return { version: 3, gameTitle: 'Tex', romHash: '', customMarkers: [], maps } as EpochmapFile
}

test('builtin texture refs survive the round-trip', () => {
  const m: MapData = { id: 'm1', name: 'M', playerX: 0, playerY: 0, cells: {}, revealedChunks: [],
    textures: { wall: 'stone_brick', floor: 'flagstone', ceiling: 'rough_hewn' } }
  const back = parseDotEpochmap(serializeDotEpochmap(file([m])))
  assert.deepEqual(back.maps[0].textures, { wall: 'stone_brick', floor: 'flagstone', ceiling: 'rough_hewn' })
})

test('a map with no textures stores nothing extra and round-trips clean', () => {
  const m: MapData = { id: 'm1', name: 'M', playerX: 0, playerY: 0, cells: {}, revealedChunks: [] }
  const back = parseDotEpochmap(serializeDotEpochmap(file([m])))
  assert.equal(back.maps[0].textures, undefined)
  assert.equal(back.maps[0].textureAssets, undefined)
})

test('custom upload is stored and rehydrated onto the map', () => {
  const m: MapData = { id: 'm1', name: 'M', playerX: 0, playerY: 0, cells: {}, revealedChunks: [],
    textures: { wall: 'custom:abcd1234' }, textureAssets: { abcd1234: CUSTOM_URI } }
  const back = parseDotEpochmap(serializeDotEpochmap(file([m])))
  assert.equal(back.maps[0].textures?.wall, 'custom:abcd1234')
  assert.equal(back.maps[0].textureAssets?.abcd1234, CUSTOM_URI)
})

test('a custom texture reused across two maps is stored once but rehydrated on both', () => {
  const mk = (id: string): MapData => ({ id, name: id, playerX: 0, playerY: 0, cells: {}, revealedChunks: [],
    textures: { floor: 'custom:shared99' }, textureAssets: { shared99: CUSTOM_URI } })
  const back = parseDotEpochmap(serializeDotEpochmap(file([mk('a'), mk('b')])))
  // dedup: exactly one blob in the shared pool
  assert.deepEqual(Object.keys(back.textureBlobs ?? {}), ['shared99'])
  // both maps still resolve it
  assert.equal(back.maps[0].textureAssets?.shared99, CUSTOM_URI)
  assert.equal(back.maps[1].textureAssets?.shared99, CUSTOM_URI)
})

test('only referenced assets are rehydrated (stale assets dropped)', () => {
  const m: MapData = { id: 'm1', name: 'M', playerX: 0, playerY: 0, cells: {}, revealedChunks: [],
    textures: { wall: 'custom:used0001' },
    textureAssets: { used0001: CUSTOM_URI, stale0002: 'data:image/png;base64,ZZZZ' } }
  const back = parseDotEpochmap(serializeDotEpochmap(file([m])))
  assert.deepEqual(Object.keys(back.maps[0].textureAssets ?? {}), ['used0001'])
})

console.log(`\ncodec-textures: ${passed} passed`)
