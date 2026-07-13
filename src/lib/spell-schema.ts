import type { SpellDef, SpellSchoolDef, StatusEffectDef, FieldSchema } from './engine-types'

export type SpellSort = 'school' | 'level' | 'mp' | 'name'

const SPELL_TARGETS = [
  { value: 'enemy',      label: 'Enemy (single)' },
  { value: 'allEnemies', label: 'All Enemies' },
  { value: 'enemyRow',   label: 'Enemy Row' },
  { value: 'ally',       label: 'Ally (single)' },
  { value: 'allAllies',  label: 'All Allies' },
  { value: 'self',       label: 'Self' },
  { value: 'none',       label: 'None (utility)' },
]

export const STATUS_KINDS = [
  { value: 'buff',    label: 'Buff' },
  { value: 'debuff',  label: 'Debuff' },
  { value: 'dot',     label: 'Damage over Time' },
  { value: 'hot',     label: 'Heal over Time' },
  { value: 'control', label: 'Control (stun/sleep)' },
]


/** The level a spell is actually acquired: the earliest learn-table entry,
 *  falling back to the authored spell.level field. */
export function spellLearnLevel(s: SpellDef): number {
  if (s.learn?.length) return Math.min(...s.learn.map(l => l.level))
  return s.level ?? 99
}

/** View-only sort for spell lists (never reorder the ruleset array itself). */
export function sortSpells(spells: SpellDef[], sort: SpellSort, schools: SpellSchoolDef[]): SpellDef[] {
  const schoolOrder = (id: string) => { const i = schools.findIndex(sc => sc.id === id); return i < 0 ? 999 : i }
  const byName = (a: SpellDef, b: SpellDef) => a.name.localeCompare(b.name)
  const arr = [...spells]
  switch (sort) {
    case 'school': return arr.sort((a, b) => schoolOrder(a.school) - schoolOrder(b.school) || spellLearnLevel(a) - spellLearnLevel(b) || byName(a, b))
    case 'level':  return arr.sort((a, b) => spellLearnLevel(a) - spellLearnLevel(b) || byName(a, b))
    case 'mp':     return arr.sort((a, b) => a.mpCost - b.mpCost || byName(a, b))
    case 'name':   return arr.sort(byName)
  }
}


export type StatusSort = 'kind' | 'duration' | 'name'

/** View-only sort for the status-effect list (never reorders the ruleset). */
export function sortStatuses(list: StatusEffectDef[], sort: StatusSort): StatusEffectDef[] {
  const kindOrder = (k: string) => { const i = STATUS_KINDS.findIndex(o => o.value === k); return i < 0 ? 999 : i }
  const byName = (a: StatusEffectDef, b: StatusEffectDef) => a.name.localeCompare(b.name)
  const arr = [...list]
  switch (sort) {
    case 'kind':     return arr.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || byName(a, b))
    case 'duration': return arr.sort((a, b) => a.durationTurns - b.durationTurns || byName(a, b))
    case 'name':     return arr.sort(byName)
  }
}

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
  { key: 'modifiers',     label: 'Stat Modifiers (while active — buffs/debuffs)', type: 'modifiers', optional: true },
  { key: 'tickEffects',   label: 'Tick Effects (each turn)',      type: 'effects' },
  { key: 'boostScope',    label: 'Charge: boosts next…', type: { kind: 'enum', options: [
    { value: '', label: '— no charge effect —' },
    { value: 'physical', label: 'Physical (attacks & skills)' },
    { value: 'magical',  label: 'Magical (spells)' },
    { value: 'any',      label: 'Any damage' },
  ] }, optional: true },
  { key: 'boostMult',     label: 'Charge multiplier (e.g. 2 = double)', type: 'number', min: 1, max: 10, optional: true },
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
