/**
 * Structural validation for the built-in pixel sprite library.
 * Run with:  tsx test/sprites.test.ts
 */

import assert from 'node:assert/strict'
import { _spriteDefs, hasPixelSprite, spriteAspect, resolveCreatureSprite, creatureSprite, isBitmapSprite, spriteKinds } from '../src/lib/pixel-sprites'
import { SUBCUBE_KIND_DEFS } from '../src/lib/subcube-defs'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'

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

const defs = _spriteDefs()

test('every sprite grid is rectangular and matches its declared size', () => {
  for (const [kind, def] of Object.entries(defs)) {
    assert.ok(def.frames.length >= 1 && def.frames.length <= 2, `${kind}: frame count`)
    for (const [fi, rows] of def.frames.entries()) {
      assert.equal(rows.length, def.h, `${kind} frame ${fi}: expected ${def.h} rows, got ${rows.length}`)
      rows.forEach((row, ri) => {
        assert.equal(row.length, def.w, `${kind} frame ${fi} row ${ri}: expected width ${def.w}, got ${row.length}`)
      })
    }
  }
})

test('every non-transparent pixel maps to a palette colour', () => {
  for (const [kind, def] of Object.entries(defs)) {
    for (const rows of def.frames) {
      for (const row of rows) {
        for (const ch of row) {
          if (ch === '.') continue
          assert.ok(def.palette[ch], `${kind}: pixel char '${ch}' missing from palette`)
        }
      }
    }
  }
})

test('every sub-cube kind has a built-in sprite', () => {
  for (const kd of SUBCUBE_KIND_DEFS) {
    assert.ok(hasPixelSprite(kd.kind), `no sprite for sub-cube kind ${kd.kind}`)
  }
})

test('special kinds (chest, lever, door panel) are present with sane aspect', () => {
  for (const kind of ['chest', 'chest_open', 'lever_off', 'lever_on', 'door_panel']) {
    assert.ok(hasPixelSprite(kind), `missing ${kind}`)
    const a = spriteAspect(kind)!
    assert.ok(a > 0.3 && a < 2.5, `${kind}: odd aspect ${a}`)
  }
})

test('every default-bestiary enemy resolves to a creature sprite', () => {
  for (const e of makeDefaultRuleset().enemies) {
    const kind = resolveCreatureSprite({ sprite: e.sprite, id: e.id, name: e.name })
    assert.ok(kind, `no creature sprite resolves for enemy ${e.id} (${e.name})`)
    assert.ok(hasPixelSprite(kind!), `resolved kind ${kind} for ${e.id} is not a real sprite`)
  }
})

test('resolveCreatureSprite honours explicit sprite and falls back to keywords', () => {
  assert.equal(resolveCreatureSprite({ sprite: 'cr_demon', id: 'x', name: 'Whatever' }), 'cr_demon')
  assert.equal(resolveCreatureSprite({ sprite: 'not_a_sprite', id: 'enemy.skeleton', name: 'Skeleton' }), 'cr_skeleton')
  assert.equal(resolveCreatureSprite({ id: 'npc.unmatchable', name: 'Xyzzy' }), null)
})

test('creator bitmaps: detection and precedence over built-ins', () => {
  const uri = 'data:image/png;base64,iVBORw0KGgo='
  assert.ok(isBitmapSprite(uri))
  assert.ok(!isBitmapSprite('cr_demon'))
  assert.ok(!isBitmapSprite(undefined))

  // A bitmap sprite renders as an <image> even when the name would keyword-match
  const el = creatureSprite({ sprite: uri, id: 'enemy.skeleton', name: 'Skeleton' }, 0, 0, 10, 'k')
  assert.ok(el && (el as { type?: unknown }).type === 'image', 'bitmap hint should yield an <image> element')

  // Without a bitmap the built-in library is used, and unmatched hints stay null
  assert.ok(creatureSprite({ id: 'enemy.skeleton', name: 'Skeleton' }, 0, 0, 10, 'k2'))
  assert.equal(creatureSprite({ id: 'x', name: 'Xyzzy' }, 0, 0, 10, 'k3'), null)

  assert.ok(spriteKinds().includes('cr_skeleton'))
})

console.log(`\n${passed} passed`)
