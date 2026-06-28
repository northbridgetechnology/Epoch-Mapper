'use client'

import { useState } from 'react'
import { Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  CellEntity, CellEvent, Condition, Effect, ObjectInstance, Ruleset,
} from '@/lib/engine-types'
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
        }}
        className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none"
      >
        <option value="flag">Flag =</option>
        <option value="hasItem">Has Item</option>
        <option value="partyLevel">Party Level ≥</option>
        <option value="random">Random chance</option>
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

function ConditionBuilder({
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
            {(['chest','door','lever','sign','npc','shop','trap','teleporter'] as const).map(k => (
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
}

const ENTITY_LABELS: Record<CellEntity['t'], string> = {
  encounter: 'Encounter',
  partyStart: 'Party Start',
  mapLink: 'Map Link',
  object: 'Object',
  event: 'Event',
}

function entitySummary(ent: CellEntity): string {
  switch (ent.t) {
    case 'encounter': return ent.table || '—'
    case 'partyStart': return 'Party spawns here'
    case 'mapLink': return `→ ${ent.mapId || '—'} (${ent.x},${ent.y})`
    case 'object': return `${ent.object.kind} "${ent.object.id}"`
    case 'event': return `${ent.event.trigger}: ${ent.event.id || '—'}`
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
  }
}

// ── Sub-cube volume editor ────────────────────────────────────────────────────

const LAYER_NAMES = ['Floor', 'Mid', 'Ceiling'] as const
const X_LABELS    = ['W', 'C', 'E']
const Z_ROW_ORDER = [2, 1, 0] as const  // far (north) at top, near (south) at bottom

let _scSeq = 1

function SubcubeVolumeEditor({
  objects,
  onChange,
}: {
  objects: SubcubeObject[]
  onChange: (objs: SubcubeObject[]) => void
}) {
  const [open, setOpen]       = useState(false)
  const [layer, setLayer]     = useState<0 | 1 | 2>(0)
  const [selKind, setSelKind] = useState<string>('torch')

  const layerObjs = objects.filter(o => o.pos.y === layer)

  function getAt(x: 0 | 1 | 2, z: 0 | 1 | 2) {
    return layerObjs.find(o => o.pos.x === x && o.pos.z === z)
  }

  function toggleSlot(x: 0 | 1 | 2, z: 0 | 1 | 2) {
    const existing = getAt(x, z)
    if (existing) {
      onChange(objects.filter(o => !(o.pos.x === x && o.pos.y === layer && o.pos.z === z)))
    } else {
      onChange([...objects, { id: `sc_${_scSeq++}`, pos: { x, y: layer, z }, kind: selKind }])
    }
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
                onClick={() => setLayer(i as 0 | 1 | 2)}
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
                  return (
                    <button
                      key={x}
                      onClick={() => toggleSlot(x, z)}
                      title={obj ? `${def?.label ?? obj.kind} — click to remove` : `Place ${selKind}`}
                      className={cn(
                        'flex-1 aspect-square rounded border flex items-center justify-center text-base transition-all',
                        obj
                          ? 'border-amber-500/50 bg-amber-500/10 hover:border-red-400/60 hover:bg-red-500/10'
                          : 'border-white/10 bg-white/4 hover:border-white/22 hover:bg-white/8',
                      )}
                    >
                      {def?.icon ?? ''}
                    </button>
                  )
                })}
              </div>
            ))}
            <div className="text-[9px] text-white/20 text-center pt-0.5">S = player side</div>
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
  onClose: () => void
}

export function CellInspector({ x, y, cell, maps, ruleset, onChange, onSubcubeChange, onClose }: CellInspectorProps) {
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
    <div className="w-80 flex-shrink-0 border-l border-white/10 bg-zinc-950 flex flex-col min-h-0">
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

      {/* Volume objects editor */}
      {onSubcubeChange && (
        <SubcubeVolumeEditor
          objects={cell.subcubeObjects ?? []}
          onChange={onSubcubeChange}
        />
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
            {(['encounter', 'partyStart', 'mapLink', 'object', 'event'] as CellEntity['t'][]).map(t => (
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
