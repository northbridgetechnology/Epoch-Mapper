/**
 * FieldSchema definitions for EnemyDef and EncounterTableDef database tables,
 * plus pure helpers for the bestiary's duplicate / Make-Elite actions.
 */

import type { EnemyDef, FieldSchema } from './engine-types'

export const ENEMY_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'enemy.short_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'icon',        label: 'Icon',         type: 'icon',    optional: true },
  { key: 'sprite',      label: 'Sprite',       type: 'sprite',  optional: true, placeholder: 'auto — or e.g. cr_demon' },
  { key: 'color',       label: 'Color',        type: 'color',   optional: true },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
  { key: 'hp',      label: 'HP',      type: 'number', min: 1 },
  { key: 'attack',  label: 'Attack',  type: 'number', min: 0 },
  { key: 'defense', label: 'Defense', type: 'number', min: 0 },
  { key: 'speed',   label: 'Speed',   type: 'number', min: 1 },
  { key: 'xp',     label: 'XP Reward',        type: 'number', min: 0 },
  {
    key: 'targeting',
    label: 'Targeting AI',
    type: { kind: 'enum', options: [{ value: 'random', label: 'Random' }, { value: 'weakest', label: 'Weakest first' }] },
    optional: true,
  },
  { key: 'loot', label: 'Loot Table', type: { kind: 'ref', table: 'lootTables' }, optional: true },
  {
    key: 'size',
    label: 'Size',
    type: { kind: 'enum', options: [{ value: '1', label: '1 — Standard' }, { value: '2', label: '2 — Large (front+back row)' }] },
    optional: true,
  },
]

export const ENCOUNTER_TABLE_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text', placeholder: 'enc.table_name' },
  { key: 'name',        label: 'Name',         type: 'text' },
  { key: 'description', label: 'Description',  type: 'textarea', optional: true },
]

export function blankEnemy(id: string): Record<string, unknown> {
  return {
    id,
    name: 'New Enemy',
    icon: '👾',
    color: '#c0392b',
    description: '',
    hp: 20,
    attack: 8,
    defense: 4,
    speed: 5,
    xp: 10,
    gold: { min: 0, max: 5 },
    size: '1',
  }
}

export function blankEncounterTable(id: string): Record<string, unknown> {
  return { id, name: 'New Encounter Table', description: '', entries: [] }
}

// ── Duplicate / Elite ────────────────────────────────────────────────────────────

function uniqueEnemyId(base: string, existingIds: string[]): string {
  if (!existingIds.includes(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`
    if (!existingIds.includes(candidate)) return candidate
  }
}

/** Deep copy of an enemy under a fresh id — the starting point for a variant.
 *  Abilities/resistances/gold are cloned so edits never bleed into the source. */
export function duplicateEnemy(def: EnemyDef, existingIds: string[]): EnemyDef {
  return {
    ...structuredClone(def),
    id: uniqueEnemyId(`${def.id}_copy`, existingIds),
    name: `${def.name} (Copy)`,
  }
}

/** Standard elite promotion: ×1.5 HP, ×1.25 attack/defense, ×2 XP and gold.
 *  The kit (abilities, resistances, targeting) carries over unchanged. */
export function eliteEnemy(def: EnemyDef, existingIds: string[]): EnemyDef {
  return {
    ...structuredClone(def),
    id: uniqueEnemyId(`${def.id}_elite`, existingIds),
    name: `Elite ${def.name}`,
    hp: Math.max(1, Math.round(def.hp * 1.5)),
    attack: Math.round(def.attack * 1.25),
    defense: Math.round(def.defense * 1.25),
    xp: def.xp * 2,
    gold: { min: (def.gold?.min ?? 0) * 2, max: (def.gold?.max ?? 0) * 2 },
  }
}
