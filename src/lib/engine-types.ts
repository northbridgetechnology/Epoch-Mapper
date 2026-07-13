/**
 * Epoch Engine — Layer 1, 2, and 3 type definitions.
 * Pure types — no DOM, no React. Safe to import in Node/server contexts.
 *
 * L1 = Ruleset (content definitions, authored)
 * L2 = World placement (entities on cells, authored)  [future: CellData.entities]
 * L3 = Runtime save state (mutated while playing, never written into .epochmap)
 */

import { evalFormula } from './formula'

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
/** Equip weight tier for weapons and armor (FF-style class proficiency). */
export type EquipWeight = 'heavy' | 'medium' | 'light'

/** Combat turn system for a map:
 *  - 'classic'   = speed-ordered round-robin, one action per actor per round.
 *  - 'oneMore'   = Persona-style: landing a weakness or crit grants the acting
 *                  actor one bonus action (no turn-icon accounting).
 *  - 'pressTurn' = SMT-style side phases with a turn-icon economy: weakness/crit
 *                  spend a half-icon (a bonus press), miss/null/repel burn extra
 *                  icons, and the side acts until its icons run out. */
export type CombatMode = 'classic' | 'oneMore' | 'pressTurn'
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
  /** Reveal every unidentified item the party carries. */
  | { t: 'identify' }
  /** Unweld all cursed equipment across the party (returned to inventory). */
  | { t: 'removeCurse' }
  /** Teach the target character a spell (scrolls, trainers). */
  | { t: 'teachSpell'; spell: DefRef<SpellDef> }
  /** Roll credits: ends the game with optional epilogue text. */
  | { t: 'gameEnd'; text?: string }
  /** Recruit an NPC into the party (dialogue "will you join me?", quest reward). */
  | { t: 'recruit'; npc: DefRef<NpcDef> }

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
  /** Schools this class may learn/cast from (SpellSchoolDef ids). Empty = all. */
  spellSchools: DefRef<SpellSchoolDef>[]
  allowedEquip: ItemSlot[]
  /** Weapon types this class is proficient with (WeaponTypeDef ids).
   *  Empty = no per-type restriction (any weapon type). */
  weaponTypes: DefRef<WeaponTypeDef>[]
  /** Armor types this class may wear (ArmorTypeDef ids).
   *  Absent/empty = no per-type restriction (any armor type). */
  armorTypes?: DefRef<ArmorTypeDef>[]
  startingSpells?: DefRef<SpellDef>[]
  /** Automatic per-level attribute growth (applied on level-up, clamped to
   *  each attribute's max). Keys may be full ids ('attr.might') or short. */
  attrGrowth: Partial<Record<string, number>>
  attrModifiers: Partial<Record<string, number>>
  /** Player-allocated attribute points granted each level-up (banked into
   *  Character.unspentPoints, spent in the in-game Status screen). Default 0. */
  levelPoints?: number
}

/** A weapon archetype (sword, bow, staff…). Individual weapon items reference
 *  a type by id; the type carries the shared, category-level behaviour that
 *  feeds both equip-gating and combat. */
export interface WeaponTypeDef extends Definition {
  /** Weight tier — every weapon of this type shares it (gated per class). */
  weight: EquipWeight
  /** Attribute id whose value scales this weapon's basic-attack damage
   *  (e.g. 'attr.might' for swords, 'attr.agility' for bows). */
  scalingAttr: string
  /** Damage element dealt on a basic attack. Individual items may override. */
  damageType: DamageType
  /** Melee weapons take/deal back-rank penalties; ranged ignore them. */
  range: 'melee' | 'ranged'
}

/** An armor archetype (light armor, plate, robe, shield…). Armor items
 *  reference a type by id; the type carries the shared weight tier and any
 *  passive combat effect (e.g. heavy armor's initiative penalty). */
export interface ArmorTypeDef extends Definition {
  /** Weight tier — every piece of this type shares it (gated per class). */
  weight: EquipWeight
  /** Flat speed/initiative modifier while any piece of this type is worn
   *  (heavy armor is typically negative). Absent = 0. */
  speedMod?: number
}

export interface RaceDef extends Definition {
  attrModifiers: Partial<Record<string, number>>
  resistances?: Partial<Record<DamageType, number>>
  traits?: string[]
}

export interface ItemDef extends Definition {
  kind: ItemKind
  slot?: ItemSlot
  /** Weapons: the WeaponTypeDef this item belongs to (drives weight, scaling,
   *  damage element, range, and class proficiency). */
  weaponType?: DefRef<WeaponTypeDef>
  /** Armor: the ArmorTypeDef this item belongs to (drives weight, passive
   *  effects, and class proficiency). */
  armorType?: DefRef<ArmorTypeDef>
  /** Weapons: overrides the weapon type's damage element for this item only
   *  (e.g. a Flamebrand sword that deals fire). Absent = the type's default. */
  damageType?: DamageType
  modifiers?: StatModifier[]
  onUse?: Effect[]
  value: number
  stackable: boolean
  twoHanded?: boolean
  charges?: number
  /** Light shed while equipped (view distance in cells on dark maps). */
  lightRadius?: number
  /** Optional burn-down: the item is consumed after this many steps of being
   *  equipped (classic torch pressure). Absent = burns forever. */
  burnSteps?: number
  /** When set, loot drops of this item arrive unidentified and show this
   *  name ("?Sword") until identified (by spell, service, or equipping it). */
  unidentifiedName?: string
  /** Cursed: once equipped it cannot be removed until a removeCurse effect. */
  cursed?: boolean
}

/** A school of magic (arcane, divine…). Spells belong to a school; classes
 *  list the schools they may learn/cast from. */
export interface SpellSchoolDef extends Definition {
  /** Attribute id whose value scales this school's spell damage/healing
   *  (+1 power per 2 points above 10). Absent = flat dice (no scaling). */
  keyAttribute?: string
}

export interface SpellDef extends Definition {
  school: DefRef<SpellSchoolDef>
  level: number
  mpCost: number
  target: SpellTarget
  inCombat: boolean
  outOfCombat: boolean
  effects: Effect[]
  /** Auto-learned when a character of classId reaches level. */
  learn?: { classId: DefRef<ClassDef>; level: number }[]
}

export interface StatusEffectDef extends Definition {
  kind: 'buff' | 'debuff' | 'dot' | 'hot' | 'control'
  durationTurns: number
  modifiers?: StatModifier[]
  tickEffects?: Effect[]
  blocksAction?: boolean
  /** When true, this status also ticks and counts down while walking the
   *  dungeon (e.g. poison bites every step). Absent = combat-only. */
  persistsExploring?: boolean
  /** Steps between exploration ticks when persistsExploring (default 1). */
  exploreStepInterval?: number
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
  /** Custom battle music for this specific fight (AudioTrackDef id). Overrides
   *  the generic battle/boss track. Absent = use the global battle/boss track. */
  musicId?: DefRef<AudioTrackDef>
  /** Marks this as a boss fight — resolves to the global boss track (and, on
   *  the map, may drive other boss-only behaviour later). */
  boss?: boolean
}

/** A looping background-music track. The bytes never live in the ruleset JSON:
 *  uploaded tracks are stored in IndexedDB (keyed by this id) and baked into the
 *  .epochmap on export; 'url' tracks stream from an external address. */
export interface AudioTrackDef extends Definition {
  /** 'upload' = blob in IndexedDB under this id (baked on export);
   *  'url' = streamed from `src`. */
  source: 'upload' | 'url'
  /** For 'url': the external address. For 'upload': the original filename
   *  (informational — the blob is keyed by id, not by this). */
  src?: string
  /** MIME type of an uploaded blob (e.g. 'audio/ogg'). Informational. */
  mime?: string
  /** Loop seamlessly (default true — it's background music). */
  loop?: boolean
  /** Baseline gain 0..1 applied before the player's master volume (default 1). */
  volume?: number
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
  /** Built-in pixel sprite kind override; falls back to keyword matching on id/name. */
  sprite?: string
  classId?: DefRef<ClassDef>
  raceId?: DefRef<RaceDef>
  level?: number
  attributes?: Record<string, number>
  equipment?: Partial<Record<ItemSlot, ItemInstance>>
  knownSpells?: DefRef<SpellDef>[]
  lines: NpcLine[]
  /** Can join the party (via a `recruit` effect). Placements vanish once recruited. */
  recruitable?: boolean
  /** Instantiated into the party at New Game (alongside the player's Main Character). */
  startsInParty?: boolean
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
  /** Camp/rest: fraction of max HP/MP restored (default 1 = full). */
  restHpFrac?: number
  restMpFrac?: number
  /** Chance a rest is interrupted by the cell's zone encounter (default 0.25). */
  restAmbushChance?: number
  /** Where saving is allowed during play (default 'anywhere'). */
  savePolicy?: 'anywhere' | 'savePoints'
  /** Fraction of gold lost when respawning after a party wipe (default 0.5). */
  wipeGoldPenalty?: number
  /** Opening story shown once on New Game (before the character builder). */
  opening?: OpeningStory
  /** Who owns the party: 'fixed' = author ships it; 'customMc' = the player
   *  builds their protagonist and starts solo (default 'customMc'). */
  partyCreation?: 'fixed' | 'customMc'
  /** SMT/Wizardry rule: the game ends the moment the Main Character dies,
   *  even if other party members still stand. */
  mcDeathEndsGame?: boolean
  /** How the builder allocates attributes (default 'pointBuy'). */
  attrMethod?: 'fixed' | 'pointBuy'
  /** Points the player distributes in point-buy (default 10). */
  pointBuyPool?: number
  /** Default background track (AudioTrackDef id) — plays on the title screen
   *  and on any map without its own musicId. */
  defaultMusicId?: DefRef<AudioTrackDef>
  /** Generic battle track — plays for normal encounters. */
  battleMusicId?: DefRef<AudioTrackDef>
  /** Generic boss track — plays for encounters flagged boss (unless the
   *  encounter carries its own custom musicId). */
  bossMusicId?: DefRef<AudioTrackDef>
}

/** A short, paced intro shown once when starting a new game. */
export interface OpeningStory {
  slides: { text: string; image?: string }[]
  /** Allow Esc to skip (default true). */
  skippable?: boolean
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
  weaponTypes: WeaponTypeDef[]
  armorTypes: ArmorTypeDef[]
  spellSchools: SpellSchoolDef[]
  audioTracks: AudioTrackDef[]
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
  kind: 'chest' | 'door' | 'lever' | 'sign' | 'npc' | 'shop' | 'trap' | 'teleporter' | 'inn'
  /** For kind 'inn': cost in gold for a full heal/cure/revive (default 0 = free). */
  price?: number
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
/** Classic dungeon trick tiles — invisible cell mechanics applied on entry
 *  (or, for the zone kinds, while standing on the cell). */
export type TrickKind = 'spinner' | 'pit' | 'silentTeleport' | 'antiMagic' | 'darkness' | 'safeRoom'

export type CellEntity =
  | {
      t: 'trick'
      kind: TrickKind
      /** spinner: how the party is rotated on entry (default 'random'). */
      rotate?: 'random' | 'left' | 'right' | 'reverse'
      /** pit: fall damage dice rolled once and applied to each party member. */
      damage?: Dice
      /** pit / silentTeleport destination. Pit default: next map in the session
       *  at the same coordinates. silentTeleport default map: the current map. */
      mapId?: string
      x?: number
      y?: number
    }
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
  | {
      /** FOE-style patrolling super-enemy: visible on the playfield, moves one
       *  cell per player step along its route, fixed battle on contact. */
      t: 'foe'
      enemy: DefRef<EnemyDef>
      count?: number
      /** Route waypoints in map coordinates; the entity's own cell is the
       *  implicit first point. Empty/absent = stands still. */
      path?: { x: number; y: number }[]
      /** loop: wraps to the start; pingpong: walks the route back and forth. */
      mode?: 'loop' | 'pingpong'
    }
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
  /** True until the item is identified (defs with unidentifiedName only). */
  unidentified?: boolean
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
  /** Portrait: a built-in portrait id (see portraits.tsx) or an uploaded data-URI. */
  portrait?: string
  /** The one player-built protagonist. Drives text tokens, undismissable slot,
   *  and (with meta.mcDeathEndsGame) the game-over rule. */
  isMc?: boolean
  /** Grammatical pronoun set for authored-text substitution. */
  pronoun?: Pronoun
  /** Optional backstory shown in the Journal. */
  bio?: string
  /** The NpcDef this party member was recruited/instantiated from (if any). */
  sourceNpc?: string
  /** Banked level-up points awaiting allocation (ClassDef.levelPoints). */
  unspentPoints?: number
}

export type Pronoun = 'he' | 'she' | 'they'

export interface Formation {
  front: number[]
  back: number[]
}

export interface SaveState {
  rulesetVersion: string
  mapHash: string
  position: { mapId: string; x: number; y: number; facing: Facing }
  party: Character[]
  /** Benched members — kept on the roster, hidden from the world, re-fieldable. */
  reserve?: Character[]
  formation: Formation
  gold: number
  sharedInventory: ItemInstance[]
  flags: Record<string, boolean | number | string>
  revealed: Record<string, string[]>
  /** Per-map exploration reveal for the minimap (`mapId → "x,y"[]`). */
  seen?: Record<string, string[]>
  /** Revealed boundary keys (illusory walls etc). */
  revealedBoundaries?: string[]
  rngSeed: number
  playtimeMs: number
  /** Total steps walked this playthrough — drives exploration pressure. */
  stepsTaken?: number
}

// ── Derived-stat helpers (formulas §6.3) ──────────────────────────────────────

/** Attribute maps are keyed inconsistently across the codebase — runtime
 *  characters use full ids ('attr.might'), some fixtures use short ('might').
 *  Read robustly under either key. */
export function readAttribute(attributes: Record<string, number>, shortName: string, fallback: number): number {
  return attributes[shortName] ?? attributes[`attr.${shortName}`] ?? fallback
}

export function deriveMaxHp(character: Pick<Character, 'level' | 'attributes'>, cls: ClassDef): number {
  return cls.hitDie * character.level + readAttribute(character.attributes, 'endurance', 10) * 2
}

export function deriveMaxMp(character: Pick<Character, 'level' | 'attributes'>, cls: ClassDef): number {
  const int = readAttribute(character.attributes, 'intellect', 0)
  const spi = readAttribute(character.attributes, 'spirit', 0)
  return cls.spellDie * character.level + Math.max(int, spi)
}

/** XP required to advance from `level`. Authors may override the curve with
 *  Ruleset.formulas.xpToNext (variable: `level`, e.g. "50 * level ^ 1.5");
 *  invalid formulas fall back to the built-in curve. */
export function xpToNextLevel(level: number, formula?: string): number {
  if (formula) {
    const v = evalFormula(formula, { level })
    if (v !== undefined && v > 0) return Math.round(v)
  }
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
  /** Pixel-sprite picker: built-in kind name or an uploaded PNG stored as a data URI. */
  | 'sprite'

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
/** Text carved into one face of a wall — the EotB storytelling staple.
 *  Read by interacting while facing the wall from the mounted side. */
export interface InscriptionDef {
  /** Pages of text, advanced one at a time. */
  text: string[]
  /** Compass direction the inscribed face points (same convention as
   *  SwitchDef.facing). Absent = readable from both sides. */
  facing?: import('./types').EdgeDir
}

export interface BoundaryData {
  /** Visual wall type ID matching EDGE_TYPES (0=standard wall, 1=locked-door, etc). */
  wall?: number
  door?: DoorDef
  /** Wall-mounted lever (see SwitchDef). */
  switch?: SwitchDef
  /** Text carved into the wall face (see InscriptionDef). */
  inscription?: InscriptionDef
  secret?: boolean
  revealFlag?: string
  blocked?: boolean
  onPass?: Effect[]
  onPassOnce?: boolean
  passedFlag?: string
  damage?: { dice: Dice; type?: DamageType }
  label?: string
}
