/**
 * `@northbridgetechnology/epoch-mapper` — public package entry point.
 *
 * Consumers (such as Epoch) import the editor component, the PDF export pipeline,
 * the `.epochmap` binary codec, and all shared types from here.
 */

// Components
export { DungeonMapper, type DungeonMapperProps } from './components/DungeonMapper'
export { WelcomeModal } from './components/WelcomeModal'
export { CellTooltip } from './components/CellTooltip'
export { Toolbar } from './components/Toolbar'

// PDF export
export { exportMapsAsPdf } from './lib/dungeon-export'

// .epochmap codec
export {
  parseDotEpochmap,
  serializeDotEpochmap,
  EpochmapParseError,
  EPOCHMAP_MAGIC,
  EPOCHMAP_VERSION,
  hexToRgb,
  rgbToHex,
} from './lib/epochmap-codec'

// Custom-marker helpers (import conflict resolution, §5.3)
export { sameMarker, nextFreeMarkerId, resolveMarkerImport, remapMapMarkers } from './lib/markers'

// Built-in type tables & grid constants
export {
  BASE,
  OVERLAY,
  EDGE,
  BASE_TYPES,
  OVERLAY_TYPES,
  EDGE_TYPES,
  BASE_PALETTE,
  OVERLAY_PALETTE,
  EDGE_PALETTE,
  CHUNK_SIZE,
  VIEWPORT_CELLS,
  DEFAULT_CELL,
  CUSTOM_ID_MIN,
  CUSTOM_ID_MAX,
  MAX_NOTE_LEN,
  MAX_MARKER_LABEL_LEN,
  baseDef,
  overlayDef,
  edgeDef,
  isCustomId,
  boundaryKey,
} from './lib/constants'

// Types
export type {
  CellData,
  CellMap,
  MapData,
  CustomMarker,
  EpochmapFile,
  EdgeDir,
  MarkerDef,
} from './lib/types'

// Engine types (L1/L2/L3)
export type {
  AttributeDef,
  ClassDef,
  RaceDef,
  ItemDef,
  SpellDef,
  StatusEffectDef,
  EnemyDef,
  EncounterTableDef,
  LootTableDef,
  ShopDef,
  GameMeta,
  Ruleset,
  Character,
  Formation,
  SaveState,
  ItemInstance,
  ActiveStatus,
  Effect,
  DamageType,
  Dice,
  ItemSlot,
  ItemKind,
  SpellTarget,
  StatModifier,
  Definition,
  FieldSchema,
  FieldType,
} from './lib/engine-types'
export { deriveMaxHp, deriveMaxMp, xpToNextLevel } from './lib/engine-types'

// Default ruleset
export { makeDefaultRuleset, DEFAULT_ATTRIBUTES, DEFAULT_CLASSES, DEFAULT_RACES, DEFAULT_SPELLS, DEFAULT_STATUS_EFFECTS } from './lib/default-ruleset'

// .epochsave codec + party persistence
export {
  serializeSaveState,
  parseSaveState,
  downloadSaveState,
  saveToDraft,
  loadFromDraft,
  deleteDraft,
  savePartyTemplate,
  loadPartyTemplate,
  newSaveState,
  newCharacter,
  SaveStateParseError,
} from './lib/save-state'

// Schema-driven form generator
export { SchemaForm } from './components/forms/SchemaForm'

// Effect builder (Phase E2)
export { EffectBuilder } from './components/forms/EffectBuilder'

// Workspaces
export { PartyWorkspace } from './components/workspaces/PartyWorkspace'
export { DatabaseWorkspace } from './components/workspaces/DatabaseWorkspace'
export { PlayWorkspace } from './components/workspaces/PlayWorkspace'

// Item schema helpers
export { ITEM_SCHEMA, LOOT_TABLE_SCHEMA, blankItem, blankLootTable } from './lib/item-schema'

// Enemy + encounter-table schema helpers (Phase E3)
export { ENEMY_SCHEMA, ENCOUNTER_TABLE_SCHEMA, blankEnemy, blankEncounterTable } from './lib/enemy-schema'

// Spell + status-effect schema helpers (Phase E5)
export { SPELL_SCHEMA, STATUS_SCHEMA, blankSpell, blankStatusEffect } from './lib/spell-schema'

// Out-of-combat effect resolver
export { applyEffectToChar, applyConsumable } from './lib/apply-effects'

// Encounter engine (Phase E3)
export { resolveEncounterTable, checkCellForEncounter, visitedFlagKey } from './lib/encounter-engine'
export type { ResolvedEncounter, EnemyInstance, CellEntity, ObjectInstance, Condition, CellEvent, BoundaryData, DoorDef, DoorState, Facing } from './lib/engine-types'

// Encounter modal (Phase E3)
export { EncounterModal } from './components/EncounterModal'

// Combat engine (Phase E4 + E5)
export {
  initCombat,
  resolvePlayerAttack,
  resolvePlayerCast,
  resolvePlayerFlee,
  resolveEnemyTurn,
  applyCombatOutcome,
} from './lib/combat-engine'
export type { CombatActor, CombatLogEntry, CombatPhase, CombatState } from './lib/combat-engine'

// Combat screen (Phase E4)
export { CombatScreen } from './components/CombatScreen'

// Event engine (Phase E6)
export {
  checkConditions,
  resolveExploreEffects,
  getTriggeredEvents,
  getInteractableObjects,
  visitedEventFlagKey,
  objectUsedFlagKey,
  resolveLootTable,
} from './lib/event-engine'
export type { EventContext, ExploreEffect } from './lib/event-engine'

// Shop schema helpers (Phase E6)
export { SHOP_SCHEMA, blankShop } from './lib/shop-schema'

// Cell inspector + shop modal (Phase E6)
export { CellInspector } from './components/CellInspector'
export { ShopModal } from './components/ShopModal'
