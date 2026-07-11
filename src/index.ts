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

// Built-in pixel sprite library (EotB-style billboards)
export { pixelSprite, pixelSpriteRect, hasPixelSprite, spriteAspect, resolveCreatureSprite, creatureSprite, bitmapSprite, isBitmapSprite, bitmapFrames, spriteKinds } from './lib/pixel-sprites'
export { fileToSpriteDataUri, fileToImageDataUri, builtinSpritePng, downloadSpriteTemplate, SPRITE_MAX_DIM, SPRITE_MAX_BYTES, SPRITE_ACCEPT_TYPES, SPRITE_ACCEPT_ATTR, IMAGE_ACCEPT_TYPES, IMAGE_ACCEPT_ATTR } from './lib/sprite-upload'

// Procedural generation
export { buildBaseMap, buildGeneratedMap, buildGeneratedWorld, layoutDim, SIZE_DIM, EOTB_DIM } from './lib/map-generator'
export type { NewMapConfig, MapSize, GeneratedWorld, LayoutStyle } from './lib/map-generator'

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
  Pronoun,
  OpeningStory,
} from './lib/engine-types'
export { deriveMaxHp, deriveMaxMp, xpToNextLevel } from './lib/engine-types'

// Default ruleset
export { makeDefaultRuleset, normalizeRuleset, DEFAULT_ATTRIBUTES, DEFAULT_CLASSES, DEFAULT_RACES, DEFAULT_SPELLS, DEFAULT_STATUS_EFFECTS } from './lib/default-ruleset'

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
  clearPartyTemplate,
  saveToSlot,
  loadFromSlot,
  deleteSlot,
  deleteAllSlots,
  listSaveSlots,
  SAVE_SLOT_COUNT,
  newSaveState,
  newCharacter,
  npcToCharacter,
  SaveStateParseError,
  type NewCharacterOpts,
} from './lib/save-state'

// Schema-driven form generator
export { SchemaForm } from './components/forms/SchemaForm'

// Effect builder (Phase E2)
export { EffectBuilder } from './components/forms/EffectBuilder'

// Workspaces
export { PartyWorkspace } from './components/workspaces/PartyWorkspace'
export { CharactersWorkspace } from './components/workspaces/CharactersWorkspace'
export { NpcEditor } from './components/forms/NpcEditor'
export { DatabaseWorkspace } from './components/workspaces/DatabaseWorkspace'
export { PlayWorkspace } from './components/workspaces/PlayWorkspace'
export { GameMenu } from './components/GameMenu'

// Item schema helpers
export { ITEM_SCHEMA, LOOT_TABLE_SCHEMA, blankItem, blankLootTable, itemDisplayName } from './lib/item-schema'

// Class schema helpers
export { CLASS_SCHEMA, blankClass } from './lib/class-schema'

// Weapon/armor type schema helpers
export { WEAPON_TYPE_SCHEMA, ARMOR_TYPE_SCHEMA, DAMAGE_TYPE_OPTIONS, blankWeaponType, blankArmorType } from './lib/type-schema'

// Enemy + encounter-table schema helpers (Phase E3)
export { ENEMY_SCHEMA, ENCOUNTER_TABLE_SCHEMA, blankEnemy, blankEncounterTable } from './lib/enemy-schema'

// NPC / global event / quest schema helpers
export { NPC_SCHEMA, EVENT_SCHEMA, QUEST_SCHEMA, blankNpc, blankEventDef, blankQuest } from './lib/npc-schema'
export { DialogueOverlay } from './components/DialogueOverlay'
export { JournalOverlay } from './components/JournalOverlay'
export { Minimap } from './components/Minimap'

// Story & protagonist (Batch F)
export { resolveText, resolveTextList, type TextActor } from './lib/text-tokens'
export { Portrait, portraitIds, portraitLabel, isBuiltinPortrait, suggestPortrait, portraitGrid } from './lib/portraits'
export {
  DEFAULT_POINT_POOL, pointPool, emptyAlloc, attrScore, pointsSpent, pointsRemaining,
  canRaise, canLower, raise, lower, buildCharacter, type BuildDraft,
} from './lib/char-build'
export { CharacterBuilder } from './components/CharacterBuilder'
export { OpeningStoryOverlay } from './components/OpeningStory'

// Spell + status-effect schema helpers (Phase E5)
export { SPELL_SCHEMA, STATUS_SCHEMA, blankSpell, blankStatusEffect } from './lib/spell-schema'

// Out-of-combat effect resolver
export { applyEffectToChar, applyConsumable } from './lib/apply-effects'

// Equip proficiency gate
export { canEquip } from './lib/equipment'
export type { EquipCheck } from './lib/equipment'

// Encounter engine (Phase E3)
export { resolveEncounterTable, checkCellForEncounter, makeFixedEncounter, visitedFlagKey } from './lib/encounter-engine'

// Exploration mechanics: trick tiles + party light (dark maps)
export { applyMoveTricks, getTricks, cellHasTrick, computeLightRadius, tickLightBurn, restParty, listFoes, advanceFoes, foeFlagKey, seenCellsFrom, DARK_BASE_RADIUS } from './lib/exploration'
export type { TrickMoveResult, RestResult, FoeRuntime } from './lib/exploration'
export type { ResolvedEncounter, EnemyInstance, CellEntity, ObjectInstance, Condition, CellEvent, BoundaryData, DoorDef, DoorState, Facing, SwitchDef, InscriptionDef, TrickKind, EventDef, NpcDef, NpcLine, QuestDef, QuestStage } from './lib/engine-types'

// Encounter modal (Phase E3)
export { EncounterModal } from './components/EncounterModal'

// Combat engine (Phase E4 + E5)
export {
  initCombat,
  resolvePlayerAttack,
  resolvePlayerCast,
  resolvePlayerFlee,
  resolvePlayerDefend,
  resolvePlayerUseItem,
  resolveEnemyTurn,
  applyCombatOutcome,
  consumeCombatItems,
  upcomingTurns,
} from './lib/combat-engine'
export type { CombatActor, CombatEvent, CombatLogEntry, CombatPhase, CombatState, InitCombatOpts } from './lib/combat-engine'

// Balance simulator (headless, uses the real combat engine)
export { simulateEncounterTable, makeSimParty } from './lib/battle-sim'
export type { SimConfig, SimResult } from './lib/battle-sim'
export { SimulatePanel } from './components/SimulatePanel'

// Battle UI: first-person battle HUD + playfield formation (Phase E4)
export { BattleHud, BattleOutcomeOverlay, useBattleController } from './components/BattleHud'
export { buildBattlePlacements } from './lib/battle-scene'
export type { EnemyPlacement, BattleViewState } from './lib/battle-scene'

// Event engine (Phase E6)
export {
  checkConditions,
  resolveExploreEffects,
  getTriggeredEvents,
  getInteractableObjects,
  visitedEventFlagKey,
  objectUsedFlagKey,
  resolveLootTable,
  effectiveDoorState,
  runCellEvents,
  expandReactive,
  applyFlagWriteWithReactions,
  applyExploreHarm,
  questStageFlagKey,
  pickNpcLine,
  finishNpcLine,
  npcLineHeardFlagKey,
  npcRecruitedFlagKey,
} from './lib/event-engine'
export type { EventContext, ExploreEffect, PartyHarm } from './lib/event-engine'

// Shop schema helpers (Phase E6)
export { SHOP_SCHEMA, blankShop } from './lib/shop-schema'

// Cell inspector + shop modal (Phase E6)
export { CellInspector } from './components/CellInspector'
export { ShopModal } from './components/ShopModal'
