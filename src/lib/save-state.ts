/**
 * SaveState persistence helpers for the L3 runtime layer.
 *
 * Stores: localStorage (keyed by mapHash) + optional .epochsave download.
 * Format: gzipped JSON SaveState with a 4-byte version prefix.
 */

import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import type { Character, ClassDef, Formation, Pronoun, Ruleset, SaveState } from './engine-types'
import { deriveMaxHp, deriveMaxMp } from './engine-types'
import { uid } from './utils'

const SAVE_VERSION = 1
const DRAFT_PREFIX = 'epochengine.save.'

// ── Persistence ───────────────────────────────────────────────────────────────

function saveKey(mapHash: string): string {
  return DRAFT_PREFIX + mapHash
}

export function saveToDraft(state: SaveState): void {
  try {
    localStorage.setItem(saveKey(state.mapHash), JSON.stringify(state))
  } catch {
    // storage full or unavailable
  }
}

export function loadFromDraft(mapHash: string): SaveState | null {
  try {
    const raw = localStorage.getItem(saveKey(mapHash))
    if (!raw) return null
    return JSON.parse(raw) as SaveState
  } catch {
    return null
  }
}

export function deleteDraft(mapHash: string): void {
  try {
    localStorage.removeItem(saveKey(mapHash))
  } catch {
    // ignore
  }
}

// ── Named save slots (play mode) ──────────────────────────────────────────────

export const SAVE_SLOT_COUNT = 3
const SLOT_PREFIX = 'epochengine.slot.'

export interface SaveSlotInfo {
  slot: number
  at: number
  mapId: string
  partySummary: string
  gold: number
}

export function saveToSlot(slot: number, state: SaveState): void {
  try {
    localStorage.setItem(`${SLOT_PREFIX}${slot}`, JSON.stringify({ at: Date.now(), state }))
  } catch {
    // storage full or unavailable
  }
}

export function loadFromSlot(slot: number): SaveState | null {
  try {
    const raw = localStorage.getItem(`${SLOT_PREFIX}${slot}`)
    if (!raw) return null
    return (JSON.parse(raw) as { state: SaveState }).state
  } catch {
    return null
  }
}

export function deleteSlot(slot: number): void {
  try {
    localStorage.removeItem(`${SLOT_PREFIX}${slot}`)
  } catch {
    // ignore
  }
}

/** Wipe every slot — used by permadeath on a party wipe. */
export function deleteAllSlots(): void {
  for (let i = 0; i < SAVE_SLOT_COUNT; i++) deleteSlot(i)
}

export function listSaveSlots(): (SaveSlotInfo | null)[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, slot) => {
    try {
      const raw = localStorage.getItem(`${SLOT_PREFIX}${slot}`)
      if (!raw) return null
      const { at, state } = JSON.parse(raw) as { at: number; state: SaveState }
      const alive = state.party.filter(c => c.alive).length
      const lvl = Math.max(1, ...state.party.map(c => c.level))
      return {
        slot, at,
        mapId: state.position.mapId,
        partySummary: `${alive}/${state.party.length} alive · Lv ${lvl}`,
        gold: state.gold,
      }
    } catch {
      return null
    }
  })
}

// ── .epochsave binary format ──────────────────────────────────────────────────
// 4 bytes: 'EPKS' magic
// 1 byte: version (1)
// remaining: gzipped JSON of SaveState

const SAVE_MAGIC = new Uint8Array([0x45, 0x50, 0x4b, 0x53]) // "EPKS"

export function serializeSaveState(state: SaveState): Uint8Array {
  const json = JSON.stringify(state)
  const compressed = gzipSync(strToU8(json))
  const out = new Uint8Array(5 + compressed.length)
  out.set(SAVE_MAGIC, 0)
  out[4] = SAVE_VERSION
  out.set(compressed, 5)
  return out
}

export class SaveStateParseError extends Error {
  constructor(msg: string) { super(msg); this.name = 'SaveStateParseError' }
}

export function parseSaveState(buf: Uint8Array): SaveState {
  if (buf.length < 5) throw new SaveStateParseError('File too short')
  for (let i = 0; i < 4; i++) {
    if (buf[i] !== SAVE_MAGIC[i]) throw new SaveStateParseError('Not a .epochsave file')
  }
  if (buf[4] !== SAVE_VERSION) throw new SaveStateParseError(`Unsupported version ${buf[4]}`)
  const json = strFromU8(gunzipSync(buf.slice(5)))
  return JSON.parse(json) as SaveState
}

export function downloadSaveState(state: SaveState, filename?: string): void {
  const bytes = serializeSaveState(state)
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `save-${state.mapHash.slice(0, 8)}.epochsave`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Character factory ─────────────────────────────────────────────────────────

/** Optional identity + attribute overrides used by the player Character Builder. */
export interface NewCharacterOpts {
  /** Pre-modifier attribute scores by id (from point-buy). Missing attrs use `default`. */
  attrBase?: Record<string, number>
  portrait?: string
  pronoun?: Pronoun
  bio?: string
  isMc?: boolean
}

export function newCharacter(
  name: string,
  classId: string,
  raceId: string,
  ruleset: Ruleset,
  opts: NewCharacterOpts = {},
): Character {
  const cls = ruleset.classes.find(c => c.id === classId) ?? ruleset.classes[0]
  const race = ruleset.races.find(r => r.id === raceId) ?? ruleset.races[0]

  const attributes: Record<string, number> = {}
  for (const attr of ruleset.attributes) {
    const base = opts.attrBase?.[attr.id] ?? attr.default
    const classMod = (cls.attrModifiers[attr.id] ?? cls.attrModifiers[attr.id.replace('attr.', '')] ?? 0)
    const raceMod = (race.attrModifiers[attr.id] ?? race.attrModifiers[attr.id.replace('attr.', '')] ?? 0)
    attributes[attr.id] = Math.min(attr.max, Math.max(attr.min, base + classMod + raceMod))
  }

  // Normalize attribute lookup by short key too
  const attrByShort: Record<string, number> = {}
  for (const [k, v] of Object.entries(attributes)) {
    attrByShort[k.replace('attr.', '')] = v
  }

  const char: Character = {
    id: uid(),
    name,
    classId,
    raceId,
    level: 1,
    xp: 0,
    attributes,
    hp: 0,
    maxHp: 0,
    mp: 0,
    maxMp: 0,
    equipment: {},
    knownSpells: [],
    statuses: [],
    alive: true,
    ...(opts.portrait ? { portrait: opts.portrait } : {}),
    ...(opts.pronoun ? { pronoun: opts.pronoun } : {}),
    ...(opts.bio ? { bio: opts.bio } : {}),
    ...(opts.isMc ? { isMc: true } : {}),
  }

  char.maxHp = deriveMaxHp({ level: 1, attributes: attrByShort }, cls as ClassDef)
  char.hp = char.maxHp
  char.maxMp = deriveMaxMp({ level: 1, attributes: attrByShort }, cls as ClassDef)
  char.mp = char.maxMp

  return char
}

// ── SaveState factory ─────────────────────────────────────────────────────────

export function newSaveState(ruleset: Ruleset, mapHash = ''): SaveState {
  return {
    rulesetVersion: ruleset.meta.version,
    mapHash,
    position: { ...ruleset.meta.startPosition, mapId: ruleset.meta.startMapId },
    party: [],
    formation: { front: [], back: [] },
    gold: ruleset.meta.startingGold,
    sharedInventory: [],
    flags: {},
    revealed: {},
    rngSeed: Math.floor(Math.random() * 0xffffffff),
    playtimeMs: 0,
  }
}

// ── Party template key ────────────────────────────────────────────────────────

const PARTY_DRAFT_KEY = 'epochengine.partyTemplate'

export function savePartyTemplate(party: Character[], formation: Formation): void {
  try {
    localStorage.setItem(PARTY_DRAFT_KEY, JSON.stringify({ party, formation }))
  } catch {
    // ignore
  }
}

export function loadPartyTemplate(): { party: Character[]; formation: Formation } | null {
  try {
    const raw = localStorage.getItem(PARTY_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
