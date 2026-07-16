'use client'

/**
 * Branching dialogue box, letterboxed at the bottom of the view. E/Enter/Space
 * (or clicking) advances text pages; on the final page, if the node offers
 * choices they appear as numbered buttons (1–9 keys select). A node with no
 * choices ends the conversation on the last advance. Escape leaves.
 *
 * Node/choice effects and `goto` navigation are driven by the parent — this
 * component only renders the current node and reports the chosen branch.
 */

import { useEffect, useState } from 'react'
import type { DialogueNode } from '@/lib/engine-types'
import { resolveText, type TextActor } from '@/lib/text-tokens'

export function DialogueOverlay({ speaker, portrait, node, choices, mc, onChoose, onClose }: {
  speaker: string
  portrait?: string
  node: DialogueNode
  /** Already condition-filtered; `index` is the choice's index in node.choices. */
  choices: { label: string; index: number }[]
  mc?: TextActor | null
  onChoose: (index: number) => void
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  useEffect(() => { setPage(0) }, [node.id]) // restart paging when the node changes

  const pages = node.text.length > 0 ? node.text.map(t => resolveText(t, mc)) : ['…']
  const lastPage = page >= pages.length - 1
  const showChoices = lastPage && choices.length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Swallow the key completely so the map's own keydown listener can't also
      // act on it — otherwise the same 'e' that closes the box would re-fire
      // "interact" on the NPC you're facing and instantly reopen the dialogue.
      const consume = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation() }
      if (e.key === 'Escape') { consume(); onClose(); return }
      if (showChoices) {
        const n = parseInt(e.key, 10)
        if (n >= 1 && n <= choices.length) { consume(); onChoose(choices[n - 1].index) }
        return
      }
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') {
        consume()
        if (lastPage) onClose(); else setPage(p => p + 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [showChoices, lastPage, choices, onChoose, onClose])

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-2xl px-4 pb-6 pointer-events-auto">
        <div className="rounded-xl border border-amber-500/25 bg-zinc-950/95 shadow-2xl px-5 py-4 flex gap-4 select-none">
          <div className="flex-shrink-0 w-14 h-14 grid place-items-center rounded-lg bg-zinc-900 border border-white/10 text-4xl leading-none">
            {portrait ?? '🧑'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold tracking-wide text-amber-300/90 mb-1">{speaker}</div>
            <div
              className={showChoices ? 'text-sm text-white/85 leading-relaxed italic' : 'text-sm text-white/85 leading-relaxed italic cursor-pointer'}
              onClick={() => { if (!showChoices) { if (lastPage) onClose(); else setPage(p => p + 1) } }}
            >
              &ldquo;{pages[page]}&rdquo;
            </div>

            {showChoices ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {choices.map((c, i) => (
                  <button
                    key={c.index}
                    onClick={() => onChoose(c.index)}
                    className="w-full text-left text-sm px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-white/80 hover:bg-amber-500/15 hover:border-amber-500/40 hover:text-white transition"
                  >
                    <span className="text-amber-300/70 font-mono mr-2">{i + 1}</span>{c.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
                <span>{pages.length > 1 ? `${page + 1} / ${pages.length}` : ''}</span>
                <span className="animate-pulse">{lastPage ? 'E — leave' : 'E — continue ▼'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
