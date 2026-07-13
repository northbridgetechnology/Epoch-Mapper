/**
 * FieldSchema for SkillDef — martial actives edited in Database → Skills.
 * The learn table renders as a nested list (class ref + level) via SchemaForm.
 */

import type { FieldSchema, SkillDef } from './engine-types'

const SKILL_TARGETS = [
  { value: 'enemy',      label: 'Enemy (single)' },
  { value: 'allEnemies', label: 'All Enemies' },
  { value: 'enemyRow',   label: 'Enemy Row' },
  { value: 'ally',       label: 'Ally (single)' },
  { value: 'allAllies',  label: 'All Allies' },
  { value: 'self',       label: 'Self' },
]

export const SKILL_SCHEMA: FieldSchema[] = [
  { key: 'name',        label: 'Name',        type: 'text' },
  { key: 'icon',        label: 'Icon',        type: 'icon',  optional: true },
  { key: 'color',       label: 'Color',       type: 'color', optional: true },
  { key: 'description', label: 'Description', type: 'textarea', optional: true },
  { key: 'hpCostPct',   label: 'HP Cost (fraction of max HP, e.g. 0.1 = 10%)', type: 'number', min: 0, max: 1, optional: true },
  { key: 'mpCost',      label: 'MP Cost',     type: 'number', min: 0, max: 999, optional: true },
  { key: 'cooldown',    label: 'Cooldown (battle rounds)', type: 'number', min: 0, max: 99, optional: true },
  { key: 'target',      label: 'Target',      type: { kind: 'enum', options: SKILL_TARGETS } },
  { key: 'effects',     label: 'Effects',     type: 'effects' },
  {
    key: 'learn',
    label: 'Learned By (class + level)',
    type: { kind: 'list', itemSchema: [
      { key: 'classId', label: 'Class', type: { kind: 'ref', table: 'classes' } },
      { key: 'level',   label: 'At Level', type: 'number', min: 1, max: 99 },
    ] },
    optional: true,
  },
]

export function blankSkill(id: string): SkillDef {
  return { id, name: 'New Skill', icon: '💥', color: '#c0392b', description: '', target: 'enemy', effects: [] }
}
