/**
 * FieldSchema definitions for NpcDef, EventDef, and QuestDef database tables.
 * Lines, conditions/effects, and stages get bespoke editors in the workspace.
 */

import type { FieldSchema, NpcDef, EventDef, QuestDef } from './engine-types'

export const NPC_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text',    placeholder: 'npc.short_name' },
  { key: 'name',        label: 'Name',        type: 'text' },
  { key: 'portrait',    label: 'Portrait',    type: 'icon',    optional: true },
  { key: 'sprite',      label: 'Sprite',      type: 'text',    optional: true, placeholder: 'auto — or e.g. cr_hermit' },
  { key: 'color',       label: 'Color',       type: 'color',   optional: true },
  { key: 'description', label: 'Description', type: 'textarea', optional: true },
  { key: 'level',       label: 'Level',       type: 'number',  min: 1, optional: true },
]

export const EVENT_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text', placeholder: 'ev.short_name' },
  { key: 'name',        label: 'Name',        type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea', optional: true },
  {
    key: 'trigger',
    label: 'Trigger',
    type: { kind: 'enum', options: [
      { value: 'manual', label: 'Manual (via Run Event)' },
      { value: 'onFlag', label: 'On Flag (reactive)' },
    ] },
  },
  { key: 'once', label: 'Fire Once', type: 'boolean' },
]

export const QUEST_SCHEMA: FieldSchema[] = [
  { key: 'id',          label: 'ID',          type: 'text', placeholder: 'q.short_name' },
  { key: 'name',        label: 'Name',        type: 'text' },
  { key: 'icon',        label: 'Icon',        type: 'icon', optional: true },
  { key: 'description', label: 'Description', type: 'textarea', optional: true },
]

export function blankNpc(id: string): NpcDef {
  return {
    id,
    name: 'New NPC',
    portrait: '🧙',
    description: '',
    level: 1,
    attributes: {},
    lines: [],
  } as NpcDef
}

export function blankEventDef(id: string): EventDef {
  return { id, name: 'New Event', description: '', trigger: 'manual', effects: [], once: false } as EventDef
}

export function blankQuest(id: string): QuestDef {
  return {
    id,
    name: 'New Quest',
    description: '',
    stages: [{ id: 's1', description: 'First objective…' }],
  } as QuestDef
}
