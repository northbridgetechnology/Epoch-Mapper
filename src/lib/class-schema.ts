/**
 * FieldSchema for the scalar fields of a ClassDef. The structured fields
 * (allowedEquip, weapon/armor weights, weaponKinds, spellSchools, attribute
 * modifiers/growth, starting spells) are edited with bespoke controls in the
 * DatabaseWorkspace ClassEditor, not through SchemaForm.
 */

import type { ClassDef, FieldSchema } from './engine-types'

export const CLASS_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'class.short_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'icon',        label: 'Icon',         type: 'icon',    optional: true },
  { key: 'color',       label: 'Color',        type: 'color',   optional: true },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
  { key: 'hitDie',      label: 'Hit Die (HP per level)',   type: 'number', min: 0 },
  { key: 'spellDie',    label: 'Spell Die (MP per level)', type: 'number', min: 0 },
]

/** Default values for a blank new ClassDef. */
export function blankClass(id: string): ClassDef {
  return {
    id,
    name: 'New Class',
    icon: '🎓',
    color: '#8888aa',
    description: '',
    hitDie: 6,
    spellDie: 0,
    spellSchools: [],
    allowedEquip: ['weapon', 'body', 'ring', 'amulet'],
    weaponKinds: [],
    attrGrowth: {},
    attrModifiers: {},
  }
}
