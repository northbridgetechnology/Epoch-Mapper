/**
 * Pure turn-based combat engine (Phase E5).
 * No DOM, no React. All mutations return new state objects.
 */

import type { Character, ActiveStatus, EnemyAbility, Effect, ItemInstance, Ruleset } from './engine-types'
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

function partyActorFromChar(char: Character, originalIdx: number): CombatActor {
  return {
    kind: 'party',
    idx: originalIdx,
    name: char.name,
    icon: char.portrait,
    hp: char.hp,
    maxHp: char.maxHp,
    mp: char.mp,
    maxMp: char.maxMp,
    attack: (char.attributes['might'] ?? 10) + Math.floor(char.level * 0.5),
    defense: Math.floor((char.attributes['endurance'] ?? 10) / 2),
    speed: char.attributes['agility'] ?? 10,
    xp: 0,
    gold: 0,
    alive: char.alive && char.hp > 0,
    statuses: char.statuses ?? [],
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
): { actors: CombatActor[]; log: CombatLogEntry[] } {
  let cur = [...actors]
  const log: CombatLogEntry[] = []
  const casterName = cur[casterIdx]?.name ?? '?'

  for (const eff of effects) {
    const idxs = targetIdxs.length > 0 ? targetIdxs : [casterIdx]

    for (const tIdx of idxs) {
      const target = cur[tIdx]
      if (!target) continue

      if (eff.t === 'damage') {
        if (!target.alive) continue
        const base = rollDice(eff.amount, rng)
        const crit = eff.canCrit !== false && rng() < 0.1
        const raw = Math.max(1, Math.round(base * (crit ? 1.5 : 1)))
        const dmg = target.defending ? Math.max(1, Math.floor(raw / 2)) : raw
        const newHp = Math.max(0, target.hp - dmg)
        cur = cur.map((a, i) => i === tIdx ? { ...a, hp: newHp, alive: newHp > 0 } : a)
        log.push({
          text: crit
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
        log.push({ text: `${target.name} recovers ${gained} HP.`, kind: 'info' })

      } else if (eff.t === 'restoreMp') {
        if (!target.alive) continue
        const amount = rollDice(eff.amount, rng)
        const newMp = Math.min(target.maxMp, target.mp + amount)
        const gained = newMp - target.mp
        cur = cur.map((a, i) => i === tIdx ? { ...a, mp: newMp } : a)
        log.push({ text: `${target.name} recovers ${gained} MP.`, kind: 'info' })

      } else if (eff.t === 'status') {
        if (!target.alive) continue
        const chance = eff.chance ?? 1
        if (rng() > chance) {
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

  return { actors: cur, log }
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
  if (endPhase) return { ...state, phase: endPhase }

  const nextIdx = nextAliveTurn(state.actors, state.turnIdx)
  const phase: CombatPhase = state.actors[nextIdx].kind === 'party' ? 'player_action' : 'enemy_turn'

  const { actors: ticked, log: tickLog, blocked } = tickStatuses(nextIdx, state.actors, ruleset, rng)
  // Guard stance ends when the actor's own turn comes back around
  const tickedActors = ticked.map((a, i) => (i === nextIdx && a.defending ? { ...a, defending: false } : a))
  const newLog = [...state.log, ...tickLog]

  if (blocked) {
    const blockedEntry: CombatLogEntry = { text: `${tickedActors[nextIdx].name} cannot act.`, kind: 'info' }
    // Recursively advance past the blocked actor
    return advanceTurn({ ...state, actors: tickedActors, log: [...newLog, blockedEntry], turnIdx: nextIdx, phase }, ruleset, rng)
  }

  return { ...state, actors: tickedActors, log: newLog, turnIdx: nextIdx, phase }
}

// ── Hit calculation (physical) ────────────────────────────────────────────────

interface HitResult { damage: number; crit: boolean; miss: boolean }

function calcHit(attacker: CombatActor, defender: CombatActor, rng: () => number): HitResult {
  const missChance = defender.defense > attacker.attack * 1.5 ? 0.25 : 0.05
  if (rng() < missChance) return { damage: 0, crit: false, miss: true }
  const crit = rng() < 0.1
  const base = Math.max(1, attacker.attack - Math.floor(defender.defense / 2))
  const variance = rng() * 0.3
  const raw = Math.max(1, Math.round(base * (1 + variance) * (crit ? 1.5 : 1)))
  const damage = defender.defending ? Math.max(1, Math.floor(raw / 2)) : raw
  return { damage, crit, miss: false }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initCombat(party: Character[], encounter: ResolvedEncounter): CombatState {
  const partyActors = party
    .map((c, i) => partyActorFromChar(c, i))
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
  }))

  const actors = [...partyActors, ...enemyActors].sort(
    (a, b) => b.speed - a.speed || (a.kind === 'party' ? -1 : 1),
  )

  const firstIdx = actors.findIndex(a => a.alive)
  const firstPhase: CombatPhase = actors[firstIdx]?.kind === 'party' ? 'player_action' : 'enemy_turn'

  return {
    actors,
    turnIdx: Math.max(0, firstIdx),
    phase: firstPhase,
    log: [{ text: `A wild encounter with ${encounter.tableName}!`, kind: 'info' }],
    fleeAttempts: 0,
    xpReward: encounter.xpReward,
    goldReward: encounter.goldReward,
    itemsUsed: {},
  }
}

// ── Player: attack ────────────────────────────────────────────────────────────

export function resolvePlayerAttack(
  state: CombatState,
  targetActorIdx: number,
  ruleset: Ruleset,
  rng: () => number,
): CombatState {
  const attacker = state.actors[state.turnIdx]
  const defender = state.actors[targetActorIdx]
  if (!attacker || !defender || !defender.alive || defender.kind !== 'enemy') return state

  const result = calcHit(attacker, defender, rng)
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

  return advanceTurn({ ...state, actors: newActors, log: newLog }, ruleset, rng)
}

// ── Player: cast spell ────────────────────────────────────────────────────────

export function resolvePlayerCast(
  state: CombatState,
  spellId: string,
  targetActorIdxs: number[],
  ruleset: Ruleset,
  rng: () => number,
): CombatState {
  const caster = state.actors[state.turnIdx]
  if (!caster || !caster.alive) return state

  const spell = ruleset.spells.find(s => s.id === spellId)
  if (!spell || caster.mp < spell.mpCost) return state

  const actorsAfterMp = state.actors.map((a, i) =>
    i === state.turnIdx ? { ...a, mp: a.mp - spell.mpCost } : a,
  )

  const castEntry: CombatLogEntry = { text: `${caster.name} casts ${spell.name}!`, kind: 'spell' }

  const { actors: newActors, log: effectLog } = resolveCombatEffects(
    spell.effects,
    state.turnIdx,
    targetActorIdxs,
    actorsAfterMp,
    ruleset,
    rng,
  )

  return advanceTurn(
    { ...state, actors: newActors, log: [...state.log, castEntry, ...effectLog] },
    ruleset,
    rng,
  )
}

// ── Player: flee ──────────────────────────────────────────────────────────────

export function resolvePlayerFlee(
  state: CombatState,
  ruleset: Ruleset,
  rng: () => number,
): CombatState {
  const attempts = state.fleeAttempts + 1
  const success = attempts >= 2 || rng() < 0.5
  if (success) {
    return {
      ...state,
      fleeAttempts: attempts,
      phase: 'fled',
      log: [...state.log, { text: 'You fled from battle!', kind: 'flee' }],
    }
  }
  const failEntry: CombatLogEntry = { text: 'Failed to escape!', kind: 'flee_fail' }
  return advanceTurn({ ...state, fleeAttempts: attempts, log: [...state.log, failEntry] }, ruleset, rng)
}

// ── Player: defend ────────────────────────────────────────────────────────────

export function resolvePlayerDefend(
  state: CombatState,
  ruleset: Ruleset,
  rng: () => number,
): CombatState {
  const actor = state.actors[state.turnIdx]
  if (!actor || !actor.alive) return state
  const actors = state.actors.map((a, i) =>
    i === state.turnIdx ? { ...a, defending: true } : a,
  )
  const entry: CombatLogEntry = { text: `${actor.name} defends.`, kind: 'info' }
  return advanceTurn({ ...state, actors, log: [...state.log, entry] }, ruleset, rng)
}

// ── Player: use item ──────────────────────────────────────────────────────────

export function resolvePlayerUseItem(
  state: CombatState,
  itemId: string,
  targetActorIdxs: number[],
  ruleset: Ruleset,
  rng: () => number,
): CombatState {
  const user = state.actors[state.turnIdx]
  if (!user || !user.alive) return state
  const def = ruleset.items.find(i => i.id === itemId)
  if (!def || def.kind !== 'consumable' || !def.onUse?.length) return state

  const useEntry: CombatLogEntry = { text: `${user.name} uses ${def.name}!`, kind: 'info' }
  const { actors, log } = resolveCombatEffects(
    def.onUse, state.turnIdx, targetActorIdxs, state.actors, ruleset, rng,
  )
  const itemsUsed = { ...state.itemsUsed, [itemId]: (state.itemsUsed[itemId] ?? 0) + 1 }
  return advanceTurn(
    { ...state, actors, itemsUsed, log: [...state.log, useEntry, ...log] },
    ruleset,
    rng,
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
  rng: () => number,
): CombatState {
  const enemy = state.actors[state.turnIdx]
  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) return advanceTurn(state, ruleset, rng)

  const partyTargets = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'party' && a.alive)
  if (partyTargets.length === 0) return { ...state, phase: 'defeat' }

  // Try to use an enemy ability
  const enemyDef = enemy.defId ? ruleset.enemies.find(e => e.id === enemy.defId) : null
  const abilities: EnemyAbility[] | undefined = enemyDef?.abilities

  if (abilities?.length) {
    const totalWeight = abilities.reduce((s, a) => s + a.weight, 0)
    let pick = rng() * totalWeight
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
        targetIdxs = [partyTargets[Math.floor(rng() * partyTargets.length)].i]
    }

    const abilityEntry: CombatLogEntry = { text: `${enemy.name} uses an ability!`, kind: 'spell' }
    const { actors: newActors, log: effectLog } = resolveCombatEffects(
      chosen.effects, state.turnIdx, targetIdxs, state.actors, ruleset, rng,
    )
    return advanceTurn(
      { ...state, actors: newActors, log: [...state.log, abilityEntry, ...effectLog] },
      ruleset, rng,
    )
  }

  // Default: physical attack
  const { a: defender, i: targetIdx } = partyTargets[Math.floor(rng() * partyTargets.length)]
  const result = calcHit(enemy, defender, rng)
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

  return advanceTurn({ ...state, actors: newActors, log: newLog }, ruleset, rng)
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
        return { ...char, level: newLevel, xp: newXp - threshold, maxHp: newMaxHp, hp: newMaxHp, maxMp: newMaxMp, mp: newMaxMp }
      }
      return { ...char, xp: newXp }
    })
  }

  return { party: updated, levelUps }
}
