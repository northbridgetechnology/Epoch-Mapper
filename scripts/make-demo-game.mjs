#!/usr/bin/env node
/**
 * Generate a small playable demo `.epochmap` for testing the standalone build.
 *   npx tsx scripts/make-demo-game.mjs [out.epochmap]
 */
import { writeFileSync } from 'node:fs'
import { makeDefaultRuleset } from '../src/lib/default-ruleset.ts'
import { buildGeneratedWorld } from '../src/lib/map-generator.ts'
import { serializeDotEpochmap } from '../src/lib/epochmap-codec.ts'

const ruleset = makeDefaultRuleset()
const world = buildGeneratedWorld('Demo Vale', { name: 'Demo Vale', size: 'small', seed: 7, generate: true, style: 'rooms' }, ruleset)
ruleset.npcs = world.npcs
ruleset.quests = world.quests
ruleset.events = world.events
ruleset.items = [...ruleset.items, ...world.items]
const maps = [world.map, ...world.extraMaps]
ruleset.meta.title = 'Demo Quest'
ruleset.meta.startMapId = world.map.id

const file = {
  version: 2,
  gameTitle: 'Demo Quest',
  romHash: '',
  customMarkers: [],
  maps,
  ruleset,
}
const out = process.argv[2] ?? 'dist-player/demo.epochmap'
writeFileSync(out, Buffer.from(serializeDotEpochmap(file)))
console.log(`wrote ${out} (${maps.length} maps)`)
