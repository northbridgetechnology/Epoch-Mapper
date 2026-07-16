#!/usr/bin/env node
/**
 * Bake a `.epochmap` into the standalone player template → one self-contained
 * HTML file you can double-click to play or upload to itch.io (Option A).
 *
 *   node scripts/bake-game.mjs my-game.epochmap [MyGame.html]
 *
 * Requires dist-player/player.html (run `node scripts/build-player.mjs` first).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLACEHOLDER = '__EPOCH_GAME_DATA__'

const gamePath = process.argv[2]
if (!gamePath) {
  console.error('usage: node scripts/bake-game.mjs <game.epochmap> [out.html]')
  process.exit(1)
}
const template = path.join(root, 'dist-player/player.html')
if (!existsSync(template)) {
  console.error('dist-player/player.html not found — run `node scripts/build-player.mjs` first.')
  process.exit(1)
}

const base = path.basename(gamePath).replace(/\.epochmap$/i, '')
const outPath = process.argv[3] ?? path.join(root, 'dist-player', `${base}.html`)

const b64 = readFileSync(gamePath).toString('base64')
const html = readFileSync(template, 'utf8')
  .replace(JSON.stringify(PLACEHOLDER), JSON.stringify(b64))

if (!html.includes(b64)) {
  console.error('failed: placeholder not found in template (was it already baked?)')
  process.exit(1)
}
writeFileSync(outPath, html)
const kb = (Buffer.byteLength(html) / 1024).toFixed(0)
console.log(`baked ${base} → ${path.relative(root, outPath)} (${kb} KB)`)
