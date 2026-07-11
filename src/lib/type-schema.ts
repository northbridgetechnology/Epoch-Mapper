/**
 * FieldSchema for the scalar fields of WeaponTypeDef and ArmorTypeDef. The
 * attribute-reference field (scalingAttr) is edited with a bespoke <select>
 * in the DatabaseWorkspace editors, since SchemaForm has no ruleset access.
 */

import type { ArmorTypeDef, FieldSchema, WeaponTypeDef } from './engine-types'

const WEIGHTS = [
  { value: 'heavy', label: 'Heavy' },
  { value: 'medium', label: 'Medium' },
  { value: 'light', label: 'Light' },
]

const DAMAGE_TYPES = [
  { value: 'physical', label: 'Physical' },
  { value: 'fire', label: 'Fire' },
  { value: 'ice', label: 'Ice' },
  { value: 'lightning', label: 'Lightning' },
  { value: 'poison', label: 'Poison' },
  { value: 'holy', label: 'Holy' },
  { value: 'dark', label: 'Dark' },
]

const RANGES = [
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Ranged' },
]

export const WEAPON_TYPE_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'wtype.short_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'icon',        label: 'Icon',         type: 'icon',    optional: true },
  { key: 'color',       label: 'Color',        type: 'color',   optional: true },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
  { key: 'weight',      label: 'Weight Tier',  type: { kind: 'enum', options: WEIGHTS } },
  { key: 'damageType',  label: 'Damage Element (basic attack)', type: { kind: 'enum', options: DAMAGE_TYPES } },
  { key: 'range',       label: 'Reach',        type: { kind: 'enum', options: RANGES } },
]

export const ARMOR_TYPE_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'atype.short_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'icon',        label: 'Icon',         type: 'icon',    optional: true },
  { key: 'color',       label: 'Color',        type: 'color',   optional: true },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
  { key: 'weight',      label: 'Weight Tier',  type: { kind: 'enum', options: WEIGHTS } },
  { key: 'speedMod',    label: 'Speed / Initiative Modifier (e.g. -2 for plate)', type: 'number', optional: true },
]

/** Player-facing damage-type options for item-level overrides. */
export const DAMAGE_TYPE_OPTIONS = DAMAGE_TYPES

export function blankWeaponType(id: string): WeaponTypeDef {
  return {
    id,
    name: 'New Weapon Type',
    icon: '⚔️',
    color: '#b2bec3',
    description: '',
    weight: 'medium',
    scalingAttr: 'attr.might',
    damageType: 'physical',
    range: 'melee',
  }
}

export function blankArmorType(id: string): ArmorTypeDef {
  return {
    id,
    name: 'New Armor Type',
    icon: '🛡️',
    color: '#b2bec3',
    description: '',
    weight: 'medium',
  }
}
