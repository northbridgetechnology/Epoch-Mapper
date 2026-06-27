'use client'

import { useState } from 'react'
import { Plus, Trash2, Package, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Effect, ItemDef, LootTableDef, Ruleset } from '@/lib/engine-types'
import { SchemaForm } from '../forms/SchemaForm'
import { EffectBuilder } from '../forms/EffectBuilder'
import { ITEM_SCHEMA, LOOT_TABLE_SCHEMA, blankItem, blankLootTable } from '@/lib/item-schema'

type Category = 'items' | 'loot_tables'

const CATEGORIES: { id: Category; icon: React.ReactNode; label: string }[] = [
  { id: 'items',       icon: <Package className="w-4 h-4" />,  label: 'Items' },
  { id: 'loot_tables', icon: <List className="w-4 h-4" />,     label: 'Loot Tables' },
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

// ── Main workspace ─────────────────────────────────────────────────────────────

interface DatabaseWorkspaceProps {
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
}

let _itemSeq = 1
let _lootSeq = 1

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

  function handleCategoryChange(cat: Category) {
    setCategory(cat)
    if (cat === 'items')       setSelectedId(ruleset.items[0]?.id ?? null)
    if (cat === 'loot_tables') setSelectedId(ruleset.lootTables[0]?.id ?? null)
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
          <ItemList
            items={ruleset.items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addItem}
            onDelete={deleteItem}
          />
        )}
        {category === 'loot_tables' && (
          <LootTableList
            tables={ruleset.lootTables}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addLootTable}
            onDelete={deleteLootTable}
          />
        )}
      </div>

      {/* Detail editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {category === 'items' && selectedItem ? (
          <ItemEditor item={selectedItem} ruleset={ruleset} onChange={updateItem} />
        ) : category === 'loot_tables' && selectedTable ? (
          <LootTableEditor table={selectedTable} ruleset={ruleset} onChange={updateLootTable} />
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
