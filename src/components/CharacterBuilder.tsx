'use client'

/**
 * Player Character Builder — creates the Main Character on New Game (and is
 * reusable from the Party workspace for authoring/testing). Name, portrait
 * (built-in pixel faces or an upload), pronoun, class, race, point-buy
 * attributes, and an optional bio, with a live derived-stat preview.
 */

import { useMemo, useState } from 'react'
import type { Character, Pronoun, Ruleset } from '@/lib/engine-types'
import {
  emptyAlloc, attrScore, pointsRemaining, canRaise, canLower, raise, lower,
  buildCharacter, pointPool, type BuildDraft,
} from '@/lib/char-build'
import { Portrait, isBuiltinPortrait, suggestPortrait } from '@/lib/portraits'
import { PortraitPicker } from './forms/PortraitPicker'

const PRONOUNS: { id: Pronoun; label: string }[] = [
  { id: 'he', label: 'He / him' },
  { id: 'she', label: 'She / her' },
  { id: 'they', label: 'They / them' },
]

export function CharacterBuilder({ ruleset, onDone, onCancel, title = 'Create your hero' }: {
  ruleset: Ruleset
  onDone: (mc: Character) => void
  onCancel?: () => void
  title?: string
}) {
  const classId0 = ruleset.classes[0]?.id ?? ''
  const raceId0 = ruleset.races[0]?.id ?? ''
  const [draft, setDraft] = useState<BuildDraft>({
    name: '',
    classId: classId0,
    raceId: raceId0,
    portrait: suggestPortrait(ruleset.classes[0]?.name),
    pronoun: 'they',
    bio: '',
    alloc: emptyAlloc(ruleset),
  })
  const pointBuy = (ruleset.meta.attrMethod ?? 'pointBuy') !== 'fixed'
  const pool = pointPool(ruleset)
  const remaining = pointsRemaining(ruleset, draft.alloc)
  const preview = useMemo(() => buildCharacter(ruleset, draft), [ruleset, draft])
  const patch = (p: Partial<BuildDraft>) => setDraft(d => ({ ...d, ...p }))

  const cls = ruleset.classes.find(c => c.id === draft.classId)

  const finalAttrs = ruleset.attributes.map(a => ({
    def: a,
    chosen: attrScore(a, draft.alloc),
    final: preview.attributes[a.id] ?? 0,
  }))

  return (
    <div className="fixed inset-0 z-[74] bg-black/92 backdrop-blur-sm grid place-items-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-amber-500/25 bg-zinc-950 shadow-2xl">
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-white/10 bg-zinc-950/95 backdrop-blur flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-100">{title}</h2>
          <div className="text-xs text-white/40">Shape the one whose tale this is.</div>
        </div>

        <div className="p-6 grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
          {/* Portrait + identity */}
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Portrait value={draft.portrait} size={112} />
              <input
                type="text" value={draft.name} autoFocus placeholder="Name"
                onChange={e => patch({ name: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-white/10 text-center text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Portrait</div>
              <PortraitPicker value={draft.portrait} onChange={p => patch({ portrait: p })} columns={5} />
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Pronoun</div>
              <div className="flex gap-1.5">
                {PRONOUNS.map(p => (
                  <button key={p.id} onClick={() => patch({ pronoun: p.id })}
                    className={`flex-1 px-2 py-1 rounded text-xs ${draft.pronoun === p.id ? 'bg-amber-600/25 text-amber-200 border border-amber-500/40' : 'bg-zinc-800 text-white/50 border border-white/10 hover:text-white'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Class / race / attributes / preview */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Class</span>
                <select value={draft.classId}
                  onChange={e => patch({ classId: e.target.value, portrait: draft.portrait && !isBuiltinPortrait(draft.portrait) ? draft.portrait : suggestPortrait(ruleset.classes.find(c => c.id === e.target.value)?.name) })}
                  className="px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50">
                  {ruleset.classes.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Race</span>
                <select value={draft.raceId} onChange={e => patch({ raceId: e.target.value })}
                  className="px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50">
                  {ruleset.races.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                </select>
              </label>
            </div>

            {/* Point-buy */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wide text-white/40">Attributes</span>
                {pointBuy && (
                  <span className={`text-xs font-mono ${remaining === 0 ? 'text-white/40' : 'text-amber-300'}`}>
                    {remaining} / {pool} points
                  </span>
                )}
              </div>
              {finalAttrs.map(({ def, chosen, final }) => (
                <div key={def.id} className="flex items-center gap-2 text-sm">
                  <span className="w-24 text-white/70 truncate" title={def.name}>{def.name}</span>
                  {pointBuy ? (
                    <>
                      <button onClick={() => patch({ alloc: lower(draft.alloc, def.id) })} disabled={!canLower(def, draft.alloc)}
                        className="w-6 h-6 grid place-items-center rounded bg-zinc-800 text-white/70 disabled:opacity-30 hover:bg-zinc-700">−</button>
                      <span className="w-6 text-center font-mono text-white/90">{chosen}</span>
                      <button onClick={() => patch({ alloc: raise(draft.alloc, def.id) })} disabled={!canRaise(ruleset, def, draft.alloc)}
                        className="w-6 h-6 grid place-items-center rounded bg-zinc-800 text-white/70 disabled:opacity-30 hover:bg-zinc-700">+</button>
                    </>
                  ) : (
                    <span className="w-6 text-center font-mono text-white/90">{chosen}</span>
                  )}
                  {final !== chosen && (
                    <span className={`text-[11px] font-mono ${final > chosen ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                      → {final} <span className="text-white/25">(class/race)</span>
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Derived preview */}
            <div className="flex gap-4 text-sm">
              <Stat label="HP" value={preview.maxHp} />
              <Stat label="MP" value={preview.maxMp} />
              {cls && <Stat label="Class" value={`${cls.icon ?? ''} ${cls.name}`.trim()} />}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-white/40">Bio (optional)</span>
              <textarea value={draft.bio} onChange={e => patch({ bio: e.target.value })} rows={2}
                placeholder="A line of backstory, shown in the Journal…"
                className="px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 resize-none" />
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 px-6 py-4 border-t border-white/10 bg-zinc-950/95 backdrop-blur flex justify-end gap-2">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 rounded-md bg-zinc-800 text-sm text-white/60 hover:text-white">Cancel</button>
          )}
          <button onClick={() => onDone(buildCharacter(ruleset, draft))} disabled={!draft.name.trim()}
            className="px-5 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40">
            Begin the adventure
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-white/40">{label}</span>
      <span className="font-mono text-amber-100">{value}</span>
    </div>
  )
}
