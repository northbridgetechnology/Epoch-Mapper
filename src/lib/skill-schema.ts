/**
 * FieldSchema for SkillDef — martial actives edited in Database → Skills.
 * The learn table renders as a nested list (class ref + level) via SchemaForm.
 */

import type { ClassDef, FieldSchema, SkillDef } from './engine-types'

export type SkillSort = 'class' | 'name'

const SKILL_TARGETS = [
  { value: 'enemy',      label: 'Enemy (single)' },
  { value: 'allEnemies', label: 'All Enemies' },
  { value: 'enemyRow',   label: 'Enemy Row' },
  { value: 'ally',       label: 'Ally (single)' },
  { value: 'allAllies',  label: 'All Allies' },
  { value: 'self',       label: 'Self' },
]


/** Group skills by the classes that learn them (a multi-class skill appears in
 *  every learning class's group, ordered by its learn level there); skills with
 *  no learn table land in an "Unassigned" group. 'name' = flat A→Z. View-only. */
export function skillGroups(skills: SkillDef[], classes: ClassDef[], sort: SkillSort): {
  groups?: { id: string; label: string; icon?: string; color?: string }[]
  rows: { skill: SkillDef; groupId?: string; key: string }[]
} {
  const byName = (a: SkillDef, b: SkillDef) => a.name.localeCompare(b.name)
  if (sort === 'name') {
    return { rows: [...skills].sort(byName).map(s => ({ skill: s, key: s.id })) }
  }
  const groups: { id: string; label: string; icon?: string; color?: string }[] = []
  const rows: { skill: SkillDef; groupId?: string; key: string }[] = []
  for (const cls of classes) {
    const lv = (s: SkillDef) => s.learn?.find(l => l.classId === cls.id)?.level ?? 99
    const members = skills
      .filter(s => s.learn?.some(l => l.classId === cls.id))
      .sort((a, b) => lv(a) - lv(b) || byName(a, b))
    if (members.length === 0) continue
    groups.push({ id: cls.id, label: cls.name, icon: cls.icon, color: cls.color })
    rows.push(...members.map(s => ({ skill: s, groupId: cls.id, key: `${cls.id}_${s.id}` })))
  }
  const unassigned = skills.filter(s => !s.learn?.length).sort(byName)
  if (unassigned.length > 0) {
    groups.push({ id: '_unassigned', label: 'Unassigned' })
    rows.push(...unassigned.map(s => ({ skill: s, groupId: '_unassigned', key: `u_${s.id}` })))
  }
  return { groups, rows }
}

export const SKILL_SCHEMA: FieldSchema[] = [
  { key: 'name',        label: 'Name',        type: 'text' },
  { key: 'icon',        label: 'Icon',        type: 'icon',  optional: true },
  { key: 'color',       label: 'Color',       type: 'color', optional: true },
  { key: 'description', label: 'Description', type: 'textarea', optional: true },
  { key: 'hpCostPct',   label: 'HP Cost (fraction of max HP, e.g. 0.1 = 10%)', type: 'number', min: 0, max: 1, optional: true },
  { key: 'mpCost',      label: 'MP Cost',     type: 'number', min: 0, max: 999, optional: true },
  { key: 'cooldown',    label: 'Cooldown (battle rounds)', type: 'number', min: 0, max: 99, optional: true },
  { key: 'ammoCost',    label: 'Ammo cost (rounds spent; blank = no ammo)', type: 'number', min: 0, max: 99, optional: true },
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
