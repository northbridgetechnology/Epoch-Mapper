'use client'

/**
 * King's Field-style listening dialogue: a letterboxed box at the bottom of
 * the view. The player doesn't choose responses — E/Enter/Space advances
 * pages; the final advance dismisses and fires the line's effects upstream.
 */

import { useEffect, useState } from 'react'
import type { NpcDef, NpcLine } from '@/lib/engine-types'
import { resolveText, type TextActor } from '@/lib/text-tokens'

export function DialogueOverlay({ npc, line, mc, onFinish }: {
  npc: NpcDef
  line: NpcLine
  mc?: TextActor | null
  onFinish: () => void
}) {
  const [page, setPage] = useState(0)
  const pages = line.text.length > 0 ? line.text.map(t => resolveText(t, mc)) : ['…']
  const last = page >= pages.length - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'Escape' || last) onFinish()
        else setPage(p => p + 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [last, onFinish])

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-2xl px-4 pb-6 pointer-events-auto">
        <div
          className="rounded-xl border border-amber-500/25 bg-zinc-950/95 shadow-2xl px-5 py-4 flex gap-4 cursor-pointer select-none"
          onClick={() => (last ? onFinish() : setPage(p => p + 1))}
        >
          <div className="flex-shrink-0 w-14 h-14 grid place-items-center rounded-lg bg-zinc-900 border border-white/10 text-4xl leading-none">
            {npc.portrait ?? '🧑'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold tracking-wide text-amber-300/90 mb-1">
              {npc.name}
            </div>
            <div className="text-sm text-white/85 leading-relaxed italic">
              &ldquo;{pages[page]}&rdquo;
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
              <span>{pages.length > 1 ? `${page + 1} / ${pages.length}` : ''}</span>
              <span className="animate-pulse">{last ? 'E — leave' : 'E — continue ▼'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
