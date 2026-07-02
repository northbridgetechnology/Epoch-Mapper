/**
 * Battle playfield view-state (pure, no React).
 *
 * Formation is assigned by the combat engine at initCombat time (each enemy
 * actor carries rank/lane/size — see CombatActor). This module projects that
 * into the shape FirstPersonView renders:
 *   rank 0 = the cell directly ahead, rank 1 = the cell behind it
 *   lane   = sub-cube column within the cell (0=screen-left, 1=center, 2=right)
 * Large enemies (size 2) claim their lane in both ranks and render scaled up,
 * straddling the rank boundary.
 */

import type { CombatState, CombatActor, CombatEvent } from './combat-engine'

export interface EnemyPlacement {
  /** Index into CombatState.actors */
  actorIdx: number
  /** 0 = front cell (1 ahead of party), 1 = back cell (2 ahead) */
  rank: 0 | 1
  /** Sub-cube column: 0 = screen-left, 1 = center, 2 = screen-right */
  lane: 0 | 1 | 2
  size: 1 | 2
}

/** Everything FirstPersonView needs to draw a battle over the playfield. */
export interface BattleViewState {
  placements: EnemyPlacement[]
  actors: CombatActor[]
  /** Actor whose turn it is (amber pulse when it's an enemy) */
  activeIdx: number
  /** Enemy actor idxs currently selectable as targets */
  targetableIdxs: number[]
  /** Current target cursor (red ring + arrow), or null */
  selectedIdx: number | null
  /** Feedback from the most recent action (popups / hit flashes) */
  events: CombatEvent[]
  /** Monotonic action counter — keys popup animations so they replay */
  eventSeq: number
  onSelectTarget?: (actorIdx: number) => void
}

export function buildBattlePlacements(state: CombatState): EnemyPlacement[] {
  return state.actors
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.kind === 'enemy')
    .map(({ a, i }) => ({
      actorIdx: i,
      rank: a.rank,
      lane: a.lane ?? 1,
      size: a.size ?? 1,
    }))
}
