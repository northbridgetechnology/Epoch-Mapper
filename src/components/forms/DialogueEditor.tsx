'use client'

/**
 * Form-based editor for a branching DialogueDef: a list of nodes, each with
 * text pages, on-enter effects, and player choices (label + conditions +
 * effects + a goto-node). Reuses the shared Condition/Effect builders.
 */

import { Plus, Trash2 } from 'lucide-react'
import type { DialogueDef, DialogueNode, DialogueChoice, Ruleset } from '@/lib/engine-types'
import { ConditionBuilder } from '@/components/CellInspector'
import { EffectBuilder } from './EffectBuilder'

const inputCls = 'px-2 py-1 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/40'

function ChoiceEditor({ choice, nodeIds, ruleset, onChange, onRemove }: {
  choice: DialogueChoice
  nodeIds: string[]
  ruleset: Ruleset
  onChange: (c: DialogueChoice) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded bg-zinc-900 border border-white/10 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <input type="text" value={choice.label} placeholder="Choice label…"
          onChange={e => onChange({ ...choice, label: e.target.value })}
          className={`flex-1 ${inputCls}`} />
        <label className="flex items-center gap-1 text-xs text-white/50">→
          <select value={choice.goto ?? ''} onChange={e => onChange({ ...choice, goto: e.target.value || undefined })}
            className={`${inputCls} font-mono`}>
            <option value="">end</option>
            {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <button onClick={onRemove} className="p-0.5 rounded text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
      <ConditionBuilder conditions={choice.conditions ?? []} ruleset={ruleset}
        onChange={cs => onChange({ ...choice, conditions: cs.length ? cs : undefined })} />
      <EffectBuilder label="On choose (effects)" effects={choice.effects ?? []} ruleset={ruleset}
        onChange={effs => onChange({ ...choice, effects: effs.length ? effs : undefined })} />
    </div>
  )
}

function NodeEditor({ node, nodeIds, ruleset, isStart, onSetStart, onChange, onRemove }: {
  node: DialogueNode
  nodeIds: string[]
  ruleset: Ruleset
  isStart: boolean
  onSetStart: () => void
  onChange: (n: DialogueNode) => void
  onRemove: () => void
}) {
  const choices = node.choices ?? []
  return (
    <div className="rounded bg-zinc-800 border border-white/10 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <input type="text" value={node.id} placeholder="node_id"
          onChange={e => onChange({ ...node, id: e.target.value })}
          className={`w-28 font-mono ${inputCls}`} />
        <input type="text" value={node.speaker ?? ''} placeholder="speaker (optional)"
          onChange={e => onChange({ ...node, speaker: e.target.value || undefined })}
          className={`flex-1 ${inputCls}`} />
        <label className="flex items-center gap-1 text-xs text-white/50" title="The node the conversation opens on">
          <input type="radio" checked={isStart} onChange={onSetStart} /> Start
        </label>
        <button onClick={onRemove} className="p-0.5 rounded text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
      <textarea
        value={node.text.join('\n\n')}
        onChange={e => onChange({ ...node, text: e.target.value.split(/\n{2,}/) })}
        placeholder={'What is said… Blank line = new page.'}
        rows={3}
        className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 italic leading-relaxed focus:outline-none focus:border-amber-500/40"
      />
      <EffectBuilder label="On enter (effects)" effects={node.effects ?? []} ruleset={ruleset}
        onChange={effs => onChange({ ...node, effects: effs.length ? effs : undefined })} />
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wide text-white/40">Choices</span>
          <button onClick={() => onChange({ ...node, choices: [...choices, { label: 'New choice' }] })}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
            <Plus className="w-3 h-3" /> Add Choice
          </button>
        </div>
        {choices.length === 0 && <div className="text-[11px] text-white/25 italic">No choices — the conversation ends after this node&apos;s text.</div>}
        <div className="space-y-1.5">
          {choices.map((c, i) => (
            <ChoiceEditor key={i} choice={c} nodeIds={nodeIds} ruleset={ruleset}
              onChange={nc => onChange({ ...node, choices: choices.map((x, j) => j === i ? nc : x) })}
              onRemove={() => onChange({ ...node, choices: choices.filter((_, j) => j !== i) })} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DialogueEditor({ dialogue, ruleset, onChange }: {
  dialogue: DialogueDef
  ruleset: Ruleset
  onChange: (d: DialogueDef) => void
}) {
  const nodes = dialogue.nodes ?? []
  const nodeIds = nodes.map(n => n.id)
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2">
        <input type="text" value={dialogue.name} placeholder="Dialogue name"
          onChange={e => onChange({ ...dialogue, name: e.target.value })}
          className={`flex-1 ${inputCls} text-sm`} />
        <label className="flex items-center gap-1 text-xs text-white/50">Start
          <select value={dialogue.start} onChange={e => onChange({ ...dialogue, start: e.target.value })}
            className={`${inputCls} font-mono`}>
            {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Nodes</span>
        <button
          onClick={() => {
            const id = `node_${nodes.length + 1}`
            onChange({ ...dialogue, nodes: [...nodes, { id, text: ['…'] }], start: dialogue.start || id })
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> Add Node
        </button>
      </div>

      <div className="space-y-2">
        {nodes.length === 0 && <div className="text-[11px] text-white/25 italic">No nodes yet — add one to begin the conversation.</div>}
        {nodes.map((n, i) => (
          <NodeEditor key={i} node={n} nodeIds={nodeIds} ruleset={ruleset}
            isStart={dialogue.start === n.id}
            onSetStart={() => onChange({ ...dialogue, start: n.id })}
            onChange={nn => onChange({
              ...dialogue,
              nodes: nodes.map((x, j) => j === i ? nn : x),
              start: dialogue.start === n.id ? nn.id : dialogue.start, // keep start pointing at a renamed node
            })}
            onRemove={() => onChange({ ...dialogue, nodes: nodes.filter((_, j) => j !== i) })} />
        ))}
      </div>
    </div>
  )
}
