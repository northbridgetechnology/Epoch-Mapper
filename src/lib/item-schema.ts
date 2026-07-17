/**
 * FieldSchema definitions for the ItemDef and LootTableDef database tables.
 * Used by SchemaForm and the DatabaseWorkspace entry editor.
 */

import type { FieldSchema, ItemDef } from './engine-types'

export type ItemSort = 'kind' | 'slot' | 'value' | 'name'

export const ITEM_KINDS = [
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'ammo', label: 'Ammo' },
  { value: 'key', label: 'Key Item' },
  { value: 'quest', label: 'Quest Item' },
  { value: 'misc', label: 'Misc' },
]

const ITEM_SLOTS = [
  { value: '', label: '— none —' },
  { value: 'weapon', label: 'Weapon (main hand)' },
  { value: 'offhand', label: 'Off-hand / Shield' },
  { value: 'head', label: 'Head' },
  { value: 'body', label: 'Body' },
  { value: 'hands', label: 'Hands' },
  { value: 'feet', label: 'Feet' },
  { value: 'ring', label: 'Ring' },
  { value: 'amulet', label: 'Amulet' },
]


const SLOT_ORDER = ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet']

/** Group/sort items for the Database list (view-only — never reorders the
 *  ruleset array). 'kind' and 'slot' produce collapsible groups; 'value' and
 *  'name' are flat. */
export function itemGroups(items: ItemDef[], sort: ItemSort): {
  groups?: { id: string; label: string }[]
  rows: { item: ItemDef; groupId?: string; key: string }[]
} {
  const byName = (a: ItemDef, b: ItemDef) => a.name.localeCompare(b.name)
  if (sort === 'name') return { rows: [...items].sort(byName).map(i => ({ item: i, key: i.id })) }
  if (sort === 'value') return { rows: [...items].sort((a, b) => a.value - b.value || byName(a, b)).map(i => ({ item: i, key: i.id })) }

  if (sort === 'slot') {
    const groups = [
      ...SLOT_ORDER.map(s => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
      { id: '_none', label: 'Not equippable' },
    ]
    const rows = groups.flatMap(g => items
      .filter(i => (i.slot ?? '_none') === g.id)
      .sort(byName)
      .map(i => ({ item: i, groupId: g.id, key: i.id })))
    return { groups, rows }
  }

  // kind (default): ITEM_KINDS order, then name
  const groups = ITEM_KINDS.map(k => ({ id: k.value, label: k.label }))
  const extras = Array.from(new Set(items.map(i => i.kind as string).filter(k => !ITEM_KINDS.some(o => o.value === k))))
  for (const k of extras) groups.push({ id: k, label: k })
  const rows = groups.flatMap(g => items
    .filter(i => (i.kind as string) === g.id)
    .sort(byName)
    .map(i => ({ item: i, groupId: g.id, key: i.id })))
  return { groups, rows }
}

export const ITEM_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'item.short_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'icon',        label: 'Icon',         type: 'icon',    optional: true },
  { key: 'color',       label: 'Color',        type: 'color',   optional: true },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
  {
    key: 'kind',
    label: 'Kind',
    type: { kind: 'enum', options: ITEM_KINDS },
  },
  {
    key: 'slot',
    label: 'Equipment Slot',
    type: { kind: 'enum', options: ITEM_SLOTS },
    optional: true,
  },
  { key: 'value',     label: 'Gold Value',  type: 'number', min: 0 },
  { key: 'stackable', label: 'Stackable',   type: 'boolean' },
  { key: 'modifiers', label: 'Stat Modifiers (while equipped — attribute or derived attack/defense/speed)', type: 'modifiers', optional: true },
  { key: 'twoHanded', label: 'Two-Handed',  type: 'boolean', optional: true },
  { key: 'charges',   label: 'Clip size / charges', type: 'number', min: 1, optional: true },
  { key: 'ammoType',  label: 'Ammo type (for Ammo items, or a weapon type’s ammo)', type: 'text', optional: true },
  { key: 'lightRadius', label: 'Light Radius (cells, dark maps)', type: 'number', min: 1, optional: true },
  { key: 'burnSteps',   label: 'Burn Steps (light source expires)', type: 'number', min: 1, optional: true },
  { key: 'unidentifiedName', label: 'Unidentified Name ("?Sword" — drops arrive unidentified)', type: 'text', optional: true },
  { key: 'cursed',      label: 'Cursed (welds on equip until Remove Curse)', type: 'boolean', optional: true },
]

export const LOOT_TABLE_SCHEMA: FieldSchema[] = [
  { key: 'id',   label: 'ID',   type: 'text', placeholder: 'loot.chest_name' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea', optional: true },
]

/** Default values for a blank new ItemDef */
export function blankItem(id: string): Record<string, unknown> {
  return {
    id,
    name: 'New Item',
    icon: '📦',
    color: '#888888',
    description: '',
    kind: 'misc',
    slot: '',
    value: 0,
    stackable: false,
    twoHanded: false,
  }
}

export function blankLootTable(id: string): Record<string, unknown> {
  return {
    id,
    name: 'New Loot Table',
    description: '',
  }
}

/** Player-facing item name: unidentified stacks show their masked name. */
export function itemDisplayName(def: { name: string; unidentifiedName?: string } | undefined, inst?: { unidentified?: boolean }): string {
  if (!def) return '???'
  return inst?.unidentified ? (def.unidentifiedName || `?${def.name.split(' ').pop()}`) : def.name
}
