'use client'

import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DamageType, Effect, Ruleset } from '@/lib/engine-types'

const DAMAGE_TYPES: DamageType[] = ['physical', 'fire', 'ice', 'lightning', 'poison', 'holy', 'dark']
const FACINGS = ['N', 'S', 'E', 'W']

const ALL_VERBS = [
  // Healing
  { t: 'heal',        label: '💊 Heal HP',          group: 'Healing' },
  { t: 'restoreMp',   label: '🔮 Restore MP',        group: 'Healing' },
  { t: 'fullHeal',    label: '✨ Full Heal & MP',     group: 'Healing' },
  { t: 'reviveRandom',label: '💫 Revive Random',      group: 'Healing' },
  // Combat
  { t: 'damage',      label: '⚔️ Damage',             group: 'Combat' },
  { t: 'status',      label: '🌀 Apply Status',       group: 'Combat' },
  { t: 'cure',        label: '🍃 Cure Status',        group: 'Combat' },
  { t: 'startCombat', label: '⚔️ Start Combat',       group: 'Combat' },
  // Items & Economy
  { t: 'giveItem',    label: '📦 Give Item',          group: 'Items' },
  { t: 'takeItem',    label: '📤 Take Item',          group: 'Items' },
  { t: 'gold',        label: '🪙 Give Gold',          group: 'Items' },
  // World
  { t: 'setFlag',     label: '🚩 Set Flag',           group: 'World' },
  { t: 'teleport',    label: '🌀 Teleport',           group: 'World' },
  { t: 'reveal',      label: '🔦 Reveal Area',        group: 'World' },
  { t: 'openShop',    label: '🏪 Open Shop',          group: 'World' },
  // Narrative
  { t: 'message',     label: '💬 Message',            group: 'Narrative' },
] as const

type Verb = typeof ALL_VERBS[number]['t']

function blankEffect(verb: Verb): Effect {
  switch (verb) {
    case 'heal':         return { t: 'heal', amount: 10 }
    case 'restoreMp':    return { t: 'restoreMp', amount: 10 }
    case 'fullHeal':     return { t: 'fullHeal' }
    case 'reviveRandom': return { t: 'reviveRandom' }
    case 'damage':       return { t: 'damage', dmgType: 'physical', amount: '1d6', canCrit: true }
    case 'status':       return { t: 'status', status: '', chance: 1.0 }
    case 'cure':         return { t: 'cure', status: 'all' }
    case 'startCombat':  return { t: 'startCombat', encounter: '' }
    case 'giveItem':     return { t: 'giveItem', item: '', qty: 1 }
    case 'takeItem':     return { t: 'takeItem', item: '', qty: 1 }
    case 'gold':         return { t: 'gold', amount: 50 }
    case 'setFlag':      return { t: 'setFlag', flag: '', value: true }
    case 'teleport':     return { t: 'teleport', mapId: '', x: 0, y: 0 }
    case 'reveal':       return { t: 'reveal', radius: 3 }
    case 'openShop':     return { t: 'openShop', shop: '' }
    case 'message':      return { t: 'message', text: '' }
    default:             return { t: 'message', text: '' }
  }
}

function effectLabel(e: Effect, ruleset: Ruleset): string {
  switch (e.t) {
    case 'heal':         return `Heal ${e.amount} HP`
    case 'restoreMp':    return `Restore ${e.amount} MP`
    case 'fullHeal':     return 'Full Heal & MP'
    case 'reviveRandom': return 'Revive random ally'
    case 'damage':       return `${e.dmgType} damage ${e.amount}`
    case 'status': {
      const name = ruleset.statusEffects.find(s => s.id === e.status)?.name ?? e.status
      return `Apply ${name}${e.chance && e.chance < 1 ? ` (${Math.round(e.chance * 100)}%)` : ''}`
    }
    case 'cure':    return `Cure ${e.status === 'all' ? 'all statuses' : e.status}`
    case 'startCombat': {
      const name = ruleset.encounterTables.find(t => t.id === e.encounter)?.name ?? e.encounter
      return `Start combat: ${name}`
    }
    case 'giveItem': {
      const name = ruleset.items.find(i => i.id === e.item)?.name ?? e.item
      return `Give ${name} ×${e.qty ?? 1}`
    }
    case 'takeItem': {
      const name = ruleset.items.find(i => i.id === e.item)?.name ?? e.item
      return `Take ${name} ×${e.qty ?? 1}`
    }
    case 'gold':      return `Give ${e.amount} gold`
    case 'setFlag':   return `Set flag "${e.flag}" = ${JSON.stringify(e.value)}`
    case 'teleport':  return `Teleport to ${e.mapId} (${e.x},${e.y})`
    case 'reveal':    return `Reveal radius ${e.radius}`
    case 'openShop': {
      const name = ruleset.shops.find(s => s.id === e.shop)?.name ?? e.shop
      return `Open shop: ${name}`
    }
    case 'message':   return `Message: "${e.text?.slice(0, 24)}"`
    default:          return (e as Effect).t
  }
}

const INPUT_CLS = 'px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50 font-mono'

interface EffectRowProps {
  effect: Effect
  ruleset: Ruleset
  onChange: (e: Effect) => void
  onRemove: () => void
}

function EffectRow({ effect, ruleset, onChange, onRemove }: EffectRowProps) {
  const e = effect

  return (
    <div className="flex items-start gap-2 rounded-lg bg-zinc-800 border border-white/10 p-2">
      {/* Verb picker */}
      <select
        value={e.t}
        onChange={ev => onChange(blankEffect(ev.target.value as Verb))}
        className="flex-shrink-0 px-1.5 py-1 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/50"
      >
        {ALL_VERBS.map(v => <option key={v.t} value={v.t}>{v.label}</option>)}
      </select>

      {/* Param fields */}
      <div className="flex-1 flex flex-wrap gap-2 min-w-0">
        {/* Dice amount: heal / restoreMp */}
        {(e.t === 'heal' || e.t === 'restoreMp') && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Amount</span>
            <input type="text" value={String((e as {amount: string|number}).amount)}
              onChange={ev => {
                const v = ev.target.value
                const n = Number(v)
                onChange({ ...e, amount: isNaN(n) || v.includes('d') ? v : n } as Effect)
              }}
              placeholder="10 or 2d6"
              className={cn(INPUT_CLS, 'w-20')}
            />
          </div>
        )}

        {/* Damage */}
        {e.t === 'damage' && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Type</span>
              <select value={e.dmgType} onChange={ev => onChange({ ...e, dmgType: ev.target.value as DamageType })}
                className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
                {DAMAGE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Amount</span>
              <input type="text" value={String(e.amount)} placeholder="1d6"
                onChange={ev => {
                  const v = ev.target.value
                  const n = Number(v)
                  onChange({ ...e, amount: isNaN(n) || v.includes('d') ? v : n })
                }}
                className={cn(INPUT_CLS, 'w-16')}
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-white/40 cursor-pointer">
              <input type="checkbox" checked={!!e.canCrit} onChange={ev => onChange({ ...e, canCrit: ev.target.checked })} />
              Crit
            </label>
          </>
        )}

        {/* Status */}
        {e.t === 'status' && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Status</span>
              <select value={e.status} onChange={ev => onChange({ ...e, status: ev.target.value })}
                className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
                <option value="">— pick —</option>
                {ruleset.statusEffects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Chance</span>
              <input type="number" min={0} max={1} step={0.05} value={e.chance ?? 1}
                onChange={ev => onChange({ ...e, chance: Math.min(1, Math.max(0, ev.target.valueAsNumber || 0)) })}
                className={cn(INPUT_CLS, 'w-14')}
              />
            </div>
          </>
        )}

        {/* Cure */}
        {e.t === 'cure' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Status</span>
            <select value={e.status} onChange={ev => onChange({ ...e, status: ev.target.value as 'all' | string })}
              className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
              <option value="all">All statuses</option>
              {ruleset.statusEffects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
        )}

        {/* startCombat */}
        {e.t === 'startCombat' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Encounter</span>
            <select value={e.encounter} onChange={ev => onChange({ ...e, encounter: ev.target.value })}
              className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
              <option value="">— pick —</option>
              {ruleset.encounterTables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* giveItem / takeItem */}
        {(e.t === 'giveItem' || e.t === 'takeItem') && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Item</span>
              <select value={e.item} onChange={ev => onChange({ ...e, item: ev.target.value })}
                className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
                <option value="">— pick —</option>
                {ruleset.items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Qty</span>
              <input type="number" min={1} value={(e as {qty?: number}).qty ?? 1}
                onChange={ev => onChange({ ...e, qty: Math.max(1, ev.target.valueAsNumber || 1) } as Effect)}
                className={cn(INPUT_CLS, 'w-14')}
              />
            </div>
          </>
        )}

        {/* gold */}
        {e.t === 'gold' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Amount</span>
            <input type="number" min={0} value={e.amount}
              onChange={ev => onChange({ ...e, amount: Math.max(0, ev.target.valueAsNumber || 0) })}
              className={cn(INPUT_CLS, 'w-20')}
            />
          </div>
        )}

        {/* setFlag */}
        {e.t === 'setFlag' && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Flag</span>
              <input type="text" value={e.flag} placeholder="my_flag"
                onChange={ev => onChange({ ...e, flag: ev.target.value })}
                className={cn(INPUT_CLS, 'w-28')}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Value</span>
              <input type="text" value={String(e.value)} placeholder="true / 1 / text"
                onChange={ev => {
                  const v = ev.target.value
                  if (v === 'true') onChange({ ...e, value: true })
                  else if (v === 'false') onChange({ ...e, value: false })
                  else if (!isNaN(Number(v)) && v !== '') onChange({ ...e, value: Number(v) })
                  else onChange({ ...e, value: v })
                }}
                className={cn(INPUT_CLS, 'w-20')}
              />
            </div>
          </>
        )}

        {/* teleport */}
        {e.t === 'teleport' && (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Map ID</span>
              <input type="text" value={e.mapId} placeholder="map_id"
                onChange={ev => onChange({ ...e, mapId: ev.target.value })}
                className={cn(INPUT_CLS, 'w-24')}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">X</span>
              <input type="number" value={e.x} onChange={ev => onChange({ ...e, x: ev.target.valueAsNumber || 0 })}
                className={cn(INPUT_CLS, 'w-14')} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Y</span>
              <input type="number" value={e.y} onChange={ev => onChange({ ...e, y: ev.target.valueAsNumber || 0 })}
                className={cn(INPUT_CLS, 'w-14')} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-white/40">Facing</span>
              <select value={e.facing ?? ''} onChange={ev => onChange({ ...e, facing: (ev.target.value as 'N'|'S'|'E'|'W') || undefined })}
                className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
                <option value="">—</option>
                {FACINGS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </>
        )}

        {/* reveal */}
        {e.t === 'reveal' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Radius</span>
            <input type="number" min={1} max={20} value={e.radius}
              onChange={ev => onChange({ ...e, radius: Math.max(1, ev.target.valueAsNumber || 1) })}
              className={cn(INPUT_CLS, 'w-14')}
            />
          </div>
        )}

        {/* openShop */}
        {e.t === 'openShop' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/40">Shop</span>
            <select value={e.shop} onChange={ev => onChange({ ...e, shop: ev.target.value })}
              className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none">
              <option value="">— pick —</option>
              {ruleset.shops.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
        )}

        {/* message */}
        {e.t === 'message' && (
          <input type="text" value={e.text}
            onChange={ev => onChange({ ...e, text: ev.target.value })}
            placeholder="Text shown to player…"
            className={cn(INPUT_CLS, 'flex-1')}
          />
        )}

        {/* No-param effects */}
        {(e.t === 'fullHeal' || e.t === 'reviveRandom') && (
          <span className="text-xs text-white/40 self-center">
            {e.t === 'fullHeal' ? 'Restores all HP and MP' : 'Revives a random dead ally at 1 HP'}
          </span>
        )}
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
          ruleset={ruleset}
          onChange={upd => updateEffect(i, upd)}
          onRemove={() => removeEffect(i)}
        />
      ))}

      {effects.length > 0 && (
        <div className="text-xs text-white/30 pt-1">
          {effects.map((e, i) => (
            <span key={i} className="mr-2">• {effectLabel(e, ruleset)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
