/**
 * Authored-text token substitution — lets a game's dialogue, inscriptions,
 * quests, opening story, and ending address the player's Main Character by
 * name and pronoun. Pure, no DOM.
 *
 *   {mc} / {name}                          → the MC's name
 *   {they} {them} {their} {theirs} {themself}  → pronoun forms
 *
 * Tokens are case-insensitive; a capitalized token (`{They}`) capitalizes the
 * substitution. With no MC, tokens pass through unchanged.
 */

import type { Character, Pronoun } from './engine-types'

interface PronounForms {
  subject: string   // they / he / she
  object: string    // them / him / her
  possAdj: string   // their / his / her
  possPron: string  // theirs / his / hers
  reflexive: string // themself / himself / herself
}

const PRONOUNS: Record<Pronoun, PronounForms> = {
  he:   { subject: 'he',   object: 'him',  possAdj: 'his',   possPron: 'his',    reflexive: 'himself' },
  she:  { subject: 'she',  object: 'her',  possAdj: 'her',   possPron: 'hers',   reflexive: 'herself' },
  they: { subject: 'they', object: 'them', possAdj: 'their', possPron: 'theirs', reflexive: 'themself' },
}

const TOKEN_MAP: Record<string, keyof PronounForms | 'name'> = {
  mc: 'name', name: 'name',
  they: 'subject', them: 'object', their: 'possAdj', theirs: 'possPron',
  themself: 'reflexive', themselves: 'reflexive',
}

const TOKEN_RE = /\{(mc|name|they|them|their|theirs|themself|themselves)\}/gi

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

export type TextActor = Pick<Character, 'name' | 'pronoun'>

/** Substitute {mc}/{name}/pronoun tokens in `str` using the Main Character. */
export function resolveText(str: string, mc?: TextActor | null): string {
  if (!str || !mc || str.indexOf('{') === -1) return str
  return str.replace(TOKEN_RE, (match, raw: string) => {
    const key = TOKEN_MAP[raw.toLowerCase()]
    if (!key) return match
    const val = key === 'name' ? mc.name : PRONOUNS[mc.pronoun ?? 'they'][key]
    return /^[A-Z]/.test(raw) ? cap(val) : val
  })
}

/** Resolve every string in a list (e.g. multi-page inscriptions/slides). */
export function resolveTextList(list: string[], mc?: TextActor | null): string[] {
  return mc ? list.map(s => resolveText(s, mc)) : list
}
