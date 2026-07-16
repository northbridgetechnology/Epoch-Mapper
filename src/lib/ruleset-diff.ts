/**
 * Ruleset diff/patch against the built-in default ruleset.
 *
 * ~80% of every `.epochmap` used to be the byte-for-byte identical default
 * ruleset (the stock classes, spells, enemies, items … that most games never
 * touch). v3 stops re-serializing it: instead of the whole `Ruleset`, a file
 * stores only what differs from `makeDefaultRuleset()`, and the loader
 * reconstitutes the rest from the bundled defaults.
 *
 * The diff is exactly lossless — order, membership, and content all round-trip:
 *
 *  - `meta`, `formulas`, `combatTuning` are small, so they're stored whole when
 *    present (no per-field diffing to get subtly wrong).
 *  - Each id-keyed table stores, at most:
 *      · `ids` — the full ordered id list, ONLY when order/membership differs
 *                from the default table (a plain reorder or a deletion).
 *      · `set` — the full def for any id whose content differs from the default
 *                (edited entries) or that has no default (brand-new entries).
 *    A table identical to the default is omitted entirely.
 *
 * Reconstruct: start from `makeDefaultRuleset()`, replace `meta` wholesale,
 * then for each table walk `ids` (or the default order) and take the override
 * from `set` when present, else the default def for that id.
 *
 * Self-containment tradeoff (accepted for the ~5× size win): a v3 file is no
 * longer 100% version-independent — it leans on this build's default ruleset to
 * fill the gaps. Additive drift (a later release adding a new default spell) is
 * benign; the defaults are otherwise treated as a stable base.
 */

import type { Ruleset } from './engine-types'
import { makeDefaultRuleset } from './default-ruleset'

/** The 18 id-keyed tables of a Ruleset (everything but meta/formulas/tuning). */
const TABLE_KEYS = [
  'attributes', 'classes', 'races', 'weaponTypes', 'armorTypes', 'spellSchools',
  'audioTracks', 'items', 'spells', 'skills', 'statusEffects', 'enemies',
  'encounterTables', 'lootTables', 'shops', 'events', 'npcs', 'quests',
] as const

type TableKey = (typeof TABLE_KEYS)[number]

/** Any def in a Ruleset table — all carry a string `id`. */
interface Def {
  id: string
}

interface TableDiff {
  /** Full ordered id list; present only when order/membership differs from default. */
  ids?: string[]
  /** Full defs for ids that differ from (or don't exist in) the default table. */
  set?: Record<string, Def>
}

export interface RulesetDiff {
  meta?: Ruleset['meta']
  formulas?: Ruleset['formulas']
  combatTuning?: Ruleset['combatTuning']
  tables?: Partial<Record<TableKey, TableDiff>>
}

// ── canonical structural equality (order-independent, undefined-dropping) ──────

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function defEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function byId(list: Def[]): Record<string, Def> {
  const m: Record<string, Def> = {}
  for (const d of list) m[d.id] = d
  return m
}

// ── diff ───────────────────────────────────────────────────────────────────────

/** Build a compact diff of `r` against the built-in default ruleset. */
export function diffRuleset(r: Ruleset): RulesetDiff {
  const def = makeDefaultRuleset()
  const diff: RulesetDiff = { meta: r.meta }
  if (r.formulas !== undefined) diff.formulas = r.formulas
  if (r.combatTuning !== undefined) diff.combatTuning = r.combatTuning

  const tables: Partial<Record<TableKey, TableDiff>> = {}
  for (const key of TABLE_KEYS) {
    const cur = (r[key] ?? []) as Def[]
    const base = (def[key] ?? []) as Def[]
    const baseById = byId(base)

    const set: Record<string, Def> = {}
    for (const entry of cur) {
      const b = baseById[entry.id]
      if (!b || !defEqual(entry, b)) set[entry.id] = entry
    }

    const curIds = cur.map(e => e.id)
    const baseIds = base.map(e => e.id)
    const orderChanged = curIds.length !== baseIds.length || curIds.some((id, i) => id !== baseIds[i])
    const hasOverrides = Object.keys(set).length > 0

    if (!orderChanged && !hasOverrides) continue // table is fully default → omit

    const td: TableDiff = {}
    if (orderChanged) td.ids = curIds
    if (hasOverrides) td.set = set
    tables[key] = td
  }

  if (Object.keys(tables).length > 0) diff.tables = tables
  return diff
}

// ── patch ────────────────────────────────────────────────────────────────────

/** Reconstitute a full Ruleset from a diff and the built-in defaults. */
export function patchRuleset(diff: RulesetDiff): Ruleset {
  const out = makeDefaultRuleset()
  if (diff.meta) out.meta = diff.meta
  if (diff.formulas !== undefined) out.formulas = diff.formulas
  if (diff.combatTuning !== undefined) out.combatTuning = diff.combatTuning

  const tables = diff.tables ?? {}
  for (const key of TABLE_KEYS) {
    const td = tables[key]
    if (!td) continue // unchanged → keep the default table
    const baseById = byId((out[key] ?? []) as Def[])
    const set = td.set ?? {}
    const order = td.ids ?? (out[key] as Def[]).map(e => e.id)
    const rebuilt = order.map(id => set[id] ?? baseById[id]).filter(Boolean) as Def[]
    // Assigning through the union of def-array types; the diff guarantees shape.
    ;(out as unknown as Record<string, Def[]>)[key] = rebuilt
  }
  return out
}
