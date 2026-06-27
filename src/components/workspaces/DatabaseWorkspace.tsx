'use client'

import { useState } from 'react'
import { Plus, Trash2, Package, List, Skull, Swords, Sparkles, Zap, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Effect, EnemyDef, EncounterTableDef, ItemDef, LootTableDef, ShopDef, SpellDef, StatusEffectDef, Ruleset } from '@/lib/engine-types'
import { SchemaForm } from '../forms/SchemaForm'
import { EffectBuilder } from '../forms/EffectBuilder'
import { ITEM_SCHEMA, LOOT_TABLE_SCHEMA, blankItem } from '@/lib/item-schema'
import { ENEMY_SCHEMA, ENCOUNTER_TABLE_SCHEMA, blankEnemy } from '@/lib/enemy-schema'
import { SPELL_SCHEMA, STATUS_SCHEMA, blankSpell, blankStatusEffect } from '@/lib/spell-schema'
import { SHOP_SCHEMA, blankShop } from '@/lib/shop-schema'

type Category = 'items' | 'loot_tables' | 'bestiary' | 'encounters' | 'spells' | 'status_effects' | 'shops'

const CATEGORIES: { id: Category; icon: React.ReactNode; label: string }[] = [
  { id: 'items',          icon: <Package className="w-4 h-4" />,  label: 'Items' },
  { id: 'loot_tables',    icon: <List className="w-4 h-4" />,     label: 'Loot Tables' },
  { id: 'bestiary',       icon: <Skull className="w-4 h-4" />,    label: 'Bestiary' },
  { id: 'encounters',     icon: <Swords className="w-4 h-4" />,   label: 'Encounter Tables' },
  { id: 'spells',         icon: <Sparkles className="w-4 h-4" />, label: 'Spells' },
  { id: 'status_effects', icon: <Zap className="w-4 h-4" />,      label: 'Status Effects' },
  { id: 'shops',          icon: <Store className="w-4 h-4" />,    label: 'Shops' },
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
    // slot '' → undefined
    if (updated.slot === '') updated = { ...updated, slot: undefined }
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

  function handleCategoryChange(cat: Category) {
    setCategory(cat)
    if (cat === 'items')          setSelectedId(ruleset.items[0]?.id ?? null)
    if (cat === 'loot_tables')    setSelectedId(ruleset.lootTables[0]?.id ?? null)
    if (cat === 'bestiary')       setSelectedId(ruleset.enemies[0]?.id ?? null)
    if (cat === 'encounters')     setSelectedId(ruleset.encounterTables[0]?.id ?? null)
    if (cat === 'spells')         setSelectedId(ruleset.spells[0]?.id ?? null)
    if (cat === 'status_effects') setSelectedId(ruleset.statusEffects[0]?.id ?? null)
    if (cat === 'shops')          setSelectedId(ruleset.shops[0]?.id ?? null)
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
