/**
 * Headless battle simulator (pure, no React).
 *
 * Runs an encounter table against a synthetic party many times using the
 * real combat engine, so creators get balance feedback while authoring:
 * "this table kills 40% of level-2 parties" beats playtester complaints.
 *
 * Party policy is deliberately simple — every member basic-attacks the
 * first living enemy (no spells, items, or defending) — making the result
 * a conservative floor for party performance.
 */

import { initCombat, resolvePlayerAttack, resolveEnemyTurn } from './combat-engine'
import { resolveEncounterTable } from './encounter-engine'
import type { Character, ResolvedEncounter, Ruleset } from './engine-types'

export interface SimConfig {
  partySize: number
  level: number
  iterations: number
  seed?: number
}

export interface SimResult {
  runs: number
  wins: number
  defeats: number
  /** Battles that hit the safety turn cap (usually mutual immunity). */
  stalls: number
  winRate: number
  avgRounds: number
  /** Average fraction of total party HP lost in WON battles. */
  avgPartyHpLostPct: number
}

function mulberry(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Synthetic benchmark party: balanced attributes scaled by level. */
export function makeSimParty(partySize: number, level: number, ruleset: Ruleset): Character[] {
  const attr = 10 + Math.floor(level / 2)
  const hp = 20 + level * 6
  return Array.from({ length: partySize }, (_, i) => ({
    id: `sim_${i}`,
    name: `Sim ${i + 1}`,
    classId: ruleset.classes[0]?.id ?? '',
    raceId: ruleset.races[0]?.id ?? '',
    level,
    xp: 0,
    attributes: { might: attr, endurance: attr, agility: attr, intellect: attr, spirit: attr },
    hp, maxHp: hp,
    mp: 10, maxMp: 10,
    equipment: {},
    knownSpells: [],
    statuses: [],
    alive: true,
  }))
}

export function simulateEncounterTable(
  tableId: string,
  ruleset: Ruleset,
  cfg: SimConfig,
): SimResult | null {
  const table = ruleset.encounterTables.find(t => t.id === tableId)
  if (!table || table.entries.length === 0) return null

  const party = makeSimParty(cfg.partySize, cfg.level, ruleset)
  const baseSeed = cfg.seed ?? 1337

  let wins = 0, defeats = 0, stalls = 0
  let roundSum = 0, hpLostSum = 0

  for (let i = 0; i < cfg.iterations; i++) {
    const rng = mulberry(baseSeed + i * 7919)
    const enemies = resolveEncounterTable(table, ruleset, rng)
    if (enemies.length === 0) { stalls++; continue }

    const encounter: ResolvedEncounter = {
      tableId,
      tableName: table.name,
      enemies,
      xpReward: enemies.reduce((s, e) => s + e.xp, 0),
      goldReward: 0,
    }

    let s = initCombat(party, encounter, { ruleset, seed: baseSeed + i })
    let guard = 0
    while (s.phase !== 'victory' && s.phase !== 'defeat' && guard++ < 400) {
      if (s.phase === 'player_action') {
        const target = s.actors.findIndex(a => a.kind === 'enemy' && a.alive)
        if (target < 0) break
        s = resolvePlayerAttack(s, target, ruleset)
      } else if (s.phase === 'enemy_turn') {
        s = resolveEnemyTurn(s, ruleset)
      } else {
        break
      }
    }

    if (s.phase === 'victory') {
      wins++
      roundSum += s.round
      const partyActors = s.actors.filter(a => a.kind === 'party')
      const maxTotal = partyActors.reduce((t, a) => t + a.maxHp, 0)
      const lost = partyActors.reduce((t, a) => t + (a.maxHp - a.hp), 0)
      if (maxTotal > 0) hpLostSum += lost / maxTotal
    } else if (s.phase === 'defeat') {
      defeats++
    } else {
      stalls++
    }
  }

  const runs = cfg.iterations
  return {
    runs,
    wins,
    defeats,
    stalls,
    winRate: runs > 0 ? wins / runs : 0,
    avgRounds: wins > 0 ? roundSum / wins : 0,
    avgPartyHpLostPct: wins > 0 ? hpLostSum / wins : 0,
  }
}
