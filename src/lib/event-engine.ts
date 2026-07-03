/**
 * Pure exploration event + effect resolver (Phase E6).
 *
 * No DOM, no React. Given cell entities and a context (flags, party,
 * inventory, gold), determines which events fire and what effects to apply.
 */

import type { CellData } from './types'
import type {
  CellEvent, Condition, ObjectInstance, Effect, ItemInstance,
  Character, Ruleset, Facing,
} from './engine-types'

/** Save-flag key holding a quest's current stage (1-based number). */
export function questStageFlagKey(questId: string): string {
  return `quest.${questId}.stage`
}

// ── Doors ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a door's live state, honouring switch-puzzle locks.
 * - requiredFlags (or legacy keyFlag) unset → sealed ('locked')
 * - all flags set → held 'open' (re-seals if a toggle switch flips off)
 * - stored state 'open' (key bypass / author) always wins
 */
export function effectiveDoorState(
  door: import('./engine-types').DoorDef,
  flags: Record<string, boolean | number | string>,
): import('./engine-types').DoorState {
  const required = door.requiredFlags?.length
    ? door.requiredFlags
    : door.keyFlag ? [door.keyFlag] : null
  if (required) {
    if (door.state === 'open') return 'open'
    return required.every(f => !!flags[f]) ? 'open' : 'locked'
  }
  return door.state
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface EventContext {
  flags: Record<string, boolean | number | string>
  party: Character[]
  inventory: ItemInstance[]
  gold: number
}

// ── Exploration effect result ─────────────────────────────────────────────────

/**
 * Mutations that the runtime should apply after resolving a set of effects
 * outside of combat (on-enter, on-interact, object interaction).
 */
export interface ExploreEffect {
  flagSets: Record<string, boolean | number | string>
  messages: string[]
  goldDelta: number
  itemsGained: { item: string; qty: number }[]
  itemsLost: { item: string; qty: number }[]
  teleportTo?: { mapId: string; x: number; y: number; facing?: Facing }
  openShop?: string
  startCombat?: string
  revealRadius?: number
  /** Quest stages advanced during this resolution (for journal toasts). */
  questUpdates: { quest: string; stage: number }[]
  /** NPC placements to relocate (cross-map when mapId is set). */
  npcMoves: { npc: string; mapId?: string; x: number; y: number }[]
  /** NPC to open the dialogue overlay for (first dialogue effect wins). */
  dialogueNode?: string
}

function emptyExploreEffect(): ExploreEffect {
  return { flagSets: {}, messages: [], goldDelta: 0, itemsGained: [], itemsLost: [], questUpdates: [], npcMoves: [] }
}

// ── Condition evaluation ──────────────────────────────────────────────────────

export function checkConditions(
  conditions: Condition[] | undefined,
  ctx: EventContext,
  rng: () => number = Math.random,
): boolean {
  if (!conditions?.length) return true
  return conditions.every(cond => {
    switch (cond.c) {
      case 'flag':
        return ctx.flags[cond.flag] === cond.equals
      case 'hasItem': {
        const total = ctx.inventory.reduce(
          (sum, inst) => inst.def === cond.item ? sum + inst.qty : sum,
          0,
        )
        return total >= (cond.qty ?? 1)
      }
      case 'partyLevel':
        return ctx.party.some(c => c.alive && c.level >= cond.min)
      case 'random':
        return rng() < cond.chance
      case 'questStage': {
        const stage = Number(ctx.flags[questStageFlagKey(cond.quest)] ?? 0)
        if (cond.equals !== undefined) return stage === cond.equals
        return stage >= (cond.min ?? 1)
      }
    }
  })
}

// ── Effect resolution ─────────────────────────────────────────────────────────

/**
 * Resolves an Effect[] in the exploration context (out of combat).
 * Combat-only effects (damage, status, cure, reviveRandom) are ignored here.
 */
/** Flags as they stand mid-resolution: base context + accumulated writes. */
function flagsNow(ctx: EventContext, acc: ExploreEffect): Record<string, boolean | number | string> {
  return { ...ctx.flags, ...acc.flagSets }
}

const MAX_EVENT_DEPTH = 8

export function resolveExploreEffects(
  effects: Effect[],
  ctx: EventContext,
  rng: () => number = Math.random,
  ruleset?: Ruleset,
): ExploreEffect {
  const result = emptyExploreEffect()
  applyEffectsInto(result, effects, ctx, ruleset, rng, 0)
  return result
}

function applyEffectsInto(
  result: ExploreEffect,
  effects: Effect[],
  ctx: EventContext,
  ruleset: Ruleset | undefined,
  rng: () => number,
  depth: number,
): void {
  if (depth > MAX_EVENT_DEPTH) return

  for (const eff of effects) {
    switch (eff.t) {
      case 'message':
        result.messages.push(eff.text)
        break
      case 'gold':
        result.goldDelta += eff.amount
        break
      case 'giveItem':
        result.itemsGained.push({ item: eff.item, qty: eff.qty ?? 1 })
        break
      case 'takeItem':
        result.itemsLost.push({ item: eff.item, qty: eff.qty ?? 1 })
        break
      case 'setFlag':
        result.flagSets[eff.flag] = eff.value
        break
      case 'teleport':
        if (!result.teleportTo) result.teleportTo = { mapId: eff.mapId, x: eff.x, y: eff.y, facing: eff.facing }
        break
      case 'openShop':
        if (!result.openShop) result.openShop = eff.shop
        break
      case 'startCombat':
        if (!result.startCombat) result.startCombat = eff.encounter
        break
      case 'reveal':
        result.revealRadius = Math.max(result.revealRadius ?? 0, eff.radius)
        break
      case 'fullHeal':
        // Handled by DungeonMapper — signal via special message flag
        result.flagSets['_fullHeal'] = true
        break
      case 'heal':
      case 'restoreMp':
        // Out-of-combat healing applied by DungeonMapper
        result.flagSets[`_${eff.t}`] = String(eff.amount)
        break
      case 'dialogue':
        if (!result.dialogueNode) result.dialogueNode = eff.node
        break
      case 'runEvent': {
        const def = ruleset?.events?.find(ev => ev.id === eff.event)
        if (!def) break
        const fl = flagsNow(ctx, result)
        const onceKey = visitedEventFlagKey(def.id)
        if (def.once && fl[onceKey]) break
        if (!checkConditions(def.conditions, { ...ctx, flags: fl }, rng)) break
        if (def.once) result.flagSets[onceKey] = true
        applyEffectsInto(result, def.effects, ctx, ruleset, rng, depth + 1)
        break
      }
      case 'questStage': {
        const key = questStageFlagKey(eff.quest)
        const cur = Number(flagsNow(ctx, result)[key] ?? 0)
        if (eff.stage <= cur) break   // quests never regress
        result.flagSets[key] = eff.stage
        result.questUpdates.push({ quest: eff.quest, stage: eff.stage })
        const stageDef = ruleset?.quests?.find(q => q.id === eff.quest)?.stages[eff.stage - 1]
        if (stageDef?.effects?.length) {
          applyEffectsInto(result, stageDef.effects, ctx, ruleset, rng, depth + 1)
        }
        break
      }
      case 'moveNpc':
        result.npcMoves.push({ npc: eff.npc, mapId: eff.mapId, x: eff.x, y: eff.y })
        break
      default:
        break
    }
  }
}

// ── Sequential cell-event runner + reactive onFlag expansion ──────────────────

function runOneEvent(
  acc: ExploreEffect,
  ev: CellEvent,
  ctx: EventContext,
  ruleset: Ruleset,
  rng: () => number,
): boolean {
  const fl = flagsNow(ctx, acc)
  const onceKey = visitedEventFlagKey(ev.id)
  if (ev.once && fl[onceKey]) return false
  if (!checkConditions(ev.conditions, { ...ctx, flags: fl }, rng)) return false
  if (ev.once) acc.flagSets[onceKey] = true
  applyEffectsInto(acc, ev.effects, ctx, ruleset, rng, 0)
  return true
}

/**
 * Run a cell's events for a trigger SEQUENTIALLY in stored order, threading
 * flag writes between them (an early event's setFlag can satisfy a later
 * event's condition in the same step), then expand reactive onFlag events.
 */
export function runCellEvents(
  cell: CellData,
  trigger: 'onEnter' | 'onInteract',
  ctx: EventContext,
  ruleset: Ruleset,
  rng: () => number = Math.random,
): ExploreEffect {
  const acc = emptyExploreEffect()
  for (const entity of cell.entities ?? []) {
    if (entity.t !== 'event' || entity.event.trigger !== trigger) continue
    runOneEvent(acc, entity.event, ctx, ruleset, rng)
  }
  expandReactive(acc, cell, ctx, ruleset, rng)
  return acc
}

/**
 * Fire onFlag events (on the given cell + the global library) whose conditions
 * NEWLY pass given the accumulated flag writes — edge-triggered, each event at
 * most once per expansion, capped rounds so cycles terminate.
 */
export function expandReactive(
  acc: ExploreEffect,
  cell: CellData | null,
  ctx: EventContext,
  ruleset: Ruleset,
  rng: () => number = Math.random,
): void {
  const fired = new Set<string>()
  let prevFlags = ctx.flags
  for (let round = 0; round < MAX_EVENT_DEPTH; round++) {
    const now = flagsNow(ctx, acc)
    const candidates: CellEvent[] = []
    for (const entity of cell?.entities ?? []) {
      if (entity.t === 'event' && entity.event.trigger === 'onFlag') candidates.push(entity.event)
    }
    for (const g of ruleset.events ?? []) {
      if (g.trigger === 'onFlag') {
        candidates.push({ id: g.id, trigger: 'onFlag', conditions: g.conditions, effects: g.effects, once: g.once })
      }
    }
    let any = false
    for (const ev of candidates) {
      if (fired.has(ev.id)) continue
      const onceKey = visitedEventFlagKey(ev.id)
      if (ev.once && now[onceKey]) continue
      if (!checkConditions(ev.conditions, { ...ctx, flags: now }, rng)) continue
      if (checkConditions(ev.conditions, { ...ctx, flags: prevFlags }, rng)) continue  // not newly passing
      fired.add(ev.id)
      if (ev.once) acc.flagSets[onceKey] = true
      applyEffectsInto(acc, ev.effects, ctx, ruleset, rng, 0)
      any = true
    }
    if (!any) break
    prevFlags = now
  }
}

// ── NPC dialogue lines ────────────────────────────────────────────────────────

/** Save-flag marking a line as heard (drives once-gating and the lore journal). */
export function npcLineHeardFlagKey(npcId: string, lineId: string): string {
  return `npcline.${npcId}.${lineId}`
}

/**
 * Pick the line an NPC speaks right now: among lines of the requested kind
 * (bark or spoken) whose conditions pass and whose once-flag isn't spent,
 * the highest priority wins; array order breaks ties.
 */
export function pickNpcLine(
  npc: import('./engine-types').NpcDef,
  ctx: EventContext,
  opts?: { bark?: boolean },
  rng: () => number = Math.random,
): import('./engine-types').NpcLine | null {
  const wantBark = opts?.bark ?? false
  const eligible = (npc.lines ?? []).filter(l =>
    (l.bark ?? false) === wantBark &&
    !(l.once && ctx.flags[npcLineHeardFlagKey(npc.id, l.id)]) &&
    checkConditions(l.conditions, ctx, rng),
  )
  if (eligible.length === 0) return null
  return eligible.reduce((best, l) => ((l.priority ?? 0) > (best.priority ?? 0) ? l : best), eligible[0])
}

/**
 * Wrap up a spoken/barked line: mark it heard (lore journal), apply its
 * effects, and expand reactive onFlag consequences.
 */
export function finishNpcLine(
  npc: import('./engine-types').NpcDef,
  line: import('./engine-types').NpcLine,
  cell: CellData | null,
  ctx: EventContext,
  ruleset: Ruleset,
  rng: () => number = Math.random,
): ExploreEffect {
  const acc = emptyExploreEffect()
  acc.flagSets[npcLineHeardFlagKey(npc.id, line.id)] = true
  if (line.effects?.length) applyEffectsInto(acc, line.effects, ctx, ruleset, rng, 0)
  expandReactive(acc, cell, ctx, ruleset, rng)
  return acc
}

/** A single flag write (e.g. a wall switch) plus its reactive consequences. */
export function applyFlagWriteWithReactions(
  flag: string,
  value: boolean | number | string,
  cell: CellData | null,
  ctx: EventContext,
  ruleset: Ruleset,
  rng: () => number = Math.random,
): ExploreEffect {
  const acc = emptyExploreEffect()
  acc.flagSets[flag] = value
  expandReactive(acc, cell, ctx, ruleset, rng)
  return acc
}

// ── Triggered events ──────────────────────────────────────────────────────────

/**
 * Returns all CellEvents on a cell that should fire for the given trigger,
 * whose conditions pass, and that haven't been fired (once flag not set).
 */
export function getTriggeredEvents(
  cell: CellData,
  trigger: 'onEnter' | 'onInteract',
  ctx: EventContext,
  rng: () => number = Math.random,
): Array<{ event: CellEvent; flagKey: string }> {
  const results: Array<{ event: CellEvent; flagKey: string }> = []
  if (!cell.entities?.length) return results

  for (const entity of cell.entities) {
    if (entity.t !== 'event') continue
    const ev = entity.event
    if (ev.trigger !== trigger) continue

    const flagKey = visitedEventFlagKey(ev.id)
    if (ev.once && ctx.flags[flagKey]) continue

    if (!checkConditions(ev.conditions, ctx, rng)) continue

    results.push({ event: ev, flagKey })
  }

  return results
}

/**
 * Returns all interactive objects on a cell.
 */
export function getInteractableObjects(cell: CellData): ObjectInstance[] {
  if (!cell.entities?.length) return []
  return cell.entities
    .filter(e => e.t === 'object')
    .map(e => (e as { t: 'object'; object: ObjectInstance }).object)
}

// ── Flag key helpers ──────────────────────────────────────────────────────────

export function visitedEventFlagKey(eventId: string): string {
  return `event.fired.${eventId}`
}

export function objectUsedFlagKey(objectId: string): string {
  return `object.used.${objectId}`
}

// ── Shop helpers ──────────────────────────────────────────────────────────────

/**
 * Resolves a loot table roll to items + gold gained.
 * Used when the party opens a chest or interacts with a loot entity.
 */
export function resolveLootTable(
  lootTableId: string,
  ruleset: Ruleset,
  rng: () => number = Math.random,
): { items: { item: string; qty: number }[]; gold: number } {
  const table = ruleset.lootTables.find(t => t.id === lootTableId)
  if (!table) return { items: [], gold: 0 }

  const items: { item: string; qty: number }[] = []
  for (const drop of table.drops) {
    if (rng() < drop.chance) {
      const qty = typeof drop.qty === 'string'
        ? rollDice(drop.qty, rng)
        : (drop.qty ?? 1)
      items.push({ item: drop.item, qty })
    }
  }

  const gold = table.gold
    ? table.gold.min + Math.floor(rng() * (table.gold.max - table.gold.min + 1))
    : 0

  return { items, gold }
}

function rollDice(dice: string | number, rng: () => number): number {
  if (typeof dice === 'number') return dice
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice.trim())
  if (!m) return parseInt(dice) || 1
  const count = parseInt(m[1])
  const sides = parseInt(m[2])
  const bonus = parseInt(m[3] ?? '0') || 0
  let total = bonus
  for (let i = 0; i < count; i++) total += 1 + Math.floor(rng() * sides)
  return total
}
