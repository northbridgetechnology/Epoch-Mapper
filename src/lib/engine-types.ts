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
  | { t: 'runEvent'; event: DefRef<EventDef> }
  | { t: 'questStage'; quest: DefRef<QuestDef>; stage: number }
  | { t: 'moveNpc'; npc: DefRef<NpcDef>; mapId?: string; x: number; y: number }

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
  /** Gate for boss phases: the ability is only usable when ALL hold.
   *  selfHpBelow is a fraction of max HP (0.5 = below half). */
  when?: { selfHpBelow?: number; roundAtLeast?: number }
}

export interface EnemyDef extends Definition {
  hp: number
  attributes: Partial<Record<string, number>>
  attack: number
  defense: number
  speed: number
  resistances?: Partial<Record<DamageType, number>>
  /** Combat AI: how this enemy picks its victim (default 'random') */
  targeting?: 'random' | 'weakest'
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

/** Reusable named event in the global library (Database workspace).
 *  'manual' events run only when invoked via a runEvent effect;
 *  'onFlag' events auto-fire when their conditions newly pass. */
export interface EventDef extends Definition {
  trigger?: 'manual' | 'onFlag'
  conditions?: Condition[]
  effects: Effect[]
  once?: boolean
}

/** One thing an NPC can say. The highest-priority line whose conditions pass
 *  is spoken on interact; bark lines instead play when the NPC comes into view. */
export interface NpcLine {
  id: string
  /** Pages of text, advanced one at a time. */
  text: string[]
  conditions?: Condition[]
  priority?: number
  once?: boolean
  /** Plays automatically when the NPC enters the player's view. */
  bark?: boolean
  /** Applied after the final page is dismissed. */
  effects?: Effect[]
}

/** A character-shaped NPC. Stats mirror the player Character model so NPCs
 *  can later fight, join the party, or trade without a schema change. */
export interface NpcDef extends Definition {
  portrait?: string
  classId?: DefRef<ClassDef>
  raceId?: DefRef<RaceDef>
  level?: number
  attributes?: Record<string, number>
  equipment?: Partial<Record<ItemSlot, ItemInstance>>
  knownSpells?: DefRef<SpellDef>[]
  lines: NpcLine[]
}

export interface QuestStage {
  id: string
  /** Journal text shown while this is the current stage. */
  description: string
  /** Applied when the quest advances TO this stage. */
  effects?: Effect[]
}

/** Quest state lives in save flags as `quest.<id>.stage` (1-based); the quest
 *  is complete when the stage reaches stages.length. */
export interface QuestDef extends Definition {
  stages: QuestStage[]
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

/** Combat constants tunable per game — engine falls back to classic defaults. */
export interface CombatTuning {
  critChance?: number            // default 0.10
  critMult?: number              // default 1.5
  baseMissChance?: number        // default 0.05
  outmatchedMissChance?: number  // default 0.25 (defense > attack × 1.5)
  variance?: number              // default 0.3 (damage spread fraction)
  defendMult?: number            // default 0.5 (damage taken while defending)
  backRankMeleeMult?: number     // default 0.5 (per back rank, dealt and taken)
  fleeBase?: number              // default 0.5
  fleeSpeedFactor?: number       // default 0.04 (per point of speed advantage)
  fleeRetryBonus?: number        // default 0.2 (per failed attempt)
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
  events: EventDef[]
  npcs: NpcDef[]
  quests: QuestDef[]
  formulas?: FormulaOverrides
  combatTuning?: CombatTuning
}

// ── L2: Cell entities (world placement) ──────────────────────────────────────

/** An interactive object placed on a cell (chest, door, NPC, shop, lever, etc.). */
export interface ObjectInstance {
  kind: 'chest' | 'door' | 'lever' | 'sign' | 'npc' | 'shop' | 'trap' | 'teleporter'
  id: string
  /** For kind 'npc': the NpcDef this placement represents. */
  npc?: DefRef<NpcDef>
  locked?: { key: DefRef<ItemDef> }
  loot?: DefRef<LootTableDef>
  shop?: DefRef<ShopDef>
  dialogue?: string
  trapEffects?: Effect[]
  onInteract?: Effect[]
}

/** A condition gate for CellEvent.conditions — ALL must pass for the event to fire. */
export type Condition =
  | { c: 'flag'; flag: string; equals: boolean | number | string }
  | { c: 'hasItem'; item: DefRef<ItemDef>; qty?: number }
  | { c: 'partyLevel'; min: number }
  | { c: 'random'; chance: number }
  | { c: 'questStage'; quest: DefRef<QuestDef>; min?: number; equals?: number }

/** A trigger + conditions + effects triple placed on a cell. */
export interface CellEvent {
  id: string
  /** Author-facing label for organisation. */
  name?: string
  /** onFlag events fire when their conditions NEWLY pass after a flag write. */
  trigger: 'onEnter' | 'onInteract' | 'onFlag'
  conditions?: Condition[]
  effects: Effect[]
  once?: boolean
}

/**
 * Entities placed on a map cell by the author.
 * Stored in CellData.entities[]. Evaluated by the engine on step.
 */
export type CellEntity =
  | {
      t: 'encounter'
      table: DefRef<EncounterTableDef>
      mode: 'fixed' | 'zone'
      /** Per-step trigger probability for zone encounters (0–1, default 0.1). */
      rate?: number
      /** If true, can only trigger once; self-sets a flag after firing. */
      oncePerVisit?: boolean
    }
  | { t: 'partyStart' }
  | { t: 'mapLink'; mapId: string; x: number; y: number; facing?: Facing }
  | { t: 'object'; object: ObjectInstance }
  | { t: 'event'; event: CellEvent }

// ── Runtime encounter instances ────────────────────────────────────────────────

/** A single live enemy during an encounter. */
export interface EnemyInstance {
  defId: DefRef<EnemyDef>
  name: string
  icon?: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  xp: number
  gold: number
}

/** Result of resolving an encounter table roll. */
export interface ResolvedEncounter {
  tableId: string
  tableName: string
  enemies: EnemyInstance[]
  goldReward: number
  xpReward: number
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

// ── Boundary system ─────────────────────────────────────────────────────────────

export type DoorState = 'open' | 'closed' | 'locked'

export interface DoorDef {
  state: DoorState
  keyItem?: DefRef<ItemDef>
  /** Legacy single-flag requirement — treated as requiredFlags[0]. */
  keyFlag?: string
  /** Switch-puzzle lock: sealed until ALL these flags are truthy, then held
   *  open (and re-seals live if a toggle switch turns one off). A carried
   *  keyItem still opens the door permanently as a bypass. */
  requiredFlags?: string[]
  toggleFlag?: string
  oneWay?: boolean
}

/** A lever mounted on one face of a wall boundary. Interacting from the
 *  mounted side toggles (or latches) its flag. */
export interface SwitchDef {
  id: string
  /** Save-state flag this switch drives. */
  flag: string
  /** 'toggle' flips freely; 'once' latches on and stays on. */
  mode: 'toggle' | 'once'
  /** Compass direction the switch face points — i.e. toward the cell it is
   *  usable/visible from. A switch on the N edge of a cell that should be
   *  used from that cell faces S. */
  facing: import('./types').EdgeDir
}

/**
 * Data stored on the "line" between two adjacent cells (canonical key from boundaryKey()).
 * Replaces the old per-cell `edges` record.
 */
export interface BoundaryData {
  /** Visual wall type ID matching EDGE_TYPES (0=standard wall, 1=locked-door, etc). */
  wall?: number
  door?: DoorDef
  /** Wall-mounted lever (see SwitchDef). */
  switch?: SwitchDef
  secret?: boolean
  revealFlag?: string
  blocked?: boolean
  onPass?: Effect[]
  onPassOnce?: boolean
  passedFlag?: string
  damage?: { dice: Dice; type?: DamageType }
  label?: string
}
