/**
 * Exploration-layer mechanics: trick tiles and party light.
 * Pure functions — no DOM, no React.
 */

import type { CellData, MapData } from './types'
import type { CellEntity, Character, Dice, Facing, GameMeta, ItemDef, Ruleset, TrickKind } from './engine-types'

type TrickEntity = Extract<CellEntity, { t: 'trick' }>

function rollDice(dice: Dice, rng: () => number): number {
  if (typeof dice === 'number') return dice
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice.trim())
  if (!m) return Number(dice) || 0
  const [, n, sides, mod] = m
  let total = mod ? Number(mod) : 0
  for (let i = 0; i < Number(n); i++) total += 1 + Math.floor(rng() * Number(sides))
  return total
}

export function getTricks(cell: CellData | undefined): TrickEntity[] {
  return (cell?.entities ?? []).filter((e): e is TrickEntity => e.t === 'trick')
}

export function cellHasTrick(cell: CellData | undefined, kind: TrickKind): boolean {
  return getTricks(cell).some(t => t.kind === kind)
}

const LEFT:  Record<Facing, Facing> = { N: 'W', W: 'S', S: 'E', E: 'N' }
const RIGHT: Record<Facing, Facing> = { N: 'E', E: 'S', S: 'W', W: 'N' }

export interface TrickMoveResult {
  /** Relocation (pit fall or silent teleport). Same-shape as a mapLink target. */
  teleportTo?: { mapId: string; x: number; y: number }
  /** New party facing (spinner). */
  facing?: Facing
  /** Fall damage rolled once — apply to each living party member. */
  damage?: number
  /** Feedback for the message log. Silent tricks contribute nothing. */
  messages: string[]
  /** True when a pit dropped the party (fall + damage messaging). */
  fell?: boolean
}

/**
 * Apply on-entry trick tiles for the cell the party just stepped onto.
 * Order: pit (falls preempt everything) → silent teleport → spinner.
 * antiMagic / darkness / safeRoom are passive zone queries — see cellHasTrick.
 */
export function applyMoveTricks(
  cell: CellData | undefined,
  opts: {
    maps: MapData[]
    mapId: string
    x: number
    y: number
    facing: Facing
    rng?: () => number
  },
): TrickMoveResult {
  const rng = opts.rng ?? Math.random
  const result: TrickMoveResult = { messages: [] }
  const tricks = getTricks(cell)
  if (tricks.length === 0) return result

  const pit = tricks.find(t => t.kind === 'pit')
  if (pit) {
    let target: { mapId: string; x: number; y: number } | null = null
    if (pit.mapId !== undefined || pit.x !== undefined || pit.y !== undefined) {
      target = { mapId: pit.mapId ?? opts.mapId, x: pit.x ?? opts.x, y: pit.y ?? opts.y }
    } else {
      // Default: fall through to the next map in the session, same coordinates
      const idx = opts.maps.findIndex(m => m.id === opts.mapId)
      const below = idx >= 0 ? opts.maps[idx + 1] : undefined
      if (below) target = { mapId: below.id, x: opts.x, y: opts.y }
    }
    if (target) {
      result.teleportTo = target
      result.fell = true
      result.damage = rollDice(pit.damage ?? '1d6', rng)
      result.messages.push('The floor gives way! The party plummets into darkness below.')
      return result
    }
  }

  const tp = tricks.find(t => t.kind === 'silentTeleport')
  if (tp && (tp.x !== undefined || tp.y !== undefined)) {
    // Silent by design: no message, the party should not notice
    result.teleportTo = { mapId: tp.mapId ?? opts.mapId, x: tp.x ?? opts.x, y: tp.y ?? opts.y }
  }

  const spin = tricks.find(t => t.kind === 'spinner')
  if (spin) {
    const mode = spin.rotate ?? 'random'
    const from = opts.facing
    // Silent by design: the classic spinner gives no feedback at all
    result.facing =
      mode === 'left'    ? LEFT[from] :
      mode === 'right'   ? RIGHT[from] :
      mode === 'reverse' ? LEFT[LEFT[from]] :
      ([LEFT[from], RIGHT[from], LEFT[LEFT[from]]] as Facing[])[Math.floor(rng() * 3)]
  }

  return result
}

// ── Party light ────────────────────────────────────────────────────────────────

/** View distance (in cells) with no light source on a dark map. */
export const DARK_BASE_RADIUS = 1

/**
 * The party's current light radius on a dark map: the strongest equipped
 * light source across the party, plus any status modifiers targeting the
 * derived stat 'lightRadius'. Standing in a `darkness` trick zone snuffs
 * everything to the base radius.
 */
export function computeLightRadius(
  party: Character[],
  ruleset: Ruleset,
  cell?: CellData,
): number {
  if (cell && cellHasTrick(cell, 'darkness')) return DARK_BASE_RADIUS
  let radius = DARK_BASE_RADIUS
  const items = new Map<string, ItemDef>(ruleset.items.map(i => [i.id, i]))
  for (const ch of party) {
    if (!ch.alive) continue
    for (const inst of Object.values(ch.equipment ?? {})) {
      if (!inst) continue
      const def = items.get(inst.def)
      if (def?.lightRadius) radius = Math.max(radius, def.lightRadius)
    }
    for (const st of ch.statuses ?? []) {
      const def = ruleset.statusEffects.find(s => s.id === st.def)
      for (const mod of def?.modifiers ?? []) {
        if (mod.target === 'derived' && mod.key === 'lightRadius' && mod.op === 'add') {
          radius = Math.max(radius, DARK_BASE_RADIUS + mod.amount)
        }
      }
    }
  }
  return radius
}

/**
 * Advance burn-down light sources by one step. Any equipped item with
 * `burnSteps` tracks its remaining life in ItemInstance.charges (initialised
 * on first tick) and is destroyed when it runs out.
 * Returns the updated party (new object only when something changed).
 */
export function tickLightBurn(
  party: Character[],
  ruleset: Ruleset,
): { party: Character[]; messages: string[] } {
  const messages: string[] = []
  let changed = false
  const items = new Map<string, ItemDef>(ruleset.items.map(i => [i.id, i]))
  const next = party.map(ch => {
    if (!ch.alive) return ch
    let chChanged = false
    const equipment = { ...ch.equipment }
    for (const [slot, inst] of Object.entries(equipment)) {
      if (!inst) continue
      const def = items.get(inst.def)
      if (!def?.burnSteps || !def.lightRadius) continue
      const remaining = (inst.charges ?? def.burnSteps) - 1
      chChanged = true
      if (remaining <= 0) {
        delete equipment[slot as keyof typeof equipment]
        messages.push(`${ch.name}'s ${def.name} gutters out.`)
      } else {
        equipment[slot as keyof typeof equipment] = { ...inst, charges: remaining }
      }
    }
    if (!chChanged) return ch
    changed = true
    return { ...ch, equipment }
  })
  return changed ? { party: next, messages } : { party, messages }
}

// ── Camp / rest ────────────────────────────────────────────────────────────────

export interface RestResult {
  party: Character[]
  /** True when the rest is interrupted — the caller should start the cell's
   *  zone encounter instead of finishing the rest. */
  ambushed: boolean
  message: string
}

/**
 * Rest the party: restore HP/MP by the meta fractions (default full), clear
 * statuses, revive nobody (death is death until a revive effect). On non-safe
 * cells the rest may be interrupted by an ambush (restAmbushChance, default
 * 0.25) — the caller rolls the cell's zone encounter table when `ambushed`.
 * Safe rooms (trick: safeRoom) never ambush.
 */
export function restParty(
  party: Character[],
  meta: GameMeta,
  cell: CellData | undefined,
  rng: () => number = Math.random,
): RestResult {
  const safe = cellHasTrick(cell, 'safeRoom')
  const hasZone = (cell?.entities ?? []).some(e => e.t === 'encounter' && e.mode === 'zone')
  if (!safe && hasZone && rng() < (meta.restAmbushChance ?? 0.25)) {
    return { party, ambushed: true, message: 'Something stirs in the dark — the camp is ambushed!' }
  }
  const hpFrac = meta.restHpFrac ?? 1
  const mpFrac = meta.restMpFrac ?? 1
  const rested = party.map(ch => {
    if (!ch.alive) return ch
    return {
      ...ch,
      hp: Math.min(ch.maxHp, Math.max(ch.hp, Math.round(ch.maxHp * hpFrac))),
      mp: Math.min(ch.maxMp, Math.max(ch.mp, Math.round(ch.maxMp * mpFrac))),
      statuses: [],
    }
  })
  return {
    party: rested,
    ambushed: false,
    message: safe ? 'The party rests safely.' : 'The party makes camp and recovers.',
  }
}
