/**
 * Epoch Engine — Layer 1, 2, and 3 type definitions.
 * Pure types — no DOM, no React. Safe to import in Node/server contexts.
 *
 * L1 = Ruleset (content definitions, authored)
 * L2 = World placement (entities on cells, authored)  [future: CellData.entities]
 * L3 = Runtime save state (mutated while playing, never written into .epochmap)
 */

// ── Branded ref ────────────────────────────────────────────────────────────────

/** A stable string id referencing a definition in a specific table. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type DefRef<T> = string

// ── Shared leaf types ──────────────────────────────────────────────────────────

/** Damage types used by attacks, spells, and resistances. */
export type DamageType =
  | 'physical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'holy' | 'dark'

/** Dice notation: a flat number or string like "2d6" or "1d8+2". */
export type Dice = number | string

export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'feet' | 'ring' | 'amulet'
export type ItemKind = 'weapon' | 'armor' | 'consumable' | 'key' | 'quest' | 'misc'
export type SpellTarget =
  | 'self' | 'ally' | 'allAllies'
  | 'enemy' | 'allEnemies' | 'enemyRow'
  | 'none'

export type Facing = 'N' | 'S' | 'E' | 'W'

// ── Effect vocabulary (shared by items/spells/enemies/events) ─────────────────

export type Effect =
  | { t: 'damage'; dmgType: DamageType; amount: Dice; canCrit?: boolean }
  | { t: 'heal'; amount: Dice }
  | { t: 'restoreMp'; amount: Dice }
  | { t: 'status'; status: DefRef<StatusEffectDef>; chance?: number }
  | { t: 'cure'; status: DefRef<StatusEffectDef> | 'all' }
  | { t: 'reviveRandom' | 'fullHeal' }
  | { t: 'giveItem'; item: DefRef<ItemDef>; qty?: number }
  | { t: 'takeItem'; item: DefRef<ItemDef>; qty?: number }
  | { t: 'gold'; amount: number }
  | { t: 'setFlag'; flag: string; value: boolean | number | string }
  | { t: 'teleport'; mapId: string; x: number; y: number; facing?: Facing }
  | { t: 'startCombat'; encounter: DefRef<EncounterTableDef> }
  | { t: 'message'; text: string }
  | { t: 'openShop'; shop: DefRef<ShopDef> }
  | { t: 'dialogue'; node: string }
  | { t: 'reveal'; radius: number }

// ── Stat modifier ──────────────────────────────────────────────────────────────

export interface StatModifier {
  target: 'attribute' | 'derived'
  key: string
  op: 'add' | 'mul'
  amount: number
}

// ── Base definition shape ──────────────────────────────────────────────────────

export interface Definition {
  id: string
  name: string
  icon?: string
  color?: string
  description?: string
}

// ── L1: Ruleset definitions ────────────────────────────────────────────────────

export interface AttributeDef extends Definition {
  abbr: string
  min: number
  max: number
  default: number
}

export interface ClassDef extends Definition {
  hitDie: number
  spellDie: number
  spellSchools: string[]
  allowedEquip: ItemSlot[]
  weaponKinds: string[]
  startingSpells?: DefRef<SpellDef>[]
  attrGrowth: Partial<Record<string, number>>
  attrModifiers: Partial<Record<string, number>>
}

export interface RaceDef extends Definition {
  attrModifiers: Partial<Record<string, number>>
  resistances?: Partial<Record<DamageType, number>>
  traits?: string[]
}

export interface ItemDef extends Definition {
  kind: ItemKind
  slot?: ItemSlot
  weaponKind?: string
  modifiers?: StatModifier[]
  onUse?: Effect[]
  value: number
  stackable: boolean
  twoHanded?: boolean
  charges?: number
}

export interface SpellDef extends Definition {
  school: string
  level: number
  mpCost: number
  target: SpellTarget
  inCombat: boolean
  outOfCombat: boolean
  effects: Effect[]
}

export interface StatusEffectDef extends Definition {
  kind: 'buff' | 'debuff' | 'dot' | 'hot' | 'control'
  durationTurns: number
  modifiers?: StatModifier[]
  tickEffects?: Effect[]
  blocksAction?: boolean
}

export interface EnemyAbility {
  weight: number
  effects: Effect[]
  target: SpellTarget
  mpCost?: number
}

export interface EnemyDef extends Definition {
  hp: number
  attributes: Partial<Record<string, number>>
  attack: number
  defense: number
  speed: number
  resistances?: Partial<Record<DamageType, number>>
  abilities?: EnemyAbility[]
  xp: number
  gold: { min: number; max: number }
  loot?: DefRef<LootTableDef>
  sprite?: string
  size?: 1 | 2
}

export interface EncounterTableDef extends Definition {
  entries: { enemy: DefRef<EnemyDef>; min: number; max: number; weight: number }[]
}

export interface LootTableDef extends Definition {
  gold?: { min: number; max: number }
  drops: { item: DefRef<ItemDef>; qty?: Dice; chance: number }[]
}

export interface ShopDef extends Definition {
  buys: boolean
  sellModifier: number
  stock: { item: DefRef<ItemDef>; price?: number; qty?: number }[]
}

export interface GameMeta {
  title: string
  author?: string
  version: string
  startMapId: string
  startPosition: { x: number; y: number; facing: Facing }
  startingPartyId?: string
  partySize: number
  rows: number
  permadeath: boolean
  startingGold: number
}

export interface FormulaOverrides {
  maxHp?: string
  maxMp?: string
  attack?: string
  defense?: string
  initiative?: string
  meleeDamage?: string
  hitChance?: string
  critChance?: string
  xpToNext?: string
}

export interface Ruleset {
  meta: GameMeta
  attributes: AttributeDef[]
  classes: ClassDef[]
  races: RaceDef[]
  items: ItemDef[]
  spells: SpellDef[]
  statusEffects: StatusEffectDef[]
  enemies: EnemyDef[]
  encounterTables: EncounterTableDef[]
  lootTables: LootTableDef[]
  shops: ShopDef[]
  formulas?: FormulaOverrides
}

// ── L3: Runtime save state ─────────────────────────────────────────────────────

export interface ItemInstance {
  def: DefRef<ItemDef>
  qty: number
  charges?: number
}

export interface ActiveStatus {
  def: DefRef<StatusEffectDef>
  remaining: number
}

export interface Character {
  id: string
  name: string
  classId: DefRef<ClassDef>
  raceId: DefRef<RaceDef>
  level: number
  xp: number
  attributes: Record<string, number>
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  equipment: Partial<Record<ItemSlot, ItemInstance>>
  knownSpells: DefRef<SpellDef>[]
  statuses: ActiveStatus[]
  alive: boolean
  portrait?: string
}

export interface Formation {
  front: number[]
  back: number[]
}

export interface SaveState {
  rulesetVersion: string
  mapHash: string
  position: { mapId: string; x: number; y: number; facing: Facing }
  party: Character[]
  formation: Formation
  gold: number
  sharedInventory: ItemInstance[]
  flags: Record<string, boolean | number | string>
  revealed: Record<string, string[]>
  rngSeed: number
  playtimeMs: number
}

// ── Derived-stat helpers (formulas §6.3) ──────────────────────────────────────

export function deriveMaxHp(character: Pick<Character, 'level' | 'attributes'>, cls: ClassDef): number {
  return cls.hitDie * character.level + (character.attributes['endurance'] ?? 10) * 2
}

export function deriveMaxMp(character: Pick<Character, 'level' | 'attributes'>, cls: ClassDef): number {
  const int = character.attributes['intellect'] ?? 0
  const spi = character.attributes['spirit'] ?? 0
  return cls.spellDie * character.level + Math.max(int, spi)
}

export function xpToNextLevel(level: number): number {
  return Math.round(50 * Math.pow(level, 1.5))
}

// ── Schema-driven form field types ────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'color'
  | 'icon'
  | 'boolean'
  | { kind: 'enum'; options: { value: string; label: string }[] }
  | { kind: 'ref'; table: keyof Ruleset }
  | { kind: 'list'; itemSchema: FieldSchema[] }
  | 'dice'
  | 'effects'
  | 'modifiers'

export interface FieldSchema {
  key: string
  label: string
  type: FieldType
  optional?: boolean
  placeholder?: string
  min?: number
  max?: number
}
