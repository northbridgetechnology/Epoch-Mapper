/**
 * FieldSchema definitions for the ItemDef and LootTableDef database tables.
 * Used by SchemaForm and the DatabaseWorkspace entry editor.
 */

import type { FieldSchema } from './engine-types'

const ITEM_KINDS = [
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'key', label: 'Key Item' },
  { value: 'quest', label: 'Quest Item' },
  { value: 'misc', label: 'Misc' },
]

const ITEM_WEIGHTS = [
  { value: '', label: '— none —' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'medium', label: 'Medium' },
  { value: 'light', label: 'Light' },
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
  {
    key: 'weaponKind',
    label: 'Weapon Type (proficiency — blade, axe, dagger, staff…)',
    type: 'text',
    optional: true,
    placeholder: 'blade',
  },
  {
    key: 'weight',
    label: 'Weight Tier (weapons/armor — gated by class)',
    type: { kind: 'enum', options: ITEM_WEIGHTS },
    optional: true,
  },
  { key: 'value',     label: 'Gold Value',  type: 'number', min: 0 },
  { key: 'stackable', label: 'Stackable',   type: 'boolean' },
  { key: 'twoHanded', label: 'Two-Handed',  type: 'boolean', optional: true },
  { key: 'charges',   label: 'Charges (wands/staves)', type: 'number', min: 1, optional: true },
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
