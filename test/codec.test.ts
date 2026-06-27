/**
 * Round-trip tests for the .epochmap binary codec.
 * Run with:  bun test/codec.test.ts   (or: npm run test:codec)
 */

import assert from 'node:assert/strict'
import {
  parseDotEpochmap,
  serializeDotEpochmap,
  EpochmapParseError,
  EPOCHMAP_MAGIC,
} from '../src/lib/epochmap-codec'
import type { EpochmapFile } from '../src/lib/types'

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

const sample: EpochmapFile = {
  version: 2,
  gameTitle: 'Dragon Quest III 🐉',
  romHash: 'a'.repeat(64),
  customMarkers: [
    { id: 130, kind: 'base', label: 'Dragon Lair', icon: '🐉', color: '#ff8800' },
    { id: 131, kind: 'overlay', label: 'Merchant Guild', icon: 'M', color: '#00aaff' },
  ],
  maps: [
    {
      id: 'm0',
      name: 'Floor 1',
      playerX: -3,
      playerY: 7,
      cells: {
        '0,0': { base: 1, overlays: [10] },
        '-3,7': { base: 4, overlays: [] },
        '2,-5': { base: 130, overlays: [131] },
        '1,1': { base: 0, overlays: [], note: 'Secret switch behind the statue' },
      },
      boundaries: {
        '0,-1:S': { wall: 0 },  // N side of (0,0) → (0,-1):S
        '0,0:E':  { wall: 0 },  // E side of (0,0)
        '2,-5:S': { wall: 5 },  // S side of (2,-5)
      },
      revealedChunks: ['0,0', '-1,2', '0,-2'],
    },
    {
      id: 'm1',
      name: 'World Map',
      playerX: 0,
      playerY: 0,
      cells: {},
      revealedChunks: ['0,0'],
    },
  ],
}

console.log('epochmap codec round-trip')

test('serialize produces EPKM magic + version 2 in the clear header', () => {
  const bytes = serializeDotEpochmap(sample)
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  assert.equal(magic, EPOCHMAP_MAGIC)
  assert.equal(bytes[4], 2)
})

test('full round-trip preserves header fields', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  assert.equal(back.version, 2)
  assert.equal(back.gameTitle, sample.gameTitle)
  assert.equal(back.romHash, sample.romHash)
})

test('custom markers round-trip (id, kind, label, icon, color)', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  assert.deepEqual(back.customMarkers, sample.customMarkers)
})

test('maps, cells and overlays round-trip', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  assert.equal(back.maps.length, 2)
  const f1 = back.maps[0]
  assert.equal(f1.name, 'Floor 1')
  assert.equal(f1.playerX, -3)
  assert.equal(f1.playerY, 7)
  assert.deepEqual(f1.cells['0,0'].overlays, [10])
  assert.equal(f1.cells['2,-5'].base, 130)
  assert.deepEqual(f1.cells['2,-5'].overlays, [131])
})

test('boundaries round-trip via JSON extension block', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  const f1 = back.maps[0]
  assert.deepEqual(f1.boundaries?.['0,-1:S'], { wall: 0 })
  assert.deepEqual(f1.boundaries?.['0,0:E'],  { wall: 0 })
  assert.deepEqual(f1.boundaries?.['2,-5:S'], { wall: 5 })
})

test('door boundary round-trips with state', () => {
  const file: EpochmapFile = {
    version: 2,
    gameTitle: '',
    romHash: '',
    customMarkers: [],
    maps: [{
      id: 'm',
      name: 'm',
      playerX: 0,
      playerY: 0,
      cells: { '0,0': { base: 1, overlays: [] } },
      boundaries: { '0,0:E': { door: { state: 'locked', keyItem: 'gold-key' } } },
      revealedChunks: ['0,0'],
    }],
  }
  const back = parseDotEpochmap(serializeDotEpochmap(file))
  assert.deepEqual(back.maps[0].boundaries?.['0,0:E'], { door: { state: 'locked', keyItem: 'gold-key' } })
})

test('v2 keeps only the first overlay per cell (documented limitation)', () => {
  const file: EpochmapFile = {
    version: 2,
    gameTitle: '',
    romHash: '',
    customMarkers: [],
    maps: [{
      id: 'm',
      name: 'm',
      playerX: 0,
      playerY: 0,
      cells: { '0,0': { base: 1, overlays: [8, 10] } },
      revealedChunks: ['0,0'],
    }],
  }
  const back = parseDotEpochmap(serializeDotEpochmap(file))
  assert.deepEqual(back.maps[0].cells['0,0'].overlays, [8])
})

test('notes round-trip and merge back onto their cell', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  assert.equal(back.maps[0].cells['1,1'].note, 'Secret switch behind the statue')
})

test('revealed chunks round-trip', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  assert.deepEqual(new Set(back.maps[0].revealedChunks), new Set(['0,0', '-1,2', '0,-2']))
})

test('empty romHash round-trips to empty string', () => {
  const file = { ...sample, romHash: '' }
  const back = parseDotEpochmap(serializeDotEpochmap(file))
  assert.equal(back.romHash, '')
})

test('negative i16 coordinates survive', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(sample))
  assert.ok('2,-5' in back.maps[0].cells)
})

test('bad magic throws EpochmapParseError', () => {
  const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  assert.throws(() => parseDotEpochmap(junk), EpochmapParseError)
})

test('compressed body is reasonably compact', () => {
  const bytes = serializeDotEpochmap(sample)
  // small sample — sanity bound, not a hard spec requirement
  assert.ok(bytes.length < 2048, `expected < 2KB, got ${bytes.length}`)
})

console.log(`\n${passed} passed`)
