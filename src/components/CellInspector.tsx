'use client'

import { useState } from 'react'
import { Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  BoundaryData, CellEntity, CellEvent, Condition, Effect, ObjectInstance, Ruleset,
} from '@/lib/engine-types'
import type { EdgeDir } from '@/lib/types'
import { edgeDef, BASE } from '@/lib/constants'
import type { CellData, MapData, SubcubeObject } from '@/lib/types'
import { SUBCUBE_KIND_DEFS, getSubcubeDef } from '@/lib/subcube-defs'
import { EffectBuilder } from './forms/EffectBuilder'

// ── Condition builder ─────────────────────────────────────────────────────────

function ConditionRow({
  cond,
  ruleset,
  onChange,
  onRemove,
}: {
  cond: Condition
  ruleset: Ruleset
  onChange: (c: Condition) => void
  onRemove: () => void
}) {
  const INPUT = 'px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none'

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-zinc-800 border border-white/10">
      <select
        value={cond.c}
        onChange={e => {
          const c = e.target.value as Condition['c']
          if (c === 'flag')       onChange({ c, flag: '', equals: true })
          else if (c === 'hasItem')    onChange({ c, item: '', qty: 1 })
          else if (c === 'partyLevel') onChange({ c, min: 1 })
          else if (c === 'random')     onChange({ c, chance: 0.5 })
          else if (c === 'questStage') onChange({ c, quest: '', min: 1 })
        }}
        className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none"
      >
        <option value="flag">Flag =</option>
        <option value="hasItem">Has Item</option>
        <option value="partyLevel">Party Level ≥</option>
        <option value="random">Random chance</option>
        <option value="questStage">Quest Stage ≥</option>
      </select>

      {cond.c === 'flag' && (
        <>
          <input type="text" value={cond.flag} placeholder="flag_name"
            onChange={e => onChange({ ...cond, flag: e.target.value })}
            className={cn(INPUT, 'w-24')} />
          <span className="text-xs text-white/30">=</span>
          <input type="text" value={String(cond.equals)} placeholder="true"
            onChange={e => {
              const v = e.target.value
              if (v === 'true') onChange({ ...cond, equals: true })
              else if (v === 'false') onChange({ ...cond, equals: false })
              else if (!isNaN(Number(v)) && v !== '') onChange({ ...cond, equals: Number(v) })
              else onChange({ ...cond, equals: v })
            }}
            className={cn(INPUT, 'w-16')} />
        </>
      )}

      {cond.c === 'hasItem' && (
        <>
          <select value={cond.item} onChange={e => onChange({ ...cond, item: e.target.value })}
            className={cn(INPUT, 'flex-1')}>
            <option value="">— pick item —</option>
            {ruleset.items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
          </select>
          <span className="text-xs text-white/30">×</span>
          <input type="number" min={1} value={cond.qty ?? 1}
            onChange={e => onChange({ ...cond, qty: Math.max(1, e.target.valueAsNumber || 1) })}
            className={cn(INPUT, 'w-12')} />
        </>
      )}

      {cond.c === 'partyLevel' && (
        <input type="number" min={1} value={cond.min}
          onChange={e => onChange({ ...cond, min: Math.max(1, e.target.valueAsNumber || 1) })}
          className={cn(INPUT, 'w-14')} />
      )}

      {cond.c === 'questStage' && (
        <>
          <select value={cond.quest} onChange={e => onChange({ ...cond, quest: e.target.value })}
            className={cn(INPUT, 'min-w-[8rem]')}>
            <option value="">— pick quest —</option>
            {(ruleset.quests ?? []).map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <span className="text-xs text-white/30">≥ stage</span>
          <input type="number" min={1} value={cond.min ?? 1}
            onChange={e => onChange({ ...cond, min: Math.max(1, e.target.valueAsNumber || 1) })}
            className={cn(INPUT, 'w-14')} />
        </>
      )}

      {cond.c === 'random' && (
        <input type="number" min={0} max={1} step={0.05} value={cond.chance}
          onChange={e => onChange({ ...cond, chance: Math.min(1, Math.max(0, e.target.valueAsNumber || 0)) })}
          className={cn(INPUT, 'w-14')} />
      )}

      <button onClick={onRemove} className="p-0.5 rounded text-white/30 hover:text-red-400">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

export function ConditionBuilder({
  conditions,
  ruleset,
  onChange,
}: {
  conditions: Condition[]
  ruleset: Ruleset
  onChange: (cs: Condition[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">Conditions (all must pass)</span>
        <button
          onClick={() => onChange([...conditions, { c: 'flag', flag: '', equals: true }])}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/10"
        >
          <Plus className="w-2.5 h-2.5" /> Add
        </button>
      </div>
      {conditions.length === 0 && (
        <div className="text-[10px] text-white/25 text-center py-1.5 rounded bg-zinc-800/50 border border-white/5">
          No conditions — fires unconditionally
        </div>
      )}
      {conditions.map((c, i) => (
        <ConditionRow key={i} cond={c} ruleset={ruleset}
          onChange={upd => onChange(conditions.map((x, j) => j === i ? upd : x))}
          onRemove={() => onChange(conditions.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  )
}

// ── Entity-specific editors ───────────────────────────────────────────────────

const INPUT = 'px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/90 focus:outline-none focus:border-amber-500/40'
const LABEL = 'text-[10px] font-medium text-white/45 uppercase tracking-wide mb-1 block'

function EncounterEntityEditor({
  entity,
  ruleset,
  onChange,
}: {
  entity: CellEntity & { t: 'encounter' }
  ruleset: Ruleset
  onChange: (e: CellEntity) => void
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className={LABEL}>Encounter Table</label>
        <select value={entity.table} onChange={e => onChange({ ...entity, table: e.target.value })}
          className={cn(INPUT, 'w-full')}>
          <option value="">— pick table —</option>
          {ruleset.encounterTables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="flex gap-3">
        <div>
          <label className={LABEL}>Mode</label>
          <select value={entity.mode} onChange={e => onChange({ ...entity, mode: e.target.value as 'fixed' | 'zone' })}
            className={INPUT}>
            <option value="fixed">Fixed (boss/ambush)</option>
            <option value="zone">Zone (random %)</option>
          </select>
        </div>
        {entity.mode === 'zone' && (
          <div>
            <label className={LABEL}>Rate (0–1)</label>
            <input type="number" min={0} max={1} step={0.05} value={entity.rate ?? 0.1}
              onChange={e => onChange({ ...entity, rate: Math.min(1, Math.max(0, e.target.valueAsNumber || 0)) })}
              className={cn(INPUT, 'w-16')} />
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
        <input type="checkbox" checked={!!entity.oncePerVisit}
          onChange={e => onChange({ ...entity, oncePerVisit: e.target.checked })} />
        Trigger only once per visit
      </label>
    </div>
  )
}

function MapLinkEntityEditor({
  entity,
  maps,
  onChange,
}: {
  entity: CellEntity & { t: 'mapLink' }
  maps: MapData[]
  onChange: (e: CellEntity) => void
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className={LABEL}>Destination Map</label>
        <select value={entity.mapId} onChange={e => onChange({ ...entity, mapId: e.target.value })}
          className={cn(INPUT, 'w-full')}>
          <option value="">— pick map —</option>
          {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <div>
          <label className={LABEL}>X</label>
          <input type="number" value={entity.x} onChange={e => onChange({ ...entity, x: e.target.valueAsNumber || 0 })}
            className={cn(INPUT, 'w-16')} />
        </div>
        <div>
          <label className={LABEL}>Y</label>
          <input type="number" value={entity.y} onChange={e => onChange({ ...entity, y: e.target.valueAsNumber || 0 })}
            className={cn(INPUT, 'w-16')} />
        </div>
        <div>
          <label className={LABEL}>Facing</label>
          <select value={entity.facing ?? ''} onChange={e => onChange({ ...entity, facing: (e.target.value as 'N'|'S'|'E'|'W') || undefined })}
            className={INPUT}>
            <option value="">—</option>
            {['N','S','E','W'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={LABEL}>Transition</label>
        <select value={entity.transition ?? 'fade'}
          onChange={e => onChange({ ...entity, transition: e.target.value === 'fade' ? undefined : e.target.value as 'seamless' | 'prompt' })}
          className={cn(INPUT, 'w-full')}>
          <option value="fade">Fade + name card (doors, stairs)</option>
          <option value="seamless">Seamless (open-world seam)</option>
          <option value="prompt">Prompt to confirm (Wizardry-style)</option>
        </select>
      </div>
    </div>
  )
}

function ObjectEntityEditor({
  entity,
  ruleset,
  onChange,
}: {
  entity: CellEntity & { t: 'object' }
  ruleset: Ruleset
  onChange: (e: CellEntity) => void
}) {
  const obj = entity.object

  function update(patch: Partial<ObjectInstance>) {
    onChange({ ...entity, object: { ...obj, ...patch } })
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Kind</label>
          <select value={obj.kind} onChange={e => update({ kind: e.target.value as ObjectInstance['kind'] })}
            className={cn(INPUT, 'w-full')}>
            {(['chest','door','lever','sign','npc','shop','trap','teleporter','inn'] as const).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={LABEL}>ID (unique)</label>
          <input type="text" value={obj.id} placeholder="my_chest_1"
            onChange={e => update({ id: e.target.value })}
            className={cn(INPUT, 'w-full')} />
        </div>
      </div>

      {obj.kind === 'npc' && (
        <div>
          <label className={LABEL}>NPC Definition</label>
          <select value={obj.npc ?? ''} onChange={e => update({ npc: e.target.value || undefined })}
            className={cn(INPUT, 'w-full')}>
            <option value="">— pick NPC —</option>
            {(ruleset.npcs ?? []).map(n => (
              <option key={n.id} value={n.id}>{n.portrait ? `${n.portrait} ` : ''}{n.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-white/25 mt-1">
            Portrait, stats, and conversation come from the NPC entry in the Characters workspace.
          </p>
        </div>
      )}

      <div className="hidden">
      </div>

      {/* Locked */}
      <div>
        <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer mb-2">
          <input type="checkbox" checked={!!obj.locked}
            onChange={e => update({ locked: e.target.checked ? { key: '' } : undefined })} />
          Requires key item
        </label>
        {obj.locked && (
          <select value={obj.locked.key} onChange={e => update({ locked: { key: e.target.value } })}
            className={cn(INPUT, 'w-full')}>
            <option value="">— pick key item —</option>
            {ruleset.items.filter(i => i.kind === 'key' || i.kind === 'misc').map(i => (
              <option key={i.id} value={i.id}>{i.icon} {i.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Open sound (chest) — overrides the ruleset 'chest' event sound */}
      {obj.kind === 'chest' && (
        <div>
          <label className={LABEL}>Open Sound <span className="text-white/30">(optional)</span></label>
          <select value={obj.sound ?? ''} onChange={e => update({ sound: e.target.value || undefined })}
            className={cn(INPUT, 'w-full')}>
            <option value="">— default (Chest) —</option>
            {ruleset.audioTracks.filter(t => t.role === 'sfx').map(t => (
              <option key={t.id} value={t.id}>{t.icon ?? '🔊'} {t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loot (chest/door/trap) */}
      {(obj.kind === 'chest' || obj.kind === 'trap' || obj.kind === 'door') && (
        <div>
          <label className={LABEL}>Loot Table</label>
          <select value={obj.loot ?? ''} onChange={e => update({ loot: e.target.value || undefined })}
            className={cn(INPUT, 'w-full')}>
            <option value="">— none —</option>
            {ruleset.lootTables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {/* Shop ref */}
      {obj.kind === 'shop' && (
        <div>
          <label className={LABEL}>Shop</label>
          <select value={obj.shop ?? ''} onChange={e => update({ shop: e.target.value || undefined })}
            className={cn(INPUT, 'w-full')}>
            <option value="">— pick shop —</option>
            {ruleset.shops.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>
      )}

      {/* Inn price */}
      {obj.kind === 'inn' && (
        <div>
          <label className={LABEL}>Price (gold, 0 = free)</label>
          <input type="number" min={0} value={obj.price ?? 0}
            onChange={e => update({ price: Math.max(0, e.target.valueAsNumber || 0) })}
            className={cn(INPUT, 'w-24')} />
          <p className="text-[10px] text-white/30 mt-1">Interacting pays the price for a full heal, cure, and revive.</p>
        </div>
      )}

      {/* Trap effects */}
      {obj.kind === 'trap' && (
        <EffectBuilder
          label="Trap Effects"
          effects={(obj.trapEffects ?? []) as Effect[]}
          ruleset={ruleset}
          onChange={effs => update({ trapEffects: effs })}
        />
      )}

      {/* On-interact effects */}
      <EffectBuilder
        label="On Interact Effects"
        effects={(obj.onInteract ?? []) as Effect[]}
        ruleset={ruleset}
        onChange={effs => update({ onInteract: effs })}
      />
    </div>
  )
}

function EventEntityEditor({
  entity,
  ruleset,
  onChange,
}: {
  entity: CellEntity & { t: 'event' }
  ruleset: Ruleset
  onChange: (e: CellEntity) => void
}) {
  const ev = entity.event

  function update(patch: Partial<CellEvent>) {
    onChange({ ...entity, event: { ...ev, ...patch } })
  }

  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className={LABEL}>Name (organisation)</label>
        <input type="text" value={ev.name ?? ''} placeholder="Crypt gate opens"
          onChange={e => update({ name: e.target.value || undefined })}
          className={cn(INPUT, 'w-full')} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={LABEL}>Event ID</label>
          <input type="text" value={ev.id} placeholder="welcome_event"
            onChange={e => update({ id: e.target.value })}
            className={cn(INPUT, 'w-full')} />
        </div>
        <div>
          <label className={LABEL}>Trigger</label>
          <select value={ev.trigger} onChange={e => update({ trigger: e.target.value as CellEvent['trigger'] })}
            className={INPUT}>
            <option value="onEnter">On Enter</option>
            <option value="onInteract">On Interact (E)</option>
            <option value="onFlag">On Flag (reactive)</option>
            <option value="onFlag">On Flag</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
        <input type="checkbox" checked={!!ev.once}
          onChange={e => update({ once: e.target.checked })} />
        Fire only once (auto-sets a flag)
      </label>

      <ConditionBuilder
        conditions={ev.conditions ?? []}
        ruleset={ruleset}
        onChange={cs => update({ conditions: cs })}
      />

      <EffectBuilder
        label="Effects"
        effects={ev.effects}
        ruleset={ruleset}
        onChange={effs => update({ effects: effs })}
      />
    </div>
  )
}

// ── Entity row (collapsed header) ─────────────────────────────────────────────

const ENTITY_ICONS: Record<CellEntity['t'], string> = {
  encounter: '⚔️',
  partyStart: '🏁',
  mapLink: '🚪',
  object: '📦',
  event: '⚡',
  trick: '🌀',
  foe: '👹',
}

const ENTITY_LABELS: Record<CellEntity['t'], string> = {
  encounter: 'Encounter',
  partyStart: 'Party Start',
  mapLink: 'Map Link',
  object: 'Object',
  event: 'Event',
  trick: 'Trick Tile',
  foe: 'FOE Patrol',
}

const TRICK_KIND_OPTS = [
  { value: 'spinner',        label: '🌀 Spinner — silently rotates the party' },
  { value: 'pit',            label: '🕳 Pit — fall to the map below (damage)' },
  { value: 'silentTeleport', label: '✨ Silent Teleport — relocate, no cue' },
  { value: 'antiMagic',      label: '🚫 Anti-Magic — no casting here' },
  { value: 'darkness',       label: '🌑 Darkness — light snuffed to 1 cell' },
  { value: 'safeRoom',       label: '⛺ Safe Room — no ambush, no encounters' },
] as const

function entitySummary(ent: CellEntity): string {
  switch (ent.t) {
    case 'encounter': return ent.table || '—'
    case 'partyStart': return 'Party spawns here'
    case 'mapLink': return `→ ${ent.mapId || '—'} (${ent.x},${ent.y})`
    case 'object': return `${ent.object.kind} "${ent.object.id}"`
    case 'event': return `${ent.event.trigger}: ${ent.event.id || '—'}`
    case 'trick': return TRICK_KIND_OPTS.find(o => o.value === ent.kind)?.label ?? ent.kind
    case 'foe': return `${ent.enemy || '—'} ×${ent.count ?? 1} · ${(ent.path?.length ?? 0) + 1} waypoints`
  }
}

// ── Entity add menu ───────────────────────────────────────────────────────────

let _objSeq = 1
let _evSeq  = 1

function makeBlankEntity(t: CellEntity['t']): CellEntity {
  switch (t) {
    case 'encounter':
      return { t: 'encounter', table: '', mode: 'zone', rate: 0.1 }
    case 'partyStart':
      return { t: 'partyStart' }
    case 'mapLink':
      return { t: 'mapLink', mapId: '', x: 0, y: 0 }
    case 'object':
      return { t: 'object', object: { kind: 'chest', id: `obj_${_objSeq++}`, onInteract: [] } }
    case 'event':
      return { t: 'event', event: { id: `event_${_evSeq++}`, trigger: 'onEnter', effects: [] } }
    case 'trick':
      return { t: 'trick', kind: 'spinner' }
    case 'foe':
      return { t: 'foe', enemy: '', count: 1, path: [], mode: 'loop' }
  }
}

// ── FOE patrol editor ─────────────────────────────────────────────────────────

function FoeEntityEditor({
  entity,
  ruleset,
  onChange,
}: {
  entity: CellEntity & { t: 'foe' }
  ruleset: Ruleset
  onChange: (e: CellEntity) => void
}) {
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className={LABEL}>Enemy</label>
        <select value={entity.enemy} onChange={e => onChange({ ...entity, enemy: e.target.value })}
          className={cn(INPUT, 'w-full')}>
          <option value="">— pick enemy —</option>
          {ruleset.enemies.map(en => <option key={en.id} value={en.id}>{en.icon} {en.name}</option>)}
        </select>
      </div>
      <div className="flex gap-3">
        <div>
          <label className={LABEL}>Count</label>
          <input type="number" min={1} max={6} value={entity.count ?? 1}
            onChange={e => onChange({ ...entity, count: Math.max(1, Math.min(6, e.target.valueAsNumber || 1)) })}
            className={cn(INPUT, 'w-16')} />
        </div>
        <div>
          <label className={LABEL}>Route mode</label>
          <select value={entity.mode ?? 'loop'}
            onChange={e => onChange({ ...entity, mode: e.target.value as 'loop' | 'pingpong' })}
            className={INPUT}>
            <option value="loop">Loop</option>
            <option value="pingpong">Ping-pong</option>
          </select>
        </div>
      </div>
      <div>
        <label className={LABEL}>Route waypoints (x,y per line — this cell is the start)</label>
        <textarea
          rows={3}
          value={(entity.path ?? []).map(p => `${p.x},${p.y}`).join('\n')}
          onChange={e => {
            const path = e.target.value.split('\n')
              .map(line => line.split(',').map(n => Number(n.trim())))
              .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
              .map(([x, y]) => ({ x, y }))
            onChange({ ...entity, path })
          }}
          placeholder={'12,5\n12,8\n9,8'}
          className={cn(INPUT, 'w-full font-mono resize-none')}
        />
        <p className="text-[10px] text-white/30 mt-1">
          Moves one waypoint per player step. Visible in-game; walking into it starts a fixed battle. Stays dead once defeated.
        </p>
      </div>
    </div>
  )
}

// ── Trick tile editor ─────────────────────────────────────────────────────────

function TrickEntityEditor({
  entity,
  maps,
  onChange,
}: {
  entity: CellEntity & { t: 'trick' }
  maps: MapData[]
  onChange: (e: CellEntity) => void
}) {
  const showTarget = entity.kind === 'pit' || entity.kind === 'silentTeleport'
  return (
    <div className="space-y-3 pt-2">
      <div>
        <label className={LABEL}>Kind</label>
        <select value={entity.kind}
          onChange={e => onChange({ t: 'trick', kind: e.target.value as typeof entity.kind })}
          className={cn(INPUT, 'w-full')}>
          {TRICK_KIND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {entity.kind === 'spinner' && (
        <div>
          <label className={LABEL}>Rotation</label>
          <select value={entity.rotate ?? 'random'}
            onChange={e => onChange({ ...entity, rotate: e.target.value as NonNullable<typeof entity.rotate> })}
            className={cn(INPUT, 'w-full')}>
            <option value="random">Random</option>
            <option value="left">Left 90°</option>
            <option value="right">Right 90°</option>
            <option value="reverse">Reverse 180°</option>
          </select>
        </div>
      )}
      {entity.kind === 'pit' && (
        <div>
          <label className={LABEL}>Fall damage (dice)</label>
          <input type="text" placeholder="1d6" value={entity.damage !== undefined ? String(entity.damage) : ''}
            onChange={e => {
              const v = e.target.value.trim()
              const n = Number(v)
              onChange({ ...entity, damage: v === '' ? undefined : isNaN(n) ? v : n })
            }}
            className={cn(INPUT, 'w-24 font-mono')} />
        </div>
      )}
      {showTarget && (
        <div className="space-y-2">
          <div>
            <label className={LABEL}>{entity.kind === 'pit' ? 'Fall target (blank = next map, same coords)' : 'Destination'}</label>
            <select value={entity.mapId ?? ''}
              onChange={e => onChange({ ...entity, mapId: e.target.value || undefined })}
              className={cn(INPUT, 'w-full')}>
              <option value="">{entity.kind === 'pit' ? '— next map below —' : '— this map —'}</option>
              {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <div>
              <label className={LABEL}>X</label>
              <input type="number" value={entity.x ?? ''} placeholder="same"
                onChange={e => onChange({ ...entity, x: isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber })}
                className={cn(INPUT, 'w-20')} />
            </div>
            <div>
              <label className={LABEL}>Y</label>
              <input type="number" value={entity.y ?? ''} placeholder="same"
                onChange={e => onChange({ ...entity, y: isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber })}
                className={cn(INPUT, 'w-20')} />
            </div>
          </div>
        </div>
      )}
      {(entity.kind === 'antiMagic' || entity.kind === 'darkness' || entity.kind === 'safeRoom') && (
        <p className="text-[11px] text-white/40">
          Zone effect — active while the party stands on this cell. No other configuration.
        </p>
      )}
    </div>
  )
}

// ── Sub-cube volume editor ────────────────────────────────────────────────────

const LAYER_NAMES = ['Floor', 'Mid', 'Ceiling'] as const
const X_LABELS    = ['W', 'C', 'E']
const Z_ROW_ORDER = [2, 1, 0] as const  // far (north) at top, near (south) at bottom

const SC_TRIGGER_OPTS = [
  { value: '',            label: 'None — visual only' },
  { value: 'onEnter',    label: 'On Enter (step into cell)' },
  { value: 'onInteract', label: 'On Interact (E key)' },
  { value: 'onView',     label: 'On View (facing object)' },
] as const

const SC_TRIGGER_COLORS: Record<string, string> = {
  onEnter:    'text-amber-300',
  onInteract: 'text-sky-300',
  onView:     'text-emerald-300',
}

function posLabel(pos: { x: number; y: number; z: number }): string {
  return `${['Floor','Mid','Ceiling'][pos.y]} · ${['W','C','E'][pos.x]} · ${['Near','C','Far'][pos.z]}`
}

let _scSeq = 1

function SubcubeVolumeEditor({
  objects,
  ruleset,
  onChange,
}: {
  objects: SubcubeObject[]
  ruleset: Ruleset
  onChange: (objs: SubcubeObject[]) => void
}) {
  const [open, setOpen]         = useState(false)
  const [layer, setLayer]       = useState<0 | 1 | 2>(0)
  const [selKind, setSelKind]   = useState<string>('torch')
  const [selId, setSelId]       = useState<string | null>(null)

  const layerObjs = objects.filter(o => o.pos.y === layer)
  const selObj    = selId ? objects.find(o => o.id === selId) ?? null : null

  function getAt(x: 0 | 1 | 2, z: 0 | 1 | 2) {
    return layerObjs.find(o => o.pos.x === x && o.pos.z === z)
  }

  function clickSlot(x: 0 | 1 | 2, z: 0 | 1 | 2) {
    const existing = getAt(x, z)
    if (existing) {
      setSelId(existing.id === selId ? null : existing.id)
    } else {
      const newObj: SubcubeObject = { id: `sc_${_scSeq++}`, pos: { x, y: layer, z }, kind: selKind }
      onChange([...objects, newObj])
      setSelId(newObj.id)
    }
  }

  function updateSel(patch: Partial<SubcubeObject>) {
    if (!selObj) return
    onChange(objects.map(o => o.id === selObj.id ? { ...o, ...patch } : o))
  }

  function removeSel() {
    if (!selObj) return
    onChange(objects.filter(o => o.id !== selObj.id))
    setSelId(null)
  }

  // Clear selection when switching layers if selected object is on a different layer
  function switchLayer(y: 0 | 1 | 2) {
    if (selObj && selObj.pos.y !== y) setSelId(null)
    setLayer(y)
  }

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span className="flex-1 text-left">Volume Objects</span>
        {objects.length > 0 && (
          <span className="text-[10px] font-normal text-amber-400/70">{objects.length}</span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Layer tabs */}
          <div className="flex rounded-md overflow-hidden border border-white/10">
            {LAYER_NAMES.map((name, i) => (
              <button
                key={name}
                onClick={() => switchLayer(i as 0 | 1 | 2)}
                className={cn(
                  'flex-1 text-[10px] py-1.5 font-medium transition-colors',
                  layer === i
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5',
                )}
              >
                {name}
              </button>
            ))}
          </div>

          {/* 3×3 grid — rows=z (far/N at top), cols=x (W→E) */}
          <div className="space-y-1">
            <div className="flex items-center">
              <span className="text-[9px] text-white/20 w-7" />
              {X_LABELS.map(l => (
                <span key={l} className="flex-1 text-[9px] text-white/25 text-center">{l}</span>
              ))}
            </div>
            {Z_ROW_ORDER.map((z, ri) => (
              <div key={z} className="flex items-center gap-1">
                <span className="text-[9px] text-white/25 w-6 text-right flex-shrink-0">
                  {ri === 0 ? 'N' : ri === 2 ? 'S' : '·'}
                </span>
                {([0, 1, 2] as const).map(x => {
                  const obj = getAt(x, z)
                  const def = obj ? getSubcubeDef(obj.kind) : null
                  const isSel = obj?.id === selId
                  const hasTrigger = Boolean(obj?.trigger)
                  return (
                    <button
                      key={x}
                      onClick={() => clickSlot(x, z)}
                      title={obj
                        ? `${def?.label ?? obj.kind}${hasTrigger ? ` · ${obj.trigger}` : ''} — click to edit`
                        : `Place ${selKind}`}
                      className={cn(
                        'flex-1 aspect-square rounded border flex items-center justify-center text-base transition-all relative',
                        isSel
                          ? 'border-sky-400/70 bg-sky-500/15 ring-1 ring-sky-400/40'
                          : obj
                          ? 'border-amber-500/50 bg-amber-500/10 hover:border-amber-400/70 hover:bg-amber-500/15'
                          : 'border-white/10 bg-white/4 hover:border-white/22 hover:bg-white/8',
                      )}
                    >
                      {def?.icon ?? ''}
                      {hasTrigger && !isSel && (
                        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
            <div className="text-[9px] text-white/20 text-center pt-0.5">S = player side · dot = has trigger</div>
          </div>

          {/* Kind picker */}
          <div>
            <div className="text-[10px] text-white/40 mb-1.5 font-medium uppercase tracking-wide">
              Brush: {getSubcubeDef(selKind)?.icon} {getSubcubeDef(selKind)?.label}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {SUBCUBE_KIND_DEFS.map(def => (
                <button
                  key={def.kind}
                  onClick={() => setSelKind(def.kind)}
                  title={def.label}
                  className={cn(
                    'rounded border py-1.5 text-base transition-all',
                    selKind === def.kind
                      ? 'border-amber-500/50 bg-amber-500/15'
                      : 'border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8',
                  )}
                >
                  {def.icon}
                </button>
              ))}
            </div>
          </div>

          {/* ── Detail panel for selected object ─────────────────────────────── */}
          {selObj && (() => {
            const def = getSubcubeDef(selObj.kind)
            const trigger = selObj.trigger ?? ''
            return (
              <div className="rounded-lg border border-sky-500/25 bg-sky-500/6 p-2.5 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{def?.icon ?? '?'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white/80">{def?.label ?? selObj.kind}</div>
                    <div className="text-[9px] text-white/35">{posLabel(selObj.pos)}</div>
                  </div>
                  <button onClick={removeSel}
                    className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Custom label */}
                <div>
                  <label className={LABEL}>Label (optional)</label>
                  <input
                    type="text"
                    value={selObj.label ?? ''}
                    placeholder={def?.label ?? selObj.kind}
                    maxLength={60}
                    onChange={e => updateSel({ label: e.target.value || undefined })}
                    className={cn(INPUT, 'w-full')}
                  />
                </div>

                {/* Trigger */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className={LABEL}>Trigger</label>
                    <select
                      value={trigger}
                      onChange={e => updateSel({ trigger: (e.target.value as SubcubeObject['trigger']) || undefined, conditions: undefined, effects: undefined, encounter: undefined })}
                      className={cn(INPUT, 'w-full', trigger && SC_TRIGGER_COLORS[trigger])}
                    >
                      {SC_TRIGGER_OPTS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {trigger && (
                    <label className="flex items-center gap-1.5 pb-1.5 text-xs text-white/60 cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={!!selObj.once}
                        onChange={e => updateSel({ once: e.target.checked || undefined })} />
                      Once
                    </label>
                  )}
                </div>

                {/* Logic body — only when trigger is set */}
                {trigger && (
                  <>
                    <ConditionBuilder
                      conditions={selObj.conditions ?? []}
                      ruleset={ruleset}
                      onChange={cs => updateSel({ conditions: cs.length ? cs : undefined })}
                    />

                    {/* Encounter OR effects — mutually exclusive */}
                    <div>
                      <label className={LABEL}>Encounter table (optional)</label>
                      <select
                        value={selObj.encounter ?? ''}
                        onChange={e => updateSel({ encounter: e.target.value || undefined, effects: e.target.value ? undefined : selObj.effects })}
                        className={cn(INPUT, 'w-full')}
                      >
                        <option value="">— none —</option>
                        {ruleset.encounterTables.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    {!selObj.encounter && (
                      <EffectBuilder
                        label="Effects"
                        effects={selObj.effects ?? []}
                        ruleset={ruleset}
                        onChange={effs => updateSel({ effects: effs.length ? effs : undefined })}
                      />
                    )}
                  </>
                )}

                {!trigger && (
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    No trigger — object is visual only. Set a trigger above to add interactivity.
                  </p>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ── Main inspector ────────────────────────────────────────────────────────────

interface CellInspectorProps {
  x: number
  y: number
  cell: CellData
  maps: MapData[]
  ruleset: Ruleset
  onChange: (entities: CellEntity[]) => void
  onSubcubeChange?: (objs: SubcubeObject[]) => void
  /** The cell's four boundaries, for the edit-boundary section. */
  boundaries?: Partial<Record<EdgeDir, BoundaryData>>
  /** Opens the boundary inspector for an edge (creating a wall if empty). */
  onEditBoundary?: (dir: EdgeDir) => void
  onClose: () => void
}

function boundarySummary(b?: BoundaryData): string {
  if (!b) return '—'
  const parts: string[] = []
  if (b.door) {
    const flags = b.door.requiredFlags?.length
      ? ` · ${b.door.requiredFlags.length} flag${b.door.requiredFlags.length > 1 ? 's' : ''}`
      : ''
    parts.push(`Door (${b.door.state})${flags}`)
  } else if (b.wall !== undefined) {
    parts.push(edgeDef(b.wall).label)
  }
  if (b.switch) parts.push(`Switch → ${b.switch.flag}`)
  if (b.inscription) parts.push('Inscription')
  return parts.join(' · ') || 'Boundary'
}

export function CellInspector({ x, y, cell, maps, ruleset, onChange, onSubcubeChange, boundaries, onEditBoundary, onClose }: CellInspectorProps) {
  const entities = cell.entities ?? []
  const [expanded, setExpanded] = useState<number | null>(entities.length === 1 ? 0 : null)
  const [showAddMenu, setShowAddMenu] = useState(false)

  function addEntity(t: CellEntity['t']) {
    const ent = makeBlankEntity(t)
    const next = [...entities, ent]
    onChange(next)
    setExpanded(next.length - 1)
    setShowAddMenu(false)
  }

  function removeEntity(idx: number) {
    const next = entities.filter((_, i) => i !== idx)
    onChange(next)
    if (expanded === idx) setExpanded(null)
    else if (expanded !== null && expanded > idx) setExpanded(expanded - 1)
  }

  function updateEntity(idx: number, ent: CellEntity) {
    onChange(entities.map((e, i) => i === idx ? ent : e))
  }

  return (
    <div className="w-full flex-1 bg-zinc-950 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
        <div>
          <div className="text-sm font-semibold text-white/90">Cell ({x}, {y})</div>
          <div className="text-[10px] text-white/40">{entities.length} entit{entities.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <button onClick={onClose} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stairs destination — surfaced whenever the cell's terrain is stairs */}
      {(cell.base === BASE.STAIRS_UP || cell.base === BASE.STAIRS_DOWN) && (() => {
        const stairsLabel = cell.base === BASE.STAIRS_UP ? 'Stairs Up' : 'Stairs Down'
        const linkIdx = entities.findIndex(e => e.t === 'mapLink')
        const link = linkIdx >= 0 ? entities[linkIdx] as CellEntity & { t: 'mapLink' } : null
        const destMap = link ? maps.find(m => m.id === link.mapId) : null
        return (
          <div className="p-2 border-b border-white/10 space-y-1.5">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide px-1">
              {cell.base === BASE.STAIRS_UP ? '▲' : '▼'} {stairsLabel} — Destination
            </div>
            {link ? (
              <div className="flex items-center gap-2 px-1.5 py-1 rounded bg-zinc-900/60 border border-white/5 text-xs">
                <span className="flex-1 truncate text-white/65">
                  → {destMap?.name ?? link.mapId ?? '— unset —'} ({link.x}, {link.y}){link.facing ? ` · face ${link.facing}` : ''}
                </span>
                <button
                  onClick={() => setExpanded(linkIdx)}
                  className="px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="px-1.5 space-y-1.5">
                <div className="text-[11px] text-amber-300/70">No destination — these stairs are decorative until linked.</div>
                <select
                  value=""
                  onChange={e => {
                    if (!e.target.value) return
                    const next = [...entities, { t: 'mapLink', mapId: e.target.value, x, y } as CellEntity]
                    onChange(next)
                    setExpanded(next.length - 1)
                  }}
                  className="w-full px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/90 focus:outline-none"
                >
                  <option value="">Link to map… (same coordinates, adjust after)</option>
                  {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )
      })()}

      {/* Volume objects editor */}
      {onSubcubeChange && (
        <SubcubeVolumeEditor
          objects={cell.subcubeObjects ?? []}
          ruleset={ruleset}
          onChange={onSubcubeChange}
        />
      )}

      {/* Boundaries: doors / switches on the four edges */}
      {boundaries && onEditBoundary && (
        <div className="p-2 border-b border-white/10 space-y-1">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide px-1">Boundaries</div>
          {(['N', 'E', 'S', 'W'] as EdgeDir[]).map(dir => {
            const b = boundaries[dir]
            return (
              <div key={dir} className="flex items-center gap-2 px-1.5 py-1 rounded bg-zinc-900/60 border border-white/5 text-xs">
                <span className="w-4 text-center font-mono text-white/40 flex-shrink-0">{dir}</span>
                <span className={cn('flex-1 truncate', b ? 'text-white/65' : 'text-white/25')}>
                  {boundarySummary(b)}
                </span>
                <button
                  onClick={() => onEditBoundary(dir)}
                  className="px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
                >
                  {b ? 'Edit' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {entities.length === 0 && (
          <div className="text-center text-white/20 text-xs py-8">
            No entities on this cell.<br />Click + Add to place one.
          </div>
        )}

        {entities.map((ent, idx) => (
          <div key={idx} className="rounded-lg border border-white/10 overflow-hidden">
            {/* Entity row header */}
            <div
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 cursor-pointer group transition-colors',
                expanded === idx ? 'bg-zinc-800' : 'hover:bg-white/5',
              )}
              onClick={() => setExpanded(expanded === idx ? null : idx)}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{ENTITY_ICONS[ent.t]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white/80">{ENTITY_LABELS[ent.t]}</div>
                <div className="text-[10px] text-white/35 truncate">{entitySummary(ent)}</div>
              </div>
              <span className="opacity-0 group-hover:opacity-100 flex flex-col flex-shrink-0">
                <button title="Move up (events run top-to-bottom)"
                  onClick={e => {
                    e.stopPropagation()
                    if (idx === 0) return
                    const next = [...entities]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                    onChange(next)
                  }}
                  className="p-0 leading-none text-[9px] text-white/30 hover:text-amber-300">▲</button>
                <button title="Move down"
                  onClick={e => {
                    e.stopPropagation()
                    if (idx === entities.length - 1) return
                    const next = [...entities]; [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
                    onChange(next)
                  }}
                  className="p-0 leading-none text-[9px] text-white/30 hover:text-amber-300">▼</button>
              </span>
              <button
                onClick={e => { e.stopPropagation(); removeEntity(idx) }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              {expanded === idx
                ? <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
              }
            </div>

            {/* Editor */}
            {expanded === idx && (
              <div className="px-3 pb-3 border-t border-white/10 bg-zinc-900/60">
                {ent.t === 'encounter' && (
                  <EncounterEntityEditor entity={ent} ruleset={ruleset} onChange={upd => updateEntity(idx, upd)} />
                )}
                {ent.t === 'partyStart' && (
                  <p className="text-xs text-white/40 pt-3">The party spawns here at game start.</p>
                )}
                {ent.t === 'mapLink' && (
                  <MapLinkEntityEditor entity={ent} maps={maps} onChange={upd => updateEntity(idx, upd)} />
                )}
                {ent.t === 'trick' && (
                  <TrickEntityEditor entity={ent} maps={maps} onChange={upd => updateEntity(idx, upd)} />
                )}
                {ent.t === 'foe' && (
                  <FoeEntityEditor entity={ent} ruleset={ruleset} onChange={upd => updateEntity(idx, upd)} />
                )}
                {ent.t === 'object' && (
                  <ObjectEntityEditor entity={ent} ruleset={ruleset} onChange={upd => updateEntity(idx, upd)} />
                )}
                {ent.t === 'event' && (
                  <EventEntityEditor entity={ent} ruleset={ruleset} onChange={upd => updateEntity(idx, upd)} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add entity */}
      <div className="border-t border-white/10">
        <div className="p-2">
          <button
            onClick={() => setShowAddMenu(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entity
          </button>
        </div>

        {showAddMenu && (
          <div className="px-2 pb-2 flex flex-col gap-0.5">
            {(['encounter', 'partyStart', 'mapLink', 'object', 'event', 'trick', 'foe'] as CellEntity['t'][]).map(t => (
              <button
                key={t}
                onClick={() => addEntity(t)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-white/70 hover:bg-white/8 hover:text-white transition-colors rounded-md"
              >
                <span className="text-base">{ENTITY_ICONS[t]}</span>
                {ENTITY_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
