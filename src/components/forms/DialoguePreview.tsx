'use client'

/**
 * In-editor playtest of a DialogueDef. Renders the real player-facing
 * {@link DialogueOverlay} and walks the node graph as the author clicks
 * choices — a structural preview: every branch is shown (choices gated by
 * conditions are flagged with 🔒 rather than hidden), and effects are listed
 * as they'd fire rather than actually executed against a game state.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import type { DialogueDef, Ruleset } from '@/lib/engine-types'
import { dialogueStartNode, dialogueNodeById } from '@/lib/event-engine'
import { DialogueOverlay } from '../DialogueOverlay'
import { effectLabel } from './EffectBuilder'

export function DialoguePreview({ dialogue, ruleset, speaker, portrait, onClose }: {
  dialogue: DialogueDef
  ruleset: Ruleset
  speaker: string
  portrait?: string
  onClose: () => void
}) {
  const start = dialogueStartNode(dialogue)
  const [nodeId, setNodeId] = useState<string>(start?.id ?? '')
  const [log, setLog] = useState<string[]>([])

  const node = dialogueNodeById(dialogue, nodeId) ?? start
  if (!node) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80" onClick={onClose}>
        <div className="text-sm text-white/70">This conversation has no nodes yet.</div>
      </div>
    )
  }

  // Show every branch; flag the ones the player would only see if conditions pass.
  const choices = (node.choices ?? []).map((c, index) => ({
    label: `${c.conditions?.length ? '🔒 ' : ''}${c.label}`,
    index,
  }))

  function choose(index: number) {
    const c = node!.choices?.[index]
    if (!c) return
    if (c.effects?.length) setLog(l => [...l, ...c.effects!.map(e => effectLabel(e, ruleset))])
    if (c.goto) setNodeId(c.goto)
    else onClose()
  }

  function restart() {
    setNodeId(start?.id ?? '')
    setLog([])
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-zinc-950/80">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold uppercase tracking-wide text-[10px]">Preview</span>
          <span className="hidden sm:inline">Choices gated by conditions show 🔒 · effects are listed, not run</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={restart} className="px-2.5 py-1 rounded text-xs text-white/70 hover:text-white hover:bg-white/10">Restart</button>
          <button onClick={onClose} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Effects-fired log */}
      {log.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-amber-200/70 space-y-0.5 max-h-32 overflow-y-auto">
          {log.map((l, i) => <div key={i}>▶ {l}</div>)}
        </div>
      )}

      {/* The real player overlay, driven by local state. Keyed on nodeId so its
          internal paging resets when we jump nodes. */}
      <DialogueOverlay
        key={nodeId}
        speaker={node.speaker || speaker}
        portrait={portrait}
        node={node}
        choices={choices}
        mc={null}
        onChoose={choose}
        onClose={onClose}
      />
    </div>
  )
}
