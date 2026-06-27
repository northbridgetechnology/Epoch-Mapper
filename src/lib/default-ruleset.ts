/**
 * Default ruleset — 6 attributes, 4 classes, 4 races.
 * Loaded automatically for any new project. All entries are editable/removable.
 */

import type { AttributeDef, ClassDef, RaceDef, Ruleset } from './engine-types'

export const DEFAULT_ATTRIBUTES: AttributeDef[] = [
  { id: 'attr.might',      name: 'Might',      abbr: 'MGT', min: 3, max: 18, default: 10, description: 'Physical power; increases melee damage and max HP.' },
  { id: 'attr.agility',    name: 'Agility',    abbr: 'AGL', min: 3, max: 18, default: 10, description: 'Speed and dexterity; affects initiative, hit chance, and defense.' },
  { id: 'attr.intellect',  name: 'Intellect',  abbr: 'INT', min: 3, max: 18, default: 10, description: 'Mental acuity; boosts arcane spell power and max MP.' },
  { id: 'attr.spirit',     name: 'Spirit',     abbr: 'SPI', min: 3, max: 18, default: 10, description: 'Spiritual force; boosts divine spell power and max MP.' },
  { id: 'attr.endurance',  name: 'Endurance',  abbr: 'END', min: 3, max: 18, default: 10, description: 'Resilience; primary contributor to max HP.' },
  { id: 'attr.luck',       name: 'Luck',       abbr: 'LCK', min: 3, max: 18, default: 10, description: 'Fortune; increases critical hit chance and loot quality.' },
]

export const DEFAULT_CLASSES: ClassDef[] = [
  {
    id: 'class.fighter',
    name: 'Fighter',
    icon: '⚔️',
    color: '#c0392b',
    description: 'A seasoned warrior who excels in melee combat and can wear heavy armor.',
    hitDie: 10,
    spellDie: 0,
    spellSchools: [],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['blade', 'axe', 'mace', 'bow', 'spear'],
    attrGrowth: { might: 1, endurance: 1 },
    attrModifiers: { might: 2, endurance: 2 },
  },
  {
    id: 'class.mage',
    name: 'Mage',
    icon: '🔮',
    color: '#8e44ad',
    description: 'A scholarly spellcaster who channels arcane energies. Frail but devastating.',
    hitDie: 4,
    spellDie: 8,
    spellSchools: ['arcane'],
    allowedEquip: ['weapon', 'ring', 'amulet'],
    weaponKinds: ['staff', 'wand', 'dagger'],
    attrGrowth: { intellect: 2 },
    attrModifiers: { intellect: 3 },
  },
  {
    id: 'class.cleric',
    name: 'Cleric',
    icon: '✝️',
    color: '#f39c12',
    description: 'A devoted priest who wields divine magic and can heal the party.',
    hitDie: 6,
    spellDie: 6,
    spellSchools: ['divine'],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['mace', 'staff', 'hammer'],
    attrGrowth: { spirit: 2 },
    attrModifiers: { spirit: 3 },
  },
  {
    id: 'class.rogue',
    name: 'Rogue',
    icon: '🗡️',
    color: '#27ae60',
    description: 'A quick and cunning adventurer skilled in stealth and precision strikes.',
    hitDie: 6,
    spellDie: 0,
    spellSchools: [],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['dagger', 'blade', 'bow'],
    attrGrowth: { agility: 2 },
    attrModifiers: { agility: 3, luck: 1 },
  },
]

export const DEFAULT_RACES: RaceDef[] = [
  {
    id: 'race.human',
    name: 'Human',
    icon: '🧑',
    color: '#e8d5b0',
    description: 'Versatile and adaptable. Slight bonuses across the board.',
    attrModifiers: { might: 1, agility: 1, intellect: 1, spirit: 1, endurance: 1, luck: 1 },
    traits: ['Adaptable'],
  },
  {
    id: 'race.elf',
    name: 'Elf',
    icon: '🧝',
    color: '#7dcea0',
    description: 'Graceful and magically gifted. High intellect and agility but less endurance.',
    attrModifiers: { agility: 2, intellect: 2, spirit: 1, endurance: -2 },
    resistances: { dark: 0.1 },
    traits: ['Keen Senses', 'Night Vision'],
  },
  {
    id: 'race.dwarf',
    name: 'Dwarf',
    icon: '🧔',
    color: '#b07d4a',
    description: 'Stout and resilient. Superior endurance and might, but slower than most.',
    attrModifiers: { might: 2, endurance: 3, agility: -2, luck: 1 },
    resistances: { poison: 0.15 },
    traits: ['Stonecunning', 'Poison Resistance'],
  },
  {
    id: 'race.halfling',
    name: 'Halfling',
    icon: '🧑‍🦯',
    color: '#f0c078',
    description: 'Small but nimble and surprisingly lucky. Masters of the unexpected.',
    attrModifiers: { agility: 2, luck: 3, might: -2 },
    traits: ['Halfling Luck', 'Small Frame'],
  },
]

export function makeDefaultRuleset(startMapId = 'map1'): Ruleset {
  return {
    meta: {
      title: 'My Dungeon',
      version: '0.1',
      startMapId,
      startPosition: { x: 0, y: 0, facing: 'N' },
      partySize: 6,
      rows: 2,
      permadeath: false,
      startingGold: 100,
    },
    attributes: DEFAULT_ATTRIBUTES,
    classes: DEFAULT_CLASSES,
    races: DEFAULT_RACES,
    items: [],
    spells: [],
    statusEffects: [],
    enemies: [],
    encounterTables: [],
    lootTables: [],
    shops: [],
  }
}
