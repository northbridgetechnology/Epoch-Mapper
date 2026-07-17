/**
 * Quick-mode dialogue: a small, graph-free shape for the common NPC —
 * "say a few lines, then optionally offer one action (recruit / give item /
 * set a flag / …)." It compiles down to the exact same {@link DialogueDef}
 * the runtime already plays, so Quick and the full branching editor are two
 * views of one underlying model, not a separate feature.
 *
 * A DialogueDef is "quick-shaped" when it fits this template:
 *   greet  (text pages, no on-enter effects)
 *     └─ optional choices: [accept (≤1 effect, → reply?), decline (→ reply?)]
 * `toQuick` returns null for anything richer (conditions, multiple effects,
 * deeper branches, extra nodes) so the caller falls back to Advanced.
 */

import type { DialogueDef, Effect } from './engine-types'

/** Effect kinds a Quick action can carry. Anything else ⇒ Advanced only. */
export const QUICK_EFFECT_TYPES = [
  'recruit', 'giveItem', 'gold', 'setFlag', 'questStage', 'fullHeal', 'openShop', 'startCombat',
] as const
export type QuickEffectType = (typeof QUICK_EFFECT_TYPES)[number]

export function isQuickEffect(effect: Effect | null | undefined): boolean {
  return !!effect && (QUICK_EFFECT_TYPES as readonly string[]).includes(effect.t)
}

/** The one action a Quick conversation may offer after its greeting. */
export interface QuickAction {
  /** Accept-button label ("Join me", "I'll take it"). */
  label: string
  /** What accepting does — a single friendly effect, or null for a pure branch. */
  effect: Effect | null
  /** NPC's line after accepting (blank = none, conversation just ends). */
  reply: string
  /** Decline-button label. */
  declineLabel: string
  /** NPC's line after declining (blank = none). */
  declineReply: string
}

export interface QuickModel {
  /** Greeting pages, advanced one at a time. */
  lines: string[]
  /** Optional single offer; null = the NPC only talks. */
  action: QuickAction | null
}

export const EMPTY_QUICK: QuickModel = { lines: [], action: null }

/** Parse a DialogueDef into the Quick shape, or null if it's too complex. */
export function toQuick(def: DialogueDef): QuickModel | null {
  const start = def.nodes.find(n => n.id === def.start) ?? def.nodes[0]
  if (!start) return null
  if (start.effects?.length) return null // Quick has no on-enter effects

  const used = new Set<string>([start.id])
  const choices = start.choices ?? []
  let action: QuickAction | null = null

  if (choices.length > 0) {
    if (choices.length > 2) return null
    const [accept, decline] = choices
    if (accept.conditions?.length) return null
    if ((accept.effects?.length ?? 0) > 1) return null
    const effect = accept.effects?.[0] ?? null
    if (effect && !isQuickEffect(effect)) return null

    const reply = terminalText(def, accept.goto, used)
    if (reply === null) return null

    let declineLabel = 'Maybe later'
    let declineReply = ''
    if (decline) {
      if (decline.conditions?.length || decline.effects?.length) return null
      declineLabel = decline.label
      const dr = terminalText(def, decline.goto, used)
      if (dr === null) return null
      declineReply = dr
    }
    action = { label: accept.label, effect, reply, declineLabel, declineReply }
  }

  // Any node we didn't account for makes this richer than Quick can show.
  if (def.nodes.some(n => !used.has(n.id))) return null
  return { lines: [...start.text], action }
}

/** A node reached by `goto` must be a plain terminal (text only). Returns its
 *  joined text, '' when goto is absent, or null when it isn't terminal. */
function terminalText(def: DialogueDef, goto: string | undefined, used: Set<string>): string | null {
  if (!goto) return ''
  const n = def.nodes.find(x => x.id === goto)
  if (!n) return null
  if ((n.choices?.length ?? 0) > 0 || (n.effects?.length ?? 0) > 0) return null
  used.add(n.id)
  return n.text.join('\n\n')
}

/** True when a DialogueDef can be shown (losslessly) in Quick mode. */
export function isQuickShaped(def: DialogueDef): boolean {
  return toQuick(def) !== null
}

const pages = (s: string): string[] => {
  const parts = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  return parts.length ? parts : ['…']
}

/** Compile a Quick model back into a runnable DialogueDef. */
export function fromQuick(model: QuickModel, id: string, name: string): DialogueDef {
  const greet = { id: 'greet', text: model.lines.length ? model.lines : ['…'] } as DialogueDef['nodes'][number]
  const nodes = [greet]

  if (model.action) {
    const a = model.action
    const acceptGoto = a.reply.trim() ? 'accept' : undefined
    const declineGoto = a.declineReply.trim() ? 'decline' : undefined
    greet.choices = [
      {
        label: a.label.trim() || 'Yes',
        ...(a.effect ? { effects: [a.effect] } : {}),
        ...(acceptGoto ? { goto: acceptGoto } : {}),
      },
      {
        label: a.declineLabel.trim() || 'Maybe later',
        ...(declineGoto ? { goto: declineGoto } : {}),
      },
    ]
    if (acceptGoto) nodes.push({ id: 'accept', text: pages(a.reply) })
    if (declineGoto) nodes.push({ id: 'decline', text: pages(a.declineReply) })
  }

  return { id, name, start: 'greet', nodes }
}
