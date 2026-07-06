'use client'

/**
 * Shared NPC (character) definition editor — stat block via the NPC schema plus
 * a dialogue-line editor. Used by the Characters workspace (authoring the cast).
 */

import { Plus, Trash2 } from 'lucide-react'
import type { NpcDef, NpcLine, Ruleset } from '@/lib/engine-types'
import { NPC_SCHEMA } from '@/lib/npc-schema'
import { ConditionBuilder } from '@/components/CellInspector'
import { SchemaForm } from './SchemaForm'
import { EffectBuilder } from './EffectBuilder'
import { PortraitPicker } from './PortraitPicker'

function NpcLineEditor({ line, ruleset, onChange, onRemove }: {
  line: NpcLine
  ruleset: Ruleset
  onChange: (l: NpcLine) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded bg-zinc-800 border border-white/10 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <input type="text" value={line.id} placeholder="line_id"
          onChange={e => onChange({ ...line, id: e.target.value })}
          className="w-28 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs font-mono text-white/80 focus:outline-none" />
        <label className="flex items-center gap-1 text-xs text-white/50">
          Priority
          <input type="number" value={line.priority ?? 0}
            onChange={e => onChange({ ...line, priority: e.target.valueAsNumber || 0 })}
            className="w-14 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs font-mono text-white/80 focus:outline-none" />
        </label>
        <label className="flex items-center gap-1 text-xs text-white/50">
          <input type="checkbox" checked={line.once ?? false}
            onChange={e => onChange({ ...line, once: e.target.checked || undefined })} /> Once
        </label>
        <label className="flex items-center gap-1 text-xs text-white/50" title="Plays automatically when the NPC comes into view">
          <input type="checkbox" checked={line.bark ?? false}
            onChange={e => onChange({ ...line, bark: e.target.checked || undefined })} /> Bark
        </label>
        <button onClick={onRemove} className="ml-auto p-0.5 rounded text-white/30 hover:text-red-400">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <textarea
        value={line.text.join('\n\n')}
        onChange={e => onChange({ ...line, text: e.target.value.split(/\n{2,}/) })}
        placeholder={'What the NPC says… Blank line = new page.'}
        rows={3}
        className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 italic leading-relaxed focus:outline-none focus:border-amber-500/40"
      />
      <ConditionBuilder conditions={line.conditions ?? []} ruleset={ruleset}
        onChange={cs => onChange({ ...line, conditions: cs.length ? cs : undefined })} />
      <EffectBuilder label="After the line (effects)" effects={line.effects ?? []} ruleset={ruleset}
        onChange={effs => onChange({ ...line, effects: effs.length ? effs : undefined })} />
    </div>
  )
}

export function NpcEditor({ npc, ruleset, onChange }: {
  npc: NpcDef
  ruleset: Ruleset
  onChange: (n: NpcDef) => void
}) {
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
      <div className="pt-2 border-t border-white/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
            Lines <span className="normal-case text-white/30">(highest passing priority is spoken)</span>
          </span>
          <button
            onClick={() => onChange({ ...npc, lines: [...(npc.lines ?? []), { id: `line_${(npc.lines ?? []).length + 1}`, text: ['…'] }] })}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
          >
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>
        <div className="space-y-2">
          {(npc.lines ?? []).map((line, i) => (
            <NpcLineEditor key={i} line={line} ruleset={ruleset}
              onChange={l => onChange({ ...npc, lines: npc.lines.map((x, j) => j === i ? l : x) })}
              onRemove={() => onChange({ ...npc, lines: npc.lines.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
