/**
 * Player Character Builder — point-buy attribute allocation and assembly of the
 * player's Main Character. Pure; the builder UI drives these and the result is
 * a normal `Character` produced through `newCharacter`.
 *
 * Point-buy model (flat pool, 1:1): every attribute starts at its `default`;
 * the player spends `meta.pointBuyPool` points at 1 point = +1, clamped to each
 * attribute's `min`/`max`. Class/race modifiers apply afterwards (inside
 * `newCharacter`), so the numbers shown here are pure player choice.
 */

import type { AttributeDef, Character, Pronoun, Ruleset } from './engine-types'
import { newCharacter, type NewCharacterOpts } from './save-state'

export const DEFAULT_POINT_POOL = 10

export interface BuildDraft {
  name: string
  classId: string
  raceId: string
  portrait?: string
  pronoun: Pronoun
  bio?: string
  /** Points added to each attribute over its default (always ≥ 0). */
  alloc: Record<string, number>
}

export function pointPool(ruleset: Ruleset): number {
  return ruleset.meta.pointBuyPool ?? DEFAULT_POINT_POOL
}

/** A zeroed allocation (nothing spent yet). */
export function emptyAlloc(ruleset: Ruleset): Record<string, number> {
  const alloc: Record<string, number> = {}
  for (const attr of ruleset.attributes) alloc[attr.id] = 0
  return alloc
}

/** The pre-modifier score the player is choosing (default + spent, clamped). */
export function attrScore(attr: AttributeDef, alloc: Record<string, number>): number {
  return Math.min(attr.max, Math.max(attr.min, attr.default + (alloc[attr.id] ?? 0)))
}

export function pointsSpent(alloc: Record<string, number>): number {
  return Object.values(alloc).reduce((sum, n) => sum + Math.max(0, n), 0)
}

export function pointsRemaining(ruleset: Ruleset, alloc: Record<string, number>): number {
  return pointPool(ruleset) - pointsSpent(alloc)
}

/** Can this attribute go up? Needs a spare point and headroom below its max. */
export function canRaise(ruleset: Ruleset, attr: AttributeDef, alloc: Record<string, number>): boolean {
  return pointsRemaining(ruleset, alloc) > 0 && attr.default + (alloc[attr.id] ?? 0) < attr.max
}

/** Can this attribute go down? Only points the player added can be refunded. */
export function canLower(attr: AttributeDef, alloc: Record<string, number>): boolean {
  return (alloc[attr.id] ?? 0) > 0
}

export function raise(alloc: Record<string, number>, attrId: string): Record<string, number> {
  return { ...alloc, [attrId]: (alloc[attrId] ?? 0) + 1 }
}

export function lower(alloc: Record<string, number>, attrId: string): Record<string, number> {
  return { ...alloc, [attrId]: Math.max(0, (alloc[attrId] ?? 0) - 1) }
}

/** Assemble the finished Main Character from a completed draft. */
export function buildCharacter(ruleset: Ruleset, draft: BuildDraft, isMc = true): Character {
  const attrBase: Record<string, number> = {}
  for (const attr of ruleset.attributes) attrBase[attr.id] = attrScore(attr, draft.alloc)
  const opts: NewCharacterOpts = {
    attrBase,
    portrait: draft.portrait,
    pronoun: draft.pronoun,
    bio: draft.bio?.trim() || undefined,
    isMc,
  }
  return newCharacter(draft.name.trim() || 'Hero', draft.classId, draft.raceId, ruleset, opts)
}
