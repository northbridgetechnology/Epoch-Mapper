/**
 * Pure encounter detection + resolution (Phase E3).
 *
 * No DOM, no React. Given a cell and a ruleset, determines whether an
 * encounter fires and resolves which enemies appear.
 */

import type { CellData } from './types'
import type { EnemyDef, EnemyInstance, EncounterTableDef, ResolvedEncounter, Ruleset } from './engine-types'

// ── Enemy instance factory ────────────────────────────────────────────────────

function makeEnemyInstance(def: EnemyDef, rng: () => number): EnemyInstance {
  const gold = def.gold.min + Math.floor(rng() * (def.gold.max - def.gold.min + 1))
  return {
    defId: def.id,
    name: def.name,
    icon: def.icon,
    hp: def.hp,
    maxHp: def.hp,
    attack: def.attack,
    defense: def.defense,
    speed: def.speed,
    xp: def.xp,
    gold,
  }
}

/** Build a fixed encounter from a single enemy def (FOE patrols, scripted fights). */
export function makeFixedEncounter(def: EnemyDef, count: number, rng: () => number): ResolvedEncounter {
  const enemies = Array.from({ length: Math.max(1, count) }, () => makeEnemyInstance(def, rng))
  return {
    tableId: `foe.${def.id}`,
    tableName: def.name,
    enemies,
    xpReward: enemies.reduce((s, e) => s + e.xp, 0),
    goldReward: enemies.reduce((s, e) => s + e.gold, 0),
  }
}

// ── Table resolution ──────────────────────────────────────────────────────────

export function resolveEncounterTable(
  table: EncounterTableDef,
  ruleset: Ruleset,
  rng: () => number,
): EnemyInstance[] {
  if (table.entries.length === 0) return []

  // Weighted pick of one entry
  const totalWeight = table.entries.reduce((s, e) => s + e.weight, 0)
  let roll = rng() * totalWeight
  const picked = table.entries.find(e => { roll -= e.weight; return roll <= 0 }) ?? table.entries[table.entries.length - 1]

  // Roll count in [min, max]
  const count = picked.min + Math.floor(rng() * (picked.max - picked.min + 1))
  const def = ruleset.enemies.find(en => en.id === picked.enemy)
  if (!def) return []

  return Array.from({ length: count }, () => makeEnemyInstance(def, rng))
}

// ── Per-cell encounter check ──────────────────────────────────────────────────

/**
 * Check a cell for a triggering encounter.
 *
 * @param cell   The cell the party just moved onto.
 * @param flags  Current save-state flags (for oncePerVisit tracking).
 * @param ruleset Current ruleset.
 * @param rng   Random source.
 * @returns The resolved encounter, or null if none triggered.
 */
export function checkCellForEncounter(
  cell: CellData,
  flags: Record<string, boolean | number | string>,
  ruleset: Ruleset,
  rng: () => number,
): ResolvedEncounter | null {
  if (!cell.entities?.length) return null

  for (const entity of cell.entities) {
    if (entity.t !== 'encounter') continue

    // Check oncePerVisit flag
    const flagKey = `enc.visited.${entity.table}`
    if (entity.oncePerVisit && flags[flagKey]) continue

    // Decide whether this entity triggers
    let triggers = false
    if (entity.mode === 'fixed') {
      triggers = true
    } else {
      // zone: roll per-step
      const rate = entity.rate ?? 0.1
      triggers = rng() < rate
    }

    if (!triggers) continue

    const table = ruleset.encounterTables.find(t => t.id === entity.table)
    if (!table) continue

    const enemies = resolveEncounterTable(table, ruleset, rng)
    if (enemies.length === 0) continue

    const xpReward = enemies.reduce((s, e) => s + e.xp, 0)
    const goldReward = enemies.reduce((s, e) => s + e.gold, 0)

    return { tableId: table.id, tableName: table.name, enemies, xpReward, goldReward }
  }

  return null
}

/**
 * Returns the flag key used to mark a fixed encounter as visited.
 */
export function visitedFlagKey(tableId: string, x: number, y: number): string {
  return `enc.visited.${tableId}.${x}.${y}`
}
