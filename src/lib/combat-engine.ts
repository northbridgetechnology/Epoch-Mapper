/**
 * Pure turn-based combat engine (Phase E5).
 * No DOM, no React. All mutations return new state objects.
 */

import type { Character, ActiveStatus, CombatMode, CombatTuning, EnemyAbility, Effect, Formation, ItemInstance, Ruleset } from './engine-types'
import { resolveLootTable } from './event-engine'
import { deriveMaxHp, deriveMaxMp, xpToNextLevel } from './engine-types'
import type { ResolvedEncounter } from './engine-types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CombatPhase = 'player_action' | 'targeting' | 'enemy_turn' | 'victory' | 'defeat' | 'fled'

export interface CombatActor {
  kind: 'party' | 'enemy'
  /** For 'party': index into the original party[]. For 'enemy': index into encounter.enemies[]. */
  idx: number
  name: string
  icon?: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  attack: number
  defense: number
  speed: number
  xp: number    // enemies only; 0 for party
  gold: number  // enemies only; 0 for party
  alive: boolean
  statuses: ActiveStatus[]
  defId?: string   // enemies only — links back to EnemyDef for ability lookup
  /** Guarding this round: incoming damage is halved until the actor's next turn */
  defending?: boolean
  /** 0 = front rank/row, 1 = back. Each back rank halves melee dealt/taken. */
  rank: 0 | 1
  /** Enemies only: sub-cube lane on the playfield (0=left, 1=center, 2=right). */
  lane?: 0 | 1 | 2
  /** Enemies only: 1 = standard, 2 = large (claims its lane in both ranks). */
  size?: 1 | 2
  /** Damage-type reduction fractions (negative = weakness, ≥1 = immune).
   *  Enemies: from EnemyDef.resistances; party: from RaceDef.resistances. */
  resistances?: Partial<Record<string, number>>
  /** Damage element of this actor's basic attack (from the equipped weapon's
   *  type, or an item override). Absent = 'physical'. */
  weaponDamageType?: string
  /** Reach of this actor's basic attack. Ranged attacks ignore back-rank
   *  penalties. Absent = 'melee'. */
  weaponRange?: 'melee' | 'ranged'
}

/** A discrete thing that happened during one action — drives view feedback
 *  (floating damage popups, hit flashes) without parsing log text. */
export interface CombatEvent {
  target: number   // actor idx
  kind: 'damage' | 'crit' | 'heal' | 'mp' | 'miss' | 'status' | 'weak' | 'resist'
  amount?: number
}

export interface CombatLogEntry {
  text: string
  kind: 'damage' | 'crit' | 'miss' | 'info' | 'flee' | 'flee_fail' | 'spell'
}

export interface CombatState {
  actors: CombatActor[]
  turnIdx: number
  phase: CombatPhase
  log: CombatLogEntry[]
  fleeAttempts: number
  xpReward: number
  goldReward: number
  /** Consumables used this battle (item id → count); applied to the shared
   *  inventory by consumeCombatItems() when combat ends — used items stay
   *  used even on flee or defeat. */
  itemsUsed: Record<string, number>
  /** Seeded PRNG stream state — battles are deterministic given the same
   *  initial seed and action sequence (callers may still inject an rng). */
  rngState: number
  /** Feedback events from the most recent action (see CombatEvent). */
  events: CombatEvent[]
  /** Monotonic counter bumped per action — keys popup animations in the view. */
  eventSeq: number
  /** Items rolled from enemy loot tables at the moment of victory. */
  drops: { item: string; qty: number }[]
  /** Battle round (1-based); advances when the turn order wraps around. */
  round: number
  /** Battle takes place in an anti-magic zone: party casting is disabled. */
  antiMagic?: boolean
  /** Turn system in effect (from the map). Absent = 'classic'. */
  mode?: CombatMode
  /** oneMore mode: consecutive bonus actions the current actor has taken this
   *  turn (capped to prevent runaway chains). */
  oneMoreStreak?: number
  /** pressTurn mode: which side is currently acting. */
  activeSide?: 'party' | 'enemy'
  /** pressTurn mode: the acting side's remaining turn icons. `full` are whole
   *  icons; `blink` are half/bonus icons earned by weakness & crits. The phase
   *  ends when both reach zero. */
  icons?: { full: number; blink: number }
}

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────

function nextRand(box: { s: number }): number {
  let t = (box.s = (box.s + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ── Tunable combat constants (Ruleset.combatTuning overrides these) ──────────

const TUNING_DEFAULTS: Required<CombatTuning> = {
  critChance: 0.10,
  critMult: 1.5,
  baseMissChance: 0.05,
  outmatchedMissChance: 0.25,
  variance: 0.3,
  defendMult: 0.5,
  backRankMeleeMult: 0.5,
  fleeBase: 0.5,
  fleeSpeedFactor: 0.04,
  fleeRetryBonus: 0.2,
}

function tuning(ruleset: Ruleset): Required<CombatTuning> {
  return { ...TUNING_DEFAULTS, ...(ruleset.combatTuning ?? {}) }
}

// ── Dice ──────────────────────────────────────────────────────────────────────

function rollDice(dice: number | string, rng: () => number): number {
  if (typeof dice === 'number') return dice
  const m = String(dice).match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!m) { const n = parseInt(dice, 10); return isNaN(n) ? 0 : n }
  let total = 0
  const count = parseInt(m[1], 10)
  const sides = parseInt(m[2], 10)
  for (let i = 0; i < count; i++) total += Math.floor(rng() * sides) + 1
  if (m[3]) total += parseInt(m[3], 10)
  return Math.max(0, total)
}

// ── Actor construction ────────────────────────────────────────────────────────

/** Character attribute maps are keyed inconsistently across the codebase —
 *  runtime characters use the full id ('attr.might') while some seed data uses
 *  the short form ('might'). Read an attribute robustly under either key. */
function readAttr(attrs: Record<string, number>, attrId: string, fallback: number): number {
  return attrs[attrId] ?? attrs[attrId.replace('attr.', '')] ?? fallback
}

function partyActorFromChar(
  char: Character,
  originalIdx: number,
  rank: 0 | 1,
  ruleset?: Ruleset,
): CombatActor {
  // Equipped items: attribute modifiers adjust the stat pools first, then
  // derived modifiers (attack/defense/speed) adjust the computed values
  const attrs: Record<string, number> = { ...char.attributes }
  const derived: { key: string; op: 'add' | 'mul'; amount: number }[] = []
  let armorSpeedMod = 0
  for (const inst of Object.values(char.equipment ?? {})) {
    if (!inst) continue
    const item = ruleset?.items.find(i => i.id === inst.def)
    for (const m of item?.modifiers ?? []) {
      if (m.target === 'attribute') {
        attrs[m.key] = m.op === 'mul'
          ? Math.round((attrs[m.key] ?? 10) * m.amount)
          : (attrs[m.key] ?? 10) + m.amount
      } else {
        derived.push(m)
      }
    }
    // Armor pieces carry a passive initiative modifier via their type
    if (item?.kind === 'armor' && item.armorType) {
      armorSpeedMod += ruleset?.armorTypes.find(t => t.id === item.armorType)?.speedMod ?? 0
    }
  }

  // The equipped weapon's type drives which attribute scales attack, the basic
  // attack's damage element, and its reach (melee/ranged).
  const weaponInst = char.equipment?.weapon
  const weaponItem = weaponInst ? ruleset?.items.find(i => i.id === weaponInst.def) : undefined
  const wtype = weaponItem?.weaponType ? ruleset?.weaponTypes.find(t => t.id === weaponItem.weaponType) : undefined
  const scalingAttrId = wtype?.scalingAttr ?? 'attr.might'
  const weaponDamageType = weaponItem?.damageType ?? wtype?.damageType ?? 'physical'
  const weaponRange: 'melee' | 'ranged' = wtype?.range ?? 'melee'

  let attack = readAttr(attrs, scalingAttrId, 10) + Math.floor(char.level * 0.5)
  let defense = Math.floor(readAttr(attrs, 'attr.endurance', 10) / 2)
  let speed = readAttr(attrs, 'attr.agility', 10) + armorSpeedMod
  for (const m of derived) {
    if (m.key === 'attack')       attack  = m.op === 'mul' ? Math.round(attack * m.amount)  : attack + m.amount
    else if (m.key === 'defense') defense = m.op === 'mul' ? Math.round(defense * m.amount) : defense + m.amount
    else if (m.key === 'speed')   speed   = m.op === 'mul' ? Math.round(speed * m.amount)   : speed + m.amount
  }
  return {
    kind: 'party',
    idx: originalIdx,
    name: char.name,
    icon: char.portrait,
    hp: char.hp,
    maxHp: char.maxHp,
    mp: char.mp,
    maxMp: char.maxMp,
    attack,
    defense,
    speed,
    xp: 0,
    gold: 0,
    alive: char.alive && char.hp > 0,
    statuses: char.statuses ?? [],
    rank,
    resistances: ruleset?.races.find(r => r.id === char.raceId)?.resistances,
    weaponDamageType,
    weaponRange,
  }
}

// ── Shared in-combat effect resolver ─────────────────────────────────────────

function resolveCombatEffects(
  effects: Effect[],
  casterIdx: number,
  targetIdxs: number[],
  actors: CombatActor[],
  ruleset: Ruleset,
  rng: () => number,
): { actors: CombatActor[]; log: CombatLogEntry[]; events: CombatEvent[] } {
  let cur = [...actors]
  const log: CombatLogEntry[] = []
  const events: CombatEvent[] = []
  const casterName = cur[casterIdx]?.name ?? '?'
  const t = tuning(ruleset)

  for (const eff of effects) {
    const idxs = targetIdxs.length > 0 ? targetIdxs : [casterIdx]

    for (const tIdx of idxs) {
      const target = cur[tIdx]
      if (!target) continue

      if (eff.t === 'damage') {
        if (!target.alive) continue
        const base = rollDice(eff.amount, rng)
        const crit = eff.canCrit !== false && rng() < t.critChance
        const raw = Math.max(1, Math.round(base * (crit ? t.critMult : 1)))
        // Resistance is the fraction blocked; negative values are weaknesses
        const resist = target.resistances?.[eff.dmgType] ?? 0
        const afterResist = Math.max(0, Math.round(raw * (1 - resist)))
        const dmg = target.defending && afterResist > 0
          ? Math.max(1, Math.floor(afterResist * t.defendMult))
          : afterResist
        const newHp = Math.max(0, target.hp - dmg)
        cur = cur.map((a, i) => i === tIdx ? { ...a, hp: newHp, alive: newHp > 0 } : a)
        events.push({ target: tIdx, kind: crit ? 'crit' : 'damage', amount: dmg })
        if (resist < 0) {
          events.push({ target: tIdx, kind: 'weak' })
          log.push({ text: `It strikes ${target.name}'s weakness!`, kind: 'crit' })
        } else if (resist > 0) {
          events.push({ target: tIdx, kind: 'resist' })
        }
        log.push({
          text: dmg === 0
            ? `${target.name} is unaffected.`
            : crit
              ? `${casterName} critically hits ${target.name} for ${dmg}!`
              : `${casterName} hits ${target.name} for ${dmg}.`,
          kind: crit ? 'crit' : 'damage',
        })
        if (newHp === 0) log.push({ text: `${target.name} was defeated!`, kind: 'info' })

      } else if (eff.t === 'heal') {
        if (!target.alive) continue
        const amount = rollDice(eff.amount, rng)
        const newHp = Math.min(target.maxHp, target.hp + amount)
        const gained = newHp - target.hp
        cur = cur.map((a, i) => i === tIdx ? { ...a, hp: newHp } : a)
        events.push({ target: tIdx, kind: 'heal', amount: gained })
        log.push({ text: `${target.name} recovers ${gained} HP.`, kind: 'info' })

      } else if (eff.t === 'restoreMp') {
        if (!target.alive) continue
        const amount = rollDice(eff.amount, rng)
        const newMp = Math.min(target.maxMp, target.mp + amount)
        const gained = newMp - target.mp
        cur = cur.map((a, i) => i === tIdx ? { ...a, mp: newMp } : a)
        events.push({ target: tIdx, kind: 'mp', amount: gained })
        log.push({ text: `${target.name} recovers ${gained} MP.`, kind: 'info' })

      } else if (eff.t === 'status') {
        if (!target.alive) continue
        const chance = eff.chance ?? 1
        if (rng() > chance) {
          events.push({ target: tIdx, kind: 'miss' })
          log.push({ text: `${target.name} resisted!`, kind: 'miss' })
          continue
        }
        const def = ruleset.statusEffects.find(s => s.id === eff.status)
        if (!def) continue
        if (!target.statuses.some(s => s.def === eff.status)) {
          const remaining = def.durationTurns > 0 ? def.durationTurns : 999
          cur = cur.map((a, i) =>
            i === tIdx
              ? { ...a, statuses: [...a.statuses, { def: eff.status, remaining }] }
              : a,
          )
          events.push({ target: tIdx, kind: 'status' })
          log.push({ text: `${target.name} is ${def.name}!`, kind: 'info' })
        }

      } else if (eff.t === 'cure') {
        if (!target.alive) continue
        const newStatuses = eff.status === 'all'
          ? []
          : target.statuses.filter(s => s.def !== eff.status)
        cur = cur.map((a, i) => i === tIdx ? { ...a, statuses: newStatuses } : a)
        const statusName = eff.status === 'all'
          ? 'all ailments'
          : (ruleset.statusEffects.find(s => s.id === eff.status)?.name ?? String(eff.status))
        log.push({ text: `${target.name} is cured of ${statusName}.`, kind: 'info' })

      } else if (eff.t === 'fullHeal') {
        cur = cur.map((a, i) =>
          i === tIdx ? { ...a, hp: a.maxHp, mp: a.maxMp, statuses: [], alive: true } : a,
        )
        events.push({ target: tIdx, kind: 'heal', amount: target.maxHp })
        log.push({ text: `${target.name} is fully restored!`, kind: 'info' })

      } else if (eff.t === 'reviveRandom') {
        const dead = cur.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'party' && !a.alive)
        if (dead.length === 0) continue
        const { a: revived, i: ri } = dead[Math.floor(rng() * dead.length)]
        cur = cur.map((a, i) => i === ri ? { ...a, hp: Math.max(1, Math.floor(a.maxHp * 0.25)), alive: true } : a)
        log.push({ text: `${revived.name} is revived!`, kind: 'info' })
      }
    }
  }

  return { actors: cur, log, events }
}

// ── Status ticking ────────────────────────────────────────────────────────────

function tickStatuses(
  actorIdx: number,
  actors: CombatActor[],
  ruleset: Ruleset,
  rng: () => number,
): { actors: CombatActor[]; log: CombatLogEntry[]; blocked: boolean } {
  const actor = actors[actorIdx]
  if (!actor.alive || !actor.statuses.length) return { actors, log: [], blocked: false }

  let cur = actors
  const log: CombatLogEntry[] = []
  let blocked = false

  for (const status of actor.statuses) {
    const def = ruleset.statusEffects.find(s => s.id === status.def)
    if (!def) continue
    if (def.blocksAction) blocked = true
    if (def.tickEffects?.length) {
      const res = resolveCombatEffects(def.tickEffects, actorIdx, [actorIdx], cur, ruleset, rng)
      cur = res.actors
      log.push(...res.log)
    }
  }

  // Decrement and expire
  cur = cur.map((a, i) => {
    if (i !== actorIdx) return a
    const newStatuses = a.statuses
      .map(s => ({ ...s, remaining: s.remaining - 1 }))
      .filter(s => s.remaining > 0)
    return { ...a, statuses: newStatuses }
  })

  return { actors: cur, log, blocked }
}

// ── Turn flow ─────────────────────────────────────────────────────────────────

function checkEndConditions(actors: CombatActor[]): CombatPhase | null {
  if (!actors.some(a => a.kind === 'enemy' && a.alive)) return 'victory'
  if (!actors.some(a => a.kind === 'party' && a.alive)) return 'defeat'
  return null
}

function nextAliveTurn(actors: CombatActor[], fromIdx: number): number {
  const n = actors.length
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n
    if (actors[idx].alive) return idx
  }
  return fromIdx
}

function advanceTurn(state: CombatState, ruleset: Ruleset, rng: () => number): CombatState {
  const endPhase = checkEndConditions(state.actors)
  if (endPhase === 'victory') {
    // Roll each fallen enemy's loot table once, at the moment of victory
    const drops = state.drops.map(d => ({ ...d }))
    let goldReward = state.goldReward
    for (const a of state.actors) {
      if (a.kind !== 'enemy' || !a.defId) continue
      const lootId = ruleset.enemies.find(e => e.id === a.defId)?.loot
      if (!lootId) continue
      const res = resolveLootTable(lootId, ruleset, rng)
      goldReward += res.gold
      for (const it of res.items) {
        const existing = drops.find(d => d.item === it.item)
        if (existing) existing.qty += it.qty
        else drops.push({ ...it })
      }
    }
    return { ...state, phase: endPhase, drops, goldReward }
  }
  if (endPhase) return { ...state, phase: endPhase }

  const nextIdx = nextAliveTurn(state.actors, state.turnIdx)
  const phase: CombatPhase = state.actors[nextIdx].kind === 'party' ? 'player_action' : 'enemy_turn'
  const round = nextIdx <= state.turnIdx ? state.round + 1 : state.round

  const { actors: ticked, log: tickLog, blocked } = tickStatuses(nextIdx, state.actors, ruleset, rng)
  // Guard stance ends when the actor's own turn comes back around
  const tickedActors = ticked.map((a, i) => (i === nextIdx && a.defending ? { ...a, defending: false } : a))
  const newLog = [...state.log, ...tickLog]

  if (blocked) {
    const blockedEntry: CombatLogEntry = { text: `${tickedActors[nextIdx].name} cannot act.`, kind: 'info' }
    // Recursively advance past the blocked actor
    return advanceTurn({ ...state, actors: tickedActors, log: [...newLog, blockedEntry], turnIdx: nextIdx, phase, round }, ruleset, rng)
  }

  // A fresh actor is up — any oneMore bonus streak resets here.
  return { ...state, actors: tickedActors, log: newLog, turnIdx: nextIdx, phase, round, oneMoreStreak: 0 }
}

// ── Turn advancement by mode (classic / oneMore / pressTurn) ──────────────────

/** What an action's result costs the acting side in press-turn / earns in
 *  oneMore. Derived once per action from its hit result or effect events. */
interface ActionOutcome { weak?: boolean; crit?: boolean; miss?: boolean }

const ONE_MORE_CAP = 8 // safety bound on runaway 1-More chains

type IconCost = 'normal' | 'half' | 'double'

function aliveOnSide(actors: CombatActor[], side: 'party' | 'enemy'): number {
  return actors.filter(a => a.alive && a.kind === side).length
}
function firstAliveOnSide(actors: CombatActor[], side: 'party' | 'enemy'): number {
  return actors.findIndex(a => a.alive && a.kind === side)
}
function nextAliveOnSide(actors: CombatActor[], fromIdx: number, side: 'party' | 'enemy'): number {
  const n = actors.length
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n
    if (actors[idx].alive && actors[idx].kind === side) return idx
  }
  return fromIdx
}

/** Spend from a side's icon pool. Weakness/crit ('half') turns a full icon into
 *  a blinking bonus icon (or consumes a blink); miss/null ('double') burns two;
 *  everything else spends one. Returns whether the side is now out of icons. */
function spendIcons(icons: { full: number; blink: number }, cost: IconCost): { icons: { full: number; blink: number }; ended: boolean } {
  let { full, blink } = icons
  if (cost === 'half') {
    if (blink > 0) blink -= 1
    else if (full > 0) { full -= 1; blink += 1 }
  } else {
    let rem = cost === 'double' ? 2 : 1
    while (rem > 0 && (blink > 0 || full > 0)) {
      if (blink > 0) blink -= 1; else full -= 1
      rem -= 1
    }
  }
  return { icons: { full, blink }, ended: full + blink <= 0 }
}

/** Press-turn advancement: spend icons, keep the side acting while it has any,
 *  otherwise hand control (and a fresh pool) to the other side. */
function advancePressTurn(state: CombatState, ruleset: Ruleset, rng: () => number, cost: IconCost): CombatState {
  if (checkEndConditions(state.actors)) return advanceTurn(state, ruleset, rng)
  const side = state.activeSide ?? 'party'
  const { icons, ended } = spendIcons(state.icons ?? { full: 0, blink: 0 }, cost)
  const pressLog: CombatLogEntry[] = cost === 'half' ? [{ text: 'Press turn!', kind: 'info' }] : []

  const settle = (target: 'same' | 'switch'): CombatState => {
    const nextSide = target === 'same' ? side : (side === 'party' ? 'enemy' : 'party')
    if (target === 'switch' && aliveOnSide(state.actors, nextSide) === 0) return advanceTurn(state, ruleset, rng)
    const nextIdx = target === 'same'
      ? nextAliveOnSide(state.actors, state.turnIdx, side)
      : firstAliveOnSide(state.actors, nextSide)
    const phase: CombatPhase = nextSide === 'party' ? 'player_action' : 'enemy_turn'
    const round = target === 'switch' && nextSide === 'party' ? state.round + 1 : state.round
    const pool = target === 'same' ? icons : { full: aliveOnSide(state.actors, nextSide), blink: 0 }
    const { actors: ticked, log: tickLog, blocked } = tickStatuses(nextIdx, state.actors, ruleset, rng)
    const tickedActors = ticked.map((a, i) => (i === nextIdx && a.defending ? { ...a, defending: false } : a))
    const base: CombatState = {
      ...state, activeSide: nextSide, icons: pool, turnIdx: nextIdx, phase, round,
      actors: tickedActors, log: [...state.log, ...pressLog, ...tickLog],
    }
    // A stunned/frozen actor forfeits — that costs the side a normal icon.
    if (blocked) return advancePressTurn(base, ruleset, rng, 'normal')
    return base
  }

  return ended ? settle('switch') : settle('same')
}

/** Dispatch turn advancement by the battle's combat mode. */
function proceedAfterAction(state: CombatState, ruleset: Ruleset, rng: () => number, outcome: ActionOutcome): CombatState {
  const mode = state.mode ?? 'classic'
  if (mode === 'classic') return advanceTurn(state, ruleset, rng)
  // A lethal blow ends the battle regardless of any pending bonus.
  if (checkEndConditions(state.actors)) return advanceTurn(state, ruleset, rng)

  if (mode === 'oneMore') {
    const earned = !outcome.miss && (outcome.weak || outcome.crit)
    const streak = state.oneMoreStreak ?? 0
    const actor = state.actors[state.turnIdx]
    if (earned && streak < ONE_MORE_CAP && actor?.alive) {
      const phase: CombatPhase = actor.kind === 'party' ? 'player_action' : 'enemy_turn'
      return { ...state, phase, oneMoreStreak: streak + 1, log: [...state.log, { text: 'One More!', kind: 'info' }] }
    }
    return advanceTurn(state, ruleset, rng)
  }

  // pressTurn
  const cost: IconCost = outcome.miss ? 'double' : (outcome.weak || outcome.crit) ? 'half' : 'normal'
  return advancePressTurn(state, ruleset, rng, cost)
}

/** Stamp an action's results onto the outgoing state: advance the RNG stream,
 *  publish feedback events, and bump the animation sequence counter. */
function finishAction(
  out: CombatState,
  box: { s: number },
  events: CombatEvent[],
  prev: CombatState,
): CombatState {
  return { ...out, rngState: box.s, events, eventSeq: prev.eventSeq + 1 }
}

// ── Hit calculation (physical) ────────────────────────────────────────────────

interface HitResult { damage: number; crit: boolean; miss: boolean; weak?: boolean; resisted?: boolean }

function calcHit(
  attacker: CombatActor,
  defender: CombatActor,
  rng: () => number,
  t: Required<CombatTuning>,
): HitResult {
  const missChance = defender.defense > attacker.attack * 1.5 ? t.outmatchedMissChance : t.baseMissChance
  if (rng() < missChance) return { damage: 0, crit: false, miss: true }
  const crit = rng() < t.critChance
  const base = Math.max(1, attacker.attack - Math.floor(defender.defense / 2))
  const variance = rng() * t.variance
  let raw = Math.max(1, Math.round(base * (1 + variance) * (crit ? t.critMult : 1)))
  // Row rules: melee dealt from the back rank and melee taken in the back rank
  // are each reduced. Ranged weapons (bows/guns) ignore rank entirely; spells
  // and effects also ignore rank (handled elsewhere).
  const isMelee = (attacker.weaponRange ?? 'melee') === 'melee'
  if (isMelee && attacker.rank === 1) raw = Math.max(1, Math.floor(raw * t.backRankMeleeMult))
  if (isMelee && defender.rank === 1) raw = Math.max(1, Math.floor(raw * t.backRankMeleeMult))
  // Elemental resistance keyed to the weapon's damage type (negative = weakness,
  // ≥1 = immune). Most weapons are 'physical'; a Flamebrand deals 'fire', etc.
  const dmgType = attacker.weaponDamageType ?? 'physical'
  const resist = defender.resistances?.[dmgType] ?? 0
  raw = Math.max(0, Math.round(raw * (1 - resist)))
  const damage = defender.defending && raw > 0 ? Math.max(1, Math.floor(raw * t.defendMult)) : raw
  return { damage, crit, miss: false, weak: resist < 0, resisted: resist > 0 }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export interface InitCombatOpts {
  /** PRNG seed — battles replay identically given the same seed + actions */
  seed?: number
  /** Party rows: members listed in formation.back fight from the back rank */
  formation?: Formation
  /** Used for enemy size lookup (large enemies straddle both ranks) */
  ruleset?: Ruleset
  /** The encounter cell is an anti-magic zone: spells cannot be cast. */
  antiMagic?: boolean
  /** Turn system for this battle (from the map). Default 'classic'. */
  combatMode?: CombatMode
}

export function initCombat(
  party: Character[],
  encounter: ResolvedEncounter,
  opts?: InitCombatOpts,
): CombatState {
  const partyActors = party
    .map((c, i) => partyActorFromChar(c, i, opts?.formation?.back?.includes(i) ? 1 : 0, opts?.ruleset))
    .filter(a => a.alive)

  const enemyActors: CombatActor[] = encounter.enemies.map((e, i) => ({
    kind: 'enemy',
    idx: i,
    name: e.name,
    icon: e.icon,
    hp: e.hp,
    maxHp: e.maxHp,
    mp: 0,
    maxMp: 0,
    attack: e.attack,
    defense: e.defense,
    speed: e.speed,
    xp: e.xp,
    gold: e.gold,
    alive: true,
    statuses: [],
    defId: e.defId,
    rank: 0 as const,
  }))

  // Formation placement: fill the front rank centre-first, overflow to the
  // back; large (size 2) enemies claim their lane in both ranks
  const laneOrder: (0 | 1 | 2)[] = [1, 0, 2]
  const frontTaken = [false, false, false]
  const backTaken = [false, false, false]
  enemyActors.forEach((actor, i) => {
    const def = opts?.ruleset?.enemies.find(d => d.id === actor.defId)
    const size: 1 | 2 = def?.size === 2 ? 2 : 1
    actor.size = size
    actor.resistances = def?.resistances
    if (size === 2) {
      const lane = laneOrder.find(l => !frontTaken[l] && !backTaken[l])
      if (lane !== undefined) {
        frontTaken[lane] = backTaken[lane] = true
        actor.rank = 0; actor.lane = lane
        return
      }
    }
    let lane = laneOrder.find(l => !frontTaken[l])
    if (lane !== undefined) { frontTaken[lane] = true; actor.rank = 0; actor.lane = lane; return }
    lane = laneOrder.find(l => !backTaken[l])
    if (lane !== undefined) { backTaken[lane] = true; actor.rank = 1; actor.lane = lane; return }
    actor.rank = 1; actor.lane = laneOrder[i % 3]   // overflow beyond 6: double up
  })

  const actors = [...partyActors, ...enemyActors].sort(
    (a, b) => b.speed - a.speed || (a.kind === 'party' ? -1 : 1),
  )

  const firstIdx = actors.findIndex(a => a.alive)
  const firstPhase: CombatPhase = actors[firstIdx]?.kind === 'party' ? 'player_action' : 'enemy_turn'

  const mode: CombatMode = opts?.combatMode ?? 'classic'
  const activeSide = actors[Math.max(0, firstIdx)]?.kind === 'enemy' ? 'enemy' : 'party'

  return {
    actors,
    turnIdx: Math.max(0, firstIdx),
    phase: firstPhase,
    mode,
    oneMoreStreak: 0,
    ...(mode === 'pressTurn'
      ? { activeSide, icons: { full: aliveOnSide(actors, activeSide), blink: 0 } }
      : {}),
    log: [{ text: `A wild encounter with ${encounter.tableName}!`, kind: 'info' }],
    fleeAttempts: 0,
    xpReward: encounter.xpReward,
    goldReward: encounter.goldReward,
    itemsUsed: {},
    rngState: (opts?.seed ?? Math.floor(Math.random() * 0xffffffff)) | 0,
    events: [],
    eventSeq: 0,
    drops: [],
    round: 1,
    antiMagic: opts?.antiMagic || undefined,
  }
}

// ── Player: attack ────────────────────────────────────────────────────────────

export function resolvePlayerAttack(
  state: CombatState,
  targetActorIdx: number,
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const attacker = state.actors[state.turnIdx]
  const defender = state.actors[targetActorIdx]
  if (!attacker || !defender || !defender.alive || defender.kind !== 'enemy') return state

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const result = calcHit(attacker, defender, rand, tuning(ruleset))
  const newHp = Math.max(0, defender.hp - result.damage)
  const died = newHp === 0

  const newActors = state.actors.map((a, i) =>
    i === targetActorIdx ? { ...a, hp: newHp, alive: !died } : a,
  )

  const entry: CombatLogEntry = result.miss
    ? { text: `${attacker.name} missed ${defender.name}!`, kind: 'miss' }
    : result.crit
      ? { text: `${attacker.name} scores a critical hit on ${defender.name} for ${result.damage}!`, kind: 'crit' }
      : { text: `${attacker.name} hits ${defender.name} for ${result.damage}.`, kind: 'damage' }

  const newLog = [...state.log, entry]
  if (died) newLog.push({ text: `${defender.name} was defeated!`, kind: 'info' })

  const events: CombatEvent[] = [
    result.miss
      ? { target: targetActorIdx, kind: 'miss' }
      : { target: targetActorIdx, kind: result.crit ? 'crit' : 'damage', amount: result.damage },
  ]
  if (!result.miss && result.weak) {
    events.push({ target: targetActorIdx, kind: 'weak' })
    newLog.push({ text: `It strikes ${defender.name}'s weakness!`, kind: 'crit' })
  } else if (!result.miss && result.resisted) {
    events.push({ target: targetActorIdx, kind: 'resist' })
  }
  return finishAction(proceedAfterAction({ ...state, actors: newActors, log: newLog }, ruleset, rand, { weak: result.weak, crit: result.crit, miss: result.miss }), box, events, state)
}

// ── Player: cast spell ────────────────────────────────────────────────────────

export function resolvePlayerCast(
  state: CombatState,
  spellId: string,
  targetActorIdxs: number[],
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const caster = state.actors[state.turnIdx]
  if (!caster || !caster.alive) return state

  if (state.antiMagic) {
    return {
      ...state,
      eventSeq: state.eventSeq + 1,
      events: [{ target: state.turnIdx, kind: 'miss' }],
      log: [...state.log, { text: 'The magic fizzles — the anti-magic field devours the spell.', kind: 'info' }],
    }
  }

  const spell = ruleset.spells.find(s => s.id === spellId)
  if (!spell || caster.mp < spell.mpCost) return state

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))

  const actorsAfterMp = state.actors.map((a, i) =>
    i === state.turnIdx ? { ...a, mp: a.mp - spell.mpCost } : a,
  )

  const castEntry: CombatLogEntry = { text: `${caster.name} casts ${spell.name}!`, kind: 'spell' }

  const { actors: newActors, log: effectLog, events } = resolveCombatEffects(
    spell.effects,
    state.turnIdx,
    targetActorIdxs,
    actorsAfterMp,
    ruleset,
    rand,
  )

  return finishAction(
    proceedAfterAction(
      { ...state, actors: newActors, log: [...state.log, castEntry, ...effectLog] },
      ruleset,
      rand,
      { weak: events.some(e => e.kind === 'weak'), crit: events.some(e => e.kind === 'crit') },
    ),
    box, events, state,
  )
}

// ── Player: flee ──────────────────────────────────────────────────────────────

export function resolvePlayerFlee(
  state: CombatState,
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const attempts = state.fleeAttempts + 1

  // Speed-based escape: party average vs the fastest living enemy, with a
  // growing bonus per failed attempt. Clamped so escape is never certain.
  const alive = state.actors.filter(a => a.alive)
  const partySpd = alive.filter(a => a.kind === 'party').map(a => a.speed)
  const avgParty = partySpd.reduce((t, v) => t + v, 0) / Math.max(1, partySpd.length)
  const maxEnemy = alive.filter(a => a.kind === 'enemy').reduce((m, a) => Math.max(m, a.speed), 0)
  const t = tuning(ruleset)
  const chance = Math.min(0.95, Math.max(0.15,
    t.fleeBase + (avgParty - maxEnemy) * t.fleeSpeedFactor + (attempts - 1) * t.fleeRetryBonus))

  if (rand() < chance) {
    return finishAction({
      ...state,
      fleeAttempts: attempts,
      phase: 'fled',
      log: [...state.log, { text: 'You fled from battle!', kind: 'flee' }],
    }, box, [], state)
  }
  const failEntry: CombatLogEntry = { text: 'Failed to escape!', kind: 'flee_fail' }
  return finishAction(
    proceedAfterAction({ ...state, fleeAttempts: attempts, log: [...state.log, failEntry] }, ruleset, rand, {}),
    box, [], state,
  )
}

// ── Player: defend ────────────────────────────────────────────────────────────

export function resolvePlayerDefend(
  state: CombatState,
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const actor = state.actors[state.turnIdx]
  if (!actor || !actor.alive) return state
  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const actors = state.actors.map((a, i) =>
    i === state.turnIdx ? { ...a, defending: true } : a,
  )
  const entry: CombatLogEntry = { text: `${actor.name} defends.`, kind: 'info' }
  return finishAction(proceedAfterAction({ ...state, actors, log: [...state.log, entry] }, ruleset, rand, {}), box, [], state)
}

// ── Player: use item ──────────────────────────────────────────────────────────

export function resolvePlayerUseItem(
  state: CombatState,
  itemId: string,
  targetActorIdxs: number[],
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const user = state.actors[state.turnIdx]
  if (!user || !user.alive) return state
  const def = ruleset.items.find(i => i.id === itemId)
  if (!def || def.kind !== 'consumable' || !def.onUse?.length) return state

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const useEntry: CombatLogEntry = { text: `${user.name} uses ${def.name}!`, kind: 'info' }
  const { actors, log, events } = resolveCombatEffects(
    def.onUse, state.turnIdx, targetActorIdxs, state.actors, ruleset, rand,
  )
  const itemsUsed = { ...state.itemsUsed, [itemId]: (state.itemsUsed[itemId] ?? 0) + 1 }
  return finishAction(
    proceedAfterAction(
      { ...state, actors, itemsUsed, log: [...state.log, useEntry, ...log] },
      ruleset,
      rand,
      { weak: events.some(e => e.kind === 'weak'), crit: events.some(e => e.kind === 'crit') },
    ),
    box, events, state,
  )
}

/** Apply a finished battle's item usage to the shared inventory. */
export function consumeCombatItems(inventory: ItemInstance[], state: CombatState): ItemInstance[] {
  return inventory
    .map(inst => {
      const used = state.itemsUsed[inst.def] ?? 0
      return used > 0 ? { ...inst, qty: Math.max(0, inst.qty - used) } : inst
    })
    .filter(inst => inst.qty > 0)
}

// ── Enemy turn (auto) ─────────────────────────────────────────────────────────

export function resolveEnemyTurn(
  state: CombatState,
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const enemy = state.actors[state.turnIdx]
  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) {
    return finishAction(proceedAfterAction(state, ruleset, rand, {}), box, [], state)
  }

  const partyTargets = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'party' && a.alive)
  if (partyTargets.length === 0) return { ...state, phase: 'defeat' }

  // Try to use an enemy ability
  const enemyDef = enemy.defId ? ruleset.enemies.find(e => e.id === enemy.defId) : null
  // Boss phases: abilities may be gated on the caster's HP or the round number
  const abilities: EnemyAbility[] | undefined = enemyDef?.abilities?.filter(ab => {
    if (!ab.when) return true
    if (ab.when.selfHpBelow !== undefined && enemy.maxHp > 0 && enemy.hp / enemy.maxHp >= ab.when.selfHpBelow) return false
    if (ab.when.roundAtLeast !== undefined && state.round < ab.when.roundAtLeast) return false
    return true
  })

  if (abilities?.length) {
    const totalWeight = abilities.reduce((s, a) => s + a.weight, 0)
    let pick = rand() * totalWeight
    let chosen = abilities[abilities.length - 1]
    for (const ab of abilities) {
      pick -= ab.weight
      if (pick <= 0) { chosen = ab; break }
    }

    // Resolve target list from the ability's target type (from enemy perspective)
    let targetIdxs: number[]
    switch (chosen.target) {
      case 'self':
        targetIdxs = [state.turnIdx]
        break
      case 'allEnemies': // enemy's "enemies" = party
      case 'allAllies':  // enemy's "allies" = also party in simplified model
      case 'enemyRow':
        targetIdxs = partyTargets.map(t => t.i)
        break
      default: // 'enemy', 'ally', 'none'
        targetIdxs = [partyTargets[Math.floor(rand() * partyTargets.length)].i]
    }

    const abilityEntry: CombatLogEntry = { text: `${enemy.name} uses an ability!`, kind: 'spell' }
    const { actors: newActors, log: effectLog, events } = resolveCombatEffects(
      chosen.effects, state.turnIdx, targetIdxs, state.actors, ruleset, rand,
    )
    return finishAction(
      proceedAfterAction(
        { ...state, actors: newActors, log: [...state.log, abilityEntry, ...effectLog] },
        ruleset, rand,
        { weak: events.some(e => e.kind === 'weak'), crit: events.some(e => e.kind === 'crit') },
      ),
      box, events, state,
    )
  }

  // Default: physical attack — targeting per EnemyDef ('weakest' hunts low HP)
  const { a: defender, i: targetIdx } = enemyDef?.targeting === 'weakest'
    ? partyTargets.reduce((m, t) => (t.a.hp < m.a.hp ? t : m), partyTargets[0])
    : partyTargets[Math.floor(rand() * partyTargets.length)]
  const result = calcHit(enemy, defender, rand, tuning(ruleset))
  const newHp = Math.max(0, defender.hp - result.damage)
  const died = newHp === 0

  const newActors = state.actors.map((a, i) =>
    i === targetIdx ? { ...a, hp: newHp, alive: !died } : a,
  )

  const entry: CombatLogEntry = result.miss
    ? { text: `${enemy.name} misses ${defender.name}!`, kind: 'miss' }
    : result.crit
      ? { text: `${enemy.name} lands a critical hit on ${defender.name} for ${result.damage}!`, kind: 'crit' }
      : { text: `${enemy.name} attacks ${defender.name} for ${result.damage}.`, kind: 'damage' }

  const newLog = [...state.log, entry]
  if (died) newLog.push({ text: `${defender.name} has fallen!`, kind: 'info' })

  const events: CombatEvent[] = [
    result.miss
      ? { target: targetIdx, kind: 'miss' }
      : { target: targetIdx, kind: result.crit ? 'crit' : 'damage', amount: result.damage },
  ]
  if (!result.miss && result.weak) events.push({ target: targetIdx, kind: 'weak' })
  return finishAction(proceedAfterAction({ ...state, actors: newActors, log: newLog }, ruleset, rand, { weak: result.weak, crit: result.crit, miss: result.miss }), box, events, state)
}

// ── Turn preview ──────────────────────────────────────────────────────────────

/** The next `count` actor indices in turn order, starting with the current
 *  actor — drives the HUD turn-order strip. */
export function upcomingTurns(state: CombatState, count: number): number[] {
  const out: number[] = []
  let idx = state.turnIdx
  if (state.actors[idx]?.alive) out.push(idx)
  while (out.length < count) {
    idx = nextAliveTurn(state.actors, idx)
    if (!state.actors[idx]?.alive) break
    out.push(idx)
  }
  return out
}

// ── Post-combat: apply outcome to party ───────────────────────────────────────

export function applyCombatOutcome(
  party: Character[],
  state: CombatState,
  ruleset: Ruleset,
): { party: Character[]; levelUps: string[] } {
  let updated = party.map((char, i) => {
    const actor = state.actors.find(a => a.kind === 'party' && a.idx === i)
    if (!actor) return char
    return { ...char, hp: actor.hp, alive: actor.alive && actor.hp > 0, mp: actor.mp, statuses: actor.statuses }
  })

  const levelUps: string[] = []

  if (state.phase === 'victory') {
    const survivors = updated.filter(c => c.alive && c.hp > 0)
    const xpEach = Math.max(0, Math.floor(state.xpReward / Math.max(1, survivors.length)))

    updated = updated.map(char => {
      if (!char.alive || char.hp <= 0 || xpEach === 0) return char
      const newXp = char.xp + xpEach
      const threshold = xpToNextLevel(char.level)
      if (newXp >= threshold) {
        const cls = ruleset.classes.find(c => c.id === char.classId)
        if (!cls) return { ...char, xp: newXp }
        const newLevel = char.level + 1
        const newMaxHp = deriveMaxHp({ level: newLevel, attributes: char.attributes }, cls)
        const newMaxMp = deriveMaxMp({ level: newLevel, attributes: char.attributes }, cls)
        levelUps.push(char.name)
        // Auto-learn spells whose learn table names this class at (or below) the new level
        const learned = ruleset.spells
          .filter(sp => !char.knownSpells.includes(sp.id)
            && sp.learn?.some(l => l.classId === char.classId && l.level <= newLevel))
          .map(sp => sp.id)
        return {
          ...char, level: newLevel, xp: newXp - threshold,
          maxHp: newMaxHp, hp: newMaxHp, maxMp: newMaxMp, mp: newMaxMp,
          knownSpells: learned.length > 0 ? [...char.knownSpells, ...learned] : char.knownSpells,
        }
      }
      return { ...char, xp: newXp }
    })
  }

  return { party: updated, levelUps }
}
