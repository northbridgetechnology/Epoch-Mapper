'use client'

/**
 * The whole "what does this NPC say" surface, embedded right in the NPC editor
 * so authoring a conversation no longer means hopping to a separate Database
 * tab and cross-referencing ids by hand.
 *
 * Two views of one underlying DialogueDef:
 *  • Quick — greeting lines + one optional offer (recruit / give item / set a
 *    flag / …). No graph. Covers the overwhelming majority of NPCs.
 *  • Advanced — the full branching node editor, for conversations Quick can't
 *    express. A conversation authored in Advanced that no longer fits the Quick
 *    shape simply locks the Quick tab (never silently drops data).
 *
 * The dialogue is created lazily (id `dlg.<npcId>`) on first edit and assigned
 * to the NPC in the same update, so a fresh NPC starts with nothing to clean up.
 */

import { useMemo, useState } from 'react'
import { Play, MessageSquare, GitBranch, Link2, Trash2 } from 'lucide-react'
import type { DialogueDef, Effect, NpcDef, Ruleset } from '@/lib/engine-types'
import { toQuick, fromQuick, isQuickShaped, EMPTY_QUICK, type QuickModel, type QuickAction } from '@/lib/dialogue-quick'
import { blankDialogue } from '@/lib/npc-schema'
import { DialogueEditor } from './DialogueEditor'
import { DialoguePreview } from './DialoguePreview'

const input = 'px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/85 focus:outline-none focus:border-amber-500/40'

// ── Quick action types: a friendly label per supported effect kind ─────────────
type ActionType = 'none' | 'recruit' | 'giveItem' | 'gold' | 'setFlag' | 'questStage' | 'fullHeal' | 'openShop' | 'startCombat'

const ACTION_LABELS: Record<ActionType, string> = {
  none: 'Nothing (just a reply)',
  recruit: '🤝 Recruit into the party',
  giveItem: '📦 Give an item',
  gold: '🪙 Give gold',
  setFlag: '🚩 Set a story flag',
  questStage: '📜 Advance a quest',
  fullHeal: '✨ Heal the party',
  openShop: '🏪 Open a shop',
  startCombat: '⚔️ Start a battle',
}

function actionTypeOf(effect: Effect | null): ActionType {
  if (!effect) return 'none'
  return (effect.t in ACTION_LABELS ? effect.t : 'none') as ActionType
}

/** A default effect for a freshly-picked action type. `recruit` targets this NPC. */
function defaultEffect(type: ActionType, npcId: string): Effect | null {
  switch (type) {
    case 'recruit':     return { t: 'recruit', npc: npcId }
    case 'giveItem':    return { t: 'giveItem', item: '', qty: 1 }
    case 'gold':        return { t: 'gold', amount: 50 }
    case 'setFlag':     return { t: 'setFlag', flag: '', value: true }
    case 'questStage':  return { t: 'questStage', quest: '', stage: 1 }
    case 'fullHeal':    return { t: 'fullHeal' }
    case 'openShop':    return { t: 'openShop', shop: '' }
    case 'startCombat': return { t: 'startCombat', encounter: '' }
    default:            return null
  }
}

function ActionEffectFields({ effect, ruleset, onChange }: {
  effect: Effect
  ruleset: Ruleset
  onChange: (e: Effect) => void
}) {
  switch (effect.t) {
    case 'giveItem':
      return (
        <div className="flex items-center gap-2">
          <select value={effect.item} onChange={e => onChange({ ...effect, item: e.target.value })} className={`${input} flex-1`}>
            <option value="">— pick item —</option>
            {ruleset.items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-white/40">×
            <input type="number" min={1} value={effect.qty ?? 1}
              onChange={e => onChange({ ...effect, qty: Math.max(1, e.target.valueAsNumber || 1) })}
              className={`${input} w-16`} />
          </label>
        </div>
      )
    case 'gold':
      return (
        <input type="number" min={0} value={effect.amount}
          onChange={e => onChange({ ...effect, amount: Math.max(0, e.target.valueAsNumber || 0) })}
          className={`${input} w-32`} />
      )
    case 'setFlag':
      return (
        <div className="flex items-center gap-2">
          <input type="text" value={effect.flag} placeholder="flag name"
            onChange={e => onChange({ ...effect, flag: e.target.value })} className={`${input} flex-1 font-mono`} />
          <span className="text-xs text-white/40">= true</span>
        </div>
      )
    case 'questStage':
      return (
        <div className="flex items-center gap-2">
          <select value={effect.quest} onChange={e => onChange({ ...effect, quest: e.target.value })} className={`${input} flex-1`}>
            <option value="">— pick quest —</option>
            {(ruleset.quests ?? []).map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-white/40">stage
            <input type="number" min={0} value={effect.stage}
              onChange={e => onChange({ ...effect, stage: Math.max(0, e.target.valueAsNumber || 0) })}
              className={`${input} w-16`} />
          </label>
        </div>
      )
    case 'openShop':
      return (
        <select value={effect.shop} onChange={e => onChange({ ...effect, shop: e.target.value })} className={`${input} w-full`}>
          <option value="">— pick shop —</option>
          {ruleset.shops.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
      )
    case 'startCombat':
      return (
        <select value={effect.encounter} onChange={e => onChange({ ...effect, encounter: e.target.value })} className={`${input} w-full`}>
          <option value="">— pick encounter —</option>
          {ruleset.encounterTables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )
    case 'recruit':
      return <p className="text-xs text-white/40">This NPC joins the party. (Set “Recruitable” above so the placement vanishes afterward.)</p>
    default:
      return null
  }
}

// ── Quick editor ───────────────────────────────────────────────────────────────
function QuickEditor({ model, npc, ruleset, onChange }: {
  model: QuickModel
  npc: NpcDef
  ruleset: Ruleset
  onChange: (m: QuickModel) => void
}) {
  const action = model.action
  const type = actionTypeOf(action?.effect ?? null)
  // When there's no action object at all we still show "Nothing" — turning the
  // toggle on creates one; picking an action type sets its effect.
  const hasOffer = action !== null

  function setAction(next: QuickAction | null) { onChange({ ...model, action: next }) }
  function patch(p: Partial<QuickAction>) { setAction({ ...(action ?? blankAction()), ...p }) }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] uppercase tracking-wide text-white/40">Greeting</label>
        <textarea
          value={model.lines.join('\n\n')}
          onChange={e => onChange({ ...model, lines: e.target.value.split(/\n{2,}/) })}
          placeholder={'What the NPC says when you talk to them…\n\nBlank line = a new page.'}
          rows={3}
          className="mt-1 w-full px-2.5 py-2 rounded bg-zinc-800 border border-white/10 text-sm text-white/85 italic leading-relaxed focus:outline-none focus:border-amber-500/40"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
        <input type="checkbox" checked={hasOffer}
          onChange={e => setAction(e.target.checked ? blankAction() : null)} />
        Offer the player a choice / action
      </label>

      {hasOffer && action && (
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input type="text" value={action.label} placeholder="Accept button (e.g. “I’ll join you”)"
              onChange={e => patch({ label: e.target.value })} className={`${input} w-full`} />
            <span className="text-xs text-white/30">accept</span>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/40">On accept</label>
            <select value={type}
              onChange={e => patch({ effect: defaultEffect(e.target.value as ActionType, npc.id) })}
              className={`${input} w-full mt-1`}>
              {(Object.keys(ACTION_LABELS) as ActionType[]).map(t => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
            </select>
            {action.effect && (
              <div className="mt-2"><ActionEffectFields effect={action.effect} ruleset={ruleset}
                onChange={eff => patch({ effect: eff })} /></div>
            )}
          </div>

          <input type="text" value={action.reply} placeholder="Reply after accepting (optional)"
            onChange={e => patch({ reply: e.target.value })}
            className={`${input} w-full italic`} />

          <div className="grid grid-cols-[1fr_1fr] gap-2 pt-1 border-t border-white/5">
            <input type="text" value={action.declineLabel} placeholder="Decline button"
              onChange={e => patch({ declineLabel: e.target.value })} className={`${input} w-full`} />
            <input type="text" value={action.declineReply} placeholder="Reply after declining (optional)"
              onChange={e => patch({ declineReply: e.target.value })} className={`${input} w-full italic`} />
          </div>
        </div>
      )}
    </div>
  )
}

function blankAction(): QuickAction {
  return { label: 'Yes', effect: null, reply: '', declineLabel: 'Maybe later', declineReply: '' }
}

// ── Top-level conversation editor ──────────────────────────────────────────────
export function ConversationEditor({ npc, ruleset, onRulesetChange }: {
  npc: NpcDef
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
}) {
  const dialogues = ruleset.dialogues ?? []
  const dlg = dialogues.find(d => d.id === npc.dialogue) ?? null
  const quickOk = !dlg || isQuickShaped(dlg)
  const [mode, setMode] = useState<'quick' | 'advanced'>(quickOk ? 'quick' : 'advanced')
  const [previewing, setPreviewing] = useState(false)
  const [reuse, setReuse] = useState(false)

  const effectiveMode = mode === 'quick' && !quickOk ? 'advanced' : mode
  const privateId = npc.dialogue ?? `dlg.${npc.id}`

  const quickModel = useMemo<QuickModel>(() => (dlg ? toQuick(dlg) : null) ?? EMPTY_QUICK, [dlg])

  /** Upsert a dialogue def and point this NPC at it — one atomic ruleset write. */
  function writeDialogue(def: DialogueDef) {
    const list = dialogues.some(d => d.id === def.id)
      ? dialogues.map(d => (d.id === def.id ? def : d))
      : [...dialogues, def]
    onRulesetChange({
      ...ruleset,
      dialogues: list,
      npcs: (ruleset.npcs ?? []).map(n => (n.id === npc.id ? { ...n, dialogue: def.id } : n)),
    })
  }

  function assign(id: string | undefined) {
    onRulesetChange({ ...ruleset, npcs: (ruleset.npcs ?? []).map(n => (n.id === npc.id ? { ...n, dialogue: id } : n)) })
  }

  function removeConversation() {
    // Drop the assignment; also delete the def if it's this NPC's private one
    // and no other NPC references it.
    const id = npc.dialogue
    const stillUsed = id && (ruleset.npcs ?? []).some(n => n.id !== npc.id && n.dialogue === id)
    const keepDefs = id === privateId && !stillUsed ? dialogues.filter(d => d.id !== id) : dialogues
    onRulesetChange({
      ...ruleset,
      dialogues: keepDefs,
      npcs: (ruleset.npcs ?? []).map(n => (n.id === npc.id ? { ...n, dialogue: undefined } : n)),
    })
    setMode('quick')
  }

  function commitQuick(next: QuickModel) {
    writeDialogue(fromQuick(next, privateId, dlg?.name ?? `${npc.name} — conversation`))
  }

  // Advanced always needs a concrete def to edit; synthesize one that persists
  // on first change if none exists yet.
  const advDef: DialogueDef = dlg ?? { ...blankDialogue(privateId), name: `${npc.name} — conversation` }
  const previewDef = effectiveMode === 'quick' ? fromQuick(quickModel, privateId, npc.name) : advDef
  const hasContent = !!dlg

  return (
    <div className="space-y-3">
      {/* Mode toggle + actions */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => quickOk && setMode('quick')}
            disabled={!quickOk}
            title={quickOk ? 'Simple: lines + one optional action' : 'This conversation branches too much for Quick mode'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${effectiveMode === 'quick' ? 'bg-amber-500/15 text-amber-200' : 'text-white/55 hover:text-white/80'} ${!quickOk ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <MessageSquare className="w-3.5 h-3.5" /> Quick
          </button>
          <button
            onClick={() => setMode('advanced')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-l border-white/10 ${effectiveMode === 'advanced' ? 'bg-amber-500/15 text-amber-200' : 'text-white/55 hover:text-white/80'}`}>
            <GitBranch className="w-3.5 h-3.5" /> Advanced
          </button>
        </div>

        <div className="flex-1" />

        <button onClick={() => setPreviewing(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10">
          <Play className="w-3.5 h-3.5" /> Preview
        </button>
        <button onClick={() => setReuse(r => !r)} title="Point at an existing shared conversation"
          className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 border border-white/10">
          <Link2 className="w-3.5 h-3.5" />
        </button>
        {hasContent && (
          <button onClick={removeConversation} title="Remove this conversation"
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 border border-white/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {reuse && (
        <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-2.5">
          <label className="text-[11px] uppercase tracking-wide text-white/40">Use an existing conversation</label>
          <select value={npc.dialogue ?? ''} onChange={e => { assign(e.target.value || undefined); setReuse(false) }}
            className={`${input} w-full mt-1`}>
            <option value="">— none —</option>
            {dialogues.map(d => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
          </select>
          <p className="text-[11px] text-white/30 mt-1">Handy when several NPCs share one script. Editing it affects all of them.</p>
        </div>
      )}

      {!quickOk && mode === 'quick' && (
        <div className="text-[11px] text-amber-300/70 bg-amber-500/5 border border-amber-500/15 rounded px-2 py-1.5">
          This conversation uses branching Quick mode can’t show — opened in Advanced.
        </div>
      )}

      {effectiveMode === 'quick' ? (
        <QuickEditor model={quickModel} npc={npc} ruleset={ruleset} onChange={commitQuick} />
      ) : (
        <div className="rounded-lg border border-white/10 bg-zinc-900/40 -mx-1">
          <DialogueEditor dialogue={advDef} ruleset={ruleset} onChange={writeDialogue} embedded />
        </div>
      )}

      {previewing && (
        <DialoguePreview dialogue={previewDef} ruleset={ruleset}
          speaker={npc.name} portrait={npc.portrait} onClose={() => setPreviewing(false)} />
      )}
    </div>
  )
}
