'use client'

import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Effect, ItemDef, Ruleset } from '@/lib/engine-types'

// Phase E2 verbs — heal / restoreMp / giveItem / message
const E2_VERBS = [
  { t: 'heal',       label: '💊 Heal HP',        fields: ['amount'] },
  { t: 'restoreMp',  label: '🔮 Restore MP',      fields: ['amount'] },
  { t: 'fullHeal',   label: '✨ Full Heal & MP',   fields: [] },
  { t: 'giveItem',   label: '📦 Give Item',        fields: ['item', 'qty'] },
  { t: 'gold',       label: '🪙 Give Gold',        fields: ['amount_flat'] },
  { t: 'message',    label: '💬 Message',          fields: ['text'] },
] as const

type Verb = typeof E2_VERBS[number]['t']

function blankEffect(verb: Verb): Effect {
  switch (verb) {
    case 'heal':      return { t: 'heal', amount: 10 }
    case 'restoreMp': return { t: 'restoreMp', amount: 10 }
    case 'fullHeal':  return { t: 'fullHeal' }
    case 'giveItem':  return { t: 'giveItem', item: '', qty: 1 }
    case 'gold':      return { t: 'gold', amount: 50 }
    case 'message':   return { t: 'message', text: '' }
    default:          return { t: 'message', text: '' }
  }
}

function effectLabel(e: Effect, items: ItemDef[]): string {
  switch (e.t) {
    case 'heal':      return `Heal ${e.amount} HP`
    case 'restoreMp': return `Restore ${e.amount} MP`
    case 'fullHeal':  return 'Full Heal & MP'
    case 'giveItem': {
      const name = items.find(i => i.id === e.item)?.name ?? e.item
      return `Give ${name} ×${e.qty ?? 1}`
    }
    case 'gold':    return `Give ${e.amount} gold`
    case 'message': return `Message: "${e.text?.slice(0, 24)}"`
    default:        return e.t
  }
}

interface EffectRowProps {
  effect: Effect
  items: ItemDef[]
  onChange: (e: Effect) => void
  onRemove: () => void
}

function EffectRow({ effect, items, onChange, onRemove }: EffectRowProps) {
  const isDice = effect.t === 'heal' || effect.t === 'restoreMp'
  const isItem = effect.t === 'giveItem'
  const isGold = effect.t === 'gold'
  const isMsg  = effect.t === 'message'
  const isFull = effect.t === 'fullHeal'

  return (
    <div className="flex items-start gap-2 rounded-lg bg-zinc-800 border border-white/10 p-2">
      {/* Verb picker */}
      <select
        value={effect.t}
        onChange={e => onChange(blankEffect(e.target.value as Verb))}
        className="flex-shrink-0 px-1.5 py-1 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50"
      >
        {E2_VERBS.map(v => <option key={v.t} value={v.t}>{v.label}</option>)}
      </select>

      {/* Param fields */}
      <div className="flex-1 flex flex-wrap gap-2 min-w-0">
        {isDice && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Amount</span>
            <input
              type="text"
              value={String((effect as { amount: number | string }).amount)}
              onChange={e => {
                const v = e.target.value
                const n = Number(v)
                onChange({ ...effect, amount: isNaN(n) || v.includes('d') ? v : n } as Effect)
              }}
              placeholder="10 or 2d6"
              className="w-20 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>
        )}

        {isItem && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Item</span>
              <select
                value={(effect as { item: string }).item}
                onChange={e => onChange({ ...effect, item: e.target.value } as Effect)}
                className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">— pick item —</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Qty</span>
              <input
                type="number" min={1}
                value={(effect as { qty?: number }).qty ?? 1}
                onChange={e => onChange({ ...effect, qty: Math.max(1, e.target.valueAsNumber || 1) } as Effect)}
                className="w-14 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </>
        )}

        {isGold && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Amount</span>
            <input
              type="number" min={0}
              value={(effect as { amount: number }).amount}
              onChange={e => onChange({ ...effect, amount: Math.max(0, e.target.valueAsNumber || 0) } as Effect)}
              className="w-20 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        )}

        {isMsg && (
          <input
            type="text"
            value={(effect as { text: string }).text}
            onChange={e => onChange({ ...effect, text: e.target.value } as Effect)}
            placeholder="Text shown to player…"
            className="flex-1 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50"
          />
        )}

        {isFull && <span className="text-xs text-white/40 self-center">Restores all HP and MP</span>}
      </div>

      <button onClick={onRemove} className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/10 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

interface EffectBuilderProps {
  effects: Effect[]
  ruleset: Ruleset
  onChange: (effects: Effect[]) => void
  className?: string
  label?: string
}

export function EffectBuilder({ effects, ruleset, onChange, className, label }: EffectBuilderProps) {
  function addEffect() {
    onChange([...effects, blankEffect('heal')])
  }

  function updateEffect(idx: number, e: Effect) {
    onChange(effects.map((x, i) => i === idx ? e : x))
  }

  function removeEffect(idx: number) {
    onChange(effects.filter((_, i) => i !== idx))
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
          {label ?? 'Effects'}
        </span>
        <button
          onClick={addEffect}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
        >
          <Plus className="w-3 h-3" /> Add effect
        </button>
      </div>

      {effects.length === 0 && (
        <div className="text-xs text-white/25 text-center py-2 rounded bg-zinc-800/50 border border-white/5">
          No effects — click Add effect
        </div>
      )}

      {effects.map((e, i) => (
        <EffectRow
          key={i}
          effect={e}
          items={ruleset.items}
          onChange={upd => updateEffect(i, upd)}
          onRemove={() => removeEffect(i)}
        />
      ))}

      {effects.length > 0 && (
        <div className="text-xs text-white/30 pt-1">
          {effects.map((e, i) => (
            <span key={i} className="mr-2">• {effectLabel(e, ruleset.items)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
