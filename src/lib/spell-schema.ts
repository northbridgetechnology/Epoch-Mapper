import type { SpellDef, SpellSchoolDef, StatusEffectDef, FieldSchema } from './engine-types'

const SPELL_TARGETS = [
  { value: 'enemy',      label: 'Enemy (single)' },
  { value: 'allEnemies', label: 'All Enemies' },
  { value: 'enemyRow',   label: 'Enemy Row' },
  { value: 'ally',       label: 'Ally (single)' },
  { value: 'allAllies',  label: 'All Allies' },
  { value: 'self',       label: 'Self' },
  { value: 'none',       label: 'None (utility)' },
]

const STATUS_KINDS = [
  { value: 'buff',    label: 'Buff' },
  { value: 'debuff',  label: 'Debuff' },
  { value: 'dot',     label: 'Damage over Time' },
  { value: 'hot',     label: 'Heal over Time' },
  { value: 'control', label: 'Control (stun/sleep)' },
]

export const SPELL_SCHEMA: FieldSchema[] = [
  { key: 'name',         label: 'Name',                type: 'text' },
  { key: 'icon',         label: 'Icon',                type: 'icon',    optional: true },
  { key: 'color',        label: 'Color',               type: 'color',   optional: true },
  { key: 'description',  label: 'Description',         type: 'textarea', optional: true },
  { key: 'school',       label: 'School',              type: { kind: 'ref', table: 'spellSchools' } },
  { key: 'level',        label: 'Min Level',           type: 'number',  min: 1, max: 99 },
  { key: 'mpCost',       label: 'MP Cost',             type: 'number',  min: 0, max: 999 },
  { key: 'target',       label: 'Target',              type: { kind: 'enum', options: SPELL_TARGETS } },
  { key: 'inCombat',     label: 'Usable in Combat',    type: 'boolean' },
  { key: 'outOfCombat',  label: 'Usable Exploring',    type: 'boolean' },
  { key: 'effects',      label: 'Effects',             type: 'effects' },
]

export const SPELL_SCHOOL_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'school.short_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'icon',        label: 'Icon',         type: 'icon',    optional: true },
  { key: 'color',       label: 'Color',        type: 'color',   optional: true },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
]

export function blankSpellSchool(id: string): SpellSchoolDef {
  return { id, name: 'New School', icon: '✨', color: '#8888aa', description: '' }
}

export const STATUS_SCHEMA: FieldSchema[] = [
  { key: 'name',          label: 'Name',                          type: 'text' },
  { key: 'icon',          label: 'Icon',                          type: 'icon',    optional: true },
  { key: 'color',         label: 'Color',                         type: 'color',   optional: true },
  { key: 'description',   label: 'Description',                   type: 'textarea', optional: true },
  { key: 'kind',          label: 'Kind',                          type: { kind: 'enum', options: STATUS_KINDS } },
  { key: 'durationTurns', label: 'Duration (turns, 0=permanent)', type: 'number',  min: 0, max: 99 },
  { key: 'blocksAction',  label: 'Blocks Action (stun/sleep)',    type: 'boolean' },
  { key: 'tickEffects',   label: 'Tick Effects (each turn)',      type: 'effects' },
  { key: 'persistsExploring',   label: 'Persists while exploring (ticks per step)', type: 'boolean', optional: true },
  { key: 'exploreStepInterval', label: 'Steps between exploration ticks',           type: 'number', min: 1, max: 99, optional: true },
]

export function blankSpell(id: string): SpellDef {
  return {
    id,
    name: 'New Spell',
    school: 'arcane',
    level: 1,
    mpCost: 4,
    target: 'enemy',
    inCombat: true,
    outOfCombat: false,
    effects: [],
  }
}

export function blankStatusEffect(id: string): StatusEffectDef {
  return {
    id,
    name: 'New Status',
    kind: 'debuff',
    durationTurns: 3,
    blocksAction: false,
  }
}
