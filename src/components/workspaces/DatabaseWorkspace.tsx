'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Copy, Crown, Package, List, Skull, Swords, Sparkles, Zap, Store, Puzzle, ScrollText, Shield, Sword, Shirt, Music, BookOpen, Flame, Upload, Play, Square, MessageSquare, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ClassDef, ItemSlot, DamageType, WeaponTypeDef, ArmorTypeDef, AudioTrackDef, SpellSchoolDef, SkillDef, Effect, EnemyAbility, EnemyDef, EncounterTableDef, EventDef, ItemDef, LootTableDef, QuestDef, ShopDef, SpellDef, StatusEffectDef, DialogueDef, Ruleset } from '@/lib/engine-types'
import { CLASS_SCHEMA, blankClass } from '@/lib/class-schema'
import { WEAPON_TYPE_SCHEMA, ARMOR_TYPE_SCHEMA, DAMAGE_TYPE_OPTIONS, blankWeaponType, blankArmorType } from '@/lib/type-schema'
import { blankAudioTrack } from '@/lib/music'
import { SFX_META } from '@/lib/chiptune'
import type { SfxEvent } from '@/lib/engine-types'
import { SKILL_SCHEMA, blankSkill, skillGroups, type SkillSort } from '@/lib/skill-schema'
import { putTrack, deleteTrack, hasTrack } from '@/lib/audio-store'
import { music } from '@/lib/audio-controller'
import { EVENT_SCHEMA, QUEST_SCHEMA, blankEventDef, blankQuest, blankDialogue } from '@/lib/npc-schema'
import { DialogueEditor } from '../forms/DialogueEditor'
import { ConditionBuilder } from '@/components/CellInspector'
import { SimulatePanel } from '@/components/SimulatePanel'
import { usePanelWidth } from '@/components/ui/ResizablePanel'
import { SchemaForm } from '../forms/SchemaForm'
import { EffectBuilder } from '../forms/EffectBuilder'
import { ITEM_SCHEMA, LOOT_TABLE_SCHEMA, blankItem, itemGroups, type ItemSort } from '@/lib/item-schema'
import { ENEMY_SCHEMA, ENCOUNTER_TABLE_SCHEMA, blankEnemy, duplicateEnemy, eliteEnemy } from '@/lib/enemy-schema'
import { SPELL_SCHEMA, STATUS_SCHEMA, STATUS_KINDS, SPELL_SCHOOL_SCHEMA, blankSpell, blankStatusEffect, blankSpellSchool, sortSpells, sortStatuses, spellLearnLevel, type SpellSort, type StatusSort } from '@/lib/spell-schema'
import { SHOP_SCHEMA, blankShop } from '@/lib/shop-schema'

type Category = 'items' | 'weapon_types' | 'armor_types' | 'spell_schools' | 'skills' | 'audio' | 'loot_tables' | 'bestiary' | 'encounters' | 'spells' | 'status_effects' | 'shops' | 'classes' | 'events' | 'quests' | 'dialogues'

const CATEGORIES: { id: Category; icon: React.ReactNode; label: string }[] = [
  { id: 'items',          icon: <Package className="w-4 h-4" />,  label: 'Items' },
  { id: 'weapon_types',   icon: <Sword className="w-4 h-4" />,    label: 'Weapon Types' },
  { id: 'armor_types',    icon: <Shirt className="w-4 h-4" />,    label: 'Armor Types' },
  { id: 'audio',          icon: <Music className="w-4 h-4" />,    label: 'Audio' },
  { id: 'classes',        icon: <Shield className="w-4 h-4" />,   label: 'Classes' },
  { id: 'loot_tables',    icon: <List className="w-4 h-4" />,     label: 'Loot Tables' },
  { id: 'bestiary',       icon: <Skull className="w-4 h-4" />,    label: 'Bestiary' },
  { id: 'encounters',     icon: <Swords className="w-4 h-4" />,   label: 'Encounter Tables' },
  { id: 'spells',         icon: <Sparkles className="w-4 h-4" />, label: 'Spells' },
  { id: 'status_effects', icon: <Zap className="w-4 h-4" />,      label: 'Status Effects' },
  { id: 'spell_schools',  icon: <BookOpen className="w-4 h-4" />, label: 'Spell Schools' },
  { id: 'skills',         icon: <Flame className="w-4 h-4" />,    label: 'Skills' },
  { id: 'shops',          icon: <Store className="w-4 h-4" />,    label: 'Shops' },
  { id: 'events',         icon: <Puzzle className="w-4 h-4" />,     label: 'Events' },
  { id: 'quests',         icon: <ScrollText className="w-4 h-4" />, label: 'Quests' },
  { id: 'dialogues',      icon: <MessageSquare className="w-4 h-4" />, label: 'Dialogue' },
]

// ── Item entry list ───────────────────────────────────────────────────────────

const ITEM_SORTS: { id: ItemSort; label: string }[] = [
  { id: 'kind',  label: 'Kind' },
  { id: 'slot',  label: 'Slot' },
  { id: 'value', label: 'Value' },
  { id: 'name',  label: 'Name' },
]

function ItemList({ items, selectedId, onSelect, onAdd, onDelete }: {
  items: ItemDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [sort, setSort] = usePersistedChoice<ItemSort>('epoch.db.itemSort', ['kind', 'slot', 'value', 'name'], 'kind')
  const { rows, groups } = useMemo(() => {
    const g = itemGroups(items, sort)
    return {
      rows: g.rows.map(({ item, groupId, key }) => ({
        key, id: item.id, icon: item.icon ?? '📦', name: item.name,
        sub: `${item.kind}${item.slot ? ` · ${item.slot}` : ''} · ${item.value}g`,
        groupId,
      })),
      groups: g.groups,
    }
  }, [items, sort])
  return <SortedList label="Items" rows={rows} groups={groups} sortOptions={ITEM_SORTS}
    sort={sort} onSort={v => setSort(v as ItemSort)}
    selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onDelete={onDelete} />
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

      {/* Weapon type + damage override */}
      {item.kind === 'weapon' && (
        <div className="pt-2 border-t border-white/10 space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-0.5">Weapon Type (weight · scaling · reach)</label>
            <select value={item.weaponType ?? ''}
              onChange={e => onChange({ ...item, weaponType: e.target.value || undefined })}
              className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50">
              <option value="">— none (unrestricted) —</option>
              {ruleset.weaponTypes.map(w => <option key={w.id} value={w.id}>{w.icon ?? '⚔️'} {w.name} · {w.weight} · {ruleset.attributes.find(a => a.id === w.scalingAttr)?.name ?? w.scalingAttr}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-0.5">Damage Element Override <span className="text-white/30">(optional)</span></label>
            <select value={item.damageType ?? ''}
              onChange={e => onChange({ ...item, damageType: (e.target.value || undefined) as DamageType | undefined })}
              className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50">
              <option value="">— use weapon type default —</option>
              {DAMAGE_TYPE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Armor type */}
      {item.kind === 'armor' && (
        <div className="pt-2 border-t border-white/10">
          <label className="block text-xs font-medium text-white/60 mb-0.5">Armor Type (weight · passive effects)</label>
          <select value={item.armorType ?? ''}
            onChange={e => onChange({ ...item, armorType: e.target.value || undefined })}
            className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50">
            <option value="">— none (unrestricted) —</option>
            {ruleset.armorTypes.map(a => <option key={a.id} value={a.id}>{a.icon ?? '🛡️'} {a.name} · {a.weight}</option>)}
          </select>
        </div>
      )}

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
  onDuplicate,
}: {
  enemies: EnemyDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
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
            <button onClick={ev => { ev.stopPropagation(); onDuplicate(e.id) }} title="Duplicate"
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-amber-300">
              <Copy className="w-3 h-3" />
            </button>
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

function EnemyEditor({ enemy, ruleset, onChange, onDuplicate, onMakeElite }: {
  enemy: EnemyDef; ruleset: Ruleset; onChange: (e: EnemyDef) => void
  onDuplicate: () => void; onMakeElite: () => void
}) {
  const raw = enemy as unknown as Record<string, unknown>

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{enemy.icon ?? '👾'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{enemy.name}</div>
          <div className="text-xs text-white/40 font-mono">{enemy.id}</div>
        </div>
        <div className="ml-auto flex gap-1">
          <button onClick={onDuplicate} title="Duplicate this enemy as a starting point for a variant"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/50 hover:text-white hover:bg-white/10 border border-white/10">
            <Copy className="w-3 h-3" /> Duplicate
          </button>
          <button onClick={onMakeElite} title="Duplicate with the elite promotion: ×1.5 HP, ×1.25 ATK/DEF, ×2 XP and gold"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/25">
            <Crown className="w-3 h-3" /> Make Elite
          </button>
        </div>
      </div>

      <SchemaForm
        schema={ENEMY_SCHEMA}
        value={raw}
        ruleset={ruleset}
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

      {/* Resistances */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-0.5">Resistances</div>
        <div className="text-[10px] text-white/30 mb-2">
          +100% = immune · negative = weakness. Press-turn battles reward hitting weaknesses.
        </div>
        <ResistancesEditor value={enemy.resistances} onChange={resistances => onChange({ ...enemy, resistances })} />
      </div>

      {/* Ability kit */}
      <div className="pt-2 border-t border-white/10">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-0.5">Abilities</div>
        <div className="text-[10px] text-white/30 mb-2">
          Each turn one ability is picked by weight; with none defined the enemy uses its basic
          physical attack. Gates hold an ability back until a boss phase (low HP / later rounds).
        </div>
        <EnemyAbilitiesEditor
          abilities={enemy.abilities ?? []}
          ruleset={ruleset}
          onChange={abilities => onChange({ ...enemy, abilities: abilities.length > 0 ? abilities : undefined })}
        />
      </div>
    </div>
  )
}

/** Per-damage-type resistance sliders. Stored as fractions (1 = immune,
 *  negative = weakness); zeroed entries are pruned from the def. */
function ResistancesEditor({ value, onChange }: {
  value?: Partial<Record<DamageType, number>>
  onChange: (r: Partial<Record<DamageType, number>> | undefined) => void
}) {
  const set = (dt: DamageType, pct: number) => {
    const frac = Math.round(pct) / 100
    const next = { ...(value ?? {}) }
    if (frac === 0) delete next[dt]
    else next[dt] = frac
    onChange(Object.keys(next).length > 0 ? next : undefined)
  }
  return (
    <div className="space-y-1">
      {DAMAGE_TYPE_OPTIONS.map(({ value: dt, label }) => {
        const frac = value?.[dt as DamageType] ?? 0
        return (
          <div key={dt} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-white/60">{label}</span>
            <input type="range" min={-100} max={100} step={5} value={frac * 100}
              onChange={e => set(dt as DamageType, e.target.valueAsNumber)}
              className="flex-1 accent-amber-500" />
            <span className={cn('w-28 text-right font-mono',
              frac > 0 ? 'text-emerald-300' : frac < 0 ? 'text-rose-300' : 'text-white/25')}>
              {frac >= 1 ? 'immune' : frac > 0 ? `resists ${Math.round(frac * 100)}%` : frac < 0 ? `weak +${Math.round(-frac * 100)}%` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Enemy-perspective targets: the enemy's "enemy" is a hero. */
const ABILITY_TARGETS = [
  { value: 'enemy',      label: 'One hero' },
  { value: 'allEnemies', label: 'All heroes' },
  { value: 'ally',       label: 'Own ally (most wounded)' },
  { value: 'allAllies',  label: 'All own allies' },
  { value: 'self',       label: 'Self' },
] as const

/** Structured editor for an enemy's weighted ability kit. Each ability draws
 *  its substance from one source — a database spell, a database skill, or
 *  custom inline effects — plus weight (with share readout), an optional
 *  target override, boss-phase gates, and a battle-log name. */
function EnemyAbilitiesEditor({ abilities, ruleset, onChange }: {
  abilities: EnemyAbility[]; ruleset: Ruleset; onChange: (a: EnemyAbility[]) => void
}) {
  const totalWeight = abilities.reduce((sum, a) => sum + (a.weight || 0), 0)
  const update = (idx: number, patch: Partial<EnemyAbility>) =>
    onChange(abilities.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  const setWhen = (idx: number, key: 'selfHpBelow' | 'roundAtLeast', v: number | undefined) => {
    const when = { ...(abilities[idx].when ?? {}) }
    if (v === undefined || Number.isNaN(v)) delete when[key]
    else when[key] = v
    update(idx, { when: Object.keys(when).length > 0 ? when : undefined })
  }
  const addAbility = () => onChange([...abilities, {
    weight: 3, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6+2', canCrit: true }],
  }])
  const setSource = (idx: number, src: 'spell' | 'skill' | 'custom') => {
    const ab = abilities[idx]
    if (src === 'spell') update(idx, { spell: ab.spell ?? ruleset.spells[0]?.id, skill: undefined, effects: undefined, target: undefined })
    else if (src === 'skill') update(idx, { skill: ab.skill ?? (ruleset.skills ?? [])[0]?.id, spell: undefined, effects: undefined, target: undefined })
    else update(idx, {
      spell: undefined, skill: undefined, target: ab.target ?? 'enemy',
      effects: ab.effects?.length ? ab.effects : [{ t: 'damage', dmgType: 'physical', amount: '1d6+2', canCrit: true }],
    })
  }

  return (
    <div className="space-y-2">
      {abilities.map((ab, i) => {
        const share = totalWeight > 0 ? Math.round(((ab.weight || 0) / totalWeight) * 100) : 0
        const hpPct = ab.when?.selfHpBelow !== undefined ? Math.round(ab.when.selfHpBelow * 100) : undefined
        const source: 'spell' | 'skill' | 'custom' = ab.spell ? 'spell' : ab.skill ? 'skill' : 'custom'
        const refDef = ab.spell ? ruleset.spells.find(sp => sp.id === ab.spell)
          : ab.skill ? (ruleset.skills ?? []).find(sk => sk.id === ab.skill) : undefined
        return (
          <div key={i} className="rounded-lg border border-white/10 bg-zinc-900/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/70">{ab.name || refDef?.name || `Ability ${i + 1}`}</span>
              <span className="text-[10px] text-white/35">
                ≈{share}% of turns{ab.when ? ' (once its gate opens)' : ''}
              </span>
              <button onClick={() => onChange(abilities.filter((_, x) => x !== i))}
                className="ml-auto p-0.5 rounded text-white/30 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 flex-1">
                <span className="text-white/50">Name</span>
                <input type="text" value={ab.name ?? ''}
                  placeholder={refDef ? refDef.name : 'an ability'}
                  onChange={e => update(i, { name: e.target.value || undefined })}
                  className="flex-1 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none focus:border-amber-500/50" />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-white/50">Weight</span>
                <input type="number" min={1} value={ab.weight}
                  onChange={e => update(i, { weight: Math.max(1, e.target.valueAsNumber || 1) })}
                  className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none focus:border-amber-500/50" />
              </label>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <span className="text-white/50">Source</span>
                <select value={source} onChange={e => setSource(i, e.target.value as 'spell' | 'skill' | 'custom')}
                  className="px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none">
                  <option value="custom">Custom effects</option>
                  <option value="spell">Spell (database)</option>
                  <option value="skill">Skill (database)</option>
                </select>
              </label>
              {source === 'spell' && (
                <select value={ab.spell ?? ''} onChange={e => update(i, { spell: e.target.value })}
                  className="flex-1 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none">
                  {ruleset.spells.map(sp => <option key={sp.id} value={sp.id}>{sp.icon} {sp.name}</option>)}
                </select>
              )}
              {source === 'skill' && (
                <select value={ab.skill ?? ''} onChange={e => update(i, { skill: e.target.value })}
                  className="flex-1 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none">
                  {(ruleset.skills ?? []).map(sk => <option key={sk.id} value={sk.id}>{sk.icon} {sk.name}</option>)}
                </select>
              )}
              <label className="flex items-center gap-1.5 flex-1">
                <span className="text-white/50">Target</span>
                <select value={ab.target ?? ''}
                  onChange={e => update(i, { target: (e.target.value || undefined) as EnemyAbility['target'] })}
                  className="flex-1 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none">
                  {source !== 'custom' && <option value="">Default (from {source})</option>}
                  {ABILITY_TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
            {refDef && (
              <div className="text-[10px] text-white/35 px-0.5">
                {refDef.icon} {refDef.name}{refDef.description ? ` — ${refDef.description}` : ''} · edits to the
                {source === 'spell' ? ' spell' : ' skill'} apply everywhere it is used.
              </div>
            )}
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <span className="text-white/50">Only below own HP %</span>
                <input type="number" min={1} max={99} placeholder="—"
                  value={hpPct ?? ''}
                  onChange={e => setWhen(i, 'selfHpBelow', Number.isNaN(e.target.valueAsNumber) ? undefined : Math.min(99, Math.max(1, e.target.valueAsNumber)) / 100)}
                  className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none focus:border-amber-500/50" />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-white/50">Only from round</span>
                <input type="number" min={1} placeholder="—"
                  value={ab.when?.roundAtLeast ?? ''}
                  onChange={e => setWhen(i, 'roundAtLeast', Number.isNaN(e.target.valueAsNumber) ? undefined : Math.max(1, Math.round(e.target.valueAsNumber)))}
                  className="w-14 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-white/90 focus:outline-none focus:border-amber-500/50" />
              </label>
            </div>
            {source === 'custom' && (
              <EffectBuilder effects={ab.effects ?? []} ruleset={ruleset}
                onChange={effects => update(i, { effects })} />
            )}
          </div>
        )
      })}
      <button onClick={addAbility}
        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-dashed border-white/15 text-xs text-white/40 hover:text-amber-200 hover:border-amber-500/40">
        <Plus className="w-3 h-3" /> Add ability
      </button>
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

      {/* Battle music + boss flag */}
      <div className="pt-2 border-t border-white/10 space-y-2">
        <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
          <input type="checkbox" checked={!!table.boss}
            onChange={e => onChange({ ...table, boss: e.target.checked || undefined })} />
          <span>👑 Boss fight</span>
          <span className="text-[10px] text-white/30">Uses the game&apos;s boss theme unless a custom track is set.</span>
        </label>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-0.5">Custom Battle Music <span className="text-white/30">(optional)</span></label>
          <select value={table.musicId ?? ''}
            onChange={e => onChange({ ...table, musicId: e.target.value || undefined })}
            className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50">
            <option value="">— use {table.boss ? 'boss' : 'battle'} theme —</option>
            {ruleset.audioTracks.map(t => <option key={t.id} value={t.id}>{t.icon ?? '🎵'} {t.name}</option>)}
          </select>
        </div>
      </div>

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

// ── Sorted, collapsible-group lists (Spells / Status Effects / Skills) ────────

/** A localStorage-persisted choice constrained to an allowed set. */
function usePersistedChoice<T extends string>(key: string, allowed: readonly T[], dflt: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const v = window.localStorage.getItem(key)
      if (v && (allowed as readonly string[]).includes(v)) return v as T
    } catch { /* SSR / storage unavailable */ }
    return dflt
  })
  const pick = (v: T) => {
    setVal(v)
    try { window.localStorage.setItem(key, v) } catch { /* ignore */ }
  }
  return [val, pick]
}

interface SortedRow { key: string; id: string; icon: string; name: string; sub?: string; groupId?: string }
interface SortedGroup { id: string; label: string; icon?: string; color?: string }

/** Entry list with a sort dropdown and collapsible group sections. Rows arrive
 *  pre-sorted; groups (when present) render as clickable ▾/▸ headers. The group
 *  holding the current selection stays open so it can never be lost. */
function SortedList({ label, rows, groups, sortOptions, sort, onSort, selectedId, onSelect, onAdd, onDelete }: {
  label: string
  rows: SortedRow[]
  groups?: SortedGroup[]
  sortOptions: { id: string; label: string }[]
  sort: string
  onSort: (id: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const toggle = (gid: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(gid)) next.delete(gid); else next.add(gid)
    return next
  })

  const q = query.trim().toLowerCase()
  const shown = q
    ? rows.filter(r => r.name.toLowerCase().includes(q) || (r.sub ?? '').toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    : rows

  const row = (r: SortedRow) => (
    <div key={r.key}
      className={cn('flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
        selectedId === r.id ? 'bg-amber-950/40 text-white' : 'text-white/70 hover:bg-white/5')}
      onClick={() => onSelect(r.id)}
    >
      <span className="text-base w-6 text-center flex-shrink-0">{r.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{r.name}</div>
        {r.sub && <div className="text-xs text-white/35 truncate">{r.sub}</div>}
      </div>
      <button onClick={ev => { ev.stopPropagation(); onDelete(r.id) }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-white/30 hover:text-red-400">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )

  const uniqueCount = new Set(rows.map(r => r.id)).size
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">{label} ({uniqueCount})</span>
        <select value={sort} onChange={e => onSort(e.target.value)} title="Sort by…"
          className="ml-auto px-1 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] text-white/60 focus:outline-none">
          {sortOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="px-2 py-1.5 border-b border-white/5">
        <div className="relative">
          <Search className="w-3 h-3 text-white/25 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="w-full pl-6 pr-6 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 placeholder:text-white/25 focus:outline-none focus:border-amber-500/40" />
          {query && (
            <button onClick={() => setQuery('')} title="Clear"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 text-xs">✕</button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
        {rows.length === 0 && <div className="text-center text-white/25 text-xs py-6">Nothing yet — click New</div>}
        {rows.length > 0 && shown.length === 0 && <div className="text-center text-white/25 text-xs py-6">No matches for “{query}”</div>}
        {groups ? groups.map(g => {
          const members = shown.filter(r => r.groupId === g.id)
          if (members.length === 0) return null
          const containsSel = selectedId != null && members.some(r => r.id === selectedId)
          const open = containsSel || !collapsed.has(g.id)
          return (
            <div key={g.id}>
              <button onClick={() => toggle(g.id)}
                title={containsSel ? 'Held open — contains the selected entry' : open ? 'Collapse' : 'Expand'}
                className="flex items-center gap-1.5 w-full px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-left"
                style={{ color: g.color ?? 'rgba(255,255,255,0.4)' }}>
                <span className="w-3">{open ? '▾' : '▸'}</span>
                {g.icon && <span>{g.icon}</span>}
                <span className="flex-1">{g.label}</span>
                <span className="text-white/25 normal-case">{members.length}</span>
              </button>
              {open && members.map(row)}
            </div>
          )
        }) : shown.map(row)}
      </div>
    </div>
  )
}

const SPELL_SORTS: { id: SpellSort; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'level',  label: 'Level' },
  { id: 'mp',     label: 'MP Cost' },
  { id: 'name',   label: 'Name' },
]

function SpellList({ spells, ruleset, selectedId, onSelect, onAdd, onDelete }: {
  spells: SpellDef[]
  ruleset: Ruleset
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [sort, setSort] = usePersistedChoice<SpellSort>('epoch.db.spellSort', ['school', 'level', 'mp', 'name'], 'school')
  const schools = useMemo(() => ruleset.spellSchools ?? [], [ruleset.spellSchools])
  const rows = useMemo<SortedRow[]>(() => sortSpells(spells, sort, schools).map(s => ({
    key: s.id, id: s.id, icon: s.icon ?? '✨', name: s.name,
    sub: `${schools.find(sc => sc.id === s.school)?.name ?? s.school} · Lv ${spellLearnLevel(s)} · ${s.mpCost} MP`,
    groupId: sort === 'school' ? s.school : undefined,
  })), [spells, sort, schools])
  const groups = useMemo<SortedGroup[] | undefined>(() => {
    if (sort !== 'school') return undefined
    const known: SortedGroup[] = schools.map(sc => ({ id: sc.id, label: sc.name, icon: sc.icon, color: sc.color }))
    const extras = Array.from(new Set(spells.map(s => s.school).filter(id => id && !schools.some(sc => sc.id === id))))
      .map(id => ({ id, label: id }))
    return [...known, ...extras]
  }, [sort, schools, spells])
  return <SortedList label="Spells" rows={rows} groups={groups} sortOptions={SPELL_SORTS}
    sort={sort} onSort={v => setSort(v as SpellSort)}
    selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onDelete={onDelete} />
}

// ── Spell editor ──────────────────────────────────────────────────────────────

function SpellEditor({ spell, ruleset, onChange }: { spell: SpellDef; ruleset: Ruleset; onChange: (s: SpellDef) => void }) {
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
        ruleset={ruleset}
        onChange={v => onChange({ ...spell, ...(v as Partial<SpellDef>) })}
      />
    </div>
  )
}

// ── Status effect list ────────────────────────────────────────────────────────

const STATUS_SORTS: { id: StatusSort; label: string }[] = [
  { id: 'kind',     label: 'Kind' },
  { id: 'duration', label: 'Duration' },
  { id: 'name',     label: 'Name' },
]

function StatusList({ statuses, selectedId, onSelect, onAdd, onDelete }: {
  statuses: StatusEffectDef[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [sort, setSort] = usePersistedChoice<StatusSort>('epoch.db.statusSort', ['kind', 'duration', 'name'], 'kind')
  const kindLabel = (k: string) => STATUS_KINDS.find(o => o.value === k)?.label ?? k
  const rows = useMemo<SortedRow[]>(() => sortStatuses(statuses, sort).map(s => ({
    key: s.id, id: s.id, icon: s.icon ?? '🌀', name: s.name,
    sub: `${kindLabel(s.kind)} · ${s.durationTurns === 0 ? 'permanent' : `${s.durationTurns} turn${s.durationTurns === 1 ? '' : 's'}`}`,
    groupId: sort === 'kind' ? s.kind : undefined,
  })), [statuses, sort])
  const groups = useMemo<SortedGroup[] | undefined>(() => sort === 'kind'
    ? STATUS_KINDS.map(k => ({ id: k.value, label: k.label }))
    : undefined, [sort])
  return <SortedList label="Status Effects" rows={rows} groups={groups} sortOptions={STATUS_SORTS}
    sort={sort} onSort={v => setSort(v as StatusSort)}
    selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onDelete={onDelete} />
}

// ── Status effect editor ──────────────────────────────────────────────────────

function StatusEditor({ status, ruleset, onChange }: { status: StatusEffectDef; ruleset: Ruleset; onChange: (s: StatusEffectDef) => void }) {
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
        ruleset={ruleset}
        onChange={v => {
          const patch = { ...(v as Partial<StatusEffectDef>) }
          if ((v as Record<string, unknown>).boostScope === '') patch.boostScope = undefined
          onChange({ ...status, ...patch } as StatusEffectDef)
        }}
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
let _wtypeSeq = 1
let _atypeSeq = 1
let _audioSeq = 1
let _schoolSeq = 1
let _skillSeq = 1

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

function ClassEditor({ cls, ruleset, onChange }: {
  cls: ClassDef
  ruleset: Ruleset
  onChange: (c: ClassDef) => void
}) {
  const raw = cls as unknown as Record<string, unknown>

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
        <div className="text-xs font-medium text-white/60 mb-1">
          Spell Schools <span className="text-white/30">(none selected = any)</span>
        </div>
        {ruleset.spellSchools.length === 0 ? (
          <div className="text-xs text-white/25">No schools defined — add some in the Spell Schools tab.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {ruleset.spellSchools.map(sc => (
              <Chip key={sc.id} active={cls.spellSchools.includes(sc.id)}
                label={`${sc.icon ?? '✨'} ${sc.name}`}
                onClick={() => onChange({ ...cls, spellSchools: cls.spellSchools.includes(sc.id)
                  ? cls.spellSchools.filter(s => s !== sc.id) : [...cls.spellSchools, sc.id] })} />
            ))}
          </div>
        )}
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

// ── Weapon / armor type editors ──────────────────────────────────────────────

function TypeEditorHeader({ def, fallback }: { def: { icon?: string; name: string; id: string }; fallback: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-2xl">{def.icon ?? fallback}</span>
      <div>
        <div className="text-base font-bold text-white/90">{def.name}</div>
        <div className="text-xs text-white/40 font-mono">{def.id}</div>
      </div>
    </div>
  )
}

function WeaponTypeEditor({ wtype, ruleset, onChange }: {
  wtype: WeaponTypeDef
  ruleset: Ruleset
  onChange: (w: WeaponTypeDef) => void
}) {
  const raw = wtype as unknown as Record<string, unknown>
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <TypeEditorHeader def={wtype} fallback="⚔️" />
      <SchemaForm schema={WEAPON_TYPE_SCHEMA} value={raw} onChange={u => onChange(u as unknown as WeaponTypeDef)} />
      <div>
        <label className="block text-xs font-medium text-white/60 mb-0.5">Scaling Attribute (drives attack damage)</label>
        <select value={wtype.scalingAttr}
          onChange={e => onChange({ ...wtype, scalingAttr: e.target.value })}
          className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50">
          {ruleset.attributes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
    </div>
  )
}

function ArmorTypeEditor({ atype, onChange }: {
  atype: ArmorTypeDef
  onChange: (a: ArmorTypeDef) => void
}) {
  const raw = atype as unknown as Record<string, unknown>
  function handle(updated: Record<string, unknown>) {
    if (updated.speedMod === '' || updated.speedMod === undefined || Number.isNaN(updated.speedMod)) {
      updated = { ...updated, speedMod: undefined }
    }
    onChange(updated as unknown as ArmorTypeDef)
  }
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <TypeEditorHeader def={atype} fallback="🛡️" />
      <SchemaForm schema={ARMOR_TYPE_SCHEMA} value={raw} onChange={handle} />
    </div>
  )
}

const SKILL_SORTS: { id: SkillSort; label: string }[] = [
  { id: 'class', label: 'Class' },
  { id: 'name',  label: 'Name' },
]

function SkillList({ skills, ruleset, selectedId, onSelect, onAdd, onDelete }: {
  skills: SkillDef[]
  ruleset: Ruleset
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const [sort, setSort] = usePersistedChoice<SkillSort>('epoch.db.skillSort', ['class', 'name'], 'class')
  const costOf = (s: SkillDef) => {
    const bits: string[] = []
    if (s.hpCostPct) bits.push(`${Math.round(s.hpCostPct * 100)}% HP`)
    if (s.mpCost) bits.push(`${s.mpCost} MP`)
    if (s.cooldown) bits.push(`CD ${s.cooldown}`)
    return bits.length ? bits.join(' · ') : 'free'
  }
  const { rows, groups } = useMemo(() => {
    const g = skillGroups(skills, ruleset.classes, sort)
    return {
      rows: g.rows.map(({ skill, groupId, key }) => {
        const lv = groupId && groupId !== '_unassigned' ? skill.learn?.find(l => l.classId === groupId)?.level : undefined
        return {
          key, id: skill.id, icon: skill.icon ?? '💥', name: skill.name,
          sub: `${lv ? `Lv ${lv} · ` : ''}${costOf(skill)}`,
          groupId,
        }
      }),
      groups: g.groups,
    }
  }, [skills, sort, ruleset.classes])
  return <SortedList label="Skills" rows={rows} groups={groups} sortOptions={SKILL_SORTS}
    sort={sort} onSort={v => setSort(v as SkillSort)}
    selectedId={selectedId} onSelect={onSelect} onAdd={onAdd} onDelete={onDelete} />
}

// ── Spell school editor ───────────────────────────────────────────────────────

function SpellSchoolEditor({ school, ruleset, onChange }: {
  school: SpellSchoolDef
  ruleset: Ruleset
  onChange: (s: SpellSchoolDef) => void
}) {
  const raw = school as unknown as Record<string, unknown>
  const spellCount = ruleset.spells.filter(sp => sp.school === school.id).length
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <TypeEditorHeader def={school} fallback="✨" />
      <SchemaForm schema={SPELL_SCHOOL_SCHEMA} value={raw} onChange={u => onChange(u as unknown as SpellSchoolDef)} />
      <div>
        <label className="block text-xs font-medium text-white/60 mb-0.5">
          Scaling Attribute <span className="text-white/30">(spell power: +1 per 2 points above 10; none = flat dice)</span>
        </label>
        <select value={school.keyAttribute ?? ''}
          onChange={e => onChange({ ...school, keyAttribute: e.target.value || undefined })}
          className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50">
          <option value="">— no scaling —</option>
          {ruleset.attributes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="text-[11px] text-white/35">{spellCount} spell{spellCount === 1 ? '' : 's'} in this school.</div>
    </div>
  )
}

// ── Audio track editor ────────────────────────────────────────────────────────

const MAX_TRACK_BYTES = 25 * 1024 * 1024      // hard cap
const WARN_TRACK_BYTES = 8 * 1024 * 1024      // soft warning (keeps .epochmap lean)

/** Synthetic list id for the global Event Sounds panel. */
const SFX_SLOTS_ID = '__sfxslots__'

/** Assign which SFX plays for each engine event (door, chest, level-up…).
 *  Writes ruleset.meta.sfxSlots; unset events fall back to their built-in. */
function SfxSlotPanel({ ruleset, onRulesetChange }: {
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
}) {
  const sfxTracks = ruleset.audioTracks.filter(t => t.role === 'sfx')
  const slots = ruleset.meta.sfxSlots ?? {}

  function setSlot(event: SfxEvent, id: string) {
    const next: Partial<Record<SfxEvent, string>> = { ...slots }
    if (id) next[event] = id; else delete next[event]
    onRulesetChange({ ...ruleset, meta: { ...ruleset.meta, sfxSlots: next } })
  }
  function preview(id: string) {
    const t = ruleset.audioTracks.find(x => x.id === id)
    if (t) { music.unlock(); music.playSfxTrack(t) }
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <div>
        <div className="text-base font-bold text-white/90">Event Sounds</div>
        <p className="text-xs text-white/40 mt-0.5">The sound effect played for each engine action. Per-object overrides (a specific door or chest) still win over these.</p>
      </div>
      <div className="space-y-1.5">
        {SFX_META.filter(s => s.event).map(s => {
          const event = s.event as SfxEvent
          const cur = slots[event] ?? `sfx.${s.name}`
          return (
            <div key={event} className="flex items-center gap-2">
              <div className="w-32 flex-shrink-0 text-sm text-white/70">{s.label}</div>
              <select value={cur} onChange={e => setSlot(event, e.target.value)}
                className="flex-1 px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/85 focus:outline-none focus:border-amber-500/40">
                {sfxTracks.map(t => <option key={t.id} value={t.id}>{t.icon ?? '🔊'} {t.name}</option>)}
              </select>
              <button onClick={() => preview(cur)} title="Preview"
                className="flex-shrink-0 p-1.5 rounded text-white/50 hover:text-white hover:bg-white/10 border border-white/10">
                <Play className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AudioTrackEditor({ track, onChange }: {
  track: AudioTrackDef
  onChange: (t: AudioTrackDef) => void
}) {
  const [stored, setStored] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (track.source === 'upload') hasTrack(track.id).then(setStored).catch(() => setStored(false))
    else setStored(null)
  }, [track.id, track.source])

  // Stop preview when leaving this track / unmounting.
  useEffect(() => () => { if (music.currentTrackId() === track.id) music.stop({ fadeMs: 150 }) }, [track.id])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > MAX_TRACK_BYTES) { toast.error(`"${f.name}" is too large (max 25 MB).`); return }
    if (f.size > WARN_TRACK_BYTES) toast('Large track — a shorter looped clip keeps your .epochmap lean.')
    setBusy(true)
    try {
      await putTrack(track.id, f)
      setStored(true)
      onChange({ ...track, src: f.name, mime: f.type || 'audio/mpeg' })
      toast.success('Track stored.')
    } catch {
      toast.error('Could not store the audio file.')
    } finally {
      setBusy(false)
    }
  }

  const isSfx = track.role === 'sfx'

  async function togglePreview() {
    if (isSfx) {
      music.unlock()
      music.playSfxTrack(track) // one-shot, no persistent "playing" state
      return
    }
    if (previewing || music.currentTrackId() === track.id) {
      music.stop({ fadeMs: 150 })
      setPreviewing(false)
      return
    }
    music.unlock() // the click is our user gesture
    try {
      await music.play(track, { crossfadeMs: 200 })
      setPreviewing(true)
    } catch {
      toast.error('Could not play this track.')
    }
  }

  const canPreview = track.source === 'builtin' ? true : track.source === 'url' ? !!track.src : stored === true

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">{track.icon ?? '🎵'}</span>
        <div>
          <div className="text-base font-bold text-white/90">{track.name}</div>
          <div className="text-xs text-white/40 font-mono">{track.id}</div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-white/60 mb-0.5">Name</label>
        <input type="text" value={track.name}
          onChange={e => onChange({ ...track, name: e.target.value })}
          className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/85 focus:outline-none focus:border-amber-500/50" />
      </div>

      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">Type</label>
        <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
          {(['music', 'sfx'] as const).map(r => (
            <button key={r}
              onClick={() => onChange({ ...track, role: r, loop: r === 'music' })}
              className={cn('px-3 py-1.5 text-xs', (track.role ?? 'music') === r ? 'bg-amber-500/15 text-amber-200' : 'text-white/55 hover:text-white/80', r === 'sfx' ? 'border-l border-white/10' : '')}>
              {r === 'music' ? '🎵 Music' : '🔊 Sound effect'}
            </button>
          ))}
        </div>
      </div>

      {/* Source */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1">Source</label>
        <div className="flex gap-1 mb-2">
          {track.source === 'builtin' && <Chip active label="Built-in chiptune" onClick={() => {}} />}
          <Chip active={track.source === 'upload'} label="Upload" onClick={() => onChange({ ...track, source: 'upload' })} />
          <Chip active={track.source === 'url'} label="External URL" onClick={() => onChange({ ...track, source: 'url' })} />
        </div>
        {track.source === 'builtin' ? (
          <div className="text-[11px] text-white/35">
            Synthesized on demand — zero file size, works everywhere, nothing to bake on
            export. Switch to Upload or URL to replace it with your own audio (the id keeps
            every slot and map that points here working).
          </div>
        ) : track.source === 'upload' ? (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onFile} />
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-amber-600/20 text-amber-300/90 hover:text-amber-200 disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" /> {busy ? 'Storing…' : (stored ? 'Replace file' : 'Choose file')}
            </button>
            <span className="text-xs text-white/50 truncate">
              {stored ? (track.src ?? 'stored ✓') : <span className="text-white/30">no file yet</span>}
            </span>
          </div>
        ) : (
          <input type="text" value={track.src ?? ''} placeholder="https://…/theme.ogg"
            onChange={e => onChange({ ...track, src: e.target.value })}
            className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 focus:outline-none focus:border-amber-500/50" />
        )}
        {track.source !== 'builtin' && (
          <div className="text-[11px] text-white/35 mt-1">
            {track.source === 'upload'
              ? 'Stored locally and baked into the .epochmap on save — fully shareable.'
              : 'Streamed from the web at play time (needs network + CORS). Keeps the file tiny.'}
          </div>
        )}
      </div>

      {/* Loop + volume */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer">
          <input type="checkbox" checked={track.loop ?? true} onChange={e => onChange({ ...track, loop: e.target.checked })} />
          Loop
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70 flex-1">
          Volume
          <input type="range" min={0} max={1} step={0.05} value={track.volume ?? 1}
            onChange={e => onChange({ ...track, volume: parseFloat(e.target.value) })}
            className="flex-1 accent-amber-500" />
          <span className="w-8 text-right text-white/50 tabular-nums">{Math.round((track.volume ?? 1) * 100)}%</span>
        </label>
      </div>

      {/* Preview */}
      <div className="pt-2 border-t border-white/10">
        <button type="button" onClick={togglePreview} disabled={!canPreview}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded text-sm',
            canPreview ? 'bg-amber-600/25 text-amber-200 hover:bg-amber-600/35' : 'bg-zinc-800 text-white/30 cursor-not-allowed')}>
          {previewing ? <><Square className="w-4 h-4" /> Stop</> : <><Play className="w-4 h-4" /> Preview</>}
        </button>
        {!canPreview && <span className="ml-2 text-xs text-white/30">{track.source === 'url' ? 'Enter a URL to preview' : 'Upload a file to preview'}</span>}
      </div>
    </div>
  )
}

export function DatabaseWorkspace({ ruleset, onRulesetChange }: DatabaseWorkspaceProps) {
  const [category, setCategory] = useState<Category>('items')
  const [selectedId, setSelectedId] = useState<string | null>(
    ruleset.items[0]?.id ?? null,
  )
  const [listWidth, listHandle] = usePanelWidth('db.list', 'left', 224, 180, 460)

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

  /** Duplicate (or elite-promote) an enemy, inserting the copy right after
   *  its source and selecting it for editing. */
  function duplicateEnemyById(id: string, elite = false) {
    const idx = ruleset.enemies.findIndex(e => e.id === id)
    if (idx < 0) return
    const ids = ruleset.enemies.map(e => e.id)
    const copy = elite ? eliteEnemy(ruleset.enemies[idx], ids) : duplicateEnemy(ruleset.enemies[idx], ids)
    const enemies = [...ruleset.enemies.slice(0, idx + 1), copy, ...ruleset.enemies.slice(idx + 1)]
    onRulesetChange({ ...ruleset, enemies })
    setSelectedId(copy.id)
    setCategory('bestiary')
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

  // ── weapon types ──

  const selectedWeaponType = ruleset.weaponTypes.find(w => w.id === selectedId) ?? null

  function addWeaponType() {
    const id = `wtype.type_${_wtypeSeq++}`
    onRulesetChange({ ...ruleset, weaponTypes: [...ruleset.weaponTypes, blankWeaponType(id)] })
    setSelectedId(id); setCategory('weapon_types')
  }
  function updateWeaponType(w: WeaponTypeDef) {
    onRulesetChange({ ...ruleset, weaponTypes: ruleset.weaponTypes.map(x => x.id === w.id ? w : x) })
  }
  function deleteWeaponType(id: string) {
    const next = ruleset.weaponTypes.filter(w => w.id !== id)
    onRulesetChange({ ...ruleset, weaponTypes: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── armor types ──

  const selectedArmorType = ruleset.armorTypes.find(a => a.id === selectedId) ?? null

  function addArmorType() {
    const id = `atype.type_${_atypeSeq++}`
    onRulesetChange({ ...ruleset, armorTypes: [...ruleset.armorTypes, blankArmorType(id)] })
    setSelectedId(id); setCategory('armor_types')
  }
  function updateArmorType(a: ArmorTypeDef) {
    onRulesetChange({ ...ruleset, armorTypes: ruleset.armorTypes.map(x => x.id === a.id ? a : x) })
  }
  function deleteArmorType(id: string) {
    const next = ruleset.armorTypes.filter(a => a.id !== id)
    onRulesetChange({ ...ruleset, armorTypes: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── audio tracks ──

  const selectedTrack = ruleset.audioTracks.find(t => t.id === selectedId) ?? null

  function addTrack() {
    const id = `trk.track_${_audioSeq++}`
    onRulesetChange({ ...ruleset, audioTracks: [...ruleset.audioTracks, blankAudioTrack(id)] })
    setSelectedId(id); setCategory('audio')
  }
  function updateTrack(t: AudioTrackDef) {
    onRulesetChange({ ...ruleset, audioTracks: ruleset.audioTracks.map(x => x.id === t.id ? t : x) })
  }
  function deleteTrackDef(id: string) {
    const next = ruleset.audioTracks.filter(t => t.id !== id)
    onRulesetChange({ ...ruleset, audioTracks: next })
    void deleteTrack(id) // drop the IndexedDB blob too
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── spell schools ──

  const selectedSchool = ruleset.spellSchools.find(s => s.id === selectedId) ?? null

  function addSchool() {
    const id = `school.school_${_schoolSeq++}`
    onRulesetChange({ ...ruleset, spellSchools: [...ruleset.spellSchools, blankSpellSchool(id)] })
    setSelectedId(id); setCategory('spell_schools')
  }
  function updateSchool(s: SpellSchoolDef) {
    onRulesetChange({ ...ruleset, spellSchools: ruleset.spellSchools.map(x => x.id === s.id ? s : x) })
  }
  function deleteSchool(id: string) {
    const next = ruleset.spellSchools.filter(s => s.id !== id)
    onRulesetChange({ ...ruleset, spellSchools: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  // ── skills ──

  const selectedSkill = (ruleset.skills ?? []).find(s => s.id === selectedId) ?? null

  function addSkill() {
    const id = `skill.skill_${_skillSeq++}`
    onRulesetChange({ ...ruleset, skills: [...(ruleset.skills ?? []), blankSkill(id)] })
    setSelectedId(id); setCategory('skills')
  }
  function updateSkill(s: SkillDef) {
    onRulesetChange({ ...ruleset, skills: (ruleset.skills ?? []).map(x => x.id === s.id ? s : x) })
  }
  function deleteSkill(id: string) {
    const next = (ruleset.skills ?? []).filter(s => s.id !== id)
    onRulesetChange({ ...ruleset, skills: next })
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
  const selectedDialogue = (ruleset.dialogues ?? []).find(d => d.id === selectedId) ?? null

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

  function addDialogue() {
    const id = `dlg.dialogue_${(ruleset.dialogues ?? []).length + 1}_${Date.now() % 1000}`
    onRulesetChange({ ...ruleset, dialogues: [...(ruleset.dialogues ?? []), blankDialogue(id)] })
    setSelectedId(id); setCategory('dialogues')
  }
  function updateDialogue(d: DialogueDef) {
    onRulesetChange({ ...ruleset, dialogues: (ruleset.dialogues ?? []).map(x => x.id === d.id ? d : x) })
  }
  function deleteDialogue(id: string) {
    const next = (ruleset.dialogues ?? []).filter(d => d.id !== id)
    onRulesetChange({ ...ruleset, dialogues: next })
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
    if (cat === 'weapon_types')   setSelectedId(ruleset.weaponTypes[0]?.id ?? null)
    if (cat === 'armor_types')    setSelectedId(ruleset.armorTypes[0]?.id ?? null)
    if (cat === 'audio')          setSelectedId(ruleset.audioTracks[0]?.id ?? null)
    if (cat === 'spell_schools')  setSelectedId(ruleset.spellSchools[0]?.id ?? null)
    if (cat === 'skills')         setSelectedId((ruleset.skills ?? [])[0]?.id ?? null)
    if (cat === 'classes')        setSelectedId(ruleset.classes[0]?.id ?? null)
    if (cat === 'events')         setSelectedId((ruleset.events ?? [])[0]?.id ?? null)
    if (cat === 'quests')         setSelectedId((ruleset.quests ?? [])[0]?.id ?? null)
    if (cat === 'dialogues')      setSelectedId((ruleset.dialogues ?? [])[0]?.id ?? null)
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

      {/* Entry list (drag the right edge to resize) */}
      <div className="relative flex-shrink-0 border-r border-white/10 bg-zinc-950 min-h-0" style={{ width: listWidth }}>
        {listHandle}
        {category === 'items' && (
          <ItemList items={ruleset.items} selectedId={selectedId} onSelect={setSelectedId} onAdd={addItem} onDelete={deleteItem} />
        )}
        {category === 'loot_tables' && (
          <LootTableList tables={ruleset.lootTables} selectedId={selectedId} onSelect={setSelectedId} onAdd={addLootTable} onDelete={deleteLootTable} />
        )}
        {category === 'bestiary' && (
          <EnemyList enemies={ruleset.enemies} selectedId={selectedId} onSelect={setSelectedId} onAdd={addEnemy} onDelete={deleteEnemy} onDuplicate={duplicateEnemyById} />
        )}
        {category === 'encounters' && (
          <EncounterTableList tables={ruleset.encounterTables} selectedId={selectedId} onSelect={setSelectedId} onAdd={addEncounterTable} onDelete={deleteEncounterTable} />
        )}
        {category === 'spells' && (
          <SpellList spells={ruleset.spells} ruleset={ruleset} selectedId={selectedId} onSelect={setSelectedId} onAdd={addSpell} onDelete={deleteSpell} />
        )}
        {category === 'status_effects' && (
          <StatusList statuses={ruleset.statusEffects} selectedId={selectedId} onSelect={setSelectedId} onAdd={addStatus} onDelete={deleteStatus} />
        )}
        {category === 'shops' && (
          <ShopList shops={ruleset.shops} selectedId={selectedId} onSelect={setSelectedId} onAdd={addShop} onDelete={deleteShop} />
        )}
        {category === 'weapon_types' && (
          <GenericDefList label="Weapon Types" entries={ruleset.weaponTypes.map(w => ({ id: w.id, icon: w.icon ?? '⚔️', name: `${w.name} · ${w.weight}` }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addWeaponType} onDelete={deleteWeaponType} />
        )}
        {category === 'armor_types' && (
          <GenericDefList label="Armor Types" entries={ruleset.armorTypes.map(a => ({ id: a.id, icon: a.icon ?? '🛡️', name: `${a.name} · ${a.weight}` }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addArmorType} onDelete={deleteArmorType} />
        )}
        {category === 'skills' && (
          <SkillList skills={ruleset.skills ?? []} ruleset={ruleset}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addSkill} onDelete={deleteSkill} />
        )}
        {category === 'spell_schools' && (
          <GenericDefList label="Spell Schools" entries={ruleset.spellSchools.map(s => ({ id: s.id, icon: s.icon ?? '✨', name: s.name }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addSchool} onDelete={deleteSchool} />
        )}
        {category === 'audio' && (
          <SortedList label="Audio"
            rows={[
              { key: SFX_SLOTS_ID, id: SFX_SLOTS_ID, icon: '🎚️', name: 'Event Sounds', sub: 'which SFX plays for each action', groupId: 'special' },
              ...ruleset.audioTracks.map(t => ({
                key: t.id, id: t.id, icon: t.icon ?? (t.role === 'sfx' ? '🔊' : '🎵'),
                name: t.name, sub: t.source, groupId: t.role === 'sfx' ? 'sfx' : 'music',
              })),
            ]}
            groups={[{ id: 'special', label: 'Global' }, { id: 'music', label: 'Music' }, { id: 'sfx', label: 'Sound Effects' }]}
            sortOptions={[{ id: 'type', label: 'Type' }]} sort="type" onSort={() => {}}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addTrack}
            onDelete={id => { if (id !== SFX_SLOTS_ID) deleteTrackDef(id) }} />
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
        {category === 'dialogues' && (
          <GenericDefList label="Dialogue" entries={(ruleset.dialogues ?? []).map(d => ({ id: d.id, icon: '💬', name: d.name }))}
            selectedId={selectedId} onSelect={setSelectedId} onAdd={addDialogue} onDelete={deleteDialogue} />
        )}
      </div>

      {/* Detail editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {category === 'items' && selectedItem ? (
          <ItemEditor item={selectedItem} ruleset={ruleset} onChange={updateItem} />
        ) : category === 'loot_tables' && selectedTable ? (
          <LootTableEditor table={selectedTable} ruleset={ruleset} onChange={updateLootTable} />
        ) : category === 'bestiary' && selectedEnemy ? (
          <EnemyEditor enemy={selectedEnemy} ruleset={ruleset} onChange={updateEnemy}
            onDuplicate={() => duplicateEnemyById(selectedEnemy.id)}
            onMakeElite={() => duplicateEnemyById(selectedEnemy.id, true)} />
        ) : category === 'encounters' && selectedEncTable ? (
          <EncounterTableEditor table={selectedEncTable} ruleset={ruleset} onChange={updateEncounterTable} />
        ) : category === 'spells' && selectedSpell ? (
          <SpellEditor spell={selectedSpell} ruleset={ruleset} onChange={updateSpell} />
        ) : category === 'status_effects' && selectedStatus ? (
          <StatusEditor status={selectedStatus} ruleset={ruleset} onChange={updateStatus} />
        ) : category === 'shops' && selectedShop ? (
          <ShopEditor shop={selectedShop} ruleset={ruleset} onChange={updateShop} />
        ) : category === 'weapon_types' && selectedWeaponType ? (
          <WeaponTypeEditor wtype={selectedWeaponType} ruleset={ruleset} onChange={updateWeaponType} />
        ) : category === 'armor_types' && selectedArmorType ? (
          <ArmorTypeEditor atype={selectedArmorType} onChange={updateArmorType} />
        ) : category === 'skills' && selectedSkill ? (
          <div className="p-4 space-y-4 overflow-y-auto h-full">
            <TypeEditorHeader def={selectedSkill} fallback="💥" />
            <SchemaForm schema={SKILL_SCHEMA} value={selectedSkill as unknown as Record<string, unknown>} ruleset={ruleset}
              onChange={v => updateSkill({ ...selectedSkill, ...(v as Partial<SkillDef>) })} />
          </div>
        ) : category === 'spell_schools' && selectedSchool ? (
          <SpellSchoolEditor school={selectedSchool} ruleset={ruleset} onChange={updateSchool} />
        ) : category === 'audio' && selectedId === SFX_SLOTS_ID ? (
          <SfxSlotPanel ruleset={ruleset} onRulesetChange={onRulesetChange} />
        ) : category === 'audio' && selectedTrack ? (
          <AudioTrackEditor track={selectedTrack} onChange={updateTrack} />
        ) : category === 'classes' && selectedClass ? (
          <ClassEditor cls={selectedClass} ruleset={ruleset} onChange={updateClass} />
        ) : category === 'events' && selectedEvent ? (
          <EventDefEditor def={selectedEvent} ruleset={ruleset} onChange={updateEventDef} />
        ) : category === 'quests' && selectedQuest ? (
          <QuestEditor quest={selectedQuest} ruleset={ruleset} onChange={updateQuest} />
        ) : category === 'dialogues' && selectedDialogue ? (
          <DialogueEditor dialogue={selectedDialogue} ruleset={ruleset} onChange={updateDialogue} />
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
