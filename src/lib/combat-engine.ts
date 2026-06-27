/**
 * Pure turn-based combat engine (Phase E4).
 * No DOM, no React. All mutations return new state objects.
 */

import type { Character, Ruleset } from './engine-types'
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
  attack: number
  defense: number
  speed: number
  xp: number    // enemies only; 0 for party
  gold: number  // enemies only; 0 for party
  alive: boolean
}

export interface CombatLogEntry {
  text: string
  kind: 'damage' | 'crit' | 'miss' | 'info' | 'flee' | 'flee_fail'
}

export interface CombatState {
  actors: CombatActor[]
  turnIdx: number
  phase: CombatPhase
  log: CombatLogEntry[]
  fleeAttempts: number
  xpReward: number
  goldReward: number
}

// ── Stat derivation ───────────────────────────────────────────────────────────

function partyActorFromChar(char: Character, originalIdx: number): CombatActor {
  return {
    kind: 'party',
    idx: originalIdx,
    name: char.name,
    icon: char.portrait,
    hp: char.hp,
    maxHp: char.maxHp,
    attack: (char.attributes['might'] ?? 10) + Math.floor(char.level * 0.5),
    defense: Math.floor((char.attributes['endurance'] ?? 10) / 2),
    speed: char.attributes['agility'] ?? 10,
    xp: 0,
    gold: 0,
    alive: char.alive && char.hp > 0,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function advanceTurn(state: CombatState): CombatState {
  const endPhase = checkEndConditions(state.actors)
  if (endPhase) return { ...state, phase: endPhase }
  const nextIdx = nextAliveTurn(state.actors, state.turnIdx)
  const phase: CombatPhase = state.actors[nextIdx].kind === 'party' ? 'player_action' : 'enemy_turn'
  return { ...state, turnIdx: nextIdx, phase }
}

interface HitResult { damage: number; crit: boolean; miss: boolean }

function calcHit(attacker: CombatActor, defender: CombatActor, rng: () => number): HitResult {
  const missChance = defender.defense > attacker.attack * 1.5 ? 0.25 : 0.05
  if (rng() < missChance) return { damage: 0, crit: false, miss: true }
  const crit = rng() < 0.1
  const base = Math.max(1, attacker.attack - Math.floor(defender.defense / 2))
  const variance = rng() * 0.3
  const damage = Math.max(1, Math.round(base * (1 + variance) * (crit ? 1.5 : 1)))
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
    attack: e.attack,
    defense: e.defense,
    speed: e.speed,
    xp: e.xp,
    gold: e.gold,
    alive: true,
  }))

  // Sort by speed desc; ties: party acts before enemies
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
  }
}

// ── Player: attack ────────────────────────────────────────────────────────────

export function resolvePlayerAttack(
  state: CombatState,
  targetActorIdx: number,
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

  return advanceTurn({ ...state, actors: newActors, log: newLog })
}

// ── Player: flee ──────────────────────────────────────────────────────────────

export function resolvePlayerFlee(state: CombatState, rng: () => number): CombatState {
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
  const base: CombatState = { ...state, fleeAttempts: attempts, log: [...state.log, failEntry] }
  return advanceTurn(base)
}

// ── Enemy turn (auto) ─────────────────────────────────────────────────────────

export function resolveEnemyTurn(state: CombatState, rng: () => number): CombatState {
  const enemy = state.actors[state.turnIdx]
  if (!enemy || enemy.kind !== 'enemy' || !enemy.alive) return advanceTurn(state)

  const targets = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'party' && a.alive)
  if (targets.length === 0) return { ...state, phase: 'defeat' }

  const { a: defender, i: targetIdx } = targets[Math.floor(rng() * targets.length)]
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

  return advanceTurn({ ...state, actors: newActors, log: newLog })
}

// ── Post-combat: apply outcome to party ───────────────────────────────────────

export function applyCombatOutcome(
  party: Character[],
  state: CombatState,
  ruleset: Ruleset,
): { party: Character[]; levelUps: string[] } {
  // Sync HP/alive from actors back to party members
  let updated = party.map((char, i) => {
    const actor = state.actors.find(a => a.kind === 'party' && a.idx === i)
    if (!actor) return char
    return { ...char, hp: actor.hp, alive: actor.alive && actor.hp > 0 }
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
