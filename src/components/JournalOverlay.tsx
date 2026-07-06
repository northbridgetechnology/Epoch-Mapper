'use client'

/**
 * In-game journal (J): active/completed quests and the lore log of every
 * NPC line the party has heard. Pure derivation from save flags — quest
 * state lives at quest.<id>.stage, heard lines at npcline.<npc>.<line>.
 */

import { useEffect, useState } from 'react'
import { ScrollText, BookOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { questStageFlagKey, npcLineHeardFlagKey } from '@/lib/event-engine'
import type { Ruleset } from '@/lib/engine-types'
import { resolveText, type TextActor } from '@/lib/text-tokens'

export function JournalOverlay({ ruleset, flags, mc, onClose }: {
  ruleset: Ruleset
  flags: Record<string, boolean | number | string>
  mc?: TextActor | null
  onClose: () => void
}) {
  const [tab, setTab] = useState<'quests' | 'lore'>('quests')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'j' || e.key === 'J') {
        e.preventDefault(); e.stopPropagation(); onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const quests = (ruleset.quests ?? []).map(q => {
    const stage = Number(flags[questStageFlagKey(q.id)] ?? 0)
    return { q, stage, done: q.stages.length > 0 && stage >= q.stages.length }
  })
  const active = quests.filter(x => x.stage >= 1 && !x.done)
  const completed = quests.filter(x => x.done)

  const lore = (ruleset.npcs ?? []).map(npc => ({
    npc,
    heard: (npc.lines ?? []).filter(l => flags[npcLineHeardFlagKey(npc.id, l.id)]),
  })).filter(x => x.heard.length > 0)

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/60" onClick={onClose}>
      <div
        className="w-[26rem] max-w-[92%] max-h-[80%] flex flex-col rounded-xl border border-amber-500/25 bg-zinc-950/95 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10">
          <button onClick={() => setTab('quests')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              tab === 'quests' ? 'bg-amber-600/20 text-amber-300' : 'text-white/40 hover:text-white')}>
            <ScrollText className="w-3.5 h-3.5" /> Quests
          </button>
          <button onClick={() => setTab('lore')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              tab === 'lore' ? 'bg-amber-600/20 text-amber-300' : 'text-white/40 hover:text-white')}>
            <BookOpen className="w-3.5 h-3.5" /> Lore
          </button>
          <button onClick={onClose} className="ml-auto p-1 rounded text-white/30 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
          {tab === 'quests' && (
            <>
              {active.length === 0 && completed.length === 0 && (
                <div className="text-white/30 text-xs text-center py-6 italic">
                  The journal is empty. The world holds its secrets close.
                </div>
              )}
              {active.map(({ q, stage }) => (
                <div key={q.id} className="rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-amber-200/90 font-semibold text-xs">
                    <span>{(q as { icon?: string }).icon ?? '📜'}</span>{q.name}
                    <span className="ml-auto font-normal text-white/30">stage {stage}/{q.stages.length}</span>
                  </div>
                  <div className="mt-1 text-xs text-white/65 leading-relaxed">
                    {resolveText(q.stages[stage - 1]?.description ?? q.description, mc)}
                  </div>
                </div>
              ))}
              {completed.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1.5">Completed</div>
                  {completed.map(({ q }) => (
                    <div key={q.id} className="flex items-center gap-1.5 text-xs text-white/40 py-0.5">
                      <span className="text-emerald-400/70">✓</span> {q.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'lore' && (
            <>
              {lore.length === 0 && (
                <div className="text-white/30 text-xs text-center py-6 italic">
                  No words heard yet. Speak with those you meet.
                </div>
              )}
              {lore.map(({ npc, heard }) => (
                <div key={npc.id} className="rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-white/75 font-semibold text-xs mb-1">
                    <span>{npc.portrait ?? '🧑'}</span>{npc.name}
                  </div>
                  <div className="space-y-1.5">
                    {heard.map(l => (
                      <div key={l.id} className="text-xs text-white/55 italic leading-relaxed">
                        &ldquo;{resolveText(l.text.join(' '), mc)}&rdquo;
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
