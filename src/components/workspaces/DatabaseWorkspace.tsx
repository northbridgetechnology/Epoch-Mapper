'use client'

import { Fragment, useState } from 'react'
import { Plus, Trash2, Package, List, Skull, Swords, Sparkles, Zap, Store, Puzzle, ScrollText, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassDef, ItemSlot, Effect, EnemyDef, EncounterTableDef, EventDef, ItemDef, LootTableDef, QuestDef, ShopDef, SpellDef, StatusEffectDef, Ruleset } from '@/lib/engine-types'
import { CLASS_SCHEMA, blankClass } from '@/lib/class-schema'
import { EVENT_SCHEMA, QUEST_SCHEMA, blankEventDef, blankQuest } from '@/lib/npc-schema'
import { ConditionBuilder } from '@/components/CellInspector'
import { SimulatePanel } from '@/components/SimulatePanel'
import { SchemaForm } from '../forms/SchemaForm'
import { EffectBuilder } from '../forms/EffectBuilder'
import { ITEM_SCHEMA, LOOT_TABLE_SCHEMA, blankItem } from '@/lib/item-schema'
import { ENEMY_SCHEMA, ENCOUNTER_TABLE_SCHEMA, blankEnemy } from '@/lib/enemy-schema'
import { SPELL_SCHEMA, STATUS_SCHEMA, blankSpell, blankStatusEffect } from '@/lib/spell-schema'
import { SHOP_SCHEMA, blankShop } from '@/lib/shop-schema'

type Category = 'items' | 'loot_tables' | 'bestiary' | 'encounters' | 'spells' | 'status_effects' | 'shops' | 'classes' | 'events' | 'quests'

const CATEGORIES: { id: Category; icon: React.ReactNode; label: string }[] = [
  { id: 'items',          icon: <Package className="w-4 h-4" />,  label: 'Items' },
  { id: 'classes',        icon: <Shield className="w-4 h-4" />,   label: 'Classes' },
  { id: 'loot_tables',    icon: <List className="w-4 h-4" />,     label: 'Loot Tables' },
  { id: 'bestiary',       icon: <Skull className="w-4 h-4" />,    label: 'Bestiary' },
  { id: 'encounters',     icon: <Swords className="w-4 h-4" />,   label: 'Encounter Tables' },
  { id: 'spells',         icon: <Sparkles className="w-4 h-4" />, label: 'Spells' },
  { id: 'status_effects', icon: <Zap className="w-4 h-4" />,      label: 'Status Effects' },
  { id: 'shops',          icon: <Store className="w-4 h-4" />,    label: 'Shops' },
  { id: 'events',         icon: <Puzzle className="w-4 h-4" />,     label: 'Events' },
  { id: 'quests',         icon: <ScrollText className="w-4 h-4" />, label: 'Quests' },
]

// ── Item entry list ───────────────────────────────────────────────────────────

function ItemList({
  items,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  items: ItemDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Items ({items.length})
        </span>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {items.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">
            No items yet — click New
          </div>
        )}
        {items.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === item.id
                ? 'bg-amber-950/40 text-white'
                : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(item.id)}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{item.icon ?? '📦'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{item.name}</div>
              <div className="text-xs text-white/35 capitalize">{item.kind}{item.slot ? ` · ${item.slot}` : ''}</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(item.id) }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Item detail editor ─────────────────────────────────────────────────────────

function ItemEditor({
  item,
  ruleset,
  onChange,
}: {
  item: ItemDef
  ruleset: Ruleset
  onChange: (item: ItemDef) => void
}) {
  const raw = item as unknown as Record<string, unknown>

  function handleSchemaChange(updated: Record<string, unknown>) {
    // enum '— none —' sentinels → undefined
    if (updated.slot === '') updated = { ...updated, slot: undefined }
    if (updated.weight === '') updated = { ...updated, weight: undefined }
    if (updated.weaponKind === '') updated = { ...updated, weaponKind: undefined }
    onChange(updated as unknown as ItemDef)
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{item.icon ?? '📦'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{item.name}</div>
          <div className="text-xs text-white/40 font-mono">{item.id}</div>
        </div>
      </div>

      <SchemaForm
        schema={ITEM_SCHEMA}
        value={raw}
        onChange={handleSchemaChange}
      />

      {/* On-use effects (consumables) */}
      <div className="pt-2 border-t border-white/10">
        <EffectBuilder
          label={item.kind === 'consumable' ? 'On Use Effects' : 'On Use Effects (equip to enable)'}
          effects={(item.onUse ?? []) as Effect[]}
          ruleset={ruleset}
          onChange={effects => onChange({ ...item, onUse: effects })}
        />
      </div>
    </div>
  )
}

// ── Loot table list ───────────────────────────────────────────────────────────

function LootTableList({
  tables,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  tables: LootTableDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Loot Tables ({tables.length})
        </span>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {tables.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">No loot tables yet</div>
        )}
        {tables.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === t.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(t.id)}
          >
            <List className="w-3.5 h-3.5 flex-shrink-0 text-white/40" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{t.name}</div>
              <div className="text-xs text-white/35">{t.drops.length} drop{t.drops.length !== 1 ? 's' : ''}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); onDelete(t.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Loot table editor ──────────────────────────────────────────────────────────

function LootTableEditor({
  table,
  ruleset,
  onChange,
}: {
  table: LootTableDef
  ruleset: Ruleset
  onChange: (t: LootTableDef) => void
}) {
  function addDrop() {
    const def = ruleset.items[0]
    if (!def) return
    onChange({ ...table, drops: [...table.drops, { item: def.id, qty: 1, chance: 0.5 }] })
  }

  function updateDrop(idx: number, field: string, value: unknown) {
    const drops = table.drops.map((d, i) => i === idx ? { ...d, [field]: value } : d)
    onChange({ ...table, drops })
  }

  function removeDrop(idx: number) {
    onChange({ ...table, drops: table.drops.filter((_, i) => i !== idx) })
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <SchemaForm
        schema={LOOT_TABLE_SCHEMA}
        value={table as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...table, ...(v as Partial<LootTableDef>) })}
      />

      {/* Gold range */}
      <div>
        <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5">Gold Drop</div>
        <div className="flex items-center gap-2">
          <input type="number" min={0}
            value={table.gold?.min ?? 0}
            onChange={e => onChange({ ...table, gold: { min: e.target.valueAsNumber || 0, max: table.gold?.max ?? 0 } })}
            className="w-20 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            placeholder="Min"
          />
          <span className="text-white/30 text-sm">to</span>
          <input type="number" min={0}
            value={table.gold?.max ?? 0}
            onChange={e => onChange({ ...table, gold: { min: table.gold?.min ?? 0, max: e.target.valueAsNumber || 0 } })}
            className="w-20 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            placeholder="Max"
          />
          <span className="text-xs text-white/30">gold (0 = none)</span>
        </div>
      </div>

      {/* Item drops */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Item Drops</span>
          <button onClick={addDrop} disabled={ruleset.items.length === 0} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 disabled:opacity-30">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {ruleset.items.length === 0 && (
          <div className="text-xs text-white/25 text-center py-2">Define some items first</div>
        )}

        <div className="space-y-1.5">
          {table.drops.map((drop, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded bg-zinc-800 border border-white/10 p-2">
              <select
                value={drop.item}
                onChange={e => updateDrop(idx, 'item', e.target.value)}
                className="flex-1 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none"
              >
                {ruleset.items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-xs text-white/30">Qty</span>
                <input type="text" value={String(drop.qty ?? 1)}
                  onChange={e => {
                    const v = e.target.value
                    const n = Number(v)
                    updateDrop(idx, 'qty', isNaN(n) ? v : n)
                  }}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs font-mono text-white/90 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-white/30">Chance</span>
                <input type="number" min={0} max={1} step={0.05}
                  value={drop.chance}
                  onChange={e => updateDrop(idx, 'chance', Math.min(1, Math.max(0, e.target.valueAsNumber || 0)))}
                  className="w-14 px-1 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs font-mono text-white/90 focus:outline-none"
                />
              </div>
              <button onClick={() => removeDrop(idx)} className="p-0.5 rounded text-white/30 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Enemy list ────────────────────────────────────────────────────────────────

function EnemyList({
  enemies,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  enemies: EnemyDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Bestiary ({enemies.length})
        </span>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {enemies.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">No enemies yet — click New</div>
        )}
        {enemies.map(e => (
          <div
            key={e.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === e.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(e.id)}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{e.icon ?? '👾'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{e.name}</div>
              <div className="text-xs text-white/35">{e.hp} HP · ATK {e.attack} · DEF {e.defense}</div>
            </div>
            <button onClick={ev => { ev.stopPropagation(); onDelete(e.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Enemy editor ───────────────────────────────────────────────────────────────

function EnemyEditor({ enemy, onChange }: { enemy: EnemyDef; onChange: (e: EnemyDef) => void }) {
  const raw = enemy as unknown as Record<string, unknown>

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{enemy.icon ?? '👾'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{enemy.name}</div>
          <div className="text-xs text-white/40 font-mono">{enemy.id}</div>
        </div>
      </div>

      <SchemaForm
        schema={ENEMY_SCHEMA}
        value={raw}
        onChange={v => onChange({ ...enemy, ...(v as Partial<EnemyDef>) })}
      />

      {/* Gold drop range */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1.5">Gold Drop</div>
        <div className="flex items-center gap-2">
          <input type="number" min={0}
            value={enemy.gold?.min ?? 0}
            onChange={e => onChange({ ...enemy, gold: { min: e.target.valueAsNumber || 0, max: enemy.gold?.max ?? 0 } })}
            className="w-20 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            placeholder="Min"
          />
          <span className="text-white/30 text-sm">to</span>
          <input type="number" min={0}
            value={enemy.gold?.max ?? 0}
            onChange={e => onChange({ ...enemy, gold: { min: enemy.gold?.min ?? 0, max: e.target.valueAsNumber || 0 } })}
            className="w-20 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            placeholder="Max"
          />
          <span className="text-xs text-white/30">gold</span>
        </div>
      </div>
    </div>
  )
}

// ── Encounter table list ───────────────────────────────────────────────────────

function EncounterTableList({
  tables,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  tables: EncounterTableDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Encounter Tables ({tables.length})
        </span>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {tables.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">No encounter tables yet</div>
        )}
        {tables.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === t.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(t.id)}
          >
            <Swords className="w-3.5 h-3.5 flex-shrink-0 text-white/40" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{t.name}</div>
              <div className="text-xs text-white/35">{t.entries.length} entr{t.entries.length !== 1 ? 'ies' : 'y'}</div>
            </div>
            <button onClick={ev => { ev.stopPropagation(); onDelete(t.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Encounter table editor ─────────────────────────────────────────────────────

function EncounterTableEditor({
  table,
  ruleset,
  onChange,
}: {
  table: EncounterTableDef
  ruleset: Ruleset
  onChange: (t: EncounterTableDef) => void
}) {
  function addEntry() {
    const def = ruleset.enemies[0]
    if (!def) return
    onChange({ ...table, entries: [...table.entries, { enemy: def.id, min: 1, max: 1, weight: 1 }] })
  }

  function updateEntry(idx: number, field: string, value: unknown) {
    const entries = table.entries.map((e, i) => i === idx ? { ...e, [field]: value } : e)
    onChange({ ...table, entries })
  }

  function removeEntry(idx: number) {
    onChange({ ...table, entries: table.entries.filter((_, i) => i !== idx) })
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <SchemaForm
        schema={ENCOUNTER_TABLE_SCHEMA}
        value={table as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...table, ...(v as Partial<EncounterTableDef>) })}
      />

      <div className="pt-2 border-t border-white/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Entries</span>
          <button onClick={addEntry} disabled={ruleset.enemies.length === 0} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 disabled:opacity-30">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {ruleset.enemies.length === 0 && (
          <div className="text-xs text-white/25 text-center py-2">Define some enemies first</div>
        )}

        <div className="space-y-1.5">
          {table.entries.map((entry, idx) => (
            <div key={idx} className="rounded bg-zinc-800 border border-white/10 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <select
                  value={entry.enemy}
                  onChange={e => updateEntry(idx, 'enemy', e.target.value)}
                  className="flex-1 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none"
                >
                  {ruleset.enemies.map(en => (
                    <option key={en.id} value={en.id}>{en.icon} {en.name}</option>
                  ))}
                </select>
                <button onClick={() => removeEntry(idx)} className="p-0.5 rounded text-white/30 hover:text-red-400 flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-white/30">Min</span>
                  <input type="number" min={1} value={entry.min}
                    onChange={e => updateEntry(idx, 'min', Math.max(1, e.target.valueAsNumber || 1))}
                    className="w-12 px-1 py-0.5 rounded bg-zinc-700 border border-white/10 font-mono text-white/90 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white/30">Max</span>
                  <input type="number" min={1} value={entry.max}
                    onChange={e => updateEntry(idx, 'max', Math.max(1, e.target.valueAsNumber || 1))}
                    className="w-12 px-1 py-0.5 rounded bg-zinc-700 border border-white/10 font-mono text-white/90 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-white/30">Weight</span>
                  <input type="number" min={1} value={entry.weight}
                    onChange={e => updateEntry(idx, 'weight', Math.max(1, e.target.valueAsNumber || 1))}
                    className="w-12 px-1 py-0.5 rounded bg-zinc-700 border border-white/10 font-mono text-white/90 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SimulatePanel tableId={table.id} ruleset={ruleset} />
    </div>
  )
}

// ── Spell list ────────────────────────────────────────────────────────────────

function SpellList({
  spells,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  spells: SpellDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Spells ({spells.length})
        </span>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {spells.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">No spells yet — click New</div>
        )}
        {spells.map(s => (
          <div
            key={s.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === s.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(s.id)}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{s.icon ?? '✨'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{s.name}</div>
              <div className="text-xs text-white/35 capitalize">{s.school} · Lv {s.level} · {s.mpCost} MP</div>
            </div>
            <button onClick={ev => { ev.stopPropagation(); onDelete(s.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Spell editor ──────────────────────────────────────────────────────────────

function SpellEditor({ spell, onChange }: { spell: SpellDef; onChange: (s: SpellDef) => void }) {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{spell.icon ?? '✨'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{spell.name}</div>
          <div className="text-xs text-white/40 font-mono">{spell.id}</div>
        </div>
      </div>
      <SchemaForm
        schema={SPELL_SCHEMA}
        value={spell as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...spell, ...(v as Partial<SpellDef>) })}
      />
    </div>
  )
}

// ── Status effect list ────────────────────────────────────────────────────────

function StatusList({
  statuses,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  statuses: StatusEffectDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Status Effects ({statuses.length})
        </span>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {statuses.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">No status effects yet — click New</div>
        )}
        {statuses.map(s => (
          <div
            key={s.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === s.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(s.id)}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{s.icon ?? '⚡'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{s.name}</div>
              <div className="text-xs text-white/35 capitalize">{s.kind} · {s.durationTurns === 0 ? 'permanent' : `${s.durationTurns} turns`}</div>
            </div>
            <button onClick={ev => { ev.stopPropagation(); onDelete(s.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Status effect editor ──────────────────────────────────────────────────────

function StatusEditor({ status, onChange }: { status: StatusEffectDef; onChange: (s: StatusEffectDef) => void }) {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{status.icon ?? '⚡'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{status.name}</div>
          <div className="text-xs text-white/40 font-mono">{status.id}</div>
        </div>
      </div>
      <SchemaForm
        schema={STATUS_SCHEMA}
        value={status as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...status, ...(v as Partial<StatusEffectDef>) })}
      />
    </div>
  )
}

// ── Shop list ─────────────────────────────────────────────────────────────────

function ShopList({
  shops,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  shops: ShopDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
          Shops ({shops.length})
        </span>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {shops.length === 0 && (
          <div className="text-center text-white/25 text-xs py-6">No shops yet — click New</div>
        )}
        {shops.map(s => (
          <div
            key={s.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
              selectedId === s.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5',
            )}
            onClick={() => onSelect(s.id)}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{s.icon ?? '🏪'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{s.name}</div>
              <div className="text-xs text-white/35">{s.stock.length} item{s.stock.length !== 1 ? 's' : ''} · {s.buys ? 'buys' : 'no buy'}</div>
            </div>
            <button onClick={ev => { ev.stopPropagation(); onDelete(s.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shop editor ───────────────────────────────────────────────────────────────

function ShopEditor({
  shop,
  ruleset,
  onChange,
}: {
  shop: ShopDef
  ruleset: Ruleset
  onChange: (s: ShopDef) => void
}) {
  function addStockEntry() {
    const def = ruleset.items[0]
    if (!def) return
    onChange({ ...shop, stock: [...shop.stock, { item: def.id }] })
  }

  function updateStockEntry(idx: number, field: string, value: unknown) {
    const stock = shop.stock.map((e, i) => i === idx ? { ...e, [field]: value } : e)
    onChange({ ...shop, stock })
  }

  function removeStockEntry(idx: number) {
    onChange({ ...shop, stock: shop.stock.filter((_, i) => i !== idx) })
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{shop.icon ?? '🏪'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{shop.name}</div>
          <div className="text-xs text-white/40 font-mono">{shop.id}</div>
        </div>
      </div>

      <SchemaForm
        schema={SHOP_SCHEMA}
        value={shop as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...shop, ...(v as Partial<ShopDef>) })}
      />

      {/* Stock */}
      <div className="pt-2 border-t border-white/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Stock</span>
          <button onClick={addStockEntry} disabled={ruleset.items.length === 0} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 disabled:opacity-30">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {ruleset.items.length === 0 && (
          <div className="text-xs text-white/25 text-center py-2">Define some items first</div>
        )}

        <div className="space-y-1.5">
          {shop.stock.map((entry, idx) => {
            const def = ruleset.items.find(i => i.id === entry.item)
            return (
              <div key={idx} className="flex items-center gap-2 rounded bg-zinc-800 border border-white/10 p-2">
                <select
                  value={entry.item}
                  onChange={e => updateStockEntry(idx, 'item', e.target.value)}
                  className="flex-1 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs text-white/90 focus:outline-none"
                >
                  {ruleset.items.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white/30">Price</span>
                  <input
                    type="number" min={0}
                    value={entry.price ?? def?.value ?? 0}
                    onChange={e => updateStockEntry(idx, 'price', e.target.valueAsNumber || 0)}
                    placeholder={String(def?.value ?? 0)}
                    className="w-16 px-1 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs font-mono text-white/90 focus:outline-none"
                  />
                  <span className="text-xs text-white/30">g</span>
                </div>
                <button onClick={() => removeStockEntry(idx)} className="p-0.5 rounded text-white/30 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main workspace ─────────────────────────────────────────────────────────────

interface DatabaseWorkspaceProps {
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
}

let _itemSeq = 1
let _lootSeq = 1
let _enemySeq = 1
let _encSeq = 1
let _spellSeq = 1
let _statusSeq = 1
let _shopSeq = 1
let _classSeq = 1

// ── Generic def list (NPCs / Events / Quests) ─────────────────────────────────

function GenericDefList({ label, entries, selectedId, onSelect, onAdd, onDelete }: {
  label: string
  entries: { id: string; icon: string; name: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">{label}</span>
        <button onClick={onAdd} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && (
          <div className="text-xs text-white/25 text-center py-6">Nothing yet — click New</div>
        )}
        {entries.map(e => (
          <div key={e.id}
            onClick={() => onSelect(e.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 cursor-pointer group text-xs',
              selectedId === e.id ? 'bg-amber-600/15 text-amber-200' : 'text-white/70 hover:bg-white/5',
            )}
          >
            <span className="w-5 text-center">{e.icon}</span>
            <span className="flex-1 truncate">{e.name}</span>
            <button onClick={ev => { ev.stopPropagation(); onDelete(e.id) }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── NPC editor: base fields + lines ───────────────────────────────────────────

// ── Global event editor ───────────────────────────────────────────────────────

function EventDefEditor({ def, ruleset, onChange }: {
  def: EventDef
  ruleset: Ruleset
  onChange: (e: EventDef) => void
}) {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <SchemaForm
        schema={EVENT_SCHEMA}
        value={def as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...def, ...(v as Partial<EventDef>) })}
      />
      <div className="pt-2 border-t border-white/10 space-y-3">
        <ConditionBuilder conditions={def.conditions ?? []} ruleset={ruleset}
          onChange={cs => onChange({ ...def, conditions: cs.length ? cs : undefined })} />
        <EffectBuilder label="Effects" effects={def.effects} ruleset={ruleset}
          onChange={effs => onChange({ ...def, effects: effs })} />
        <p className="text-[10px] text-white/25 leading-relaxed">
          Manual events run when invoked by a Run Event effect (from any cell, NPC line,
          or other event, on any map). On-Flag events fire automatically the moment their
          conditions newly pass after a flag changes.
        </p>
      </div>
    </div>
  )
}

// ── Quest editor: base fields + stages ────────────────────────────────────────

function QuestEditor({ quest, ruleset, onChange }: {
  quest: QuestDef
  ruleset: Ruleset
  onChange: (q: QuestDef) => void
}) {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <SchemaForm
        schema={QUEST_SCHEMA}
        value={quest as unknown as Record<string, unknown>}
        onChange={v => onChange({ ...quest, ...(v as Partial<QuestDef>) })}
      />
      <div className="pt-2 border-t border-white/10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
            Stages <span className="normal-case text-white/30">(reaching the last stage completes the quest)</span>
          </span>
          <button
            onClick={() => onChange({ ...quest, stages: [...quest.stages, { id: `s${quest.stages.length + 1}`, description: '' }] })}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10"
          >
            <Plus className="w-3 h-3" /> Add Stage
          </button>
        </div>
        <div className="space-y-2">
          {quest.stages.map((st, i) => (
            <div key={i} className="rounded bg-zinc-800 border border-white/10 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-300/70 w-14">Stage {i + 1}</span>
                <input type="text" value={st.id} placeholder="stage_id"
                  onChange={e => onChange({ ...quest, stages: quest.stages.map((x, j) => j === i ? { ...x, id: e.target.value } : x) })}
                  className="w-24 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-xs font-mono text-white/80 focus:outline-none" />
                <button
                  onClick={() => onChange({ ...quest, stages: quest.stages.filter((_, j) => j !== i) })}
                  className="ml-auto p-0.5 rounded text-white/30 hover:text-red-400"
                ><Trash2 className="w-3 h-3" /></button>
              </div>
              <textarea value={st.description} rows={2}
                placeholder="Journal text while this is the current stage…"
                onChange={e => onChange({ ...quest, stages: quest.stages.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/40" />
              <EffectBuilder label="On reaching this stage" effects={st.effects ?? []} ruleset={ruleset}
                onChange={effs => onChange({ ...quest, stages: quest.stages.map((x, j) => j === i ? { ...x, effects: effs.length ? effs : undefined } : x) })} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Class editor ──────────────────────────────────────────────────────────────

const SLOT_OPTIONS: { slot: ItemSlot; label: string }[] = [
  { slot: 'weapon', label: 'Weapon' },
  { slot: 'offhand', label: 'Off-hand' },
  { slot: 'head', label: 'Head' },
  { slot: 'body', label: 'Body' },
  { slot: 'hands', label: 'Hands' },
  { slot: 'feet', label: 'Feet' },
  { slot: 'ring', label: 'Ring' },
  { slot: 'amulet', label: 'Amulet' },
]
function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded text-xs border transition-colors capitalize',
        active
          ? 'bg-amber-600/25 border-amber-500/50 text-amber-200'
          : 'bg-zinc-800 border-white/10 text-white/45 hover:text-white/70',
      )}
    >
      {label}
    </button>
  )
}

function TagRow({ label, tags, suggestions, onChange, placeholder }: {
  label: string
  tags: string[]
  suggestions?: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const toggle = (t: string) => onChange(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t])
  const add = () => {
    const v = draft.trim().toLowerCase()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setDraft('')
  }
  const extra = tags.filter(t => !(suggestions ?? []).includes(t))
  return (
    <div>
      <div className="text-xs font-medium text-white/60 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {(suggestions ?? []).map(s => <Chip key={s} active={tags.includes(s)} label={s} onClick={() => toggle(s)} />)}
        {extra.map(t => (
          <button key={t} type="button" onClick={() => toggle(t)}
            className="px-2 py-0.5 rounded text-xs border bg-amber-600/25 border-amber-500/50 text-amber-200 capitalize">
            {t} ✕
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={draft} placeholder={placeholder ?? 'add custom…'}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          className="flex-1 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/40" />
        <button type="button" onClick={add}
          className="px-2 py-0.5 rounded text-xs bg-amber-600/20 text-amber-300/80 hover:text-amber-200">Add</button>
      </div>
    </div>
  )
}

function ClassEditor({ cls, ruleset, onChange }: {
  cls: ClassDef
  ruleset: Ruleset
  onChange: (c: ClassDef) => void
}) {
  const raw = cls as unknown as Record<string, unknown>
  const spellSchoolSuggestions = Array.from(new Set(ruleset.spells.map(s => s.school).filter(Boolean)))

  function toggleSlot(slot: ItemSlot) {
    const has = cls.allowedEquip.includes(slot)
    onChange({ ...cls, allowedEquip: has ? cls.allowedEquip.filter(s => s !== slot) : [...cls.allowedEquip, slot] })
  }
  function toggleWeaponType(id: string) {
    const has = cls.weaponTypes.includes(id)
    onChange({ ...cls, weaponTypes: has ? cls.weaponTypes.filter(t => t !== id) : [...cls.weaponTypes, id] })
  }
  function toggleArmorType(id: string) {
    const cur = cls.armorTypes ?? []
    const has = cur.includes(id)
    onChange({ ...cls, armorTypes: has ? cur.filter(t => t !== id) : [...cur, id] })
  }
  function setAttr(field: 'attrModifiers' | 'attrGrowth', attrId: string, val: number) {
    // Store under the full attribute id, clearing any legacy short-key duplicate
    const short = attrId.replace('attr.', '')
    const next = { ...cls[field] }
    delete next[short]
    if (!val || Number.isNaN(val)) delete next[attrId]
    else next[attrId] = val
    onChange({ ...cls, [field]: next })
  }
  const attrVal = (map: Partial<Record<string, number>>, attrId: string) =>
    map[attrId] ?? map[attrId.replace('attr.', '')] ?? ''
  function toggleStartingSpell(id: string) {
    const cur = cls.startingSpells ?? []
    const has = cur.includes(id)
    const next = has ? cur.filter(s => s !== id) : [...cur, id]
    onChange({ ...cls, startingSpells: next.length ? next : undefined })
  }

  const armorTypes = cls.armorTypes ?? []

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{cls.icon ?? '🎓'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{cls.name}</div>
          <div className="text-xs text-white/40 font-mono">{cls.id}</div>
        </div>
      </div>

      <SchemaForm schema={CLASS_SCHEMA} value={raw} onChange={u => onChange(u as unknown as ClassDef)} />

      {/* Equippable slots */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/60 mb-1">Equippable Slots</div>
        <div className="flex flex-wrap gap-1">
          {SLOT_OPTIONS.map(({ slot, label }) => (
            <Chip key={slot} active={cls.allowedEquip.includes(slot)} label={label} onClick={() => toggleSlot(slot)} />
          ))}
        </div>
      </div>

      {/* Weapon proficiency (by type) */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/60 mb-1">
          Weapon Types <span className="text-white/30">(none selected = any)</span>
        </div>
        {ruleset.weaponTypes.length === 0 ? (
          <div className="text-xs text-white/25">No weapon types defined — add some in the Weapon Types tab.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {ruleset.weaponTypes.map(wt => (
              <Chip key={wt.id} active={cls.weaponTypes.includes(wt.id)}
                label={`${wt.icon ?? '⚔️'} ${wt.name} · ${wt.weight}`} onClick={() => toggleWeaponType(wt.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Armor proficiency (by type) */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/60 mb-1">
          Armor Types <span className="text-white/30">(none selected = any)</span>
        </div>
        {ruleset.armorTypes.length === 0 ? (
          <div className="text-xs text-white/25">No armor types defined — add some in the Armor Types tab.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {ruleset.armorTypes.map(at => (
              <Chip key={at.id} active={armorTypes.includes(at.id)}
                label={`${at.icon ?? '🛡️'} ${at.name} · ${at.weight}`} onClick={() => toggleArmorType(at.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Spell schools */}
      <div className="pt-2 border-t border-white/10">
        <TagRow label="Spell Schools" tags={cls.spellSchools}
          suggestions={spellSchoolSuggestions} placeholder="add school…"
          onChange={next => onChange({ ...cls, spellSchools: next })} />
      </div>

      {/* Attribute modifiers & growth */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/60 mb-1">Attributes</div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center">
          <div />
          <div className="text-[10px] text-white/40 text-center uppercase tracking-wide">Modifier</div>
          <div className="text-[10px] text-white/40 text-center uppercase tracking-wide">Growth/Lvl</div>
          {ruleset.attributes.map(attr => (
            <Fragment key={attr.id}>
              <div className="text-xs text-white/70">{attr.name}</div>
              <input type="number" value={attrVal(cls.attrModifiers, attr.id)} placeholder="0"
                onChange={e => setAttr('attrModifiers', attr.id, parseInt(e.target.value, 10))}
                className="w-16 px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 text-center focus:outline-none focus:border-amber-500/40" />
              <input type="number" value={attrVal(cls.attrGrowth, attr.id)} placeholder="0"
                onChange={e => setAttr('attrGrowth', attr.id, parseInt(e.target.value, 10))}
                className="w-16 px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-xs text-white/85 text-center focus:outline-none focus:border-amber-500/40" />
            </Fragment>
          ))}
        </div>
      </div>

      {/* Starting spells */}
      {ruleset.spells.length > 0 && (
        <div className="pt-2 border-t border-white/10">
          <div className="text-xs font-medium text-white/60 mb-1">Starting Spells</div>
          <div className="flex flex-wrap gap-1">
            {ruleset.spells.map(sp => (
              <Chip key={sp.id} active={(cls.startingSpells ?? []).includes(sp.id)}
                label={`${sp.icon ?? '✨'} ${sp.name}`} onClick={() => toggleStartingSpell(sp.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function DatabaseWorkspace({ ruleset, onRulesetChange }: DatabaseWorkspaceProps) {
  const [category, setCategory] = useState<Category>('items')
  const [selectedId, setSelectedId] = useState<string | null>(
    ruleset.items[0]?.id ?? null,
  )

  // ── items ──

  const selectedItem = ruleset.items.find(i => i.id === selectedId) ?? null

  function addItem() {
    const id = `item.item_${_itemSeq++}`
    const raw = blankItem(id)
    const item: ItemDef = {
      id,
      name: raw.name as string,
      icon: raw.icon as string,
      color: raw.color as string,
      kind: raw.kind as ItemDef['kind'],
      value: raw.value as number,
      stackable: raw.stackable as boolean,
      onUse: [],
    }
    onRulesetChange({ ...ruleset, items: [...ruleset.items, item] })
    setSelectedId(id)
    setCategory('items')
  }

  function updateItem(item: ItemDef) {
    onRulesetChange({ ...ruleset, items: ruleset.items.map(i => i.id === item.id ? item : i) })
  }

  function deleteItem(id: string) {
    const next = ruleset.items.filter(i => i.id !== id)
    onRulesetChange({ ...ruleset, items: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── loot tables ──

  const selectedTable = ruleset.lootTables.find(t => t.id === selectedId) ?? null

  function addLootTable() {
    const id = `loot.table_${_lootSeq++}`
    const table: LootTableDef = { id, name: 'New Loot Table', drops: [] }
    onRulesetChange({ ...ruleset, lootTables: [...ruleset.lootTables, table] })
    setSelectedId(id)
    setCategory('loot_tables')
  }

  function updateLootTable(t: LootTableDef) {
    onRulesetChange({ ...ruleset, lootTables: ruleset.lootTables.map(x => x.id === t.id ? t : x) })
  }

  function deleteLootTable(id: string) {
    const next = ruleset.lootTables.filter(t => t.id !== id)
    onRulesetChange({ ...ruleset, lootTables: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── enemies ──

  const selectedEnemy = ruleset.enemies.find(e => e.id === selectedId) ?? null

  function addEnemy() {
    const id = `enemy.enemy_${_enemySeq++}`
    const raw = blankEnemy(id)
    const enemy: EnemyDef = {
      id,
      name: raw.name as string,
      icon: raw.icon as string,
      color: raw.color as string,
      hp: raw.hp as number,
      attack: raw.attack as number,
      defense: raw.defense as number,
      speed: raw.speed as number,
      xp: raw.xp as number,
      gold: raw.gold as { min: number; max: number },
      attributes: {},
    }
    onRulesetChange({ ...ruleset, enemies: [...ruleset.enemies, enemy] })
    setSelectedId(id)
    setCategory('bestiary')
  }

  function updateEnemy(enemy: EnemyDef) {
    onRulesetChange({ ...ruleset, enemies: ruleset.enemies.map(e => e.id === enemy.id ? enemy : e) })
  }

  function deleteEnemy(id: string) {
    const next = ruleset.enemies.filter(e => e.id !== id)
    onRulesetChange({ ...ruleset, enemies: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── encounter tables ──

  const selectedEncTable = ruleset.encounterTables.find(t => t.id === selectedId) ?? null

  function addEncounterTable() {
    const id = `enc.table_${_encSeq++}`
    const table: EncounterTableDef = { id, name: 'New Encounter Table', entries: [] }
    onRulesetChange({ ...ruleset, encounterTables: [...ruleset.encounterTables, table] })
    setSelectedId(id)
    setCategory('encounters')
  }

  function updateEncounterTable(t: EncounterTableDef) {
    onRulesetChange({ ...ruleset, encounterTables: ruleset.encounterTables.map(x => x.id === t.id ? t : x) })
  }

  function deleteEncounterTable(id: string) {
    const next = ruleset.encounterTables.filter(t => t.id !== id)
    onRulesetChange({ ...ruleset, encounterTables: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── spells ──

  const selectedSpell = ruleset.spells.find(s => s.id === selectedId) ?? null

  function addSpell() {
    const id = `spell.spell_${_spellSeq++}`
    const spell: SpellDef = blankSpell(id)
    onRulesetChange({ ...ruleset, spells: [...ruleset.spells, spell] })
    setSelectedId(id)
    setCategory('spells')
  }

  function updateSpell(spell: SpellDef) {
    onRulesetChange({ ...ruleset, spells: ruleset.spells.map(s => s.id === spell.id ? spell : s) })
  }

  function deleteSpell(id: string) {
    const next = ruleset.spells.filter(s => s.id !== id)
    onRulesetChange({ ...ruleset, spells: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── status effects ──

  const selectedStatus = ruleset.statusEffects.find(s => s.id === selectedId) ?? null

  function addStatus() {
    const id = `status.status_${_statusSeq++}`
    const status: StatusEffectDef = blankStatusEffect(id)
    onRulesetChange({ ...ruleset, statusEffects: [...ruleset.statusEffects, status] })
    setSelectedId(id)
    setCategory('status_effects')
  }

  function updateStatus(status: StatusEffectDef) {
    onRulesetChange({ ...ruleset, statusEffects: ruleset.statusEffects.map(s => s.id === status.id ? status : s) })
  }

  function deleteStatus(id: string) {
    const next = ruleset.statusEffects.filter(s => s.id !== id)
    onRulesetChange({ ...ruleset, statusEffects: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── shops ──

  const selectedShop = ruleset.shops.find(s => s.id === selectedId) ?? null

  function addShop() {
    const id = `shop.shop_${_shopSeq++}`
    const shop: ShopDef = blankShop(id)
    onRulesetChange({ ...ruleset, shops: [...ruleset.shops, shop] })
    setSelectedId(id)
    setCategory('shops')
  }

  function updateShop(shop: ShopDef) {
    onRulesetChange({ ...ruleset, shops: ruleset.shops.map(s => s.id === shop.id ? shop : s) })
  }

  function deleteShop(id: string) {
    const next = ruleset.shops.filter(s => s.id !== id)
    onRulesetChange({ ...ruleset, shops: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── classes ──

  const selectedClass = ruleset.classes.find(c => c.id === selectedId) ?? null

  function addClass() {
    const id = `class.class_${_classSeq++}`
    onRulesetChange({ ...ruleset, classes: [...ruleset.classes, blankClass(id)] })
    setSelectedId(id)
    setCategory('classes')
  }

  function updateClass(cls: ClassDef) {
    onRulesetChange({ ...ruleset, classes: ruleset.classes.map(c => c.id === cls.id ? cls : c) })
  }

  function deleteClass(id: string) {
    const next = ruleset.classes.filter(c => c.id !== id)
    onRulesetChange({ ...ruleset, classes: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  const selectedEvent = (ruleset.events ?? []).find(e => e.id === selectedId) ?? null
  const selectedQuest = (ruleset.quests ?? []).find(q => q.id === selectedId) ?? null

  function addEventDef() {
    const id = `ev.event_${(ruleset.events ?? []).length + 1}_${Date.now() % 1000}`
    onRulesetChange({ ...ruleset, events: [...(ruleset.events ?? []), blankEventDef(id)] })
    setSelectedId(id); setCategory('events')
  }
  function updateEventDef(e: EventDef) {
    onRulesetChange({ ...ruleset, events: (ruleset.events ?? []).map(x => x.id === e.id ? e : x) })
  }
  function deleteEventDef(id: string) {
    const next = (ruleset.events ?? []).filter(e => e.id !== id)
    onRulesetChange({ ...ruleset, events: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  function addQuest() {
    const id = `q.quest_${(ruleset.quests ?? []).length + 1}_${Date.now() % 1000}`
    onRulesetChange({ ...ruleset, quests: [...(ruleset.quests ?? []), blankQuest(id)] })
    setSelectedId(id); setCategory('quests')
  }
  function updateQuest(q: QuestDef) {
    onRulesetChange({ ...ruleset, quests: (ruleset.quests ?? []).map(x => x.id === q.id ? q : x) })
  }
  function deleteQuest(id: string) {
    const next = (ruleset.quests ?? []).filter(q => q.id !== id)
    onRulesetChange({ ...ruleset, quests: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  function handleCategoryChange(cat: Category) {
    setCategory(cat)
    if (cat === 'items')          setSelectedId(ruleset.items[0]?.id ?? null)
    if (cat === 'loot_tables')    setSelectedId(ruleset.lootTables[0]?.id ?? null)
    if (cat === 'bestiary')       setSelectedId(ruleset.enemies[0]?.id ?? null)
    if (cat === 'encounters')     setSelectedId(ruleset.encounterTables[0]?.id ?? null)
    if (cat === 'spells')         setSelectedId(ruleset.spells[0]?.id ?? null)
    if (cat === 'status_effects') setSelectedId(ruleset.statusEffects[0]?.id ?? null)
    if (cat === 'shops')          setSelectedId(ruleset.shops[0]?.id ?? null)
    if (cat === 'classes')        setSelectedId(ruleset.classes[0]?.id ?? null)
    if (cat === 'events')         setSelectedId((ruleset.events ?? [])[0]?.id ?? null)
    if (cat === 'quests')         setSelectedId((ruleset.quests ?? [])[0]?.id ?? null)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Category rail */}
      <nav className="w-10 flex-shrink-0 flex flex-col items-center gap-1 py-2 border-r border-white/10 bg-zinc-950/60">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            title={cat.label}
            onClick={() => handleCategoryChange(cat.id)}
            className={cn(
              'w-8 h-8 grid place-items-center rounded transition-colors',
              category === cat.id
                ? 'bg-amber-600/20 text-amber-400'
                : 'text-white/35 hover:text-white hover:bg-white/10',
            )}
          >
            {cat.icon}
          </button>
        ))}
      </nav>

      {/* Entry list */}
      <div className="w-56 flex-shrink-0 border-r border-white/10 bg-zinc-950 min-h-0">
        {category === 'items' && (
          <ItemList items={ruleset.items} selectedId={selectedId} onSelect={setSelectedId} onAdd={addItem} onDelete={deleteItem} />
        )}
        {category === 'loot_tables' && (
          <LootTableList tables={ruleset.lootTables} selectedId={selectedId} onSelect={setSelectedId} onAdd={addLootTable} onDelete={deleteLootTable} />
        )}
        {category === 'bestiary' && (
          <EnemyList enemies={ruleset.enemies} selectedId={selectedId} onSelect={setSelectedId} onAdd={addEnemy} onDelete={deleteEnemy} />
        )}
        {category === 'encounters' && (
          <EncounterTableList tables={ruleset.encounterTables} selectedId={selectedId} onSelect={setSelectedId} onAdd={addEncounterTable} onDelete={deleteEncounterTable} />
        )}
        {category === 'spells' && (
          <SpellList spells={ruleset.spells} selectedId={selectedId} onSelect={setSelectedId} onAdd={addSpell} onDelete={deleteSpell} />
        )}
        {category === 'status_effects' && (
          <StatusList statuses={ruleset.statusEffects} selectedId={selectedId} onSelect={setSelectedId} onAdd={addStatus} onDelete={deleteStatus} />
        )}
        {category === 'shops' && (
          <ShopList shops={ruleset.shops} selectedId={selectedId} onSelect={setSelectedId} onAdd={addShop} onDelete={deleteShop} />
        )}
        {category === 'classes' && (
          <GenericDefList label="Classes" entries={ruleset.classes.map(c => ({ id: c.id, icon: c.icon ?? '🎓', name: c.name }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addClass} onDelete={deleteClass} />
        )}
        {category === 'events' && (
          <GenericDefList label="Events" entries={(ruleset.events ?? []).map(e => ({ id: e.id, icon: e.trigger === 'onFlag' ? '⚡' : '🧩', name: e.name }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addEventDef} onDelete={deleteEventDef} />
        )}
        {category === 'quests' && (
          <GenericDefList label="Quests" entries={(ruleset.quests ?? []).map(q => ({ id: q.id, icon: '📜', name: q.name }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addQuest} onDelete={deleteQuest} />
        )}
      </div>

      {/* Detail editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {category === 'items' && selectedItem ? (
          <ItemEditor item={selectedItem} ruleset={ruleset} onChange={updateItem} />
        ) : category === 'loot_tables' && selectedTable ? (
          <LootTableEditor table={selectedTable} ruleset={ruleset} onChange={updateLootTable} />
        ) : category === 'bestiary' && selectedEnemy ? (
          <EnemyEditor enemy={selectedEnemy} onChange={updateEnemy} />
        ) : category === 'encounters' && selectedEncTable ? (
          <EncounterTableEditor table={selectedEncTable} ruleset={ruleset} onChange={updateEncounterTable} />
        ) : category === 'spells' && selectedSpell ? (
          <SpellEditor spell={selectedSpell} onChange={updateSpell} />
        ) : category === 'status_effects' && selectedStatus ? (
          <StatusEditor status={selectedStatus} onChange={updateStatus} />
        ) : category === 'shops' && selectedShop ? (
          <ShopEditor shop={selectedShop} ruleset={ruleset} onChange={updateShop} />
        ) : category === 'classes' && selectedClass ? (
          <ClassEditor cls={selectedClass} ruleset={ruleset} onChange={updateClass} />
        ) : category === 'events' && selectedEvent ? (
          <EventDefEditor def={selectedEvent} ruleset={ruleset} onChange={updateEventDef} />
        ) : category === 'quests' && selectedQuest ? (
          <QuestEditor quest={selectedQuest} ruleset={ruleset} onChange={updateQuest} />
        ) : (
          <div className="h-full flex items-center justify-center text-white/20 text-sm flex-col gap-2">
            <Package className="w-8 h-8 opacity-30" />
            <span>Select or create an entry</span>
          </div>
        )}
      </div>
    </div>
  )
}
