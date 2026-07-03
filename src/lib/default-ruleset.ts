/**
 * Default ruleset — seeded with SMT-inspired content.
 * All entries are editable/removable in the Database workspace.
 */

import type {
  AttributeDef, ClassDef, RaceDef, SpellDef, StatusEffectDef,
  ItemDef, EnemyDef, EncounterTableDef, LootTableDef, ShopDef,
  Ruleset,
} from './engine-types'

// ── Attributes ─────────────────────────────────────────────────────────────────

export const DEFAULT_ATTRIBUTES: AttributeDef[] = [
  { id: 'attr.might',     name: 'Might',     abbr: 'MGT', min: 3, max: 18, default: 10, description: 'Physical power; increases melee damage and max HP.' },
  { id: 'attr.agility',   name: 'Agility',   abbr: 'AGL', min: 3, max: 18, default: 10, description: 'Speed and dexterity; affects initiative, hit chance, and defense.' },
  { id: 'attr.intellect', name: 'Intellect', abbr: 'INT', min: 3, max: 18, default: 10, description: 'Mental acuity; boosts arcane spell power and max MP.' },
  { id: 'attr.spirit',    name: 'Spirit',    abbr: 'SPI', min: 3, max: 18, default: 10, description: 'Spiritual force; boosts divine spell power and max MP.' },
  { id: 'attr.endurance', name: 'Endurance', abbr: 'END', min: 3, max: 18, default: 10, description: 'Resilience; primary contributor to max HP.' },
  { id: 'attr.luck',      name: 'Luck',      abbr: 'LCK', min: 3, max: 18, default: 10, description: 'Fortune; increases critical hit chance and loot quality.' },
]

// ── Classes ────────────────────────────────────────────────────────────────────

export const DEFAULT_CLASSES: ClassDef[] = [
  {
    id: 'class.fighter', name: 'Fighter', icon: '⚔️', color: '#c0392b',
    description: 'A seasoned warrior who excels in melee combat and can wear heavy armor.',
    hitDie: 10, spellDie: 0, spellSchools: [],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['blade', 'axe', 'mace', 'bow', 'spear'],
    attrGrowth: { might: 1, endurance: 1 },
    attrModifiers: { might: 2, endurance: 2 },
  },
  {
    id: 'class.mage', name: 'Mage', icon: '🔮', color: '#8e44ad',
    description: 'A scholarly spellcaster who channels arcane and elemental energies. Frail but devastating.',
    hitDie: 4, spellDie: 8, spellSchools: ['arcane', 'element'],
    allowedEquip: ['weapon', 'ring', 'amulet'],
    weaponKinds: ['staff', 'wand', 'dagger'],
    startingSpells: ['spell.agi', 'spell.bufu', 'spell.zio'],
    attrGrowth: { intellect: 2 },
    attrModifiers: { intellect: 3 },
  },
  {
    id: 'class.cleric', name: 'Cleric', icon: '✝️', color: '#f39c12',
    description: 'A devoted priest wielding divine magic. Heals allies and smites the unholy.',
    hitDie: 6, spellDie: 6, spellSchools: ['divine', 'holy'],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['mace', 'staff', 'hammer'],
    startingSpells: ['spell.dia', 'spell.hama', 'spell.cure_poison'],
    attrGrowth: { spirit: 2 },
    attrModifiers: { spirit: 3 },
  },
  {
    id: 'class.rogue', name: 'Rogue', icon: '🗡️', color: '#27ae60',
    description: 'A quick and cunning adventurer skilled in stealth and precision strikes.',
    hitDie: 6, spellDie: 0, spellSchools: [],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['dagger', 'blade', 'bow', 'gun'],
    attrGrowth: { agility: 2 },
    attrModifiers: { agility: 3, luck: 1 },
  },
  {
    id: 'class.gunslinger', name: 'Gunslinger', icon: '🔫', color: '#2980b9',
    description: 'A sharp-eyed marksman wielding firearms and quick reflexes.',
    hitDie: 6, spellDie: 0, spellSchools: [],
    allowedEquip: ['weapon', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponKinds: ['gun'],
    attrGrowth: { agility: 1, luck: 1 },
    attrModifiers: { agility: 2, luck: 2 },
  },
]

// ── Races ──────────────────────────────────────────────────────────────────────

export const DEFAULT_RACES: RaceDef[] = [
  {
    id: 'race.human', name: 'Human', icon: '🧑', color: '#e8d5b0',
    description: 'Versatile and adaptable. Slight bonuses across the board.',
    attrModifiers: { might: 1, agility: 1, intellect: 1, spirit: 1, endurance: 1, luck: 1 },
    traits: ['Adaptable'],
  },
  {
    id: 'race.elf', name: 'Elf', icon: '🧝', color: '#7dcea0',
    description: 'Graceful and magically gifted. High intellect and agility but less endurance.',
    attrModifiers: { agility: 2, intellect: 2, spirit: 1, endurance: -2 },
    resistances: { dark: 0.1 },
    traits: ['Keen Senses', 'Night Vision'],
  },
  {
    id: 'race.dwarf', name: 'Dwarf', icon: '🧔', color: '#b07d4a',
    description: 'Stout and resilient. Superior endurance and might, but slower.',
    attrModifiers: { might: 2, endurance: 3, agility: -2, luck: 1 },
    resistances: { poison: 0.15 },
    traits: ['Stonecunning', 'Poison Resistance'],
  },
  {
    id: 'race.halfling', name: 'Halfling', icon: '🧑‍🦯', color: '#f0c078',
    description: 'Small but nimble and surprisingly lucky. Masters of the unexpected.',
    attrModifiers: { agility: 2, luck: 3, might: -2 },
    traits: ['Halfling Luck', 'Small Frame'],
  },
]

// ── Status Effects ─────────────────────────────────────────────────────────────

export const DEFAULT_STATUS_EFFECTS: StatusEffectDef[] = [
  {
    id: 'status.poisoned', name: 'Poisoned', icon: '☠️', color: '#2ecc71',
    description: 'Takes poison damage each turn.',
    kind: 'dot', durationTurns: 4, blocksAction: false,
    tickEffects: [{ t: 'damage', dmgType: 'poison', amount: '1d4', canCrit: false }],
  },
  {
    id: 'status.burned', name: 'Burned', icon: '🔥', color: '#e74c3c',
    description: 'On fire. Takes fire damage each turn.',
    kind: 'dot', durationTurns: 3, blocksAction: false,
    tickEffects: [{ t: 'damage', dmgType: 'fire', amount: '1d6', canCrit: false }],
  },
  {
    id: 'status.frozen', name: 'Frozen', icon: '🧊', color: '#74b9ff',
    description: 'Encased in ice. Cannot act for 2 turns.',
    kind: 'control', durationTurns: 2, blocksAction: true,
  },
  {
    id: 'status.shocked', name: 'Shocked', icon: '⚡', color: '#fdcb6e',
    description: 'Paralyzed by electricity. Has a 50% chance to skip each turn.',
    kind: 'debuff', durationTurns: 2, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: -5 }],
  },
  {
    id: 'status.asleep', name: 'Asleep', icon: '💤', color: '#9b59b6',
    description: 'Cannot act while asleep. Wakes on taking damage.',
    kind: 'control', durationTurns: 3, blocksAction: true,
  },
  {
    id: 'status.charmed', name: 'Charmed', icon: '💘', color: '#fd79a8',
    description: 'Infatuated. May attack allies instead of enemies.',
    kind: 'control', durationTurns: 2, blocksAction: false,
  },
  {
    id: 'status.panicked', name: 'Panicked', icon: '😱', color: '#ffeaa7',
    description: 'Overcome by fear. Acts randomly each turn.',
    kind: 'control', durationTurns: 2, blocksAction: false,
  },
  {
    id: 'status.bound', name: 'Bound', icon: '🔗', color: '#636e72',
    description: 'Restrained. Cannot flee. Defense reduced.',
    kind: 'debuff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: -4 }],
  },
  {
    id: 'status.silenced', name: 'Silenced', icon: '🤫', color: '#b2bec3',
    description: 'Cannot speak. Unable to cast spells.',
    kind: 'debuff', durationTurns: 3, blocksAction: false,
  },
  {
    id: 'status.regen', name: 'Regenerating', icon: '💚', color: '#27ae60',
    description: 'Recovers HP each turn.',
    kind: 'hot', durationTurns: 4, blocksAction: false,
    tickEffects: [{ t: 'heal', amount: '1d6' }],
  },
  {
    id: 'status.tarukaja', name: 'Attack Up', icon: '⬆️', color: '#e17055',
    description: 'Attack power raised.',
    kind: 'buff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 5 }],
  },
  {
    id: 'status.rakukaja', name: 'Defense Up', icon: '🛡️', color: '#0984e3',
    description: 'Defense raised.',
    kind: 'buff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 5 }],
  },
  {
    id: 'status.sukunda', name: 'Agility Down', icon: '⬇️', color: '#636e72',
    description: 'Agility lowered. Harder to hit or evade.',
    kind: 'debuff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: -5 }],
  },
]

// ── Spells ─────────────────────────────────────────────────────────────────────

export const DEFAULT_SPELLS: SpellDef[] = [
  // ── Agi (Fire) ────────────────────────────────────────────────────────────────
  {
    id: 'spell.agi', name: 'Agi', icon: '🔥', color: '#e74c3c',
    school: 'element', level: 1, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A small jet of flame. Light fire damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '1d8+2', canCrit: true }],
  },
  {
    id: 'spell.agilao', name: 'Agilao', icon: '🔥', color: '#e17055',
    school: 'element', level: 3, mpCost: 8, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A roaring tongue of flame. Medium fire damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '2d8+4', canCrit: true }],
  },
  {
    id: 'spell.agidyne', name: 'Agidyne', icon: '💥', color: '#d63031',
    school: 'element', level: 6, mpCost: 14, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'An inferno erupts around the target. Heavy fire damage to one foe.',
    effects: [
      { t: 'damage', dmgType: 'fire', amount: '4d6+6', canCrit: true },
      { t: 'status', status: 'status.burned', chance: 0.25 },
    ],
  },
  {
    id: 'spell.maragi', name: 'Maragi', icon: '🔥', color: '#fab1a0',
    school: 'element', level: 2, mpCost: 10, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Sprays embers across all enemies. Light fire damage to all foes.',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '1d6+2', canCrit: false }],
  },
  {
    id: 'spell.maragidyne', name: 'Maragidyne', icon: '🌋', color: '#d63031',
    school: 'element', level: 8, mpCost: 22, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'A volcanic eruption engulfs all enemies. Heavy fire damage to all foes.',
    effects: [
      { t: 'damage', dmgType: 'fire', amount: '3d6+4', canCrit: false },
      { t: 'status', status: 'status.burned', chance: 0.20 },
    ],
  },
  // ── Bufu (Ice) ────────────────────────────────────────────────────────────────
  {
    id: 'spell.bufu', name: 'Bufu', icon: '❄️', color: '#74b9ff',
    school: 'element', level: 1, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A shard of ice. Light ice damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'ice', amount: '1d8+2', canCrit: true }],
  },
  {
    id: 'spell.bufula', name: 'Bufula', icon: '❄️', color: '#0984e3',
    school: 'element', level: 3, mpCost: 8, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A lance of ice. Medium ice damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'ice', amount: '2d8+4', canCrit: true }],
  },
  {
    id: 'spell.bufudyne', name: 'Bufudyne', icon: '🌨️', color: '#0652dd',
    school: 'element', level: 6, mpCost: 14, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A glacier crashes down. Heavy ice damage to one foe. May Freeze.',
    effects: [
      { t: 'damage', dmgType: 'ice', amount: '4d6+6', canCrit: true },
      { t: 'status', status: 'status.frozen', chance: 0.30 },
    ],
  },
  {
    id: 'spell.mabufu', name: 'Mabufu', icon: '❄️', color: '#a8d8ea',
    school: 'element', level: 2, mpCost: 10, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Frost spreads across the battlefield. Light ice damage to all foes.',
    effects: [{ t: 'damage', dmgType: 'ice', amount: '1d6+2', canCrit: false }],
  },
  {
    id: 'spell.mabufudyne', name: 'Mabufudyne', icon: '🌨️', color: '#0652dd',
    school: 'element', level: 8, mpCost: 22, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'A blizzard freezes everything. Heavy ice damage to all foes. May Freeze.',
    effects: [
      { t: 'damage', dmgType: 'ice', amount: '3d6+4', canCrit: false },
      { t: 'status', status: 'status.frozen', chance: 0.20 },
    ],
  },
  // ── Zio (Lightning) ───────────────────────────────────────────────────────────
  {
    id: 'spell.zio', name: 'Zio', icon: '⚡', color: '#fdcb6e',
    school: 'element', level: 1, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A bolt of lightning. Light lightning damage to one foe. May Shock.',
    effects: [
      { t: 'damage', dmgType: 'lightning', amount: '1d8+2', canCrit: true },
      { t: 'status', status: 'status.shocked', chance: 0.20 },
    ],
  },
  {
    id: 'spell.zionga', name: 'Zionga', icon: '⚡', color: '#e17055',
    school: 'element', level: 3, mpCost: 8, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A crashing thunderbolt. Medium lightning damage to one foe. May Shock.',
    effects: [
      { t: 'damage', dmgType: 'lightning', amount: '2d8+4', canCrit: true },
      { t: 'status', status: 'status.shocked', chance: 0.25 },
    ],
  },
  {
    id: 'spell.ziodyne', name: 'Ziodyne', icon: '🌩️', color: '#fdcb6e',
    school: 'element', level: 6, mpCost: 14, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A heaven-sent thunderstrike. Heavy lightning damage to one foe. High Shock chance.',
    effects: [
      { t: 'damage', dmgType: 'lightning', amount: '4d6+6', canCrit: true },
      { t: 'status', status: 'status.shocked', chance: 0.40 },
    ],
  },
  {
    id: 'spell.mazio', name: 'Mazio', icon: '⚡', color: '#ffeaa7',
    school: 'element', level: 2, mpCost: 10, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Chain lightning arcs across all foes. Light lightning damage.',
    effects: [
      { t: 'damage', dmgType: 'lightning', amount: '1d6+2', canCrit: false },
      { t: 'status', status: 'status.shocked', chance: 0.15 },
    ],
  },
  {
    id: 'spell.maziodyne', name: 'Maziodyne', icon: '🌩️', color: '#fdcb6e',
    school: 'element', level: 8, mpCost: 22, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'A thunderstorm electrifies all foes. Heavy lightning damage. May Shock.',
    effects: [
      { t: 'damage', dmgType: 'lightning', amount: '3d6+4', canCrit: false },
      { t: 'status', status: 'status.shocked', chance: 0.25 },
    ],
  },
  // ── Zan (Wind) ────────────────────────────────────────────────────────────────
  {
    id: 'spell.zan', name: 'Zan', icon: '💨', color: '#b2bec3',
    school: 'element', level: 1, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A razor-sharp gust. Light wind damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '1d8+2', canCrit: true }],
  },
  {
    id: 'spell.zanma', name: 'Zanma', icon: '💨', color: '#636e72',
    school: 'element', level: 3, mpCost: 8, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A cyclone rips through the target. Medium wind damage.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+4', canCrit: true }],
  },
  {
    id: 'spell.zandyne', name: 'Zandyne', icon: '🌪️', color: '#2d3436',
    school: 'element', level: 6, mpCost: 14, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A massive tornado. Heavy wind damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '4d6+6', canCrit: true }],
  },
  {
    id: 'spell.mazan', name: 'Mazan', icon: '💨', color: '#dfe6e9',
    school: 'element', level: 2, mpCost: 10, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Cutting winds slice through all enemies. Light wind damage.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6+2', canCrit: false }],
  },
  // ── Dia (Healing) ─────────────────────────────────────────────────────────────
  {
    id: 'spell.dia', name: 'Dia', icon: '✨', color: '#55efc4',
    school: 'divine', level: 1, mpCost: 3, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'A healing light. Recovers a small amount of HP for one ally.',
    effects: [{ t: 'heal', amount: '2d6+4' }],
  },
  {
    id: 'spell.diarama', name: 'Diarama', icon: '✨', color: '#00b894',
    school: 'divine', level: 4, mpCost: 8, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'A warm healing glow. Recovers a moderate amount of HP.',
    effects: [{ t: 'heal', amount: '4d8+8' }],
  },
  {
    id: 'spell.diarahan', name: 'Diarahan', icon: '💛', color: '#fdcb6e',
    school: 'divine', level: 7, mpCost: 18, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'Fully restores one ally\'s HP.',
    effects: [{ t: 'fullHeal' }],
  },
  {
    id: 'spell.media', name: 'Media', icon: '✨', color: '#81ecec',
    school: 'divine', level: 3, mpCost: 12, target: 'allAllies',
    inCombat: true, outOfCombat: true,
    description: 'A wave of healing light restores HP for all allies.',
    effects: [{ t: 'heal', amount: '2d6+3' }],
  },
  {
    id: 'spell.mediarama', name: 'Mediarama', icon: '💛', color: '#00cec9',
    school: 'divine', level: 6, mpCost: 20, target: 'allAllies',
    inCombat: true, outOfCombat: true,
    description: 'A powerful healing wave restores substantial HP for all allies.',
    effects: [{ t: 'heal', amount: '4d8+6' }],
  },
  {
    id: 'spell.recarm', name: 'Recarm', icon: '💫', color: '#ffeaa7',
    school: 'divine', level: 5, mpCost: 16, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'Revives a fallen ally with 50% of their max HP.',
    effects: [{ t: 'reviveRandom' }],
  },
  // ── Cure (Support) ────────────────────────────────────────────────────────────
  {
    id: 'spell.cure_light', name: 'Cure Light Wounds', icon: '✨', color: '#f1c40f',
    school: 'divine', level: 1, mpCost: 4, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'Heals a single ally for 1d8+2 HP.',
    effects: [{ t: 'heal', amount: '1d8+2' }],
  },
  {
    id: 'spell.cure_poison', name: 'Patra', icon: '🍃', color: '#2ecc71',
    school: 'divine', level: 1, mpCost: 3, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'Cures Poison, Burn, and Freeze from one ally.',
    effects: [
      { t: 'cure', status: 'status.poisoned' },
      { t: 'cure', status: 'status.burned' },
      { t: 'cure', status: 'status.frozen' },
    ],
  },
  {
    id: 'spell.posumudi', name: 'Posumudi', icon: '🍃', color: '#27ae60',
    school: 'divine', level: 1, mpCost: 2, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'Removes Poison from one ally.',
    effects: [{ t: 'cure', status: 'status.poisoned' }],
  },
  {
    id: 'spell.group_heal', name: 'Mass Cure', icon: '💛', color: '#f39c12',
    school: 'divine', level: 3, mpCost: 8, target: 'allAllies',
    inCombat: true, outOfCombat: true,
    description: 'Heals all allies for 1d6 HP.',
    effects: [{ t: 'heal', amount: '1d6' }],
  },
  {
    id: 'spell.regen', name: 'Regenerate', icon: '💚', color: '#27ae60',
    school: 'divine', level: 2, mpCost: 4, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'Grants an ally Regenerating for 4 turns.',
    effects: [{ t: 'status', status: 'status.regen' }],
  },
  // ── Hama (Light / Holy) ───────────────────────────────────────────────────────
  {
    id: 'spell.hama', name: 'Hama', icon: '☀️', color: '#f9ca24',
    school: 'holy', level: 3, mpCost: 8, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'The light of judgement. 40% chance to instantly banish an unholy foe.',
    effects: [{ t: 'damage', dmgType: 'holy', amount: 99, canCrit: false }],
  },
  {
    id: 'spell.hamaon', name: 'Hamaon', icon: '☀️', color: '#f6e58d',
    school: 'holy', level: 6, mpCost: 14, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Powerful holy judgement. 70% chance to instantly banish one foe.',
    effects: [{ t: 'damage', dmgType: 'holy', amount: 99, canCrit: false }],
  },
  {
    id: 'spell.mahama', name: 'Mahama', icon: '☀️', color: '#ffe082',
    school: 'holy', level: 5, mpCost: 18, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Holy light floods the area. 25% chance to banish all foes.',
    effects: [{ t: 'damage', dmgType: 'holy', amount: 99, canCrit: false }],
  },
  // ── Mudo (Dark) ───────────────────────────────────────────────────────────────
  {
    id: 'spell.mudo', name: 'Mudo', icon: '🌑', color: '#2d3436',
    school: 'dark', level: 3, mpCost: 8, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A word of death. 40% chance to instantly destroy one foe.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: 99, canCrit: false }],
  },
  {
    id: 'spell.mudoon', name: 'Mudoon', icon: '🌑', color: '#6c5ce7',
    school: 'dark', level: 6, mpCost: 14, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A powerful death curse. 70% chance to instantly destroy one foe.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: 99, canCrit: false }],
  },
  {
    id: 'spell.mamudo', name: 'Mamudo', icon: '🌑', color: '#a29bfe',
    school: 'dark', level: 5, mpCost: 18, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'A wave of death. 25% chance to destroy all foes.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: 99, canCrit: false }],
  },
  // ── Ailment / Support ─────────────────────────────────────────────────────────
  {
    id: 'spell.dormina', name: 'Dormina', icon: '💤', color: '#9b59b6',
    school: 'arcane', level: 2, mpCost: 5, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Lulls one foe to sleep (75% chance).',
    effects: [{ t: 'status', status: 'status.asleep', chance: 0.75 }],
  },
  {
    id: 'spell.sleep_spell', name: 'Sleep', icon: '💤', color: '#9b59b6',
    school: 'arcane', level: 1, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Attempts to put one enemy to sleep (60% chance).',
    effects: [{ t: 'status', status: 'status.asleep', chance: 0.6 }],
  },
  {
    id: 'spell.marin_karin', name: 'Marin Karin', icon: '💘', color: '#fd79a8',
    school: 'arcane', level: 3, mpCost: 7, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Bewitches a foe, charming them (50% chance). They may attack their allies.',
    effects: [{ t: 'status', status: 'status.charmed', chance: 0.50 }],
  },
  {
    id: 'spell.pulinpa', name: 'Pulinpa', icon: '😱', color: '#fdcb6e',
    school: 'arcane', level: 2, mpCost: 5, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Induces panic in one foe (60% chance). They act randomly.',
    effects: [{ t: 'status', status: 'status.panicked', chance: 0.60 }],
  },
  {
    id: 'spell.makajam', name: 'Makajam', icon: '🤫', color: '#b2bec3',
    school: 'arcane', level: 2, mpCost: 5, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Seals a foe\'s mouth, silencing them (65% chance).',
    effects: [{ t: 'status', status: 'status.silenced', chance: 0.65 }],
  },
  {
    id: 'spell.poison', name: 'Poison', icon: '☠️', color: '#2ecc71',
    school: 'arcane', level: 2, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Poisons one enemy, dealing 1d4 damage per turn for 4 turns.',
    effects: [{ t: 'status', status: 'status.poisoned', chance: 0.75 }],
  },
  // ── Kaja / Nda (Buffs / Debuffs) ─────────────────────────────────────────────
  {
    id: 'spell.tarukaja', name: 'Tarukaja', icon: '⬆️', color: '#e17055',
    school: 'divine', level: 2, mpCost: 6, target: 'ally',
    inCombat: true, outOfCombat: false,
    description: 'Raises one ally\'s attack power for 3 turns.',
    effects: [{ t: 'status', status: 'status.tarukaja' }],
  },
  {
    id: 'spell.rakukaja', name: 'Rakukaja', icon: '🛡️', color: '#0984e3',
    school: 'divine', level: 2, mpCost: 6, target: 'ally',
    inCombat: true, outOfCombat: false,
    description: 'Raises one ally\'s defense for 3 turns.',
    effects: [{ t: 'status', status: 'status.rakukaja' }],
  },
  {
    id: 'spell.sukunda', name: 'Sukunda', icon: '⬇️', color: '#636e72',
    school: 'dark', level: 2, mpCost: 6, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Lowers one enemy\'s agility for 3 turns.',
    effects: [{ t: 'status', status: 'status.sukunda' }],
  },
  // ── Arcane (legacy) ───────────────────────────────────────────────────────────
  {
    id: 'spell.fire_bolt', name: 'Fire Bolt', icon: '🔥', color: '#e74c3c',
    school: 'arcane', level: 1, mpCost: 5, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Hurls a bolt of fire at one enemy for 1d10 fire damage.',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '1d10', canCrit: true }],
  },
  {
    id: 'spell.fireball', name: 'Fireball', icon: '💥', color: '#e67e22',
    school: 'arcane', level: 3, mpCost: 10, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Engulfs all enemies in flame for 2d6 fire damage.',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '2d6', canCrit: true }],
  },
]

// ── Items ──────────────────────────────────────────────────────────────────────

export const DEFAULT_ITEMS: ItemDef[] = [
  // ── Consumables ────────────────────────────────────────────────────────────────
  {
    id: 'item.medicine', name: 'Medicine', icon: '💊', color: '#dfe6e9',
    description: 'A basic healing draught. Restores 50 HP.', kind: 'consumable',
    value: 80, stackable: true,
    onUse: [{ t: 'heal', amount: 50 }],
  },
  {
    id: 'item.hi_medicine', name: 'Hi-Medicine', icon: '💊', color: '#74b9ff',
    description: 'A potent healing draught. Restores 120 HP.', kind: 'consumable',
    value: 200, stackable: true,
    onUse: [{ t: 'heal', amount: 120 }],
  },
  {
    id: 'item.mega_medicine', name: 'Mega-Medicine', icon: '💊', color: '#a29bfe',
    description: 'A powerful healing brew. Restores 300 HP.', kind: 'consumable',
    value: 600, stackable: true,
    onUse: [{ t: 'heal', amount: 300 }],
  },
  {
    id: 'item.soma', name: 'Soma', icon: '🫙', color: '#00cec9',
    description: 'A miraculous elixir. Fully restores one ally\'s HP and MP.', kind: 'consumable',
    value: 1200, stackable: true,
    onUse: [{ t: 'fullHeal' }],
  },
  {
    id: 'item.mp_bead', name: 'Magic Bead', icon: '🔵', color: '#0984e3',
    description: 'A small sapphire bead filled with arcane energy. Restores 30 MP.', kind: 'consumable',
    value: 150, stackable: true,
    onUse: [{ t: 'restoreMp', amount: 30 }],
  },
  {
    id: 'item.mp_bead_hi', name: 'Hi-Magic Bead', icon: '🔵', color: '#6c5ce7',
    description: 'A larger MP bead. Restores 80 MP.', kind: 'consumable',
    value: 400, stackable: true,
    onUse: [{ t: 'restoreMp', amount: 80 }],
  },
  {
    id: 'item.bead', name: 'Bead', icon: '⚪', color: '#f5f6fa',
    description: 'A sacred bead of revival. Revives a fallen ally with half HP.', kind: 'consumable',
    value: 500, stackable: true,
    onUse: [{ t: 'reviveRandom' }],
  },
  {
    id: 'item.bead_chain', name: 'Bead Chain', icon: '📿', color: '#ffeaa7',
    description: 'A chain of sacred beads. Revives all fallen allies with full HP.', kind: 'consumable',
    value: 3000, stackable: true,
    onUse: [{ t: 'fullHeal' }],
  },
  {
    id: 'item.dis_poison', name: 'Dis-Poison', icon: '🍃', color: '#55efc4',
    description: 'An antidote tablet. Cures Poison from one ally.', kind: 'consumable',
    value: 50, stackable: true,
    onUse: [{ t: 'cure', status: 'status.poisoned' }],
  },
  {
    id: 'item.dis_panic', name: 'Dis-Panic', icon: '💛', color: '#ffeaa7',
    description: 'A calming draught. Cures Panic and Charm from one ally.', kind: 'consumable',
    value: 60, stackable: true,
    onUse: [
      { t: 'cure', status: 'status.panicked' },
      { t: 'cure', status: 'status.charmed' },
    ],
  },
  {
    id: 'item.amrita', name: 'Amrita', icon: '✨', color: '#fdcb6e',
    description: 'Divine water that purifies all ailments from one ally.', kind: 'consumable',
    value: 300, stackable: true,
    onUse: [{ t: 'cure', status: 'all' }],
  },
  {
    id: 'item.smoke_bomb', name: 'Smoke Bomb', icon: '💨', color: '#636e72',
    description: 'Creates a smoke screen. Guarantees escape from battle.', kind: 'consumable',
    value: 100, stackable: true,
    onUse: [{ t: 'message', text: 'A smoke bomb erupts, covering your escape!' }],
  },
  {
    id: 'item.trafuri', name: 'Traesto Gem', icon: '💎', color: '#a29bfe',
    description: 'A teleportation gem. Instantly warps the party to the dungeon entrance.', kind: 'consumable',
    value: 400, stackable: true,
    onUse: [{ t: 'message', text: 'A shimmering portal whisks the party away...' }],
  },
  // ── Weapons ────────────────────────────────────────────────────────────────────
  {
    id: 'item.shortsword', name: 'Shortsword', icon: '🗡️', color: '#b2bec3',
    description: 'A simple one-handed blade. Reliable and easy to use.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'blade',
    value: 150, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 2 }],
  },
  {
    id: 'item.longsword', name: 'Longsword', icon: '⚔️', color: '#dfe6e9',
    description: 'A well-balanced blade with excellent reach.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'blade',
    value: 400, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 4 }],
  },
  {
    id: 'item.katana', name: 'Katana', icon: '⚔️', color: '#e17055',
    description: 'A razor-sharp curved blade of superior craftsmanship.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'blade', twoHanded: true,
    value: 900, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 6 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.zweihander', name: 'Zweihänder', icon: '⚔️', color: '#636e72',
    description: 'A massive two-handed greatsword. Devastating but slow.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'blade', twoHanded: true,
    value: 1200, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 10 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -2 },
    ],
  },
  {
    id: 'item.battle_axe', name: 'Battle Axe', icon: '🪓', color: '#b07d4a',
    description: 'A heavy war axe that cleaves through armor.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'axe', twoHanded: true,
    value: 500, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 7 }],
  },
  {
    id: 'item.mace', name: 'Mace', icon: '🔨', color: '#a0522d',
    description: 'A flanged mace blessed against the undead.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'mace',
    value: 300, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 3 }],
  },
  {
    id: 'item.stiletto', name: 'Stiletto', icon: '🗡️', color: '#2d3436',
    description: 'A slim, fast dagger ideal for precision strikes.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'dagger',
    value: 250, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 2 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.kris_knife', name: 'Kris Knife', icon: '🗡️', color: '#6c5ce7',
    description: 'A wavy-bladed ritual dagger. Said to carry dark power.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'dagger',
    value: 700, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 4 },
      { target: 'attribute', key: 'intellect', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.staff_fire', name: 'Flame Staff', icon: '🔥', color: '#e74c3c',
    description: 'A staff imbued with fire magic. Boosts arcane and elemental power.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'staff',
    value: 650, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 5 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.staff_frost', name: 'Frost Staff', icon: '❄️', color: '#74b9ff',
    description: 'A staff channelling frozen power.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'staff',
    value: 650, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 5 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.wand', name: 'Magic Wand', icon: '🪄', color: '#a29bfe',
    description: 'A simple wand for focusing magical energy.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'wand',
    value: 200, stackable: false,
    modifiers: [{ target: 'attribute', key: 'intellect', op: 'add', amount: 3 }],
  },
  {
    id: 'item.holy_spear', name: 'Holy Spear', icon: '✝️', color: '#f9ca24',
    description: 'A spear blessed by divine power. Extra effective against the undead.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'spear', twoHanded: true,
    value: 1800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 7 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.pistol', name: 'Pistol', icon: '🔫', color: '#636e72',
    description: 'A semi-automatic handgun. Fast and concealable.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'gun',
    value: 500, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'agility', op: 'add', amount: 2 },
      { target: 'attribute', key: 'might', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.assault_rifle', name: 'Assault Rifle', icon: '🔫', color: '#2d3436',
    description: 'A military-grade rifle. High damage at range.',
    kind: 'weapon', slot: 'weapon', weaponKind: 'gun', twoHanded: true,
    value: 1500, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 8 }],
  },
  // ── Armor ──────────────────────────────────────────────────────────────────────
  {
    id: 'item.leather_vest', name: 'Leather Vest', icon: '🥋', color: '#b07d4a',
    description: 'Simple but reliable leather protection.',
    kind: 'armor', slot: 'body',
    value: 120, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 2 }],
  },
  {
    id: 'item.chain_mail', name: 'Chain Mail', icon: '🛡️', color: '#b2bec3',
    description: 'Interlocking rings of steel. Moderate protection with decent flexibility.',
    kind: 'armor', slot: 'body',
    value: 400, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 5 }],
  },
  {
    id: 'item.plate_armor', name: 'Plate Armor', icon: '🛡️', color: '#636e72',
    description: 'Full plate steel armor. Maximum protection, but heavy.',
    kind: 'armor', slot: 'body',
    value: 1100, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 9 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -2 },
    ],
  },
  {
    id: 'item.mage_robe', name: "Mage's Robe", icon: '👘', color: '#6c5ce7',
    description: 'A robe woven with arcane thread. Boosts magic power.',
    kind: 'armor', slot: 'body',
    value: 350, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 4 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.shadow_cloak', name: 'Shadow Cloak', icon: '🌑', color: '#2d3436',
    description: 'A cloak that bends shadow. Boosts agility and reduces encounter rate.',
    kind: 'armor', slot: 'body',
    value: 800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'agility', op: 'add', amount: 4 },
      { target: 'attribute', key: 'luck', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.mythril_vest', name: 'Mythril Vest', icon: '✨', color: '#a29bfe',
    description: 'A lightweight vest of refined mythril. Excellent protection with minimal encumbrance.',
    kind: 'armor', slot: 'body',
    value: 2500, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 8 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 2 },
    ],
  },
  // ── Shields ────────────────────────────────────────────────────────────────────
  {
    id: 'item.buckler', name: 'Buckler', icon: '🛡️', color: '#b07d4a',
    description: 'A small round shield. Easy to wield and reasonably protective.',
    kind: 'armor', slot: 'offhand',
    value: 100, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 2 }],
  },
  {
    id: 'item.heater_shield', name: 'Heater Shield', icon: '🛡️', color: '#b2bec3',
    description: 'A sturdy kite shield offering strong protection.',
    kind: 'armor', slot: 'offhand',
    value: 450, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 5 }],
  },
  {
    id: 'item.mythril_shield', name: 'Mythril Shield', icon: '✨', color: '#74b9ff',
    description: 'A shining mythril shield. Repels dark magic.',
    kind: 'armor', slot: 'offhand',
    value: 1800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 7 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  // ── Helmets ────────────────────────────────────────────────────────────────────
  {
    id: 'item.leather_helm', name: 'Leather Helm', icon: '⛑️', color: '#b07d4a',
    description: 'A simple leather cap offering basic head protection.',
    kind: 'armor', slot: 'head',
    value: 80, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 1 }],
  },
  {
    id: 'item.iron_helm', name: 'Iron Helm', icon: '⛑️', color: '#636e72',
    description: 'A solid iron helmet.',
    kind: 'armor', slot: 'head',
    value: 250, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 3 }],
  },
  // ── Accessories ────────────────────────────────────────────────────────────────
  {
    id: 'item.magatama', name: 'Magatama', icon: '🔮', color: '#00cec9',
    description: 'A comma-shaped jewel of spiritual power. Sharpens both mind and soul.',
    kind: 'misc', slot: 'amulet',
    value: 1000, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 3 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.bead_ring', name: 'Prayer Beads', icon: '📿', color: '#ffeaa7',
    description: 'Sacred beads worn around the wrist. Boosts spiritual defense.',
    kind: 'misc', slot: 'ring',
    value: 600, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
      { target: 'attribute', key: 'luck', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.lucky_charm', name: 'Lucky Charm', icon: '🍀', color: '#00b894',
    description: 'A four-leaf clover pressed in glass. Raises fortune considerably.',
    kind: 'misc', slot: 'ring',
    value: 400, stackable: false,
    modifiers: [{ target: 'attribute', key: 'luck', op: 'add', amount: 6 }],
  },
  // ── Key Items ─────────────────────────────────────────────────────────────────
  {
    id: 'item.skeleton_key', name: 'Skeleton Key', icon: '🗝️', color: '#b07d4a',
    description: 'A worn key that can open many basic locks.', kind: 'key',
    value: 0, stackable: false,
  },
  {
    id: 'item.bronze_key', name: 'Bronze Key', icon: '🗝️', color: '#cd853f',
    description: 'A heavy bronze key. Opens bronze-locked doors.', kind: 'key',
    value: 0, stackable: false,
  },
  {
    id: 'item.silver_key', name: 'Silver Key', icon: '🗝️', color: '#b2bec3',
    description: 'A silver key bearing the palace crest.', kind: 'key',
    value: 0, stackable: false,
  },
  {
    id: 'item.gold_key', name: 'Gold Key', icon: '🔑', color: '#f9ca24',
    description: 'A gleaming gold key. Opens the most important doors.', kind: 'key',
    value: 0, stackable: false,
  },
  {
    id: 'item.demon_mirror', name: 'Demon Mirror', icon: '🪞', color: '#6c5ce7',
    description: 'A cracked obsidian mirror said to reveal hidden truths.', kind: 'quest',
    value: 0, stackable: false,
  },
  {
    id: 'item.old_coin', name: 'Old Coin', icon: '🪙', color: '#b8860b',
    description: 'An ancient coin from a forgotten civilization. Someone might want this.', kind: 'quest',
    value: 0, stackable: false,
  },
]

// ── Enemies ────────────────────────────────────────────────────────────────────

export const DEFAULT_ENEMIES: EnemyDef[] = [
  // ── Tier 1: Surface / Cave Entrance ──────────────────────────────────────────
  {
    id: 'enemy.slime', name: 'Slime', icon: '🫧', color: '#00cec9',
    description: 'A gelatinous mass of semi-sentient ooze that absorbs almost anything.',
    hp: 25, attack: 8, defense: 2, speed: 3, xp: 10, gold: { min: 2, max: 8 },
    attributes: { might: 6, agility: 3, endurance: 14 },
    resistances: { physical: 0.25, fire: -0.5, ice: -0.5 },
    loot: 'loot.weak_demon',
    abilities: [
      { weight: 1, effects: [{ t: 'damage', dmgType: 'physical', amount: '1d4', canCrit: false }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.pixie', name: 'Pixie', icon: '🧚', color: '#fd79a8',
    description: 'A tiny mischievous fairy. Weak in body but quick and knows a touch of magic.',
    hp: 30, attack: 10, defense: 4, speed: 12, xp: 15, gold: { min: 3, max: 12 },
    attributes: { might: 7, agility: 12, intellect: 10, spirit: 9 },
    resistances: { dark: 0.5 },
    loot: 'loot.fairy_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'heal', amount: '1d6+2' }], target: 'ally' },
    ],
  },
  {
    id: 'enemy.obariyon', name: 'Obariyon', icon: '👺', color: '#e17055',
    description: 'A small red demon that loves leaping onto people\'s backs and crushing them.',
    hp: 40, attack: 14, defense: 6, speed: 9, xp: 20, gold: { min: 5, max: 18 },
    attributes: { might: 13, agility: 9, endurance: 10 },
    loot: 'loot.weak_demon',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '1d8+2', canCrit: true }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.mokoi', name: 'Mokoi', icon: '💀', color: '#2d3436',
    description: 'The spirit of a murdered man whose grudge prevents it from passing on.',
    hp: 45, attack: 12, defense: 5, speed: 7, xp: 22, gold: { min: 4, max: 15 },
    attributes: { might: 10, intellect: 11, spirit: 8 },
    resistances: { dark: 0.5, holy: -0.5 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '1d6', canCrit: false }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'status', status: 'status.bound', chance: 0.5 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.jack_frost', name: 'Jack Frost', icon: '⛄', color: '#74b9ff',
    description: 'An adorable snowman-like spirit with an icy personality and freezing powers.',
    hp: 50, attack: 13, defense: 8, speed: 10, xp: 28, gold: { min: 6, max: 20 },
    attributes: { might: 9, agility: 10, intellect: 13 },
    resistances: { ice: 1.0, fire: -0.75 },
    loot: 'loot.fairy_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'ice', amount: '1d8+3', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'status', status: 'status.frozen', chance: 0.35 }], target: 'enemy' },
    ],
  },
  // ── Tier 2: Cave / Dungeon ────────────────────────────────────────────────────
  {
    id: 'enemy.pyro_jack', name: 'Pyro Jack', icon: '🎃', color: '#e17055',
    description: 'A flaming jack-o-lantern spirit who hurls fireballs with glee.',
    hp: 60, attack: 16, defense: 9, speed: 11, xp: 38, gold: { min: 8, max: 28 },
    attributes: { might: 10, agility: 11, intellect: 15 },
    resistances: { fire: 1.0, ice: -0.75 },
    loot: 'loot.fairy_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'fire', amount: '2d6+3', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'status', status: 'status.burned', chance: 0.40 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.lilim', name: 'Lilim', icon: '😈', color: '#fd79a8',
    description: 'A seductive demoness born from Lilith. Uses charm to bewitch and drain her prey.',
    hp: 65, attack: 14, defense: 10, speed: 13, xp: 42, gold: { min: 10, max: 35 },
    attributes: { might: 10, agility: 13, intellect: 14, spirit: 12, luck: 14 },
    resistances: { dark: 0.5, holy: -0.5 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '1d8+4', canCrit: false }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'status', status: 'status.charmed', chance: 0.55 }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'heal', amount: '1d8+4' }], target: 'ally' },
    ],
  },
  {
    id: 'enemy.fallen', name: 'Fallen Angel', icon: '🪽', color: '#6c5ce7',
    description: 'An angel cast down from the heavens. Bitter and wrathful, wielding dark fire.',
    hp: 70, attack: 18, defense: 12, speed: 11, xp: 48, gold: { min: 12, max: 40 },
    attributes: { might: 15, agility: 11, intellect: 16, spirit: 10 },
    resistances: { dark: 0.5, fire: 0.25, holy: -0.5 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'fire', amount: '2d6+4', canCrit: true }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '2d6+4', canCrit: true }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.bicorn', name: 'Bicorn', icon: '🦄', color: '#2d3436',
    description: 'A dark two-horned horse. Unlike the unicorn, it despises virtue.',
    hp: 80, attack: 20, defense: 11, speed: 14, xp: 45, gold: { min: 10, max: 30 },
    attributes: { might: 17, agility: 14, endurance: 13 },
    resistances: { dark: 0.25 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+4', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+6', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.apsaras', name: 'Apsaras', icon: '💧', color: '#74b9ff',
    description: 'A divine water spirit from Hindu mythology. Graceful and dangerous.',
    hp: 75, attack: 16, defense: 12, speed: 13, xp: 45, gold: { min: 10, max: 30 },
    attributes: { might: 12, agility: 13, intellect: 15, spirit: 14 },
    resistances: { ice: 0.5, fire: -0.25 },
    loot: 'loot.divine_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'ice', amount: '2d6+4', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'status', status: 'status.frozen', chance: 0.30 }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'heal', amount: '2d6+3' }], target: 'allAllies' },
    ],
  },
  {
    id: 'enemy.zombie', name: 'Zombie', icon: '🧟', color: '#636e72',
    description: 'The reanimated corpse of an unfortunate soul. Slow but infectious.',
    hp: 75, attack: 17, defense: 8, speed: 4, xp: 35, gold: { min: 0, max: 5 },
    attributes: { might: 15, agility: 4, endurance: 18 },
    resistances: { physical: 0.25, dark: 0.5, poison: 1.0, holy: -0.75, fire: -0.25 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6+3', canCrit: false }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'status', status: 'status.poisoned', chance: 0.40 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.ghost', name: 'Ghost', icon: '👻', color: '#dfe6e9',
    description: 'A spectral entity that drains the life from the living.',
    hp: 55, attack: 15, defense: 14, speed: 10, xp: 40, gold: { min: 0, max: 10 },
    attributes: { might: 10, agility: 10, intellect: 12, spirit: 13 },
    resistances: { physical: 0.5, dark: 0.5, holy: -0.75, poison: 1.0 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '1d8+3', canCrit: false }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'dark', amount: '2d6+2', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.oni', name: 'Oni', icon: '👹', color: '#e74c3c',
    description: 'A hulking red demon of Japanese legend. Carries an iron club and breathes fire.',
    hp: 90, attack: 22, defense: 14, speed: 9, xp: 58, gold: { min: 15, max: 45 },
    attributes: { might: 20, agility: 9, endurance: 16, intellect: 10 },
    resistances: { fire: 0.5 },
    loot: 'loot.mid_demon',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+6', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'fire', amount: '2d8+4', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.ogre', name: 'Ogre', icon: '👾', color: '#b07d4a',
    description: 'A massive, brutish creature that relies entirely on raw strength.',
    hp: 100, attack: 24, defense: 12, speed: 6, xp: 55, gold: { min: 10, max: 40 },
    attributes: { might: 22, agility: 6, endurance: 18 },
    loot: 'loot.mid_demon',
    abilities: [
      { weight: 4, effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+8', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+6', canCrit: false }], target: 'allEnemies' },
    ],
  },
  // ── Tier 3: Deep Dungeon ──────────────────────────────────────────────────────
  {
    id: 'enemy.skeleton', name: 'Skeleton Warrior', icon: '💀', color: '#dfe6e9',
    description: 'The animated bones of a fallen warrior, still wearing rusted armor.',
    hp: 85, attack: 19, defense: 16, speed: 8, xp: 52, gold: { min: 5, max: 25 },
    attributes: { might: 17, agility: 8, endurance: 16 },
    resistances: { physical: 0.25, dark: 0.5, poison: 1.0, holy: -0.5, ice: -0.25 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+5', canCrit: true }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.succubus', name: 'Succubus', icon: '😈', color: '#6c5ce7',
    description: 'A powerful night demon who drains her victims dry, leaving nothing but a husk.',
    hp: 90, attack: 18, defense: 16, speed: 14, xp: 70, gold: { min: 20, max: 60 },
    attributes: { might: 12, agility: 14, intellect: 18, spirit: 16, luck: 16 },
    resistances: { dark: 0.75, fire: 0.25, holy: -0.75 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '2d8+6', canCrit: false }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'status', status: 'status.charmed', chance: 0.65 }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'status', status: 'status.asleep', chance: 0.50 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.incubus', name: 'Incubus', icon: '😈', color: '#a29bfe',
    description: 'The male counterpart to the Succubus. Sows panic and feeds on despair.',
    hp: 95, attack: 20, defense: 16, speed: 13, xp: 72, gold: { min: 20, max: 60 },
    attributes: { might: 14, agility: 13, intellect: 17, spirit: 15 },
    resistances: { dark: 0.75, holy: -0.75 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '2d8+5', canCrit: true }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'status', status: 'status.panicked', chance: 0.60 }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'dark', amount: '2d6+4', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.naga', name: 'Naga', icon: '🐍', color: '#2ecc71',
    description: 'A serpentine demon of ancient power. Poisons all it strikes.',
    hp: 110, attack: 22, defense: 17, speed: 12, xp: 80, gold: { min: 18, max: 55 },
    attributes: { might: 18, agility: 12, endurance: 18, intellect: 14 },
    resistances: { poison: 1.0, lightning: -0.25 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'poison', amount: '2d8+6', canCrit: true }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'status', status: 'status.poisoned', chance: 0.65 }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'poison', amount: '2d6+4', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.archangel', name: 'Archangel', icon: '👼', color: '#f9ca24',
    description: 'A mighty holy warrior bearing celestial arms and the will to smite evil.',
    hp: 100, attack: 22, defense: 20, speed: 14, xp: 88, gold: { min: 20, max: 60 },
    attributes: { might: 18, agility: 14, intellect: 16, spirit: 22 },
    resistances: { holy: 1.0, dark: -0.75, fire: 0.25 },
    loot: 'loot.divine_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'holy', amount: '2d8+6', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'holy', amount: '2d6+4', canCrit: false }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'heal', amount: '2d8+6' }], target: 'allAllies' },
    ],
  },
  {
    id: 'enemy.loup_garou', name: 'Loup-Garou', icon: '🐺', color: '#636e72',
    description: 'A werewolf of French legend. Rends flesh with supernatural fury under the moon.',
    hp: 120, attack: 26, defense: 16, speed: 16, xp: 90, gold: { min: 15, max: 50 },
    attributes: { might: 22, agility: 16, endurance: 18 },
    resistances: { physical: 0.25, fire: -0.25 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+8', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+6', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.lich', name: 'Lich', icon: '💀', color: '#6c5ce7',
    description: 'An undead archmage who transcended death through dark ritual. A master of death magic.',
    hp: 140, attack: 24, defense: 20, speed: 9, xp: 120, gold: { min: 30, max: 90 },
    attributes: { might: 12, agility: 9, intellect: 26, spirit: 24, endurance: 16 },
    resistances: { dark: 0.75, poison: 1.0, holy: -0.75, fire: 0.25 },
    loot: 'loot.strong_demon',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '3d8+8', canCrit: true }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '2d8+6', canCrit: false }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'status', status: 'status.bound', chance: 0.55 }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'heal', amount: '3d8+10' }], target: 'ally' },
    ],
  },
  // ── Boss Tier ─────────────────────────────────────────────────────────────────
  {
    id: 'enemy.troll', name: 'Troll', icon: '🧌', color: '#27ae60',
    description: 'A monstrous cave troll that regenerates rapidly. Must be burned or frozen to stop regeneration.',
    hp: 200, attack: 28, defense: 22, speed: 7, xp: 200, gold: { min: 50, max: 120 },
    attributes: { might: 24, agility: 7, endurance: 26 },
    resistances: { physical: 0.5, fire: -0.5, ice: -0.5 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '4d6+10', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'physical', amount: '3d8+8', canCrit: false }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'heal', amount: '2d10+8' }], target: 'ally' },
    ],
  },
  {
    id: 'enemy.baphomet', name: 'Baphomet', icon: '🐐', color: '#2d3436',
    description: 'The Sabbatic Goat. A demonic idol of chaos worshipped by cultists. Commands all elements.',
    hp: 220, attack: 30, defense: 24, speed: 12, xp: 250, gold: { min: 60, max: 150 },
    attributes: { might: 20, agility: 12, intellect: 24, spirit: 22, endurance: 18 },
    resistances: { dark: 0.75, fire: 0.5, ice: 0.5, lightning: 0.5, holy: -0.75 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'fire', amount: '3d8+8', canCrit: true }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'damage', dmgType: 'dark', amount: '3d8+8', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'lightning', amount: '3d6+6', canCrit: false }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'status', status: 'status.charmed', chance: 0.50 }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.minotaur', name: 'Minotaur', icon: '🐂', color: '#b07d4a',
    description: 'The bull-headed guardian of the labyrinth. Unstoppable in the confines of its maze.',
    hp: 350, attack: 36, defense: 28, speed: 10, xp: 500, gold: { min: 100, max: 250 },
    attributes: { might: 30, agility: 10, endurance: 28 },
    resistances: { physical: 0.25, lightning: -0.25 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, effects: [{ t: 'damage', dmgType: 'physical', amount: '5d6+12', canCrit: true }], target: 'enemy' },
      { weight: 1, effects: [{ t: 'damage', dmgType: 'physical', amount: '4d8+10', canCrit: false }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'status', status: 'status.bound', chance: 0.60 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.medusa', name: 'Medusa', icon: '🐍', color: '#a29bfe',
    description: 'The gorgon whose petrifying gaze turns the unwary to stone. Her serpent hair drips venom.',
    hp: 300, attack: 28, defense: 26, speed: 14, xp: 450, gold: { min: 80, max: 200 },
    attributes: { might: 20, agility: 14, intellect: 22, spirit: 18, luck: 16 },
    resistances: { poison: 1.0, dark: 0.5, holy: -0.5 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 2, effects: [{ t: 'damage', dmgType: 'poison', amount: '3d8+8', canCrit: true }], target: 'enemy' },
      { weight: 2, effects: [{ t: 'status', status: 'status.frozen', chance: 0.55 }], target: 'allEnemies' },
      { weight: 1, effects: [{ t: 'status', status: 'status.panicked', chance: 0.60 }], target: 'allEnemies' },
    ],
  },
]

// ── Encounter Tables ───────────────────────────────────────────────────────────

export const DEFAULT_ENCOUNTER_TABLES: EncounterTableDef[] = [
  {
    id: 'enc.surface_early', name: 'Surface (Early)', icon: '🌿', color: '#55efc4',
    description: 'Weak demons roaming near the dungeon entrance. Good for new adventurers.',
    entries: [
      { enemy: 'enemy.slime',     min: 1, max: 3, weight: 3 },
      { enemy: 'enemy.pixie',     min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.obariyon',  min: 1, max: 2, weight: 2 },
    ],
  },
  {
    id: 'enc.cave_shallow', name: 'Cave (Shallow)', icon: '🪨', color: '#b07d4a',
    description: 'The upper floors of the dungeon. Elemental sprites and brutes.',
    entries: [
      { enemy: 'enemy.jack_frost', min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.obariyon',   min: 1, max: 3, weight: 3 },
      { enemy: 'enemy.mokoi',      min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.pixie',      min: 1, max: 3, weight: 2 },
      { enemy: 'enemy.slime',      min: 2, max: 4, weight: 1 },
    ],
  },
  {
    id: 'enc.cave_deep', name: 'Cave (Deep)', icon: '🔥', color: '#e17055',
    description: 'Deeper floors with fiercer demons. Bring fire resistance.',
    entries: [
      { enemy: 'enemy.pyro_jack',  min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.oni',        min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.ogre',       min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.fallen',     min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.lilim',      min: 1, max: 2, weight: 1 },
    ],
  },
  {
    id: 'enc.undead_crypt', name: 'Undead Crypt', icon: '💀', color: '#6c5ce7',
    description: 'A crypt teeming with restless undead. Holy magic recommended.',
    entries: [
      { enemy: 'enemy.zombie',     min: 2, max: 4, weight: 4 },
      { enemy: 'enemy.ghost',      min: 1, max: 3, weight: 3 },
      { enemy: 'enemy.skeleton',   min: 1, max: 3, weight: 3 },
      { enemy: 'enemy.mokoi',      min: 1, max: 2, weight: 2 },
    ],
  },
  {
    id: 'enc.high_dungeon', name: 'High Dungeon', icon: '⚔️', color: '#a29bfe',
    description: 'The deepest floors, home to mighty demons. Only the prepared survive.',
    entries: [
      { enemy: 'enemy.loup_garou', min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.naga',       min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.archangel',  min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.succubus',   min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.incubus',    min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.lich',       min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: 'enc.chaos_realm', name: 'Chaos Realm', icon: '🌑', color: '#2d3436',
    description: 'A rift of pure chaos. Demons of every ilk clash in endless conflict.',
    entries: [
      { enemy: 'enemy.succubus',   min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.incubus',    min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.baphomet',   min: 1, max: 1, weight: 1 },
      { enemy: 'enemy.fallen',     min: 1, max: 3, weight: 2 },
      { enemy: 'enemy.lich',       min: 1, max: 1, weight: 1 },
    ],
  },
]

// ── Loot Tables ────────────────────────────────────────────────────────────────

export const DEFAULT_LOOT_TABLES: LootTableDef[] = [
  // ── Enemy drops ───────────────────────────────────────────────────────────────
  {
    id: 'loot.weak_demon', name: 'Weak Demon Drop', icon: '💰', color: '#b07d4a',
    description: 'Basic spoils from a weak demon.',
    gold: { min: 5, max: 20 },
    drops: [
      { item: 'item.medicine',   qty: 1, chance: 0.30 },
      { item: 'item.dis_poison', qty: 1, chance: 0.15 },
    ],
  },
  {
    id: 'loot.fairy_drop', name: 'Fairy Drop', icon: '✨', color: '#fd79a8',
    description: 'Sparkling trinkets left by a fairy demon.',
    gold: { min: 8, max: 30 },
    drops: [
      { item: 'item.medicine',    qty: 1,       chance: 0.25 },
      { item: 'item.lucky_charm', qty: 1,       chance: 0.08 },
      { item: 'item.amrita',      qty: 1,       chance: 0.06 },
    ],
  },
  {
    id: 'loot.night_drop', name: 'Night Demon Drop', icon: '🌑', color: '#6c5ce7',
    description: 'Dark treasures from a night demon.',
    gold: { min: 15, max: 50 },
    drops: [
      { item: 'item.hi_medicine', qty: 1, chance: 0.25 },
      { item: 'item.dis_panic',   qty: 1, chance: 0.20 },
      { item: 'item.kris_knife',  qty: 1, chance: 0.05 },
      { item: 'item.magatama',    qty: 1, chance: 0.04 },
    ],
  },
  {
    id: 'loot.undead_drop', name: 'Undead Drop', icon: '💀', color: '#636e72',
    description: 'Grim remnants of the undead.',
    gold: { min: 0, max: 15 },
    drops: [
      { item: 'item.medicine',    qty: 1, chance: 0.15 },
      { item: 'item.stiletto',    qty: 1, chance: 0.06 },
      { item: 'item.old_coin',    qty: 1, chance: 0.10 },
    ],
  },
  {
    id: 'loot.beast_drop', name: 'Beast Drop', icon: '🐾', color: '#b07d4a',
    description: 'Spoils from a feral demon.',
    gold: { min: 10, max: 40 },
    drops: [
      { item: 'item.medicine',    qty: '1d2', chance: 0.30 },
      { item: 'item.hi_medicine', qty: 1,     chance: 0.12 },
      { item: 'item.leather_vest',qty: 1,     chance: 0.06 },
    ],
  },
  {
    id: 'loot.mid_demon', name: 'Demon Drop (Mid)', icon: '💰', color: '#e17055',
    description: 'Spoils from a mid-tier demon.',
    gold: { min: 20, max: 60 },
    drops: [
      { item: 'item.hi_medicine', qty: 1, chance: 0.30 },
      { item: 'item.mp_bead',     qty: 1, chance: 0.20 },
      { item: 'item.shortsword',  qty: 1, chance: 0.06 },
      { item: 'item.chain_mail',  qty: 1, chance: 0.05 },
    ],
  },
  {
    id: 'loot.divine_drop', name: 'Divine Drop', icon: '☀️', color: '#f9ca24',
    description: 'Blessed items from a holy or divine being.',
    gold: { min: 15, max: 55 },
    drops: [
      { item: 'item.amrita',       qty: 1, chance: 0.15 },
      { item: 'item.bead',         qty: 1, chance: 0.10 },
      { item: 'item.prayer_beads', qty: 1, chance: 0.05 },
      { item: 'item.mythril_shield', qty: 1, chance: 0.03 },
    ],
  },
  {
    id: 'loot.strong_demon', name: 'Strong Demon Drop', icon: '⚔️', color: '#a29bfe',
    description: 'Powerful items from an elite demon.',
    gold: { min: 40, max: 110 },
    drops: [
      { item: 'item.mega_medicine', qty: 1, chance: 0.35 },
      { item: 'item.mp_bead_hi',    qty: 1, chance: 0.25 },
      { item: 'item.katana',        qty: 1, chance: 0.06 },
      { item: 'item.mage_robe',     qty: 1, chance: 0.06 },
      { item: 'item.magatama',      qty: 1, chance: 0.04 },
    ],
  },
  {
    id: 'loot.boss_drop', name: 'Boss Drop', icon: '💎', color: '#f9ca24',
    description: 'Rare and powerful rewards from a boss encounter.',
    gold: { min: 100, max: 400 },
    drops: [
      { item: 'item.soma',          qty: 1, chance: 0.40 },
      { item: 'item.bead_chain',    qty: 1, chance: 0.15 },
      { item: 'item.mythril_vest',  qty: 1, chance: 0.12 },
      { item: 'item.holy_spear',    qty: 1, chance: 0.08 },
      { item: 'item.assault_rifle', qty: 1, chance: 0.06 },
      { item: 'item.demon_mirror',  qty: 1, chance: 0.08 },
    ],
  },
  // ── Chests ────────────────────────────────────────────────────────────────────
  {
    id: 'loot.chest_t1', name: 'Chest (Tier 1)', icon: '📦', color: '#a0522d',
    description: 'A simple wooden chest. Basic gold and common supplies.',
    gold: { min: 10, max: 50 },
    drops: [
      { item: 'item.medicine',   qty: '1d2', chance: 0.50 },
      { item: 'item.dis_poison', qty: 1,     chance: 0.25 },
      { item: 'item.smoke_bomb', qty: 1,     chance: 0.20 },
      { item: 'item.old_coin',   qty: 1,     chance: 0.10 },
    ],
  },
  {
    id: 'loot.chest_t2', name: 'Chest (Tier 2)', icon: '🗃️', color: '#b8860b',
    description: 'A reinforced chest with decent rewards.',
    gold: { min: 50, max: 200 },
    drops: [
      { item: 'item.hi_medicine', qty: '1d2', chance: 0.45 },
      { item: 'item.mp_bead',     qty: 1,     chance: 0.30 },
      { item: 'item.amrita',      qty: 1,     chance: 0.15 },
      { item: 'item.longsword',   qty: 1,     chance: 0.08 },
      { item: 'item.chain_mail',  qty: 1,     chance: 0.08 },
      { item: 'item.magatama',    qty: 1,     chance: 0.05 },
    ],
  },
  {
    id: 'loot.chest_t3', name: 'Chest (Tier 3)', icon: '💎', color: '#4169e1',
    description: 'A heavily locked chest containing rare treasures.',
    gold: { min: 150, max: 600 },
    drops: [
      { item: 'item.soma',          qty: 1, chance: 0.35 },
      { item: 'item.bead',          qty: 1, chance: 0.30 },
      { item: 'item.mega_medicine', qty: 1, chance: 0.40 },
      { item: 'item.mythril_vest',  qty: 1, chance: 0.10 },
      { item: 'item.katana',        qty: 1, chance: 0.08 },
      { item: 'item.holy_spear',    qty: 1, chance: 0.06 },
      { item: 'item.gold_key',      qty: 1, chance: 0.08 },
    ],
  },
]

// ── Shops ──────────────────────────────────────────────────────────────────────

export const DEFAULT_SHOPS: ShopDef[] = [
  {
    id: 'shop.healer', name: 'Healer', icon: '⚕️', color: '#55efc4',
    description: 'A wandering healer stocking medicines and curatives.',
    buys: false, sellModifier: 0.5,
    stock: [
      { item: 'item.medicine',    price: 80 },
      { item: 'item.hi_medicine', price: 200 },
      { item: 'item.dis_poison',  price: 50 },
      { item: 'item.dis_panic',   price: 60 },
      { item: 'item.amrita',      price: 300 },
      { item: 'item.mp_bead',     price: 150 },
      { item: 'item.bead',        price: 500 },
      { item: 'item.smoke_bomb',  price: 100 },
    ],
  },
  {
    id: 'shop.armory', name: 'Armory', icon: '⚔️', color: '#636e72',
    description: 'A well-stocked armory dealing in weapons and shields.',
    buys: true, sellModifier: 0.4,
    stock: [
      { item: 'item.shortsword',   price: 150 },
      { item: 'item.longsword',    price: 400 },
      { item: 'item.mace',         price: 300 },
      { item: 'item.stiletto',     price: 250 },
      { item: 'item.wand',         price: 200 },
      { item: 'item.pistol',       price: 500 },
      { item: 'item.buckler',      price: 100 },
      { item: 'item.heater_shield',price: 450 },
      { item: 'item.leather_helm', price: 80 },
      { item: 'item.iron_helm',    price: 250 },
    ],
  },
  {
    id: 'shop.outfitter', name: 'Outfitter', icon: '👘', color: '#b07d4a',
    description: 'Sells armor, robes, and protective gear.',
    buys: true, sellModifier: 0.4,
    stock: [
      { item: 'item.leather_vest', price: 120 },
      { item: 'item.chain_mail',   price: 400 },
      { item: 'item.mage_robe',    price: 350 },
      { item: 'item.shadow_cloak', price: 800 },
      { item: 'item.bead_ring',    price: 600 },
      { item: 'item.lucky_charm',  price: 400 },
      { item: 'item.trafuri',      price: 400 },
    ],
  },
  {
    id: 'shop.black_market', name: 'Black Market', icon: '🌑', color: '#2d3436',
    description: 'Shady dealer with rare and unusual items. Prices are steep.',
    buys: true, sellModifier: 0.6,
    stock: [
      { item: 'item.katana',        price: 900 },
      { item: 'item.kris_knife',    price: 700 },
      { item: 'item.magatama',      price: 1000 },
      { item: 'item.mythril_vest',  price: 2500 },
      { item: 'item.mythril_shield',price: 1800 },
      { item: 'item.soma',          price: 1200 },
      { item: 'item.bead_chain',    price: 3000 },
      { item: 'item.assault_rifle', price: 1500 },
    ],
  },
]

// ── Ruleset ────────────────────────────────────────────────────────────────────

/**
 * Backfill collections added after a ruleset was saved — drafts and imports
 * from older versions lack newer tables (events/npcs/quests, etc.).
 */
export function normalizeRuleset(r: Ruleset): Ruleset {
  return {
    ...r,
    items: r.items ?? [],
    spells: r.spells ?? [],
    statusEffects: r.statusEffects ?? [],
    enemies: r.enemies ?? [],
    encounterTables: r.encounterTables ?? [],
    lootTables: r.lootTables ?? [],
    shops: r.shops ?? [],
    events: r.events ?? [],
    npcs: r.npcs ?? [],
    quests: r.quests ?? [],
  }
}

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
    items: DEFAULT_ITEMS,
    spells: DEFAULT_SPELLS,
    statusEffects: DEFAULT_STATUS_EFFECTS,
    enemies: DEFAULT_ENEMIES,
    encounterTables: DEFAULT_ENCOUNTER_TABLES,
    lootTables: DEFAULT_LOOT_TABLES,
    events: [],
    npcs: [],
    quests: [],
    shops: DEFAULT_SHOPS,
  }
}
