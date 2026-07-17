/**
 * Pure turn-based combat engine (Phase E5).
 * No DOM, no React. All mutations return new state objects.
 */

import type { Character, ActiveStatus, CombatMode, CombatTuning, EnemyAbility, Effect, Formation, ItemInstance, Ruleset, SkillDef, SpellTarget } from './engine-types'
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
  /** Party only: post-equipment attribute snapshot — drives spell-school
   *  power scaling (SpellSchoolDef.keyAttribute). */
  attrs?: Record<string, number>
  /** Party only: the equipped ranged weapon's ammo hookup. `clipSize > 0` = a
   *  firearm (fire from the loaded clip, Reload from the shared reserve);
   *  `clipSize === 0` = a bow (each shot draws straight from the reserve). The
   *  reserve itself is tracked battle-wide on CombatState (a shared pool), not
   *  here. Absent = melee or a weapon that needs no ammo. */
  ammo?: { type: string; clipSize: number; loaded: number }
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
  /** Charges spent from equipped items (wands/staves) this battle, keyed
   *  `${memberIdx}:${slot}` — applied to party equipment by
   *  applyCombatOutcome(), spent even on flee or defeat. */
  equipChargesUsed?: Record<string, number>
  /** Rounds carried per ammo category at battle start (shared reserve). */
  ammoReserve?: Record<string, number>
  /** Rounds drawn from the reserve this battle (bow shots + reload top-ups),
   *  keyed by ammo category — applied to the shared inventory when combat ends. */
  ammoUsed?: Record<string, number>
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
  /** pressTurn mode: enemy actor indices knocked down by a weakness/crit this
   *  party phase. When every living enemy is down, the party may All-Out Attack.
   *  Enemies stand back up (cleared) when the enemy phase begins. */
  downed?: number[]
  /** Skill cooldowns: `${actorIdx}:${skillId}` → round it is usable again. */
  skillCooldowns?: Record<string, number>
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


/** Effective combat stat: the actor's base plus active status modifiers.
 *  Derived keys (attack/defense/speed) apply directly; attribute keys map to
 *  their derived stat (might→attack, agility→speed, endurance→defense at the
 *  same ratio the derive formulas use). */
function effStat(actor: CombatActor, ruleset: Ruleset, key: 'attack' | 'defense' | 'speed'): number {
  let v = actor[key]
  const ATTR_MAP: Record<string, { key: 'attack' | 'defense' | 'speed'; scale: number }> = {
    might: { key: 'attack', scale: 1 }, agility: { key: 'speed', scale: 1 }, endurance: { key: 'defense', scale: 0.5 },
  }
  for (const st of actor.statuses) {
    const def = ruleset.statusEffects.find(s => s.id === st.def)
    for (const m of def?.modifiers ?? []) {
      if (m.target === 'derived' && m.key === key) {
        v = m.op === 'mul' ? v * m.amount : v + m.amount
      } else if (m.target === 'attribute') {
        const map = ATTR_MAP[m.key.replace('attr.', '')]
        if (map?.key === key && m.op === 'add') v += m.amount * map.scale
      }
    }
  }
  return Math.max(0, Math.round(v))
}

/** Charge mechanic: the first active status granting a boost for this action
 *  scope. The caller multiplies its damage and strips the status (consumed). */
function findBoost(actor: CombatActor, ruleset: Ruleset, scope: 'physical' | 'magical'): { mult: number; statusId: string } | null {
  for (const st of actor.statuses) {
    const def = ruleset.statusEffects.find(s => s.id === st.def)
    if (def?.boostMult && def.boostScope && (def.boostScope === 'any' || def.boostScope === scope)) {
      return { mult: def.boostMult, statusId: def.id }
    }
  }
  return null
}

function stripStatus(actors: CombatActor[], idx: number, statusId: string): CombatActor[] {
  return actors.map((a, i) => i === idx ? { ...a, statuses: a.statuses.filter(s => s.def !== statusId) } : a)
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

  // Ammo hookup: a ranged weapon whose type declares an ammoType. Firearms
  // (weapon item has a clip via `charges`) fire from the loaded clip; bows (no
  // clip) draw each shot from the shared reserve tracked on CombatState.
  const ammo: CombatActor['ammo'] = wtype?.ammoType && weaponItem
    ? { type: wtype.ammoType, clipSize: weaponItem.charges ?? 0, loaded: weaponItem.charges ? (weaponInst?.charges ?? weaponItem.charges) : 0 }
    : undefined

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
    attrs,
    ammo,
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
  /** Flat power added to damage/heal rolls (spell-school attribute scaling). */
  powerBonus = 0,
  /** Damage multiplier (charge mechanic). Applies to damage only, not heals. */
  damageMult = 1,
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
        const base = Math.round((rollDice(eff.amount, rng) + powerBonus) * damageMult)
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
        const amount = rollDice(eff.amount, rng) + powerBonus
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
        if (target.statuses.some(s => s.def === eff.status)) {
          // No stacking and no timer refresh — re-applying (e.g. spamming
          // Charge!) wastes the action. Say so.
          log.push({ text: `${target.name} is already ${def.name}.`, kind: 'info' })
        } else {
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
      // Enemies stand back up when their side takes over.
      downed: target === 'switch' && nextSide === 'enemy' ? [] : state.downed,
    }
    // A stunned/frozen actor forfeits — that costs the side a normal icon.
    if (blocked) return advancePressTurn(base, ruleset, rng, 'normal')
    return base
  }

  return ended ? settle('switch') : settle('same')
}

/** pressTurn: record enemies knocked down by a weakness/crit this action. */
function withDowned(state: CombatState, events: CombatEvent[]): CombatState {
  if (state.mode !== 'pressTurn') return state
  const add = events
    .filter(e => (e.kind === 'weak' || e.kind === 'crit') && state.actors[e.target]?.kind === 'enemy')
    .map(e => e.target)
  if (add.length === 0) return state
  return { ...state, downed: Array.from(new Set([...(state.downed ?? []), ...add])) }
}

/** Whether the party may launch an All-Out Attack right now (pressTurn only). */
export function canAllOutAttack(state: CombatState): boolean {
  if (state.mode !== 'pressTurn' || state.activeSide !== 'party' || state.phase !== 'player_action') return false
  const living = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'enemy' && a.alive)
  if (living.length === 0) return false
  const down = new Set(state.downed ?? [])
  return living.every(({ i }) => down.has(i))
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
  ruleset?: Ruleset,
): HitResult {
  // Status buffs/debuffs (Attack Up, Armor Broken…) shape the effective stats.
  const atk = ruleset ? effStat(attacker, ruleset, 'attack') : attacker.attack
  const dfn = ruleset ? effStat(defender, ruleset, 'defense') : defender.defense
  const missChance = dfn > atk * 1.5 ? t.outmatchedMissChance : t.baseMissChance
  if (rng() < missChance) return { damage: 0, crit: false, miss: true }
  const crit = rng() < t.critChance
  const base = Math.max(1, atk - Math.floor(dfn / 2))
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
  /** Shared inventory at battle start — used to snapshot each fighter's ammo
   *  reserve (arrows/rounds) for their equipped ranged weapon. */
  inventory?: ItemInstance[]
}

export function initCombat(
  party: Character[],
  encounter: ResolvedEncounter,
  opts?: InitCombatOpts,
): CombatState {
  const partyActors = party
    .map((c, i) => partyActorFromChar(c, i, opts?.formation?.back?.includes(i) ? 1 : 0, opts?.ruleset))
    .filter(a => a.alive)

  // Battle-wide ammo reserve: total rounds carried per ammo category. A shared
  // pool so two archers drawing the same arrows don't each see the full count.
  const ammoReserve: Record<string, number> = {}
  for (const inst of opts?.inventory ?? []) {
    const tag = opts?.ruleset?.items.find(d => d.id === inst.def)?.ammoType
    if (tag) ammoReserve[tag] = (ammoReserve[tag] ?? 0) + inst.qty
  }

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
    ammoReserve,
    ammoUsed: {},
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

  // Ranged ammo gate: a firearm fires from its loaded clip, a bow from the
  // shared reserve. With none available the attack isn't allowed (HUD disables
  // it too). `spendReserve` is set when this shot draws from the reserve pool.
  const ammo = attacker.ammo
  const reserveLeft = ammo ? (state.ammoReserve?.[ammo.type] ?? 0) - (state.ammoUsed?.[ammo.type] ?? 0) : 0
  if (ammo && (ammo.clipSize > 0 ? ammo.loaded <= 0 : reserveLeft <= 0)) return state
  const spendReserve = !!ammo && ammo.clipSize === 0

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const result = calcHit(attacker, defender, rand, tuning(ruleset), ruleset)
  // Charge (empower-next): a stored physical boost doubles this hit, consumed.
  const boost = findBoost(attacker, ruleset, 'physical')
  const dmg = !result.miss && boost ? Math.round(result.damage * boost.mult) : result.damage
  const newHp = Math.max(0, defender.hp - dmg)
  const died = newHp === 0

  let newActors = state.actors.map((a, i) => {
    if (i === targetActorIdx) return { ...a, hp: newHp, alive: !died }
    // Firearms spend one round from the loaded clip; bows draw from the reserve.
    if (i === state.turnIdx && ammo && ammo.clipSize > 0) {
      return { ...a, ammo: { ...ammo, loaded: ammo.loaded - 1 } }
    }
    return a
  })
  if (!result.miss && boost) newActors = stripStatus(newActors, state.turnIdx, boost.statusId)
  const ammoUsed = spendReserve
    ? { ...(state.ammoUsed ?? {}), [ammo!.type]: (state.ammoUsed?.[ammo!.type] ?? 0) + 1 }
    : state.ammoUsed
  result.damage = dmg

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
  return finishAction(proceedAfterAction(withDowned({ ...state, actors: newActors, ammoUsed, log: newLog }, events), ruleset, rand, { weak: result.weak, crit: result.crit, miss: result.miss }), box, events, state)
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

  // Spell-school scaling: the school's key attribute adds +1 power per 2
  // points above 10 (schools without a keyAttribute stay flat dice).
  const school = ruleset.spellSchools?.find(s => s.id === spell.school)
  const keyAttr = school?.keyAttribute
  const attrVal = keyAttr && caster.attrs
    ? (caster.attrs[keyAttr] ?? caster.attrs[keyAttr.replace('attr.', '')] ?? 10)
    : 10
  const powerBonus = Math.max(0, Math.floor((attrVal - 10) / 2))

  const boost = spell.effects.some(e => e.t === 'damage') ? findBoost(caster, ruleset, 'magical') : null
  const baseActors = boost ? stripStatus(actorsAfterMp, state.turnIdx, boost.statusId) : actorsAfterMp
  const { actors: newActors, log: effectLog, events } = resolveCombatEffects(
    spell.effects,
    state.turnIdx,
    targetActorIdxs,
    baseActors,
    ruleset,
    rand,
    powerBonus,
    boost?.mult ?? 1,
  )

  return finishAction(
    proceedAfterAction(
      withDowned({ ...state, actors: newActors, log: [...state.log, castEntry, ...effectLog] }, events),
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

// ── Player: press-turn helpers (free member selection + all-out attack) ───────

/** pressTurn: switch which living party member is the active actor. */
export function resolveSelectActor(state: CombatState, idx: number): CombatState {
  if (state.mode !== 'pressTurn' || state.phase !== 'player_action' || state.activeSide !== 'party') return state
  const a = state.actors[idx]
  if (!a || a.kind !== 'party' || !a.alive || idx === state.turnIdx) return state
  return { ...state, turnIdx: idx }
}

/** pressTurn: unleash an All-Out Attack when every living enemy is knocked down.
 *  Heavy party-wide burst, then the party phase ends. */
export function resolveAllOutAttack(state: CombatState, ruleset: Ruleset, rng?: () => number): CombatState {
  if (!canAllOutAttack(state)) return state
  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const t = tuning(ruleset)

  const partyAtk = state.actors.filter(a => a.kind === 'party' && a.alive).reduce((s, a) => s + a.attack, 0)
  const targets = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'enemy' && a.alive)

  const events: CombatEvent[] = []
  const actors = state.actors.map(a => ({ ...a }))
  for (const { i } of targets) {
    const base = Math.max(1, Math.round(partyAtk * 1.5))
    const dmg = Math.max(1, Math.round(base * (1 + rand() * t.variance)))
    const newHp = Math.max(0, actors[i].hp - dmg)
    actors[i] = { ...actors[i], hp: newHp, alive: newHp > 0 }
    events.push({ target: i, kind: 'crit', amount: dmg })
  }

  const log: CombatLogEntry[] = [{ text: 'All-Out Attack!', kind: 'crit' }]
  const felled = targets.filter(({ i }) => !actors[i].alive).length
  if (felled > 0) log.push({ text: `${felled} ${felled === 1 ? 'foe is' : 'foes are'} wiped out!`, kind: 'crit' })

  // The barrage exhausts the party's presses — hand over to the enemy (or end).
  const spent: CombatState = { ...state, actors, downed: [], icons: { full: 0, blink: 0 }, log: [...state.log, ...log] }
  return finishAction(advancePressTurn(spent, ruleset, rand, 'normal'), box, events, state)
}

// ── Player: use skill ─────────────────────────────────────────────────────────

/** Whether the current actor may use `skill` right now (cost + cooldown). */
export function canUseSkill(state: CombatState, skill: SkillDef): { ok: boolean; reason?: string } {
  const user = state.actors[state.turnIdx]
  if (!user || !user.alive || user.kind !== 'party') return { ok: false, reason: 'Not your turn' }
  const hpCost = Math.ceil(user.maxHp * (skill.hpCostPct ?? 0))
  if (hpCost > 0 && user.hp <= hpCost) return { ok: false, reason: 'Not enough HP' }
  if ((skill.mpCost ?? 0) > user.mp) return { ok: false, reason: 'Not enough MP' }
  const readyAt = state.skillCooldowns?.[`${state.turnIdx}:${skill.id}`] ?? 0
  if (state.round < readyAt) return { ok: false, reason: `Ready in ${readyAt - state.round} round${readyAt - state.round === 1 ? '' : 's'}` }
  const ammoCost = skill.ammoCost ?? 0
  if (ammoCost > 0) {
    if (!user.ammo) return { ok: false, reason: 'Requires a ranged weapon' }
    if (skillAmmoAvailable(state, user) < ammoCost) return { ok: false, reason: 'Not enough ammo' }
  }
  return { ok: true }
}

/** Rounds the actor's equipped ranged weapon can spend right now (firearm clip
 *  or bow reserve). Infinity when the weapon needs no ammo. */
function skillAmmoAvailable(state: CombatState, actor: CombatActor): number {
  const ammo = actor.ammo
  if (!ammo) return Infinity
  return ammo.clipSize > 0 ? ammo.loaded : (state.ammoReserve?.[ammo.type] ?? 0) - (state.ammoUsed?.[ammo.type] ?? 0)
}

export function resolvePlayerUseSkill(
  state: CombatState,
  skillId: string,
  targetActorIdxs: number[],
  ruleset: Ruleset,
  rng?: () => number,
): CombatState {
  const user = state.actors[state.turnIdx]
  const skill = (ruleset.skills ?? []).find(s => s.id === skillId)
  if (!user || !skill || !canUseSkill(state, skill).ok) return state

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const hpCost = Math.ceil(user.maxHp * (skill.hpCostPct ?? 0))
  const actorsAfterCost = state.actors.map((a, i) =>
    i === state.turnIdx ? { ...a, hp: a.hp - hpCost, mp: a.mp - (skill.mpCost ?? 0) } : a,
  )
  const entry: CombatLogEntry = { text: `${user.name} uses ${skill.name}!`, kind: 'spell' }
  const boost = skill.effects.some(e => e.t === 'damage') ? findBoost(user, ruleset, 'physical') : null
  const baseActors = boost ? stripStatus(actorsAfterCost, state.turnIdx, boost.statusId) : actorsAfterCost
  const { actors, log, events } = resolveCombatEffects(
    skill.effects, state.turnIdx, targetActorIdxs, baseActors, ruleset, rand, 0, boost?.mult ?? 1,
  )
  const skillCooldowns = skill.cooldown
    ? { ...(state.skillCooldowns ?? {}), [`${state.turnIdx}:${skill.id}`]: state.round + skill.cooldown }
    : state.skillCooldowns

  // Spend ammo: a firearm skill draws from the loaded clip, a bow skill from
  // the shared reserve (both already gated by canUseSkill above).
  const ammoCost = skill.ammoCost ?? 0
  let ammoUsed = state.ammoUsed
  let firedActors = actors
  if (ammoCost > 0 && user.ammo) {
    if (user.ammo.clipSize > 0) {
      firedActors = actors.map((a, i) => i === state.turnIdx && a.ammo
        ? { ...a, ammo: { ...a.ammo, loaded: Math.max(0, a.ammo.loaded - ammoCost) } } : a)
    } else {
      ammoUsed = { ...(state.ammoUsed ?? {}), [user.ammo.type]: (state.ammoUsed?.[user.ammo.type] ?? 0) + ammoCost }
    }
  }

  return finishAction(
    proceedAfterAction(
      withDowned({ ...state, actors: firedActors, ammoUsed, skillCooldowns, log: [...state.log, entry, ...log] }, events),
      ruleset, rand,
      { weak: events.some(e => e.kind === 'weak'), crit: events.some(e => e.kind === 'crit') },
    ),
    box, events, state,
  )
}

// ── Player: reload ────────────────────────────────────────────────────────────

/** A skill may be used in the same turn as a reload only if it doesn't fire the
 *  weapon — i.e. it deals no direct damage and spends no ammo (buffs, heals,
 *  taunts, debuffs). */
export function isReloadCompatibleSkill(skill: SkillDef): boolean {
  return !skill.effects.some(e => e.t === 'damage') && !(skill.ammoCost && skill.ammoCost > 0)
}

/** How many rounds a Reload would move into the clip right now (0 = can't). */
export function reloadableRounds(state: CombatState, actor: CombatActor | undefined): number {
  const ammo = actor?.ammo
  if (!ammo || ammo.clipSize <= 0) return 0
  const reserveLeft = (state.ammoReserve?.[ammo.type] ?? 0) - (state.ammoUsed?.[ammo.type] ?? 0)
  return Math.max(0, Math.min(ammo.clipSize - ammo.loaded, reserveLeft))
}

/** Reload the equipped firearm's clip from the shared reserve, optionally
 *  alongside one non-firing skill (buff/taunt/heal). Costs the turn. */
export function resolvePlayerReload(
  state: CombatState,
  ruleset: Ruleset,
  opts?: { skillId?: string; skillTargets?: number[] },
  rng?: () => number,
): CombatState {
  const user = state.actors[state.turnIdx]
  if (!user || !user.alive || user.kind !== 'party') return state

  const move = reloadableRounds(state, user)
  const skill = opts?.skillId ? (ruleset.skills ?? []).find(s => s.id === opts.skillId) : undefined
  const skillOk = !!skill && isReloadCompatibleSkill(skill) && canUseSkill(state, skill).ok
  if (move <= 0 && !skillOk) return state

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const log: CombatLogEntry[] = []
  let actors = state.actors
  let ammoUsed = state.ammoUsed

  if (move > 0 && user.ammo) {
    const loaded = user.ammo.loaded + move
    actors = actors.map((a, i) => i === state.turnIdx ? { ...a, ammo: { ...a.ammo!, loaded } } : a)
    ammoUsed = { ...(state.ammoUsed ?? {}), [user.ammo.type]: (state.ammoUsed?.[user.ammo.type] ?? 0) + move }
    log.push({ text: `${user.name} reloads (${loaded}/${user.ammo.clipSize}).`, kind: 'info' })
  }

  let events: CombatEvent[] = []
  let skillCooldowns = state.skillCooldowns
  if (skillOk && skill) {
    const hpCost = Math.ceil(user.maxHp * (skill.hpCostPct ?? 0))
    actors = actors.map((a, i) => i === state.turnIdx ? { ...a, hp: a.hp - hpCost, mp: a.mp - (skill.mpCost ?? 0) } : a)
    log.push({ text: `${user.name} uses ${skill.name}!`, kind: 'spell' })
    const r = resolveCombatEffects(skill.effects, state.turnIdx, opts?.skillTargets ?? [], actors, ruleset, rand)
    actors = r.actors; log.push(...r.log); events = r.events
    if (skill.cooldown) skillCooldowns = { ...(state.skillCooldowns ?? {}), [`${state.turnIdx}:${skill.id}`]: state.round + skill.cooldown }
  }

  return finishAction(
    proceedAfterAction(
      withDowned({ ...state, actors, ammoUsed, skillCooldowns, log: [...state.log, ...log] }, events),
      ruleset, rand,
      { weak: events.some(e => e.kind === 'weak'), crit: events.some(e => e.kind === 'crit') },
    ),
    box, events, state,
  )
}

// ── Player: use item ──────────────────────────────────────────────────────────

export function resolvePlayerUseItem(
  state: CombatState,
  itemId: string,
  targetActorIdxs: number[],
  ruleset: Ruleset,
  rng?: () => number,
  /** When set, the use is a charge from the actor's equipped item in this
   *  slot (wand/staff) rather than a consumable from the shared inventory. */
  opts?: { equipSlot?: string },
): CombatState {
  const user = state.actors[state.turnIdx]
  if (!user || !user.alive) return state
  const def = ruleset.items.find(i => i.id === itemId)
  if (!def || !def.onUse?.length) return state
  const fromEquip = opts?.equipSlot
  if (fromEquip ? !def.charges : def.kind !== 'consumable') return state

  const box = { s: state.rngState }
  const rand = rng ?? (() => nextRand(box))
  const useEntry: CombatLogEntry = { text: `${user.name} uses ${def.name}!`, kind: 'info' }
  const { actors, log, events } = resolveCombatEffects(
    def.onUse, state.turnIdx, targetActorIdxs, state.actors, ruleset, rand,
  )
  const chargeKey = fromEquip ? `${user.idx}:${fromEquip}` : null
  const equipChargesUsed = chargeKey
    ? { ...(state.equipChargesUsed ?? {}), [chargeKey]: ((state.equipChargesUsed ?? {})[chargeKey] ?? 0) + 1 }
    : state.equipChargesUsed
  const itemsUsed = chargeKey
    ? state.itemsUsed
    : { ...state.itemsUsed, [itemId]: (state.itemsUsed[itemId] ?? 0) + 1 }
  return finishAction(
    proceedAfterAction(
      withDowned({ ...state, actors, itemsUsed, equipChargesUsed, log: [...state.log, useEntry, ...log] }, events),
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

/** Apply a finished battle's ammo draw (bow shots + reloads) to the shared
 *  inventory, spending rounds from the matching ammo items in carry order. */
export function consumeCombatAmmo(inventory: ItemInstance[], state: CombatState, ruleset: Ruleset): ItemInstance[] {
  const remaining: Record<string, number> = { ...(state.ammoUsed ?? {}) }
  return inventory
    .map(inst => {
      const tag = ruleset.items.find(d => d.id === inst.def)?.ammoType
      if (!tag || !remaining[tag]) return inst
      const take = Math.min(inst.qty, remaining[tag])
      remaining[tag] -= take
      return { ...inst, qty: inst.qty - take }
    })
    .filter(inst => inst.qty > 0)
}

// ── Enemy turn (auto) ─────────────────────────────────────────────────────────

/** An EnemyAbility with its substance resolved from its source. */
export interface ResolvedAbility {
  name: string
  verb: 'casts' | 'uses'
  effects: Effect[]
  target: SpellTarget
}

/** Resolve an ability's substance from its source, in order: database spell,
 *  database skill, custom inline effects. Returns null when nothing usable
 *  resolves (dangling ref, empty effects) — the AI then falls back to the
 *  basic physical attack rather than wasting the turn. */
export function resolveEnemyAbility(ab: EnemyAbility, ruleset: Ruleset): ResolvedAbility | null {
  if (ab.spell) {
    const def = ruleset.spells.find(sp => sp.id === ab.spell)
    if (!def || def.effects.length === 0) return null
    return { name: ab.name ?? def.name, verb: 'casts', effects: def.effects, target: ab.target ?? def.target }
  }
  if (ab.skill) {
    const def = (ruleset.skills ?? []).find(sk => sk.id === ab.skill)
    if (!def || def.effects.length === 0) return null
    return { name: ab.name ?? def.name, verb: 'uses', effects: def.effects, target: ab.target ?? def.target }
  }
  if (ab.effects && ab.effects.length > 0) {
    return { name: ab.name ?? 'an ability', verb: 'uses', effects: ab.effects, target: ab.target ?? 'enemy' }
  }
  return null
}

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
  // Boss phases: abilities may be gated on the caster's HP or the round number.
  // Each usable ability is resolved to its substance (spell/skill/custom) —
  // unresolvable ones drop out and the enemy falls back to a basic attack.
  const abilities = (enemyDef?.abilities ?? [])
    .filter(ab => {
      if (!ab.when) return true
      if (ab.when.selfHpBelow !== undefined && enemy.maxHp > 0 && enemy.hp / enemy.maxHp >= ab.when.selfHpBelow) return false
      if (ab.when.roundAtLeast !== undefined && state.round < ab.when.roundAtLeast) return false
      return true
    })
    .map(ab => ({ ab, res: resolveEnemyAbility(ab, ruleset) }))
    .filter((x): x is { ab: EnemyAbility; res: ResolvedAbility } => x.res !== null)

  // Press modes: the AI hunts weaknesses — abilities whose damage element hits
  // a living member's weakness weigh ×3, since a weak hit earns the side a
  // bonus press / One More.
  const pressMode = state.mode === 'pressTurn' || state.mode === 'oneMore'
  const hitsWeakness = (res: ResolvedAbility) => res.effects.some(e =>
    e.t === 'damage' && partyTargets.some(({ a }) => (a.resistances?.[e.dmgType] ?? 0) < 0))
  const abilityWeight = (x: { ab: EnemyAbility; res: ResolvedAbility }) =>
    x.ab.weight * (pressMode && hitsWeakness(x.res) ? 3 : 1)

  if (abilities.length) {
    const totalWeight = abilities.reduce((s, a) => s + abilityWeight(a), 0)
    let pick = rand() * totalWeight
    let chosen = abilities[abilities.length - 1].res
    for (const x of abilities) {
      pick -= abilityWeight(x)
      if (pick <= 0) { chosen = x.res; break }
    }

    // Resolve target list from the ability's target type (from enemy perspective):
    // 'enemy' = a hero, 'ally' = the enemy's own side (heals/buffs).
    const sideTargets = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'enemy' && a.alive)
    let targetIdxs: number[]
    switch (chosen.target) {
      case 'self':
        targetIdxs = [state.turnIdx]
        break
      case 'allEnemies': // enemy's "enemies" = party
      case 'enemyRow':
        targetIdxs = partyTargets.map(t => t.i)
        break
      case 'ally': // most-wounded living ally on the enemy's own side
        targetIdxs = [sideTargets.reduce((m, t) => (t.a.hp / Math.max(1, t.a.maxHp) < m.a.hp / Math.max(1, m.a.maxHp) ? t : m), sideTargets[0]).i]
        break
      case 'allAllies': // the enemy's whole side
        targetIdxs = sideTargets.map(t => t.i)
        break
      default: // 'enemy', 'none'
        targetIdxs = [partyTargets[Math.floor(rand() * partyTargets.length)].i]
    }

    const abilityEntry: CombatLogEntry = { text: `${enemy.name} ${chosen.verb} ${chosen.name}!`, kind: 'spell' }
    const aBoost = chosen.effects.some(e => e.t === 'damage') ? findBoost(enemy, ruleset, 'magical') : null
    const aBase = aBoost ? stripStatus(state.actors, state.turnIdx, aBoost.statusId) : state.actors
    const { actors: newActors, log: effectLog, events } = resolveCombatEffects(
      chosen.effects, state.turnIdx, targetIdxs, aBase, ruleset, rand, 0, aBoost?.mult ?? 1,
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

  // Default: physical attack — targeting per EnemyDef ('weakest' hunts low HP).
  // In press modes, members weak to physical get hunted first (free presses).
  const physWeak = pressMode ? partyTargets.filter(({ a }) => (a.resistances?.['physical'] ?? 0) < 0) : []
  const pool = physWeak.length > 0 ? physWeak : partyTargets
  const { a: defender, i: targetIdx } = enemyDef?.targeting === 'weakest'
    ? pool.reduce((m, t) => (t.a.hp < m.a.hp ? t : m), pool[0])
    : pool[Math.floor(rand() * pool.length)]
  const result = calcHit(enemy, defender, rand, tuning(ruleset), ruleset)
  const boost = findBoost(enemy, ruleset, 'physical')
  const dmg = !result.miss && boost ? Math.round(result.damage * boost.mult) : result.damage
  const newHp = Math.max(0, defender.hp - dmg)
  const died = newHp === 0

  let newActors = state.actors.map((a, i) =>
    i === targetIdx ? { ...a, hp: newHp, alive: !died } : a,
  )
  if (!result.miss && boost) newActors = stripStatus(newActors, state.turnIdx, boost.statusId)
  result.damage = dmg

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
  return finishAction(proceedAfterAction(withDowned({ ...state, actors: newActors, log: newLog }, events), ruleset, rand, { weak: result.weak, crit: result.crit, miss: result.miss }), box, events, state)
}

// ── Turn preview ──────────────────────────────────────────────────────────────

/** The next `count` actor indices in turn order, starting with the current
 *  actor — drives the HUD turn-order strip. */
export function upcomingTurns(state: CombatState, count: number): number[] {
  const out: number[] = []
  let idx = state.turnIdx
  if (state.actors[idx]?.alive) out.push(idx)
  // pressTurn: only the active side acts until its icons run out, so preview
  // cycles within that side (the icon row conveys how many presses remain).
  if (state.mode === 'pressTurn' && state.activeSide) {
    const side = state.activeSide
    const max = Math.min(count, aliveOnSide(state.actors, side))
    while (out.length < max) {
      idx = nextAliveOnSide(state.actors, idx, side)
      if (!state.actors[idx]?.alive || out.includes(idx)) break
      out.push(idx)
    }
    return out
  }
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
    let next: Character = { ...char, hp: actor.hp, alive: actor.alive && actor.hp > 0, mp: actor.mp, statuses: actor.statuses }
    // Spend equipped-item charges (wands/staves used this battle). The item
    // stays equipped at 0 charges — inert until the author refills it.
    for (const [key, used] of Object.entries(state.equipChargesUsed ?? {})) {
      const [idxStr, slot] = key.split(':')
      if (Number(idxStr) !== i || !used) continue
      const inst = next.equipment[slot as keyof typeof next.equipment]
      if (!inst) continue
      const def = ruleset.items.find(it => it.id === inst.def)
      const remaining = Math.max(0, (inst.charges ?? def?.charges ?? 0) - used)
      next = { ...next, equipment: { ...next.equipment, [slot]: { ...inst, charges: remaining } } }
    }
    // Persist the firearm clip: the loaded round count fired down this battle
    // sticks to the equipped weapon until reloaded.
    if (actor.ammo && actor.ammo.clipSize > 0 && next.equipment.weapon) {
      next = { ...next, equipment: { ...next.equipment, weapon: { ...next.equipment.weapon, charges: actor.ammo.loaded } } }
    }
    return next
  })

  const levelUps: string[] = []

  if (state.phase === 'victory') {
    const survivors = updated.filter(c => c.alive && c.hp > 0)
    const xpEach = Math.max(0, Math.floor(state.xpReward / Math.max(1, survivors.length)))

    updated = updated.map(char => {
      if (!char.alive || char.hp <= 0 || xpEach === 0) return char
      const newXp = char.xp + xpEach
      const threshold = xpToNextLevel(char.level, ruleset.formulas?.xpToNext)
      if (newXp >= threshold) {
        const cls = ruleset.classes.find(c => c.id === char.classId)
        if (!cls) return { ...char, xp: newXp }
        const newLevel = char.level + 1
        // Automatic class growth: attrGrowth raises attributes each level,
        // clamped to each attribute's max. Growth and character maps may key
        // by full id or short name — resolve both.
        const attributes = { ...char.attributes }
        for (const attr of ruleset.attributes) {
          const short = attr.id.replace('attr.', '')
          const growth = cls.attrGrowth[attr.id] ?? cls.attrGrowth[short] ?? 0
          if (!growth) continue
          const key = attributes[attr.id] !== undefined ? attr.id
            : attributes[short] !== undefined ? short : attr.id
          const cur = attributes[key] ?? attr.default
          attributes[key] = Math.min(attr.max, cur + growth)
        }
        // Derive HP/MP after growth so endurance/intellect gains count now.
        const newMaxHp = deriveMaxHp({ level: newLevel, attributes }, cls)
        const newMaxMp = deriveMaxMp({ level: newLevel, attributes }, cls)
        levelUps.push(char.name)
        // Auto-learn spells whose learn table names this class at (or below) the new level
        const learned = ruleset.spells
          .filter(sp => !char.knownSpells.includes(sp.id)
            && sp.learn?.some(l => l.classId === char.classId && l.level <= newLevel))
          .map(sp => sp.id)
        const learnedSkills = (ruleset.skills ?? [])
          .filter(sk => !(char.knownSkills ?? []).includes(sk.id)
            && sk.learn?.some(l => l.classId === char.classId && l.level <= newLevel))
          .map(sk => sk.id)
        return {
          ...char, level: newLevel, xp: newXp - threshold, attributes,
          unspentPoints: (char.unspentPoints ?? 0) + (cls.levelPoints ?? 0),
          maxHp: newMaxHp, hp: newMaxHp, maxMp: newMaxMp, mp: newMaxMp,
          knownSpells: learned.length > 0 ? [...char.knownSpells, ...learned] : char.knownSpells,
          knownSkills: learnedSkills.length > 0 ? [...(char.knownSkills ?? []), ...learnedSkills] : char.knownSkills,
        }
      }
      return { ...char, xp: newXp }
    })
  }

  return { party: updated, levelUps }
}
