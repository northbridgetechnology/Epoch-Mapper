'use client'

/**
 * Shared NPC (character) definition editor — the stat block (via the NPC schema),
 * a portrait picker, the NPC's conversation (authored inline via the embedded
 * ConversationEditor), and its ambient barks.
 */

import { Plus, Trash2 } from 'lucide-react'
import type { NpcDef, Ruleset } from '@/lib/engine-types'
import { NPC_SCHEMA } from '@/lib/npc-schema'
import { SchemaForm } from './SchemaForm'
import { PortraitPicker } from './PortraitPicker'
import { ConversationEditor } from './ConversationEditor'

export function NpcEditor({ npc, ruleset, onChange, onRulesetChange }: {
  npc: NpcDef
  ruleset: Ruleset
  onChange: (n: NpcDef) => void
  onRulesetChange: (r: Ruleset) => void
}) {
  const barks = npc.barks ?? []
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <SchemaForm
        schema={NPC_SCHEMA}
        value={npc as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...npc, ...(v as Partial<NpcDef>) })}
      />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Portrait</div>
        <PortraitPicker value={npc.portrait} onChange={p => onChange({ ...npc, portrait: p })} allowEmoji columns={8} />
      </div>

      {/* Conversation — authored inline (Quick or Advanced) */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5">Conversation</div>
        <ConversationEditor npc={npc} ruleset={ruleset} onRulesetChange={onRulesetChange} />
      </div>

      {/* Ambient barks */}
      <div className="pt-2 border-t border-white/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
            Barks <span className="normal-case text-white/30">(a random one plays when the NPC comes into view)</span>
          </span>
          <button
            onClick={() => onChange({ ...npc, barks: [...barks, ''] })}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
          >
            <Plus className="w-3 h-3" /> Add Bark
          </button>
        </div>
        <div className="space-y-1.5">
          {barks.length === 0 && <div className="text-[11px] text-white/25 italic">No barks — this NPC is silent until spoken to.</div>}
          {barks.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text" value={b} placeholder="An ambient one-liner…"
                onChange={e => onChange({ ...npc, barks: barks.map((x, j) => j === i ? e.target.value : x) })}
                className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 italic focus:outline-none focus:border-amber-500/40"
              />
              <button onClick={() => onChange({ ...npc, barks: barks.filter((_, j) => j !== i) })}
                className="p-0.5 rounded text-white/30 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
