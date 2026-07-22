/**
 * Procedural texture library: builtins render tiles, refs resolve to image
 * hrefs (builtin → encoded SVG data URI, custom → the uploaded URI), and
 * surface filtering behaves.
 * Run with:  tsx test/textures.test.ts
 */

import assert from 'node:assert/strict'
import {
  BUILTIN_TEXTURES, texturesForSurface, textureImageHref, tileToDataUri,
  isCustomRef, customHash, getBuiltinTexture, texturePreviewUri,
} from '../src/lib/textures'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

const stone = { hue: 220, sat: 10, light: 50 }

test('every builtin has an id/name/icon and at least one surface', () => {
  for (const t of BUILTIN_TEXTURES) {
    assert.ok(t.id && t.name && t.icon, `missing meta on ${t.id}`)
    assert.ok(t.surfaces.length > 0, `${t.id} has no surfaces`)
  }
})

test('builtin ids are unique', () => {
  const ids = BUILTIN_TEXTURES.map(t => t.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('every builtin renders non-empty SVG shape markup', () => {
  for (const t of BUILTIN_TEXTURES) {
    const svg = t.render(stone)
    assert.ok(svg.length > 20, `${t.id} rendered too little`)
    assert.ok(/<(rect|circle|ellipse|path|polygon)/.test(svg), `${t.id} drew no shapes`)
  }
})

test('texturesForSurface only returns textures tagged for that surface', () => {
  for (const surface of ['wall', 'floor', 'ceiling'] as const) {
    const list = texturesForSurface(surface)
    assert.ok(list.length > 0, `no textures for ${surface}`)
    for (const t of list) assert.ok(t.surfaces.includes(surface))
  }
})

test('tileToDataUri produces a decodable SVG data URI', () => {
  const uri = tileToDataUri('<rect width="100" height="100" fill="#fff"/>')
  assert.ok(uri.startsWith('data:image/svg+xml,'))
  const decoded = decodeURIComponent(uri.slice('data:image/svg+xml,'.length))
  assert.ok(decoded.includes('<svg'))
  assert.ok(decoded.includes('viewBox="0 0 100 100"'))
})

test('textureImageHref: builtin → SVG data URI, tinted by colours', () => {
  const href = textureImageHref('stone_brick', stone)
  assert.ok(href && href.startsWith('data:image/svg+xml,'))
})

test('textureImageHref: unknown ref and empty ref → null', () => {
  assert.equal(textureImageHref(undefined, stone), null)
  assert.equal(textureImageHref('does_not_exist', stone), null)
})

test('textureImageHref: custom ref resolves from assets, missing → null', () => {
  const assets = { abc123: 'data:image/png;base64,AAAA' }
  assert.equal(textureImageHref('custom:abc123', stone, assets), 'data:image/png;base64,AAAA')
  assert.equal(textureImageHref('custom:missing', stone, assets), null)
})

test('isCustomRef / customHash', () => {
  assert.equal(isCustomRef('custom:deadbeef'), true)
  assert.equal(isCustomRef('stone_brick'), false)
  assert.equal(isCustomRef(undefined), false)
  assert.equal(customHash('custom:deadbeef'), 'deadbeef')
})

test('getBuiltinTexture + texturePreviewUri', () => {
  const def = getBuiltinTexture('cobblestone')
  assert.ok(def)
  assert.ok(texturePreviewUri(def!).startsWith('data:image/svg+xml,'))
})

console.log(`\ntextures: ${passed} passed`)
