/**
 * Battle formation placement (pure, no React).
 *
 * Maps each enemy actor in a CombatState onto the first-person playfield in
 * front of the party, using the 3×3×3 sub-cube slots of the cells ahead:
 *   rank 0 = the cell directly ahead, rank 1 = the cell behind it
 *   lane   = sub-cube column within the cell (0=screen-left, 1=center, 2=right)
 * Enemies stand on the floor (sub-cube y=0) at the cell's center depth.
 * Large enemies (EnemyDef.size === 2) claim their lane in BOTH ranks and
 * render scaled up, straddling the rank boundary.
 */

import type { CombatState, CombatActor } from './combat-engine'
import type { Ruleset } from './engine-types'

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
  onSelectTarget?: (actorIdx: number) => void
}

export interface EnemyPlacement {
  /** Index into CombatState.actors */
  actorIdx: number
  /** 0 = front cell (1 ahead of party), 1 = back cell (2 ahead) */
  rank: 0 | 1
  /** Sub-cube column: 0 = screen-left, 1 = center, 2 = screen-right */
  lane: 0 | 1 | 2
  size: 1 | 2
}

/** Fill order: center first, then left, then right — classic formation look. */
const LANE_ORDER: (0 | 1 | 2)[] = [1, 0, 2]

export function buildBattlePlacements(state: CombatState, ruleset: Ruleset): EnemyPlacement[] {
  const enemies = state.actors
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.kind === 'enemy')

  const front = [false, false, false]
  const back = [false, false, false]
  const out: EnemyPlacement[] = []

  for (const { a, i } of enemies) {
    const def = ruleset.enemies.find(e => e.id === a.defId)
    const size: 1 | 2 = def?.size === 2 ? 2 : 1

    if (size === 2) {
      const lane = LANE_ORDER.find(l => !front[l] && !back[l])
      if (lane !== undefined) {
        front[lane] = back[lane] = true
        out.push({ actorIdx: i, rank: 0, lane, size })
        continue
      }
    }

    let lane = LANE_ORDER.find(l => !front[l])
    if (lane !== undefined) {
      front[lane] = true
      out.push({ actorIdx: i, rank: 0, lane, size })
      continue
    }
    lane = LANE_ORDER.find(l => !back[l])
    if (lane !== undefined) {
      back[lane] = true
      out.push({ actorIdx: i, rank: 1, lane, size })
      continue
    }
    // Overflow beyond 6: double up in the back rank round-robin
    out.push({ actorIdx: i, rank: 1, lane: LANE_ORDER[out.length % 3], size })
  }

  return out
}
