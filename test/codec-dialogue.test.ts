/**
 * Codec coverage for conversations: Quick-built and hand-branched DialogueDefs,
 * plus the NpcDef fields that reference them, must survive both the ruleset
 * diff/patch layer and the full .epochmap binary round-trip.
 * Run with:  tsx test/codec-dialogue.test.ts
 */

import assert from 'node:assert/strict'
import { serializeDotEpochmap, parseDotEpochmap } from '../src/lib/epochmap-codec'
import { diffRuleset, patchRuleset } from '../src/lib/ruleset-diff'
import { makeDefaultRuleset } from '../src/lib/default-ruleset'
import { fromQuick } from '../src/lib/dialogue-quick'
import type { DialogueDef, NpcDef, Ruleset } from '../src/lib/engine-types'
import type { EpochmapFile } from '../src/lib/types'

let passed = 0
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (err) { console.error(`  ✗ ${name}`); console.error(err); process.exitCode = 1 }
}

// A Quick-built recruit conversation and a hand-authored branching one.
const quickDlg: DialogueDef = fromQuick(
  { lines: ['Well met.', 'Dark times are upon us.'],
    action: { label: 'I will join you', effect: { t: 'recruit', npc: 'npc.ally' }, reply: 'Then we ride.', declineLabel: 'Not now', declineReply: 'Another time.' } },
  'dlg.ally', 'Ally — conversation',
)
const branchDlg: DialogueDef = {
  id: 'dlg.sage', name: 'The Sage', start: 'greet',
  nodes: [
    { id: 'greet', text: ['Ask, and I answer.'], effects: [{ t: 'setFlag', flag: 'met_sage', value: true }],
      choices: [
        { label: 'The vault?', goto: 'vault', conditions: [{ c: 'flag', flag: 'met_sage', equals: true }] },
        { label: 'Farewell.' },
      ] },
    { id: 'vault', text: ['Beneath us, sealed.'], choices: [{ label: 'Thanks', effects: [{ t: 'gold', amount: 10 }] }] },
  ],
}
const ally: NpcDef = {
  id: 'npc.ally', name: 'Ally', portrait: '🧝', dialogue: 'dlg.ally',
  barks: ['Steel ready.', 'Lead on.'], recruitable: true, level: 3, attributes: {},
} as NpcDef

function ruleset(): Ruleset {
  const r = makeDefaultRuleset()
  r.dialogues = [...(r.dialogues ?? []), quickDlg, branchDlg]
  r.npcs = [...(r.npcs ?? []), ally]
  return r
}

function file(r: Ruleset): EpochmapFile {
  return {
    version: 3, gameTitle: 'T', romHash: '', customMarkers: [], ruleset: r,
    maps: [{ id: 'm1', name: 'M', playerX: 0, playerY: 0, cells: {}, revealedChunks: [] }],
  } as EpochmapFile
}

test('diff/patch preserves custom dialogues and npc refs', () => {
  const r = ruleset()
  const back = patchRuleset(diffRuleset(r))
  assert.deepEqual(back.dialogues, r.dialogues)
  assert.deepEqual(back.npcs, r.npcs)
})

test('.epochmap binary round-trip preserves dialogues verbatim', () => {
  const r = ruleset()
  const back = parseDotEpochmap(serializeDotEpochmap(file(r)))
  assert.ok(back.ruleset, 'ruleset survived')
  const d = back.ruleset!.dialogues.find(x => x.id === 'dlg.ally')
  assert.ok(d, 'quick dialogue survived')
  assert.deepEqual(d, quickDlg)
  assert.deepEqual(back.ruleset!.dialogues.find(x => x.id === 'dlg.sage'), branchDlg)
})

test('.epochmap round-trip preserves npc dialogue/barks/recruitable', () => {
  const r = ruleset()
  const back = parseDotEpochmap(serializeDotEpochmap(file(r)))
  const n = back.ruleset!.npcs?.find(x => x.id === 'npc.ally')
  assert.ok(n)
  assert.equal(n!.dialogue, 'dlg.ally')
  assert.deepEqual(n!.barks, ['Steel ready.', 'Lead on.'])
  assert.equal(n!.recruitable, true)
})

test('a stock-ruleset file (no custom dialogues) still round-trips', () => {
  const back = parseDotEpochmap(serializeDotEpochmap(file(makeDefaultRuleset())))
  assert.deepEqual(back.ruleset!.dialogues, makeDefaultRuleset().dialogues)
})

console.log(`\ncodec-dialogue: ${passed} passed`)
