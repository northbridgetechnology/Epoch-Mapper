'use client'

/**
 * Form-based editor for a branching DialogueDef: a list of nodes, each with
 * text pages, on-enter effects, and player choices (label + conditions +
 * effects + a goto-node). Reuses the shared Condition/Effect builders.
 *
 * Node cross-references are shown by their first line of text, not raw ids, so
 * the branch structure reads at a glance; renaming a node id re-points every
 * `goto`/`start` that referenced it (no silent orphans); and a choice can spawn
 * and link a fresh follow-up node in one click. A validation banner flags a
 * missing start, unreachable nodes, and dangling gotos.
 */

import { Plus, Trash2, CornerDownRight, AlertTriangle } from 'lucide-react'
import type { DialogueDef, DialogueNode, DialogueChoice, Ruleset } from '@/lib/engine-types'
import { ConditionBuilder } from '@/components/CellInspector'
import { EffectBuilder } from './EffectBuilder'

const inputCls = 'px-2 py-1 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/40'

/** A short, human label for a node — its first line of text, else its id. */
function nodeLabel(node: DialogueNode | undefined, id: string): string {
  if (!node) return id
  const first = node.text.find(t => t.trim())?.trim()
  return first ? (first.length > 34 ? `${first.slice(0, 34)}…` : first) : id
}

function uniqueNodeId(nodes: DialogueNode[]): string {
  let n = nodes.length + 1
  const has = (id: string) => nodes.some(x => x.id === id)
  while (has(`node_${n}`)) n++
  return `node_${n}`
}

const NEW_NODE = '__new__'

function GotoSelect({ value, nodes, onPick, onNew }: {
  value: string | undefined
  nodes: DialogueNode[]
  onPick: (goto: string | undefined) => void
  onNew: () => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => { if (e.target.value === NEW_NODE) onNew(); else onPick(e.target.value || undefined) }}
      className={`${inputCls} max-w-[13rem]`}
      title="Where this choice leads"
    >
      <option value="">▪ end conversation</option>
      {nodes.map(n => <option key={n.id} value={n.id}>→ {nodeLabel(n, n.id)}</option>)}
      <option value={NEW_NODE}>＋ new follow-up node…</option>
    </select>
  )
}

function ChoiceEditor({ choice, nodes, ruleset, onChange, onRemove, onGotoNew }: {
  choice: DialogueChoice
  nodes: DialogueNode[]
  ruleset: Ruleset
  onChange: (c: DialogueChoice) => void
  onRemove: () => void
  onGotoNew: () => void
}) {
  return (
    <div className="rounded bg-zinc-900 border border-white/10 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <CornerDownRight className="w-3 h-3 text-white/25 flex-shrink-0" />
        <input type="text" value={choice.label} placeholder="Choice the player sees…"
          onChange={e => onChange({ ...choice, label: e.target.value })}
          className={`flex-1 ${inputCls}`} />
        <GotoSelect value={choice.goto} nodes={nodes}
          onPick={goto => onChange({ ...choice, goto })} onNew={onGotoNew} />
        <button onClick={onRemove} className="p-0.5 rounded text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
      <ConditionBuilder conditions={choice.conditions ?? []} ruleset={ruleset}
        onChange={cs => onChange({ ...choice, conditions: cs.length ? cs : undefined })} />
      <EffectBuilder label="On choose (effects)" effects={choice.effects ?? []} ruleset={ruleset}
        onChange={effs => onChange({ ...choice, effects: effs.length ? effs : undefined })} />
    </div>
  )
}

function NodeEditor({ node, nodes, ruleset, isStart, onSetStart, onChange, onRemove, onGotoNew }: {
  node: DialogueNode
  nodes: DialogueNode[]
  ruleset: Ruleset
  isStart: boolean
  onSetStart: () => void
  onChange: (n: DialogueNode) => void
  onRemove: () => void
  onGotoNew: (choiceIdx: number) => void
}) {
  const choices = node.choices ?? []
  return (
    <div className={`rounded border p-2.5 space-y-2 ${isStart ? 'bg-zinc-800 border-amber-500/30' : 'bg-zinc-800 border-white/10'}`}>
      <div className="flex items-center gap-2">
        <button onClick={onSetStart} title={isStart ? 'This is where the conversation opens' : 'Make this the opening node'}
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${isStart ? 'bg-amber-500/20 text-amber-200' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}>
          {isStart ? '★ Start' : 'Set start'}
        </button>
        <input type="text" value={node.id} placeholder="node_id"
          onChange={e => onChange({ ...node, id: e.target.value })}
          className={`w-24 font-mono ${inputCls} text-white/40`} title="Internal id — references update automatically when you rename it" />
        <input type="text" value={node.speaker ?? ''} placeholder="speaker (optional)"
          onChange={e => onChange({ ...node, speaker: e.target.value || undefined })}
          className={`flex-1 ${inputCls}`} />
        <button onClick={onRemove} className="p-0.5 rounded text-white/30 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
      <textarea
        value={node.text.join('\n\n')}
        onChange={e => onChange({ ...node, text: e.target.value.split(/\n{2,}/) })}
        placeholder={'What is said… Blank line = new page.'}
        rows={2}
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
            <ChoiceEditor key={i} choice={c} nodes={nodes} ruleset={ruleset}
              onChange={nc => onChange({ ...node, choices: choices.map((x, j) => j === i ? nc : x) })}
              onRemove={() => onChange({ ...node, choices: choices.filter((_, j) => j !== i) })}
              onGotoNew={() => onGotoNew(i)} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** BFS the goto graph from the start node. */
function reachableIds(dialogue: DialogueDef): Set<string> {
  const byId = new Map(dialogue.nodes.map(n => [n.id, n]))
  const seen = new Set<string>()
  const stack = [dialogue.start]
  while (stack.length) {
    const id = stack.pop()
    if (!id || seen.has(id) || !byId.has(id)) continue
    seen.add(id)
    for (const c of byId.get(id)!.choices ?? []) if (c.goto) stack.push(c.goto)
  }
  return seen
}

function validate(dialogue: DialogueDef): string[] {
  const out: string[] = []
  const ids = new Set(dialogue.nodes.map(n => n.id))
  if (!ids.has(dialogue.start)) out.push('No start node is set.')
  const reach = reachableIds(dialogue)
  for (const n of dialogue.nodes) {
    if (!reach.has(n.id)) out.push(`“${nodeLabel(n, n.id)}” is unreachable.`)
    for (const c of n.choices ?? []) {
      if (c.goto && !ids.has(c.goto)) out.push(`A choice in “${nodeLabel(n, n.id)}” points at a missing node.`)
    }
  }
  return out
}

export function DialogueEditor({ dialogue, ruleset, onChange, embedded }: {
  dialogue: DialogueDef
  ruleset: Ruleset
  onChange: (d: DialogueDef) => void
  /** Rendered inside the NPC editor — drop the outer name field and padding. */
  embedded?: boolean
}) {
  const nodes = dialogue.nodes ?? []
  const problems = validate(dialogue)

  /** Update one node; if its id changed, re-point every goto/start at it. */
  function updateNode(idx: number, next: DialogueNode) {
    const prev = nodes[idx]
    const renamed = prev.id !== next.id
    const remap = (id: string | undefined) => (renamed && id === prev.id ? next.id : id)
    onChange({
      ...dialogue,
      start: dialogue.start === prev.id ? next.id : dialogue.start,
      nodes: nodes.map((n, j) => {
        const node = j === idx ? next : n
        if (!renamed) return node
        return { ...node, choices: node.choices?.map(c => ({ ...c, goto: remap(c.goto) })) }
      }),
    })
  }

  function addNode() {
    const id = uniqueNodeId(nodes)
    onChange({ ...dialogue, nodes: [...nodes, { id, text: ['…'] }], start: dialogue.start || id })
  }

  /** Spawn a node and link the given choice to it — atomic, no ordering race. */
  function gotoNewNode(nodeIdx: number, choiceIdx: number) {
    const id = uniqueNodeId(nodes)
    onChange({
      ...dialogue,
      nodes: [
        ...nodes.map((n, j) => j !== nodeIdx ? n : {
          ...n,
          choices: (n.choices ?? []).map((c, k) => k === choiceIdx ? { ...c, goto: id } : c),
        }),
        { id, text: ['…'] },
      ],
    })
  }

  return (
    <div className={embedded ? 'p-3 space-y-3' : 'p-4 space-y-4 overflow-y-auto h-full'}>
      {!embedded && (
        <input type="text" value={dialogue.name} placeholder="Dialogue name"
          onChange={e => onChange({ ...dialogue, name: e.target.value })}
          className={`w-full ${inputCls} text-sm`} />
      )}

      {problems.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-200/80">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <ul className="space-y-0.5">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Nodes</span>
        <button onClick={addNode}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> Add Node
        </button>
      </div>

      <div className="space-y-2">
        {nodes.length === 0 && <div className="text-[11px] text-white/25 italic">No nodes yet — add one to begin the conversation.</div>}
        {nodes.map((n, i) => (
          <NodeEditor key={i} node={n} nodes={nodes} ruleset={ruleset}
            isStart={dialogue.start === n.id}
            onSetStart={() => onChange({ ...dialogue, start: n.id })}
            onChange={nn => updateNode(i, nn)}
            onRemove={() => onChange({ ...dialogue, nodes: nodes.filter((_, j) => j !== i) })}
            onGotoNew={choiceIdx => gotoNewNode(i, choiceIdx)} />
        ))}
      </div>
    </div>
  )
}
