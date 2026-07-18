/**
 * Default ruleset — seeded with SMT-inspired content.
 * All entries are editable/removable in the Database workspace.
 */

import type {
  AttributeDef, AudioTrackDef, ClassDef, RaceDef, SpellDef, StatusEffectDef,
  ItemDef, WeaponTypeDef, ArmorTypeDef, SpellSchoolDef, SkillDef, EnemyDef, EncounterTableDef, LootTableDef, ShopDef,
  Ruleset,
} from './engine-types'
import { CHIP_TRACKS, CHIP_BOSS_INTRO, SFX_META } from './chiptune'
import { CLASS_GEAR_ITEMS } from './class-gear'

// ── Attributes ─────────────────────────────────────────────────────────────────

export const DEFAULT_ATTRIBUTES: AttributeDef[] = [
  { id: 'attr.might',     name: 'Might',     abbr: 'MGT', min: 3, max: 30, default: 10, description: 'Physical power; increases melee damage and max HP.' },
  { id: 'attr.agility',   name: 'Agility',   abbr: 'AGL', min: 3, max: 30, default: 10, description: 'Speed and dexterity; affects initiative, hit chance, and defense.' },
  { id: 'attr.intellect', name: 'Intellect', abbr: 'INT', min: 3, max: 30, default: 10, description: 'Mental acuity; boosts arcane spell power and max MP.' },
  { id: 'attr.spirit',    name: 'Spirit',    abbr: 'SPI', min: 3, max: 30, default: 10, description: 'Spiritual force; boosts divine spell power and max MP.' },
  { id: 'attr.endurance', name: 'Endurance', abbr: 'END', min: 3, max: 30, default: 10, description: 'Resilience; primary contributor to max HP.' },
  { id: 'attr.luck',      name: 'Luck',      abbr: 'LCK', min: 3, max: 30, default: 10, description: 'Fortune; increases critical hit chance and loot quality.' },
]

// ── Classes ────────────────────────────────────────────────────────────────────

export const DEFAULT_CLASSES: ClassDef[] = [
  {
    id: 'class.fighter', name: 'Fighter', icon: '⚔️', color: '#c0392b',
    description: 'A seasoned warrior who excels in melee combat and can wear heavy armor.',
    hitDie: 10, spellDie: 0, spellSchools: [],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponTypes: ['wtype.sword', 'wtype.katana', 'wtype.greatsword', 'wtype.axe', 'wtype.mace', 'wtype.hammer', 'wtype.spear', 'wtype.bow'],
    armorTypes: [],
    attrGrowth: { might: 1, endurance: 1 },
    levelPoints: 2,
    attrModifiers: { might: 2, endurance: 2 },
  },
  {
    id: 'class.mage', name: 'Mage', icon: '🔮', color: '#8e44ad',
    description: 'A scholarly spellcaster who channels arcane and elemental energies. Frail but devastating.',
    hitDie: 4, spellDie: 8, spellSchools: ['arcane', 'element'],
    allowedEquip: ['weapon', 'body', 'ring', 'amulet'],
    weaponTypes: ['wtype.staff', 'wtype.rod', 'wtype.dagger'],
    armorTypes: ['atype.robe', 'atype.light'],
    startingSpells: ['spell.agi', 'spell.bufu', 'spell.zio'],
    attrGrowth: { intellect: 2 },
    levelPoints: 2,
    attrModifiers: { intellect: 3 },
  },
  {
    id: 'class.cleric', name: 'Cleric', icon: '✝️', color: '#f39c12',
    description: 'A devoted priest wielding divine magic. Heals allies and smites the unholy.',
    hitDie: 6, spellDie: 6, spellSchools: ['divine', 'holy'],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponTypes: ['wtype.mace', 'wtype.staff', 'wtype.hammer'],
    armorTypes: ['atype.medium', 'atype.light', 'atype.robe', 'atype.buckler', 'atype.shield'],
    startingSpells: ['spell.dia', 'spell.hama', 'spell.cure_poison'],
    attrGrowth: { spirit: 2 },
    levelPoints: 2,
    attrModifiers: { spirit: 3 },
  },
  {
    id: 'class.rogue', name: 'Rogue', icon: '🗡️', color: '#27ae60',
    description: 'A quick and cunning adventurer skilled in stealth and precision strikes.',
    hitDie: 6, spellDie: 0, spellSchools: [],
    allowedEquip: ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponTypes: ['wtype.dagger', 'wtype.sword', 'wtype.bow', 'wtype.gun'],
    armorTypes: ['atype.light', 'atype.medium', 'atype.buckler'],
    attrGrowth: { agility: 2 },
    levelPoints: 3,
    attrModifiers: { agility: 3, luck: 1 },
  },
  {
    id: 'class.gunslinger', name: 'Gunslinger', icon: '🔫', color: '#2980b9',
    description: 'A sharp-eyed marksman wielding firearms and quick reflexes.',
    hitDie: 6, spellDie: 0, spellSchools: [],
    allowedEquip: ['weapon', 'head', 'body', 'hands', 'feet', 'ring', 'amulet'],
    weaponTypes: ['wtype.gun', 'wtype.heavy_gun'],
    armorTypes: ['atype.light', 'atype.medium'],
    attrGrowth: { agility: 1, luck: 1 },
    levelPoints: 2,
    attrModifiers: { agility: 2, luck: 2 },
  },
]

// ── Weapon & armor types ────────────────────────────────────────────────────────

export const DEFAULT_WEAPON_TYPES: WeaponTypeDef[] = [
  { id: 'wtype.sword',      name: 'Sword',      icon: '⚔️', color: '#dfe6e9', description: 'Balanced one-handed blades — the versatile martial standard.', weight: 'medium', scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.katana',     name: 'Katana',     icon: '🗡️', color: '#e17055', description: 'Curved single-edged blades prized for their keen cutting edge.', weight: 'medium', scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.greatsword', name: 'Greatsword', icon: '⚔️', color: '#636e72', description: 'Massive two-handed blades that trade speed for crushing force.', weight: 'heavy',  scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.axe',        name: 'Axe',        icon: '🪓', color: '#b07d4a', description: 'Heavy chopping weapons that bite deep but swing slow.',        weight: 'heavy',  scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.mace',       name: 'Mace',       icon: '🔨', color: '#a0522d', description: 'Blunt bludgeons that shatter armor and bone alike.',           weight: 'medium', scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.hammer',     name: 'Warhammer',  icon: '🔨', color: '#7f8c8d', description: 'Two-handed hammers built for raw concussive impact.',          weight: 'heavy',  scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.dagger',     name: 'Dagger',     icon: '🗡️', color: '#2d3436', description: 'Light, quick blades that reward speed over strength.',          weight: 'light',  scalingAttr: 'attr.agility',   damageType: 'physical', range: 'melee' },
  { id: 'wtype.spear',      name: 'Spear',      icon: '🔱', color: '#f9ca24', description: 'Long polearms with reach and thrusting power.',                weight: 'medium', scalingAttr: 'attr.might',     damageType: 'physical', range: 'melee' },
  { id: 'wtype.staff',      name: 'Staff',      icon: '🪄', color: '#8e44ad', description: 'Focusing rods that channel magic; feeble as a bludgeon.',      weight: 'light',  scalingAttr: 'attr.intellect', damageType: 'physical', range: 'melee' },
  { id: 'wtype.rod',        name: 'Rod',        icon: '🪄', color: '#a29bfe', description: 'Slender wands that amplify arcane precision.',                 weight: 'light',  scalingAttr: 'attr.intellect', damageType: 'physical', range: 'melee' },
  { id: 'wtype.bow',        name: 'Bow',        icon: '🏹', color: '#27ae60', description: 'Ranged weapons that strike from the back rank unhindered. Each shot draws an arrow from your pack.', weight: 'medium', scalingAttr: 'attr.agility',   damageType: 'physical', range: 'ranged', ammoType: 'arrow' },
  { id: 'wtype.gun',        name: 'Firearm',    icon: '🔫', color: '#636e72', description: 'Sidearms that reach across the field with agile precision. Fires from a clip; reload from carried rounds.', weight: 'medium', scalingAttr: 'attr.agility',   damageType: 'physical', range: 'ranged', ammoType: 'pistol_round' },
  { id: 'wtype.heavy_gun',  name: 'Heavy Gun',  icon: '🔫', color: '#2d3436', description: 'Two-handed firearms — devastating but cumbersome. Fires from a magazine; reload from carried rounds.', weight: 'heavy',  scalingAttr: 'attr.agility',   damageType: 'physical', range: 'ranged', ammoType: 'rifle_round' },
]

export const DEFAULT_ARMOR_TYPES: ArmorTypeDef[] = [
  { id: 'atype.light',   name: 'Light Armor',  icon: '🥋', color: '#b07d4a', description: 'Leathers and padding — freedom of movement over protection.', weight: 'light' },
  { id: 'atype.medium',  name: 'Medium Armor', icon: '🛡️', color: '#b2bec3', description: 'Mail and scale — a balance of guard and mobility.',           weight: 'medium', speedMod: -1 },
  { id: 'atype.heavy',   name: 'Heavy Armor',  icon: '🛡️', color: '#636e72', description: 'Plate — maximum protection at the cost of initiative.',        weight: 'heavy',  speedMod: -2 },
  { id: 'atype.robe',    name: 'Robe',         icon: '👘', color: '#6c5ce7', description: "A spellcaster's vestments — no burden on the arcane.",         weight: 'light' },
  { id: 'atype.buckler', name: 'Buckler',      icon: '🛡️', color: '#b07d4a', description: 'A small light shield strapped to the forearm.',                weight: 'light' },
  { id: 'atype.shield',  name: 'Shield',       icon: '🛡️', color: '#b2bec3', description: 'A full shield — sturdy cover that slows the guard.',            weight: 'medium', speedMod: -1 },
]

// ── Built-in music (synthesized chiptune library — zero assets) ─────────────────

export const DEFAULT_AUDIO_TRACKS: AudioTrackDef[] = [...CHIP_TRACKS, CHIP_BOSS_INTRO].map(t => ({
  id: t.id,
  name: t.name,
  icon: '🎵',
  description: 'Built-in synthesized chiptune. Replace with an upload any time.',
  source: 'builtin' as const,
  loop: t.id !== 'chip.boss_intro',
  volume: 1,
}))

/** Default global music slots — every fresh game is fully scored. */
export const DEFAULT_MUSIC_SLOTS = {
  titleMusicId: 'chip.title',
  defaultMusicId: 'chip.dungeon',
  battleMusicId: 'chip.battle',
  bossMusicId: 'chip.boss',
  bossIntroId: 'chip.boss_intro',
  victoryMusicId: 'chip.victory',
  gameOverMusicId: 'chip.gameover',
} as const

/** Built-in one-shot SFX, surfaced as AudioTrackDefs so they're managed in the
 *  Audio database next to music (previewable, replaceable with an upload). The
 *  `sfx.` id prefix keeps them out of the music namespace; playback strips it
 *  to find the synth spec in the SFX kit. */
export const DEFAULT_SFX_TRACKS: AudioTrackDef[] = SFX_META.map(s => ({
  id: `sfx.${s.name}`,
  name: s.label,
  icon: '🔊',
  description: 'Built-in synthesized sound effect. Replace with an upload any time.',
  role: 'sfx' as const,
  source: 'builtin' as const,
  loop: false,
  volume: 1,
}))

/** Default event→SFX assignments: each engine event points at its built-in. */
export const DEFAULT_SFX_SLOTS = Object.fromEntries(
  SFX_META.filter(s => s.event).map(s => [s.event!, `sfx.${s.name}`]),
) as Record<string, string>

// ── Spell schools ───────────────────────────────────────────────────────────────
// Ids are the historical school strings, so legacy spells/classes (which stored
// the raw string) reference these defs with zero remapping.

export const DEFAULT_SPELL_SCHOOLS: SpellSchoolDef[] = [
  { id: 'arcane',  name: 'Arcane',    icon: '🔮', color: '#8e44ad', description: 'Raw magical force and mind-bending trickery. Scales with Intellect.', keyAttribute: 'attr.intellect' },
  { id: 'element', name: 'Elemental', icon: '🔥', color: '#e17055', description: "Fire, ice, and storm bent to the caster's will. Scales with Intellect.", keyAttribute: 'attr.intellect' },
  { id: 'divine',  name: 'Divine',    icon: '✨', color: '#f39c12', description: 'Healing light and protective blessings. Scales with Spirit.', keyAttribute: 'attr.spirit' },
  { id: 'holy',    name: 'Holy',      icon: '✝️', color: '#f9ca24', description: 'Consecrated wrath against the unholy. Scales with Spirit.', keyAttribute: 'attr.spirit' },
  { id: 'dark',    name: 'Dark',      icon: '🌑', color: '#6c5ce7', description: 'Curses, death words, and entropy. Scales with Intellect.', keyAttribute: 'attr.intellect' },
]


// ── Skills (martial actives — HP/MP costs, cooldowns) ───────────────────────────

export const DEFAULT_SKILLS: SkillDef[] = [
  {
    id: 'skill.power_strike', name: 'Power Strike', icon: '💥', color: '#c0392b',
    description: 'Throw your whole body into one blow.',
    hpCostPct: 0.05, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6+4', canCrit: true }],
    learn: [{ classId: 'class.fighter', level: 1 }],
  },
  {
    id: 'skill.cleave', name: 'Cleave', icon: '🌪️', color: '#e17055',
    description: 'A sweeping arc that bites every foe.',
    hpCostPct: 0.12, cooldown: 2, target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '1d8+3', canCrit: false }],
    learn: [{ classId: 'class.fighter', level: 4 }],
  },
  {
    id: 'skill.viper_bite', name: 'Viper Bite', icon: '🐍', color: '#27ae60',
    description: 'A poisoned blade slipped between the ribs.',
    hpCostPct: 0.05, target: 'enemy',
    effects: [
      { t: 'damage', dmgType: 'poison', amount: '1d6+3', canCrit: true },
      { t: 'status', status: 'status.poisoned', chance: 0.5 },
    ],
    learn: [{ classId: 'class.rogue', level: 1 }],
  },
  {
    id: 'skill.deadeye', name: 'Deadeye', icon: '🎯', color: '#2980b9',
    description: 'One breath. One bullet.',
    hpCostPct: 0.08, cooldown: 2, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+2', canCrit: true }],
    learn: [{ classId: 'class.gunslinger', level: 2 }],
  },
  {
    id: 'skill.smite', name: 'Smite', icon: '⚡', color: '#f9ca24',
    description: 'Consecrated force brought down like a hammer.',
    mpCost: 4, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'holy', amount: '1d8+4', canCrit: false }],
    learn: [{ classId: 'class.cleric', level: 2 }],
  },
  {
    id: 'skill.war_cry', name: 'War Cry', icon: '📣', color: '#e17055',
    description: 'A rallying shout that stirs the whole party to fury.',
    cooldown: 3, target: 'allAllies',
    effects: [{ t: 'status', status: 'status.tarukaja' }],
    learn: [{ classId: 'class.fighter', level: 2 }],
  },
  {
    id: 'skill.armor_crush', name: 'Armor Crush', icon: '🔨', color: '#d63031',
    description: 'A brutal blow aimed at straps and plate — leaves them exposed.',
    hpCostPct: 0.05, target: 'enemy',
    effects: [
      { t: 'damage', dmgType: 'physical', amount: '1d6+2', canCrit: false },
      { t: 'status', status: 'status.armor_break', chance: 0.8 },
    ],
    learn: [{ classId: 'class.fighter', level: 5 }],
  },
  {
    id: 'skill.charge', name: 'Charge!', icon: '💢', color: '#e17055',
    description: 'Gather your strength — the next physical blow lands twice as hard.',
    target: 'self',
    effects: [{ t: 'status', status: 'status.charged' }],
    learn: [{ classId: 'class.fighter', level: 6 }],
  },
  {
    id: 'skill.flash_powder', name: 'Flash Powder', icon: '💨', color: '#ffeaa7',
    description: 'A blinding burst that leaves every foe stumbling.',
    cooldown: 2, target: 'allEnemies',
    effects: [{ t: 'status', status: 'status.sukunda', chance: 0.7 }],
    learn: [{ classId: 'class.rogue', level: 3 }],
  },
  {
    id: 'skill.pray', name: 'Pray', icon: '🙏', color: '#ffeaa7',
    description: "A whispered plea that knits the party's wounds. Costs nothing but time.",
    cooldown: 3, target: 'allAllies',
    effects: [{ t: 'heal', amount: '1d6+2' }],
    learn: [{ classId: 'class.cleric', level: 3 }],
  },
  {
    id: 'skill.guardians_chant', name: "Guardian's Chant", icon: '🛡️', color: '#0984e3',
    description: 'A protective litany laid over every ally.',
    mpCost: 5, cooldown: 3, target: 'allAllies',
    effects: [{ t: 'status', status: 'status.rakukaja' }],
    learn: [{ classId: 'class.cleric', level: 5 }],
  },
  {
    id: 'skill.scattershot', name: 'Scattershot', icon: '💥', color: '#2980b9',
    description: 'One wide, ragged volley across the enemy line.',
    hpCostPct: 0.08, target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6+2', canCrit: false }],
    learn: [{ classId: 'class.gunslinger', level: 4 }],
  },
  {
    id: 'skill.focus_aim', name: 'Focus Aim', icon: '🎯', color: '#2980b9',
    description: 'Slow the breath, line the shot — the next hit strikes true and hard.',
    target: 'self',
    effects: [{ t: 'status', status: 'status.charged' }],
    learn: [{ classId: 'class.gunslinger', level: 5 }],
  },
  // ── Gunslinger: Dark Tower–flavoured kit ──────────────────────────────────────
  {
    id: 'skill.gs_litany', name: "Gunslinger's Litany", icon: '🕯️', color: '#b8860b',
    description: 'I do not aim with my hand — I aim with my eye. A steadying creed that primes the whole line for a killing shot. (No ammo — may be used while reloading.)',
    cooldown: 4, target: 'allAllies',
    effects: [{ t: 'status', status: 'status.charged' }],
    learn: [{ classId: 'class.gunslinger', level: 3 }],
  },
  {
    id: 'skill.leg_shot', name: 'Leg Shot', icon: '🦵', color: '#c0392b',
    description: 'A called shot to the knee — hobbles the target so it acts late and misses more.',
    cooldown: 2, ammoCost: 1, target: 'enemy',
    effects: [
      { t: 'damage', dmgType: 'physical', amount: '1d6+2', canCrit: true },
      { t: 'status', status: 'status.winged', chance: 0.9 },
    ],
    learn: [{ classId: 'class.gunslinger', level: 6 }],
  },
  {
    id: 'skill.palaver', name: 'Palaver', icon: '💬', color: '#e67e22',
    description: 'A cold word and a colder stare that singles a foe out — Marked enemies take more from every hit. (No ammo — may be used while reloading.)',
    cooldown: 3, target: 'allEnemies',
    effects: [{ t: 'status', status: 'status.marked', chance: 0.85 }],
    learn: [{ classId: 'class.gunslinger', level: 7 }],
  },
  {
    id: 'skill.kill_eye', name: 'Kill with the Eye', icon: '👁️', color: '#2c3e50',
    description: 'One breath held, one perfect shot placed exactly where it will do the most harm.',
    hpCostPct: 0.06, cooldown: 3, ammoCost: 1, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '4d6+6', canCrit: true }],
    learn: [{ classId: 'class.gunslinger', level: 8 }],
  },
  {
    id: 'skill.suppressing_fire', name: 'Suppressing Fire', icon: '🔫', color: '#7f8c8d',
    description: 'Rake the line to keep heads down — light damage and shaken aim across all foes.',
    cooldown: 2, ammoCost: 2, target: 'allEnemies',
    effects: [
      { t: 'damage', dmgType: 'physical', amount: '1d4+1', canCrit: false },
      { t: 'status', status: 'status.sukunda', chance: 0.6 },
    ],
    learn: [{ classId: 'class.gunslinger', level: 9 }],
  },
  {
    id: 'skill.gut_shot', name: 'Gut Shot', icon: '🩸', color: '#a93226',
    description: 'A cruel low shot that leaves the wound weeping — damage now, and bleeding after.',
    cooldown: 2, ammoCost: 1, target: 'enemy',
    effects: [
      { t: 'damage', dmgType: 'physical', amount: '2d6+2', canCrit: true },
      { t: 'status', status: 'status.bleeding', chance: 0.8 },
    ],
    learn: [{ classId: 'class.gunslinger', level: 10 }],
  },
  {
    id: 'skill.khef', name: 'Khef', icon: '🌊', color: '#16a085',
    description: 'Share the water of life — steadies the party, clearing fear and charm and bolstering resolve. (No ammo — may be used while reloading.)',
    hpCostPct: 0.05, cooldown: 4, target: 'allAllies',
    effects: [
      { t: 'cure', status: 'status.panicked' },
      { t: 'cure', status: 'status.charmed' },
      { t: 'status', status: 'status.rakukaja' },
    ],
    learn: [{ classId: 'class.gunslinger', level: 11 }],
  },
  {
    id: 'skill.fan_hammer', name: 'Fan the Hammer', icon: '🤠', color: '#8e44ad',
    description: 'Empty the piece in a single roaring fan of lead — hits every foe, but burns through the clip.',
    hpCostPct: 0.08, cooldown: 3, ammoCost: 3, target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6+3', canCrit: true }],
    learn: [{ classId: 'class.gunslinger', level: 12 }],
  },
  {
    id: 'skill.concentrate', name: 'Concentrate', icon: '🌀', color: '#6c5ce7',
    description: 'Still the mind — the next damaging spell strikes for double.',
    target: 'self',
    effects: [{ t: 'status', status: 'status.concentrated' }],
    learn: [{ classId: 'class.mage', level: 5 }],
  },
  // ── Final Fantasy classics ────────────────────────────────────────────────────
  {
    id: 'skill.cross_slash', name: 'Cross-Slash', icon: '✖️', color: '#74b9ff',
    description: 'Three strokes in the shape of a kanji — the wound binds the foe in place.',
    hpCostPct: 0.1, target: 'enemy',
    effects: [
      { t: 'damage', dmgType: 'physical', amount: '3d6+6', canCrit: true },
      { t: 'status', status: 'status.bound', chance: 0.5 },
    ],
    learn: [{ classId: 'class.fighter', level: 7 }],
  },
  {
    id: 'skill.darkside', name: 'Darkside', icon: '🌑', color: '#2d3436',
    description: 'Feed your own life force into the blade for a devastating shadow strike.',
    hpCostPct: 0.2, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'dark', amount: '3d8+8', canCrit: true }],
    learn: [{ classId: 'class.fighter', level: 8 }],
  },
  {
    id: 'skill.shock', name: 'Shock', icon: '💥', color: '#f9ca24',
    description: 'Raise your weapon and bring a field of force crashing onto the whole enemy line.',
    hpCostPct: 0.1, cooldown: 3, target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+8', canCrit: false }],
    learn: [{ classId: 'class.fighter', level: 10 }],
  },
  {
    id: 'skill.sword_dance', name: 'Sword Dance', icon: '💃', color: '#e84393',
    description: 'A deadly waltz of steel — beautiful, unpredictable, and vicious.',
    hpCostPct: 0.08, cooldown: 3, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '4d6+4', canCrit: true }],
    learn: [{ classId: 'class.rogue', level: 6 }],
  },
  {
    id: 'skill.rapid_fire', name: 'Rapid Fire', icon: '🔫', color: '#2980b9',
    description: 'Empty the cylinder — four wild shots that trade accuracy for volume.',
    hpCostPct: 0.06, cooldown: 2, target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '4d4+4', canCrit: false }],
    learn: [{ classId: 'class.gunslinger', level: 7 }],
  },
  {
    id: 'skill.chakra', name: 'Chakra', icon: '🧘', color: '#00cec9',
    description: 'Open the inner gates and pour spiritual energy back into an ally.',
    cooldown: 3, target: 'ally',
    effects: [{ t: 'restoreMp', amount: '2d6+4' }],
    learn: [{ classId: 'class.cleric', level: 6 }, { classId: 'class.mage', level: 7 }],
  },
  // ── Monster techniques (no class learns them by default — grant via a class
  //    learn table to build a Blue Mage, or reference from enemy ability kits) ──
  {
    id: 'skill.goblin_punch', name: 'Goblin Punch', icon: '👊', color: '#27ae60',
    description: 'A headlong, artless haymaker. Somehow it works.',
    target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '2d4+2', canCrit: false }],
  },
  {
    id: 'skill.thousand_needles', name: '1000 Needles', icon: '🌵', color: '#6ab04c',
    description: 'Exactly one thousand needles. No more, no less, no dice about it.',
    target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: 30, canCrit: false }],
  },
  {
    id: 'skill.self_destruct', name: 'Self-Destruct', icon: '💥', color: '#e17055',
    description: 'Trade everything for one cataclysmic blast.',
    target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '4d6+6', canCrit: false }],
  },
  {
    id: 'skill.bad_breath', name: 'Bad Breath', icon: '🤢', color: '#6ab04c',
    description: 'An exhalation of every affliction known to alchemy, at once.',
    target: 'allEnemies',
    effects: [
      { t: 'status', status: 'status.poisoned', chance: 0.6 },
      { t: 'status', status: 'status.silenced', chance: 0.4 },
      { t: 'status', status: 'status.panicked', chance: 0.4 },
    ],
  },
  {
    id: 'skill.blaster', name: 'Blaster', icon: '⚡', color: '#a29bfe',
    description: 'A crack of paralyzing current from whip-like whiskers.',
    target: 'enemy',
    effects: [
      { t: 'damage', dmgType: 'lightning', amount: '1d8+3', canCrit: false },
      { t: 'status', status: 'status.shocked', chance: 0.6 },
    ],
  },
  {
    id: 'skill.chefs_knife', name: "Chef's Knife", icon: '🔪', color: '#00b894',
    description: 'One unhurried, expertly-placed cut. The lantern never wavers.',
    target: 'enemy',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '5d6+10', canCrit: true }],
  },
  {
    id: 'skill.dread_gaze', name: 'Dread Gaze', icon: '👁️', color: '#6c5ce7',
    description: 'A stare that unspools the mind into raw panic.',
    target: 'enemy',
    effects: [{ t: 'status', status: 'status.panicked', chance: 0.55 }],
  },
  {
    id: 'skill.petrifying_gaze', name: 'Petrifying Gaze', icon: '🗿', color: '#b2bec3',
    description: 'Meet its eyes and your limbs turn to stone.',
    target: 'allEnemies',
    effects: [{ t: 'status', status: 'status.frozen', chance: 0.55 }],
  },
  {
    id: 'skill.fire_breath', name: 'Fire Breath', icon: '🔥', color: '#e17055',
    description: 'A rolling cone of flame across the enemy line.',
    target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '2d8+5', canCrit: false }],
  },
  {
    id: 'skill.frost_breath', name: 'Frost Breath', icon: '❄️', color: '#74b9ff',
    description: 'A howling gale of razor ice across the enemy line.',
    target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'ice', amount: '2d8+5', canCrit: false }],
  },
  {
    id: 'skill.poison_breath', name: 'Poison Breath', icon: '☠️', color: '#2ecc71',
    description: 'A billowing cloud of venom that clings to everything it touches.',
    target: 'allEnemies',
    effects: [
      { t: 'damage', dmgType: 'poison', amount: '2d6+4', canCrit: false },
      { t: 'status', status: 'status.poisoned', chance: 0.35 },
    ],
  },
  {
    id: 'skill.wave_cannon', name: 'Wave Cannon', icon: '🔆', color: '#2d3436',
    description: 'A charged annihilation beam swept across the whole party.',
    target: 'allEnemies',
    effects: [{ t: 'damage', dmgType: 'fire', amount: '5d8+10', canCrit: false }],
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
    description: 'Takes poison damage each turn — and every few steps in the dungeon.',
    kind: 'dot', durationTurns: 4, blocksAction: false,
    tickEffects: [{ t: 'damage', dmgType: 'poison', amount: '1d4', canCrit: false }],
    persistsExploring: true, exploreStepInterval: 2,
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
    description: 'Recovers HP each turn — and while exploring.',
    kind: 'hot', durationTurns: 4, blocksAction: false,
    tickEffects: [{ t: 'heal', amount: '1d6' }],
    persistsExploring: true, exploreStepInterval: 2,
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
  {
    id: 'status.charged', name: 'Charged!', icon: '💢', color: '#e17055',
    description: 'Power gathered — the next physical attack or skill hits for double.',
    kind: 'buff', durationTurns: 3, blocksAction: false,
    boostScope: 'physical', boostMult: 2,
  },
  {
    id: 'status.concentrated', name: 'Concentrated', icon: '🌀', color: '#6c5ce7',
    description: 'Mind honed to a point — the next damaging spell hits for double.',
    kind: 'buff', durationTurns: 3, blocksAction: false,
    boostScope: 'magical', boostMult: 2,
  },
  {
    id: 'status.armor_break', name: 'Armor Broken', icon: '🛡️', color: '#d63031',
    description: 'Defenses shattered. Takes far more physical punishment.',
    kind: 'debuff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'derived', key: 'defense', op: 'add', amount: -6 }],
  },
  {
    id: 'status.haste', name: 'Haste', icon: '⏩', color: '#00b894',
    description: 'Time flows faster. Acts sooner and evades more easily.',
    kind: 'buff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 5 }],
  },
  {
    id: 'status.stopped', name: 'Stopped', icon: '⏱️', color: '#636e72',
    description: 'Frozen outside of time. Cannot act.',
    kind: 'control', durationTurns: 2, blocksAction: true,
  },
  {
    id: 'status.winged', name: 'Winged', icon: '🦵', color: '#c0392b',
    description: 'A leg shot — hobbled and slow. Acts late and struggles to evade.',
    kind: 'debuff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: -8 }],
  },
  {
    id: 'status.marked', name: 'Marked', icon: '🎯', color: '#e67e22',
    description: 'Singled out — every hit against them bites deeper.',
    kind: 'debuff', durationTurns: 3, blocksAction: false,
    modifiers: [{ target: 'derived', key: 'defense', op: 'add', amount: -5 }],
  },
  {
    id: 'status.bleeding', name: 'Bleeding', icon: '🩸', color: '#c0392b',
    description: 'An open wound that keeps taking its toll, even between fights.',
    kind: 'dot', durationTurns: 3, blocksAction: false,
    tickEffects: [{ t: 'damage', dmgType: 'physical', amount: '1d4' }],
    persistsExploring: true, exploreStepInterval: 3,
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
  {
    id: 'spell.kouha', name: 'Kouha', icon: '💠', color: '#f6e58d',
    school: 'holy', level: 4, mpCost: 9, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Blades of sacred light slash one foe. Medium holy damage.',
    effects: [{ t: 'damage', dmgType: 'holy', amount: '2d8+5', canCrit: true }],
  },
  {
    id: 'spell.makouha', name: 'Makouha', icon: '💠', color: '#ffe082',
    school: 'holy', level: 5, mpCost: 14, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'A burst of holy light washes over all foes. Light holy damage.',
    effects: [{ t: 'damage', dmgType: 'holy', amount: '2d6+4', canCrit: false }],
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
  // ── Eiha (Dark damage) ────────────────────────────────────────────────────────
  {
    id: 'spell.eiha', name: 'Eiha', icon: '🌑', color: '#6c5ce7',
    school: 'dark', level: 1, mpCost: 4, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A lash of cursed energy. Light dark damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: '1d8+3', canCrit: true }],
  },
  {
    id: 'spell.eiga', name: 'Eiga', icon: '🌑', color: '#5f27cd',
    school: 'dark', level: 4, mpCost: 9, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Coiling shadows crush the target. Medium dark damage to one foe.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: '2d8+5', canCrit: true }],
  },
  {
    id: 'spell.eigaon', name: 'Eigaon', icon: '🕳️', color: '#341f97',
    school: 'dark', level: 7, mpCost: 16, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A devouring void erupts beneath the target. Heavy dark damage.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: '3d8+8', canCrit: true }],
  },
  {
    id: 'spell.maeiha', name: 'Maeiha', icon: '🌑', color: '#a29bfe',
    school: 'dark', level: 3, mpCost: 11, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Cursed energy seeps across the field. Light dark damage to all foes.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: '2d6+3', canCrit: false }],
  },
  {
    id: 'spell.maeiga', name: 'Maeiga', icon: '🕳️', color: '#5f27cd',
    school: 'dark', level: 8, mpCost: 22, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'A tide of shadow drowns all enemies. Heavy dark damage to all foes.',
    effects: [{ t: 'damage', dmgType: 'dark', amount: '2d8+6', canCrit: false }],
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
  // ── Final Fantasy classics ────────────────────────────────────────────────────
  {
    id: 'spell.bio', name: 'Bio', icon: '☣️', color: '#6ab04c',
    school: 'element', level: 4, mpCost: 9, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'A splash of virulent ooze. Medium poison damage and may Poison.',
    effects: [
      { t: 'damage', dmgType: 'poison', amount: '2d8+4', canCrit: true },
      { t: 'status', status: 'status.poisoned', chance: 0.45 },
    ],
  },
  {
    id: 'spell.haste', name: 'Haste', icon: '⏩', color: '#00b894',
    school: 'arcane', level: 4, mpCost: 8, target: 'ally',
    inCombat: true, outOfCombat: false,
    description: 'Accelerates one ally through time. Raises agility for 3 turns.',
    effects: [{ t: 'status', status: 'status.haste' }],
  },
  {
    id: 'spell.hastega', name: 'Hastega', icon: '⏩', color: '#55efc4',
    school: 'arcane', level: 8, mpCost: 20, target: 'allAllies',
    inCombat: true, outOfCombat: false,
    description: 'Time races for the whole party. Raises agility of all allies.',
    effects: [{ t: 'status', status: 'status.haste' }],
  },
  {
    id: 'spell.slowga', name: 'Slowga', icon: '🐌', color: '#636e72',
    school: 'arcane', level: 6, mpCost: 16, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Time crawls for every foe. Lowers agility of all enemies (60% each).',
    effects: [{ t: 'status', status: 'status.sukunda', chance: 0.6 }],
  },
  {
    id: 'spell.stop', name: 'Stop', icon: '⏱️', color: '#b2bec3',
    school: 'arcane', level: 5, mpCost: 10, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'Halts one foe outside of time (50% chance). They cannot act.',
    effects: [{ t: 'status', status: 'status.stopped', chance: 0.5 }],
  },
  {
    id: 'spell.esuna', name: 'Esuna', icon: '🍀', color: '#55efc4',
    school: 'divine', level: 3, mpCost: 10, target: 'ally',
    inCombat: true, outOfCombat: true,
    description: 'A cleansing wind lifts every ailment from one ally.',
    effects: [{ t: 'cure', status: 'all' }],
  },
  {
    id: 'spell.holy', name: 'Holy', icon: '🌟', color: '#f9ca24',
    school: 'holy', level: 9, mpCost: 30, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'The ultimate white magic. Pearls of sacred light burst against one foe.',
    effects: [{ t: 'damage', dmgType: 'holy', amount: '5d8+10', canCrit: true }],
  },
  {
    id: 'spell.flare', name: 'Flare', icon: '💫', color: '#e74c3c',
    school: 'element', level: 9, mpCost: 30, target: 'enemy',
    inCombat: true, outOfCombat: false,
    description: 'The ultimate black magic. Raw non-elemental force annihilates one foe.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '6d6+12', canCrit: false }],
  },
  {
    id: 'spell.meteor', name: 'Meteor', icon: '☄️', color: '#e17055',
    school: 'arcane', level: 9, mpCost: 34, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'Calls burning stones down from beyond the sky onto all foes.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '4d8+8', canCrit: false }],
  },
  {
    id: 'spell.ultima', name: 'Ultima', icon: '🌀', color: '#a29bfe',
    school: 'arcane', level: 10, mpCost: 45, target: 'allEnemies',
    inCombat: true, outOfCombat: false,
    description: 'The forbidden magic of the ancients. Devastates the entire enemy line.',
    effects: [{ t: 'damage', dmgType: 'physical', amount: '5d8+12', canCrit: false }],
  },
]

// ── Items ──────────────────────────────────────────────────────────────────────

export const DEFAULT_ITEMS: ItemDef[] = [
  // ── Light sources (dark maps) ──────────────────────────────────────────────────
  {
    id: 'item.torch', name: 'Torch', icon: '🔥', color: '#ff9f43',
    description: 'A pitch-soaked brand. Sheds light 3 cells ahead while held.', kind: 'misc',
    slot: 'offhand', value: 10, stackable: false, lightRadius: 3,
  },
  {
    id: 'item.lantern', name: 'Lantern', icon: '🏮', color: '#feca57',
    description: 'A hooded oil lantern. Sheds steady light 4 cells ahead while held.', kind: 'misc',
    slot: 'offhand', value: 60, stackable: false, lightRadius: 4,
  },
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
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword',
    value: 150, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 2 }],
  },
  {
    id: 'item.longsword', name: 'Longsword', icon: '⚔️', color: '#dfe6e9',
    description: 'A well-balanced blade with excellent reach.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword',
    value: 400, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 4 }],
  },
  {
    id: 'item.katana', name: 'Katana', icon: '⚔️', color: '#e17055',
    description: 'A razor-sharp curved blade of superior craftsmanship.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.katana', twoHanded: true,
    value: 900, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 6 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.zweihander', name: 'Zweihänder', icon: '⚔️', color: '#636e72',
    description: 'A massive two-handed greatsword. Devastating but slow.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.greatsword', twoHanded: true,
    value: 1200, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 10 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -2 },
    ],
  },
  {
    id: 'item.battle_axe', name: 'Battle Axe', icon: '🪓', color: '#b07d4a',
    description: 'A heavy war axe that cleaves through armor.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.axe', twoHanded: true,
    value: 500, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 7 }],
  },
  {
    id: 'item.mace', name: 'Mace', icon: '🔨', color: '#a0522d',
    description: 'A flanged mace blessed against the undead.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.mace',
    value: 300, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 3 }],
  },
  {
    id: 'item.stiletto', name: 'Stiletto', icon: '🗡️', color: '#2d3436',
    description: 'A slim, fast dagger ideal for precision strikes.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.dagger',
    value: 250, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 2 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.kris_knife', name: 'Kris Knife', icon: '🗡️', color: '#6c5ce7',
    description: 'A wavy-bladed ritual dagger. Said to carry dark power.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.dagger',
    value: 700, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 4 },
      { target: 'attribute', key: 'intellect', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.staff_fire', name: 'Flame Staff', icon: '🔥', color: '#e74c3c',
    description: 'A staff imbued with fire magic. Boosts arcane and elemental power.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.staff',
    value: 650, stackable: false,
    charges: 12, onUse: [{ t: 'damage', dmgType: 'fire', amount: '2d6+2', canCrit: false }],
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 5 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.staff_frost', name: 'Frost Staff', icon: '❄️', color: '#74b9ff',
    description: 'A staff channelling frozen power.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.staff',
    value: 650, stackable: false,
    charges: 12, onUse: [{ t: 'damage', dmgType: 'ice', amount: '2d6+2', canCrit: false }],
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 5 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.wand', name: 'Magic Wand', icon: '🪄', color: '#a29bfe',
    description: 'A simple wand for focusing magical energy.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.rod',
    value: 200, stackable: false,
    charges: 15, onUse: [{ t: 'damage', dmgType: 'lightning', amount: '1d10+2', canCrit: false }],
    modifiers: [{ target: 'attribute', key: 'intellect', op: 'add', amount: 3 }],
  },
  {
    id: 'item.holy_spear', name: 'Holy Spear', icon: '✝️', color: '#f9ca24',
    description: 'A spear blessed by divine power. Extra effective against the undead.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.spear', twoHanded: true,
    value: 1800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 7 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.pistol', name: 'Pistol', icon: '🔫', color: '#636e72',
    description: 'A semi-automatic handgun. Fast and concealable. Holds a 6-round clip; reload from Pistol Ammo when it runs dry.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.gun',
    value: 500, stackable: false,
    charges: 6,
    modifiers: [
      { target: 'attribute', key: 'agility', op: 'add', amount: 2 },
      { target: 'attribute', key: 'might', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.assault_rifle', name: 'Assault Rifle', icon: '🔫', color: '#2d3436',
    description: 'A military-grade rifle. High damage at range. Holds a 5-round magazine; reload from Rifle Ammo when empty.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.heavy_gun', twoHanded: true,
    value: 1500, stackable: false,
    charges: 5,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 8 }],
  },
  // ── Ammo ─────────────────────────────────────────────────────────────────────
  {
    id: 'item.arrows', name: 'Arrows', icon: '🏹', color: '#8d6e63',
    description: 'A quiver of arrows. Bows draw one per shot straight from your pack.',
    kind: 'ammo', ammoType: 'arrow', value: 2, stackable: true,
  },
  {
    id: 'item.pistol_ammo', name: 'Pistol Ammo', icon: '🧰', color: '#b8860b',
    description: 'A box of pistol rounds. Reload an equipped Firearm from these.',
    kind: 'ammo', ammoType: 'pistol_round', value: 8, stackable: true,
  },
  {
    id: 'item.rifle_ammo', name: 'Rifle Ammo', icon: '🧰', color: '#8b5a2b',
    description: 'A box of rifle rounds. Reload an equipped Heavy Gun from these.',
    kind: 'ammo', ammoType: 'rifle_round', value: 16, stackable: true,
  },
  // ── Armor ──────────────────────────────────────────────────────────────────────
  {
    id: 'item.leather_vest', name: 'Leather Vest', icon: '🥋', color: '#b07d4a',
    description: 'Simple but reliable leather protection.',
    kind: 'armor', slot: 'body', armorType: 'atype.light',
    value: 120, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 2 }],
  },
  {
    id: 'item.chain_mail', name: 'Chain Mail', icon: '🛡️', color: '#b2bec3',
    description: 'Interlocking rings of steel. Moderate protection with decent flexibility.',
    kind: 'armor', slot: 'body', armorType: 'atype.medium',
    value: 400, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 5 }],
  },
  {
    id: 'item.plate_armor', name: 'Plate Armor', icon: '🛡️', color: '#636e72',
    description: 'Full plate steel armor. Maximum protection, but heavy.',
    kind: 'armor', slot: 'body', armorType: 'atype.heavy',
    value: 1100, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 9 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -2 },
    ],
  },
  {
    id: 'item.mage_robe', name: "Mage's Robe", icon: '👘', color: '#6c5ce7',
    description: 'A robe woven with arcane thread. Boosts magic power.',
    kind: 'armor', slot: 'body', armorType: 'atype.robe',
    value: 350, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 4 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.shadow_cloak', name: 'Shadow Cloak', icon: '🌑', color: '#2d3436',
    description: 'A cloak that bends shadow. Boosts agility and reduces encounter rate.',
    kind: 'armor', slot: 'body', armorType: 'atype.light',
    value: 800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'agility', op: 'add', amount: 4 },
      { target: 'attribute', key: 'luck', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.mythril_vest', name: 'Mythril Vest', icon: '✨', color: '#a29bfe',
    description: 'A lightweight vest of refined mythril. Excellent protection with minimal encumbrance.',
    kind: 'armor', slot: 'body', armorType: 'atype.medium',
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
    kind: 'armor', slot: 'offhand', armorType: 'atype.buckler',
    value: 100, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 2 }],
  },
  {
    id: 'item.heater_shield', name: 'Heater Shield', icon: '🛡️', color: '#b2bec3',
    description: 'A sturdy kite shield offering strong protection.',
    kind: 'armor', slot: 'offhand', armorType: 'atype.shield',
    value: 450, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 5 }],
  },
  {
    id: 'item.mythril_shield', name: 'Mythril Shield', icon: '✨', color: '#74b9ff',
    description: 'A shining mythril shield. Repels dark magic.',
    kind: 'armor', slot: 'offhand', armorType: 'atype.shield',
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
    kind: 'armor', slot: 'head', armorType: 'atype.light',
    value: 80, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 1 }],
  },
  {
    id: 'item.iron_helm', name: 'Iron Helm', icon: '⛑️', color: '#636e72',
    description: 'A solid iron helmet.',
    kind: 'armor', slot: 'head', armorType: 'atype.medium',
    value: 250, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 3 }],
  },
  // ── Accessories ────────────────────────────────────────────────────────────────
  {
    id: 'item.magatama', name: 'Magatama', icon: '🔮', color: '#00cec9',
    description: 'A comma-shaped jewel of spiritual power. Sharpens both mind and soul.',
    kind: 'accessory', slot: 'amulet',
    value: 1000, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 3 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
    ],
  },
  {
    id: 'item.bead_ring', name: 'Prayer Beads', icon: '📿', color: '#ffeaa7',
    description: 'Sacred beads worn around the wrist. Boosts spiritual defense.',
    kind: 'accessory', slot: 'ring',
    value: 600, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
      { target: 'attribute', key: 'luck', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.lucky_charm', name: 'Lucky Charm', icon: '🍀', color: '#00b894',
    description: 'A four-leaf clover pressed in glass. Raises fortune considerably.',
    kind: 'accessory', slot: 'ring',
    value: 400, stackable: false,
    modifiers: [{ target: 'attribute', key: 'luck', op: 'add', amount: 6 }],
  },
  // ── Material-tier weapons (iron → steel → mythril → ebonsteel) ────────────────
  {
    id: 'item.iron_sword', name: 'Iron Sword', icon: '🗡️', color: '#95a5a6',
    description: 'A rough-forged blade. Every farmhand-turned-hero starts here.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword',
    value: 60, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 1 }],
  },
  {
    id: 'item.iron_dagger', name: 'Iron Dagger', icon: '🗡️', color: '#95a5a6',
    description: 'Cheap, quick, and easy to hide.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.dagger',
    value: 50, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 1 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 1 },
    ],
  },
  {
    id: 'item.iron_mace', name: 'Iron Mace', icon: '🔨', color: '#95a5a6',
    description: 'A lump of iron on a stick. Surprisingly persuasive.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.mace',
    value: 90, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 2 }],
  },
  {
    id: 'item.iron_war_axe', name: 'Iron War Axe', icon: '🪓', color: '#95a5a6',
    description: 'A woodcutter\'s axe re-ground for grimmer work.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.axe', twoHanded: true,
    value: 200, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 4 }],
  },
  {
    id: 'item.hunting_bow', name: 'Hunting Bow', icon: '🏹', color: '#b07d4a',
    description: 'A plain yew bow. Feeds villages; fells goblins.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.bow',
    value: 130, stackable: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 2 }],
  },
  {
    id: 'item.steel_sword', name: 'Steel Sword', icon: '⚔️', color: '#bdc3c7',
    description: 'Honest steel, honestly forged. The soldier\'s standard.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword',
    value: 500, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 5 }],
  },
  {
    id: 'item.steel_greatsword', name: 'Steel Greatsword', icon: '⚔️', color: '#bdc3c7',
    description: 'Six feet of steel that arrives before its wielder does.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.greatsword', twoHanded: true,
    value: 700, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 7 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -1 },
    ],
  },
  {
    id: 'item.steel_warhammer', name: 'Steel Warhammer', icon: '🔨', color: '#7f8c8d',
    description: 'Armor is a suggestion. This is the rebuttal.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.hammer', twoHanded: true,
    value: 650, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 8 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -2 },
    ],
  },
  {
    id: 'item.longbow', name: 'Longbow', icon: '🏹', color: '#27ae60',
    description: 'A war bow of laminated horn and sinew.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.bow',
    value: 550, stackable: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 4 }],
  },
  {
    id: 'item.mythril_blade', name: 'Mythril Blade', icon: '✨', color: '#a29bfe',
    description: 'Feather-light and impossibly keen. Sings when swung.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword',
    value: 2400, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 8 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.mythril_dagger', name: 'Mythril Dagger', icon: '✨', color: '#a29bfe',
    description: 'So light it seems to move on its own.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.dagger',
    value: 1900, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 4 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 6 },
    ],
  },
  {
    id: 'item.ebonsteel_sword', name: 'Ebonsteel Sword', icon: '⚔️', color: '#2d3436',
    description: 'Black metal from the deep forges. It drinks the light.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword',
    value: 4200, stackable: false,
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 11 }],
  },
  {
    id: 'item.ebonsteel_greatsword', name: 'Ebonsteel Greatsword', icon: '⚔️', color: '#2d3436',
    description: 'A slab of night-dark metal. Walls are also a suggestion.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.greatsword', twoHanded: true,
    value: 4800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 13 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -1 },
    ],
  },
  {
    id: 'item.ebonsteel_warbow', name: 'Ebonsteel Warbow', icon: '🏹', color: '#2d3436',
    description: 'Few can even draw it. Fewer still survive its answer.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.bow',
    value: 4000, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'agility', op: 'add', amount: 9 },
      { target: 'attribute', key: 'might', op: 'add', amount: 2 },
    ],
  },
  // ── Enchanted weapons (drop unidentified; element overrides the type) ─────────
  {
    id: 'item.flamebrand', name: 'Flamebrand', icon: '🔥', color: '#e74c3c',
    description: 'A sword wreathed in ever-burning runes. Strikes with fire.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.sword', damageType: 'fire',
    value: 2200, stackable: false, unidentifiedName: '?Sword',
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 6 }],
  },
  {
    id: 'item.frostbite_axe', name: 'Frostbite', icon: '❄️', color: '#74b9ff',
    description: 'An axe rimed with unmelting frost. Strikes with ice.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.axe', damageType: 'ice', twoHanded: true,
    value: 2400, stackable: false, unidentifiedName: '?Axe',
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 8 }],
  },
  {
    id: 'item.stormfang', name: 'Stormfang', icon: '⚡', color: '#fdcb6e',
    description: 'A bow strung with captured lightning. Arrows arrive as thunder.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.bow', damageType: 'lightning',
    value: 2600, stackable: false, unidentifiedName: '?Bow',
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 6 }],
  },
  {
    id: 'item.venombite', name: 'Venombite', icon: '🐍', color: '#2ecc71',
    description: 'A dagger whose edge weeps green. Strikes with poison.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.dagger', damageType: 'poison',
    value: 1600, stackable: false, unidentifiedName: '?Dagger',
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 3 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 4 },
    ],
  },
  {
    id: 'item.sunforged_mace', name: 'Sunforged Mace', icon: '☀️', color: '#f9ca24',
    description: 'Consecrated at high noon. The unholy dread its dawn-bright arc.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.mace', damageType: 'holy',
    value: 2800, stackable: false, unidentifiedName: '?Mace',
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 6 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.nights_edge', name: "Night's Edge", icon: '🌑', color: '#6c5ce7',
    description: 'A katana quenched in shadow. Strikes with darkness.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.katana', damageType: 'dark', twoHanded: true,
    value: 3200, stackable: false, unidentifiedName: '?Katana',
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 8 },
      { target: 'attribute', key: 'intellect', op: 'add', amount: 2 },
    ],
  },
  // ── Armor expansion (sets, robes, hands & feet) ────────────────────────────────
  {
    id: 'item.fur_armor', name: 'Fur Armor', icon: '🦫', color: '#b07d4a',
    description: 'Pelts and hide stitched against the cold. Better than nothing.',
    kind: 'armor', slot: 'body', armorType: 'atype.light',
    value: 70, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 1 }],
  },
  {
    id: 'item.reinforced_leather', name: 'Reinforced Leather', icon: '🥋', color: '#a0522d',
    description: 'Boiled leather with riveted plates at the vitals.',
    kind: 'armor', slot: 'body', armorType: 'atype.light',
    value: 300, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 3 },
      { target: 'attribute', key: 'agility', op: 'add', amount: 1 },
    ],
  },
  {
    id: 'item.iron_cuirass', name: 'Iron Cuirass', icon: '🛡️', color: '#95a5a6',
    description: 'Heavy iron plate, dented by previous owners.',
    kind: 'armor', slot: 'body', armorType: 'atype.heavy',
    value: 500, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 6 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -1 },
    ],
  },
  {
    id: 'item.ebonsteel_plate', name: 'Ebonsteel Plate', icon: '🛡️', color: '#2d3436',
    description: 'Night-dark full plate. Wearing a fortress, walking anyway.',
    kind: 'armor', slot: 'body', armorType: 'atype.heavy',
    value: 4500, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 13 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -2 },
    ],
  },
  {
    id: 'item.apprentice_robe', name: 'Apprentice Robe', icon: '👘', color: '#81ecec',
    description: 'Scratchy academy wool. The hem is singed, as tradition demands.',
    kind: 'armor', slot: 'body', armorType: 'atype.robe',
    value: 120, stackable: false,
    modifiers: [{ target: 'attribute', key: 'intellect', op: 'add', amount: 2 }],
  },
  {
    id: 'item.archmage_robe', name: "Archmage's Robe", icon: '👘', color: '#8e44ad',
    description: 'Woven with silver sigils that rearrange themselves at midnight.',
    kind: 'armor', slot: 'body', armorType: 'atype.robe',
    value: 2800, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 7 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 4 },
    ],
  },
  {
    id: 'item.iron_shield', name: 'Iron Shield', icon: '🛡️', color: '#95a5a6',
    description: 'A round iron shield with a comforting heft.',
    kind: 'armor', slot: 'offhand', armorType: 'atype.shield',
    value: 200, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 3 }],
  },
  {
    id: 'item.ebonsteel_tower', name: 'Ebonsteel Tower Shield', icon: '🛡️', color: '#2d3436',
    description: 'A wall that agreed to travel.',
    kind: 'armor', slot: 'offhand', armorType: 'atype.shield',
    value: 3500, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 9 },
      { target: 'attribute', key: 'agility', op: 'add', amount: -1 },
    ],
  },
  {
    id: 'item.leather_gloves', name: 'Leather Gloves', icon: '🧤', color: '#b07d4a',
    description: 'Supple gloves with a sure grip.',
    kind: 'armor', slot: 'hands', armorType: 'atype.light',
    value: 60, stackable: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 1 }],
  },
  {
    id: 'item.steel_gauntlets', name: 'Steel Gauntlets', icon: '🧤', color: '#bdc3c7',
    description: 'Articulated steel fists. Doubles as a last argument.',
    kind: 'armor', slot: 'hands', armorType: 'atype.medium',
    value: 300, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 2 },
      { target: 'attribute', key: 'might', op: 'add', amount: 1 },
    ],
  },
  {
    id: 'item.travelers_boots', name: "Traveler's Boots", icon: '👢', color: '#b07d4a',
    description: 'Broken in across three kingdoms. They know the way.',
    kind: 'armor', slot: 'feet', armorType: 'atype.light',
    value: 150, stackable: false,
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 2 }],
  },
  {
    id: 'item.steel_sabatons', name: 'Steel Sabatons', icon: '👢', color: '#bdc3c7',
    description: 'Plated boots that make every step sound official.',
    kind: 'armor', slot: 'feet', armorType: 'atype.medium',
    value: 280, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 2 }],
  },
  // ── Jewelry (modifiers; some drop unidentified, two are cursed traps) ─────────
  {
    id: 'item.ring_of_might', name: 'Ring of Might', icon: '💍', color: '#e17055',
    description: 'A heavy band that lends the arm its certainty.',
    kind: 'accessory', slot: 'ring',
    value: 900, stackable: false, unidentifiedName: '?Ring',
    modifiers: [{ target: 'attribute', key: 'might', op: 'add', amount: 3 }],
  },
  {
    id: 'item.ring_of_magus', name: 'Ring of the Magus', icon: '💍', color: '#8e44ad',
    description: 'A sapphire band humming with stored theory.',
    kind: 'accessory', slot: 'ring',
    value: 1100, stackable: false, unidentifiedName: '?Ring',
    modifiers: [{ target: 'attribute', key: 'intellect', op: 'add', amount: 4 }],
  },
  {
    id: 'item.band_of_alacrity', name: 'Band of Alacrity', icon: '💍', color: '#00b894',
    description: 'Time seems politely slower while you wear it.',
    kind: 'accessory', slot: 'ring',
    value: 1000, stackable: false, unidentifiedName: '?Ring',
    modifiers: [{ target: 'attribute', key: 'agility', op: 'add', amount: 4 }],
  },
  {
    id: 'item.amulet_of_warding', name: 'Amulet of Warding', icon: '🧿', color: '#0984e3',
    description: 'An evil eye that stares back on your behalf.',
    kind: 'accessory', slot: 'amulet',
    value: 1200, stackable: false, unidentifiedName: '?Amulet',
    modifiers: [{ target: 'derived', key: 'defense', op: 'add', amount: 3 }],
  },
  {
    id: 'item.amulet_of_vitality', name: 'Amulet of Vitality', icon: '📿', color: '#e74c3c',
    description: 'A drop of garnet warm as a heartbeat.',
    kind: 'accessory', slot: 'amulet',
    value: 800, stackable: false,
    modifiers: [{ target: 'attribute', key: 'endurance', op: 'add', amount: 3 }],
  },
  {
    id: 'item.signet_of_fortune', name: 'Signet of Fortune', icon: '💍', color: '#f9ca24',
    description: 'Its previous owners were all, briefly, very lucky.',
    kind: 'accessory', slot: 'ring',
    value: 700, stackable: false,
    modifiers: [{ target: 'attribute', key: 'luck', op: 'add', amount: 4 }],
  },
  {
    id: 'item.ring_of_greed', name: 'Ring of Greed', icon: '💍', color: '#f39c12',
    description: 'Gorgeous, heavy, and warm to the touch. It wants to be worn.',
    kind: 'accessory', slot: 'ring',
    value: 50, stackable: false, unidentifiedName: '?Gold Ring', cursed: true,
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 2 },
      { target: 'attribute', key: 'luck', op: 'add', amount: -6 },
    ],
  },
  {
    id: 'item.drowned_crown', name: 'Drowned Crown', icon: '👑', color: '#0984e3',
    description: 'A king\'s circlet dredged from a black lake. Whispers arithmetic.',
    kind: 'armor', slot: 'head', armorType: 'atype.light',
    value: 60, stackable: false, unidentifiedName: '?Crown', cursed: true,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 6 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: -4 },
    ],
  },
  // ── Artifacts (uniques) ────────────────────────────────────────────────────────
  {
    id: 'item.duskrender', name: 'Duskrender', icon: '🌒', color: '#2d3436',
    description: 'An ebonsteel greatsword said to have cut the first nightfall loose.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.greatsword', damageType: 'dark', twoHanded: true,
    value: 9000, stackable: false, unidentifiedName: '?Greatsword',
    modifiers: [
      { target: 'attribute', key: 'might', op: 'add', amount: 14 },
      { target: 'attribute', key: 'intellect', op: 'add', amount: 2 },
    ],
  },
  {
    id: 'item.aegis_of_dawn', name: 'Aegis of Dawn', icon: '🌅', color: '#f9ca24',
    description: 'A mirror-bright shield that remembers every sunrise it has guarded.',
    kind: 'armor', slot: 'offhand', armorType: 'atype.shield',
    value: 8000, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'endurance', op: 'add', amount: 10 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 4 },
    ],
  },
  {
    id: 'item.staff_of_magus', name: 'Staff of the Magus', icon: '🪄', color: '#8e44ad',
    description: 'The academy\'s founding relic. It has opinions about your casting.',
    kind: 'weapon', slot: 'weapon', weaponType: 'wtype.staff',
    value: 7500, stackable: false,
    charges: 20, onUse: [{ t: 'damage', dmgType: 'lightning', amount: '3d6+4', canCrit: false }],
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 8 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 4 },
    ],
  },
  {
    id: 'item.veil_of_stars', name: 'Veil of Stars', icon: '🌌', color: '#6c5ce7',
    description: 'A necklace of seven stones that are not from around here.',
    kind: 'accessory', slot: 'amulet',
    value: 6500, stackable: false,
    modifiers: [
      { target: 'attribute', key: 'intellect', op: 'add', amount: 3 },
      { target: 'attribute', key: 'spirit', op: 'add', amount: 3 },
      { target: 'attribute', key: 'luck', op: 'add', amount: 3 },
    ],
  },
  // ── Alchemy: buff potions & thrown poisons ─────────────────────────────────────
  {
    id: 'item.potion_strength', name: 'Potion of Strength', icon: '🧪', color: '#e17055',
    description: 'Tastes of iron and ambition. Raises attack for 3 turns.',
    kind: 'consumable', value: 120, stackable: true,
    onUse: [{ t: 'status', status: 'status.tarukaja' }],
  },
  {
    id: 'item.potion_ironskin', name: 'Potion of Ironskin', icon: '🧪', color: '#636e72',
    description: 'Gritty going down. Raises defense for 3 turns.',
    kind: 'consumable', value: 120, stackable: true,
    onUse: [{ t: 'status', status: 'status.rakukaja' }],
  },
  {
    id: 'item.potion_haste', name: 'Potion of Haste', icon: '🧪', color: '#00b894',
    description: 'The world slows down; your heart does not. Grants Haste.',
    kind: 'consumable', value: 150, stackable: true,
    onUse: [{ t: 'status', status: 'status.haste' }],
  },
  {
    id: 'item.troll_blood_tonic', name: 'Troll-Blood Tonic', icon: '🧪', color: '#27ae60',
    description: 'Thick, green, and best not asked about. Grants Regeneration.',
    kind: 'consumable', value: 180, stackable: true,
    onUse: [{ t: 'status', status: 'status.regen' }],
  },
  {
    id: 'item.philter_of_focus', name: 'Philter of Focus', icon: '🧪', color: '#6c5ce7',
    description: 'Distilled silence. The next damaging spell strikes for double.',
    kind: 'consumable', value: 200, stackable: true,
    onUse: [{ t: 'status', status: 'status.concentrated' }],
  },
  {
    id: 'item.draught_of_the_bull', name: 'Draught of the Bull', icon: '🧪', color: '#c0392b',
    description: 'Liquid fury. The next physical blow lands twice as hard.',
    kind: 'consumable', value: 200, stackable: true,
    onUse: [{ t: 'status', status: 'status.charged' }],
  },
  {
    id: 'item.poison_flask', name: 'Poison Flask', icon: '⚗️', color: '#2ecc71',
    description: 'A glass flask of virulent sludge. Hurl at an enemy.',
    kind: 'consumable', value: 90, stackable: true,
    onUse: [
      { t: 'damage', dmgType: 'poison', amount: '2d6+4', canCrit: false },
      { t: 'status', status: 'status.poisoned', chance: 0.6 },
    ],
  },
  {
    id: 'item.alchemists_fire', name: "Alchemist's Fire", icon: '⚗️', color: '#e74c3c',
    description: 'Sticky fire in a bottle. Shake well; throw fast.',
    kind: 'consumable', value: 130, stackable: true,
    onUse: [{ t: 'damage', dmgType: 'fire', amount: '3d6+4', canCrit: false }],
  },
  // ── Spell tomes (single-use; class school gates apply automatically) ──────────
  {
    id: 'item.tome_eiha', name: 'Tome of Eiha', icon: '📖', color: '#6c5ce7',
    description: 'A slim black grimoire. Teaches the spell Eiha.',
    kind: 'consumable', value: 350, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.eiha' }],
  },
  {
    id: 'item.tome_bio', name: 'Tome of Bio', icon: '📖', color: '#6ab04c',
    description: 'The pages themselves feel unwell. Teaches the spell Bio.',
    kind: 'consumable', value: 700, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.bio' }],
  },
  {
    id: 'item.tome_kouha', name: 'Tome of Kouha', icon: '📖', color: '#f6e58d',
    description: 'Illuminated in the literal sense. Teaches the spell Kouha.',
    kind: 'consumable', value: 900, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.kouha' }],
  },
  {
    id: 'item.tome_haste', name: 'Tome of Haste', icon: '📖', color: '#00b894',
    description: 'The text reads itself to you, quickly. Teaches the spell Haste.',
    kind: 'consumable', value: 800, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.haste' }],
  },
  {
    id: 'item.tome_esuna', name: 'Tome of Esuna', icon: '📖', color: '#55efc4',
    description: 'Smells of clean linen and rain. Teaches the spell Esuna.',
    kind: 'consumable', value: 750, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.esuna' }],
  },
  {
    id: 'item.tome_stop', name: 'Tome of Stop', icon: '📖', color: '#b2bec3',
    description: 'Its final page is always blank. Teaches the spell Stop.',
    kind: 'consumable', value: 950, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.stop' }],
  },
  {
    id: 'item.tome_slowga', name: 'Tome of Slowga', icon: '📖', color: '#636e72',
    description: 'Takes a suspiciously long time to read. Teaches the spell Slowga.',
    kind: 'consumable', value: 1000, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.slowga' }],
  },
  {
    id: 'item.tome_meteor', name: 'Tome of Meteor', icon: '📕', color: '#e17055',
    description: 'Bound in scorched hide and priced like a castle. Teaches Meteor.',
    kind: 'consumable', value: 9000, stackable: false,
    onUse: [{ t: 'teachSpell', spell: 'spell.meteor' }],
  },
  // ── Food & drink ──────────────────────────────────────────────────────────────
  {
    id: 'item.bread', name: 'Loaf of Bread', icon: '🍞', color: '#f0c078',
    description: 'Dense trail bread. Restores 8 HP and morale.',
    kind: 'consumable', value: 5, stackable: true,
    onUse: [{ t: 'heal', amount: 8 }],
  },
  {
    id: 'item.apple', name: 'Crisp Apple', icon: '🍎', color: '#e74c3c',
    description: 'Keeps at least one profession away. Restores 5 HP.',
    kind: 'consumable', value: 3, stackable: true,
    onUse: [{ t: 'heal', amount: 5 }],
  },
  {
    id: 'item.cheese_wheel', name: 'Wheel of Cheese', icon: '🧀', color: '#f9ca24',
    description: 'An entire wheel. You regret nothing. Restores 25 HP.',
    kind: 'consumable', value: 25, stackable: true,
    onUse: [{ t: 'heal', amount: 25 }],
  },
  {
    id: 'item.mead', name: 'Honeyed Mead', icon: '🍺', color: '#f0932b',
    description: 'Sweet courage by the bottle. Restores 12 HP.',
    kind: 'consumable', value: 10, stackable: true,
    onUse: [{ t: 'heal', amount: 12 }],
  },
  {
    id: 'item.roast_haunch', name: 'Roast Haunch', icon: '🍖', color: '#b07d4a',
    description: 'Cooked over someone else\'s campfire. Restores 20 HP.',
    kind: 'consumable', value: 15, stackable: true,
    onUse: [{ t: 'heal', amount: 20 }],
  },
  {
    id: 'item.hearty_stew', name: 'Hearty Stew', icon: '🍲', color: '#e17055',
    description: 'Grandmother-grade. Restores 35 HP and cures Poison.',
    kind: 'consumable', value: 40, stackable: true,
    onUse: [
      { t: 'heal', amount: 35 },
      { t: 'cure', status: 'status.poisoned' },
    ],
  },
  // ── Treasure & clutter (vendor goods) ─────────────────────────────────────────
  {
    id: 'item.garnet', name: 'Garnet', icon: '🔻', color: '#c0392b',
    description: 'A small red gemstone. Merchants never haggle over these.',
    kind: 'misc', value: 150, stackable: true,
  },
  {
    id: 'item.emerald', name: 'Emerald', icon: '💚', color: '#27ae60',
    description: 'A flawed but sizeable green stone.',
    kind: 'misc', value: 500, stackable: true,
  },
  {
    id: 'item.diamond', name: 'Diamond', icon: '💎', color: '#dfe6e9',
    description: 'Flawless. The lantern light gets lost in it.',
    kind: 'misc', value: 2000, stackable: true,
  },
  {
    id: 'item.wolf_pelt', name: 'Wolf Pelt', icon: '🐺', color: '#95a5a6',
    description: 'A thick winter pelt. Furriers pay well.',
    kind: 'misc', value: 40, stackable: true,
  },
  {
    id: 'item.silver_goblet', name: 'Silver Goblet', icon: '🏆', color: '#b2bec3',
    description: 'Engraved with someone else\'s family crest.',
    kind: 'misc', value: 90, stackable: true,
  },
  {
    id: 'item.spirit_shard', name: 'Spirit Shard', icon: '🔮', color: '#81ecec',
    description: 'A faintly humming crystal that once held a soul. Enchanters covet them.',
    kind: 'misc', value: 300, stackable: true,
  },
  {
    id: 'item.dragon_scale', name: 'Dragon Scale', icon: '🐉', color: '#2d3436',
    description: 'Warm to the touch decades after its owner died.',
    kind: 'misc', value: 800, stackable: true,
  },
  {
    id: 'item.golden_idol', name: 'Golden Idol', icon: '🗿', color: '#f9ca24',
    description: 'A squat god of a forgotten faith. Heavier than it looks.',
    kind: 'misc', value: 1200, stackable: true,
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
  // Class-signature armor sets + shared rings/amulets/shields (see class-gear.ts)
  ...CLASS_GEAR_ITEMS,
]

// ── Enemies ────────────────────────────────────────────────────────────────────

export const DEFAULT_ENEMIES: EnemyDef[] = [
  // ── Tier 1: Surface / Cave Entrance ──────────────────────────────────────────
  {
    id: 'enemy.slime', name: 'Slime', icon: '🫧', color: '#00cec9',
    description: 'A gelatinous mass of semi-sentient ooze that absorbs almost anything.',
    hp: 25, attack: 8, defense: 2, speed: 3, xp: 10, gold: { min: 2, max: 8 },
    resistances: { physical: 0.25, fire: -0.5, ice: -0.5 },
    loot: 'loot.weak_demon',
    abilities: [
      { weight: 1, name: 'Corrosive Touch', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d4', canCrit: false }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.pixie', name: 'Pixie', icon: '🧚', color: '#fd79a8',
    description: 'A tiny mischievous fairy. Weak in body but quick and knows a touch of magic.',
    hp: 30, attack: 10, defense: 4, speed: 12, xp: 15, gold: { min: 3, max: 12 },
    resistances: { dark: 0.5 },
    loot: 'loot.fairy_drop',
    abilities: [
      { weight: 2, name: 'Needle Shot', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6', canCrit: true }], target: 'enemy' },
      { weight: 1, spell: 'spell.dia' },
    ],
  },
  {
    id: 'enemy.obariyon', name: 'Obariyon', icon: '👺', color: '#e17055',
    description: 'A small red demon that loves leaping onto people\'s backs and crushing them.',
    hp: 40, attack: 14, defense: 6, speed: 9, xp: 20, gold: { min: 5, max: 18 },
    loot: 'loot.weak_demon',
    abilities: [
      { weight: 3, name: 'Piggyback Crush', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d8+2', canCrit: true }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.mokoi', name: 'Mokoi', icon: '💀', color: '#2d3436',
    description: 'The spirit of a murdered man whose grudge prevents it from passing on.',
    hp: 45, attack: 12, defense: 5, speed: 7, xp: 22, gold: { min: 4, max: 15 },
    resistances: { dark: 0.5, holy: -0.5 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 2, name: 'Grudge Bolt', spell: 'spell.eiha' },
      { weight: 1, name: 'Binding Curse', effects: [{ t: 'status', status: 'status.bound', chance: 0.5 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.jack_frost', name: 'Jack Frost', icon: '⛄', color: '#74b9ff',
    description: 'An adorable snowman-like spirit with an icy personality and freezing powers.',
    hp: 50, attack: 13, defense: 8, speed: 10, xp: 28, gold: { min: 6, max: 20 },
    resistances: { ice: 1.0, fire: -0.75 },
    loot: 'loot.fairy_drop',
    abilities: [
      { weight: 3, spell: 'spell.bufu' },
      { weight: 1, name: 'Cold Snap', effects: [{ t: 'status', status: 'status.frozen', chance: 0.35 }], target: 'enemy' },
    ],
  },
  // ── Tier 2: Cave / Dungeon ────────────────────────────────────────────────────
  {
    id: 'enemy.pyro_jack', name: 'Pyro Jack', icon: '🎃', color: '#e17055',
    description: 'A flaming jack-o-lantern spirit who hurls fireballs with glee.',
    hp: 60, attack: 16, defense: 9, speed: 11, xp: 38, gold: { min: 8, max: 28 },
    resistances: { fire: 1.0, ice: -0.75 },
    loot: 'loot.fairy_drop',
    abilities: [
      { weight: 3, spell: 'spell.agilao' },
      { weight: 1, name: 'Fire Dance', effects: [{ t: 'status', status: 'status.burned', chance: 0.40 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.lilim', name: 'Lilim', icon: '😈', color: '#fd79a8',
    description: 'A seductive demoness born from Lilith. Uses charm to bewitch and drain her prey.',
    hp: 65, attack: 14, defense: 10, speed: 13, xp: 42, gold: { min: 10, max: 35 },
    resistances: { dark: 0.5, holy: -0.5 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, name: 'Dark Kiss', spell: 'spell.eiha' },
      { weight: 2, spell: 'spell.marin_karin' },
      { weight: 1, spell: 'spell.dia' },
    ],
  },
  {
    id: 'enemy.fallen', name: 'Fallen Angel', icon: '🪽', color: '#6c5ce7',
    description: 'An angel cast down from the heavens. Bitter and wrathful, wielding dark fire.',
    hp: 70, attack: 18, defense: 12, speed: 11, xp: 48, gold: { min: 12, max: 40 },
    resistances: { dark: 0.5, fire: 0.25, holy: -0.5 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, name: 'Hellfire', spell: 'spell.agilao' },
      { weight: 2, name: 'Dark Blast', spell: 'spell.eiga' },
    ],
  },
  {
    id: 'enemy.bicorn', name: 'Bicorn', icon: '🦄', color: '#2d3436',
    description: 'A dark two-horned horse. Unlike the unicorn, it despises virtue.',
    hp: 80, attack: 20, defense: 11, speed: 14, xp: 45, gold: { min: 10, max: 30 },
    resistances: { dark: 0.25 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Gore', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+4', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Wild Stampede', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+6', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.apsaras', name: 'Apsaras', icon: '💧', color: '#74b9ff',
    description: 'A divine water spirit from Hindu mythology. Graceful and dangerous.',
    hp: 75, attack: 16, defense: 12, speed: 13, xp: 45, gold: { min: 10, max: 30 },
    resistances: { ice: 0.5, fire: -0.25 },
    loot: 'loot.divine_drop',
    abilities: [
      { weight: 2, spell: 'spell.bufula' },
      { weight: 1, name: 'Chilling Mist', effects: [{ t: 'status', status: 'status.frozen', chance: 0.30 }], target: 'enemy' },
      { weight: 1, name: 'Healing Rain', spell: 'spell.media' },
    ],
  },
  {
    id: 'enemy.zombie', name: 'Zombie', icon: '🧟', color: '#636e72',
    description: 'The reanimated corpse of an unfortunate soul. Slow but infectious.',
    hp: 75, attack: 17, defense: 8, speed: 4, xp: 35, gold: { min: 0, max: 5 },
    resistances: { physical: 0.25, dark: 0.5, poison: 1.0, holy: -0.75, fire: -0.25 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 3, name: 'Rotting Bite', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6+3', canCrit: false }], target: 'enemy' },
      { weight: 1, name: 'Infectious Claw', effects: [{ t: 'status', status: 'status.poisoned', chance: 0.40 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.ghost', name: 'Ghost', icon: '👻', color: '#dfe6e9',
    description: 'A spectral entity that drains the life from the living.',
    hp: 55, attack: 15, defense: 14, speed: 10, xp: 40, gold: { min: 0, max: 10 },
    resistances: { physical: 0.5, dark: 0.5, holy: -0.75, poison: 1.0 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 2, name: 'Life Drain', spell: 'spell.eiha' },
      { weight: 1, name: 'Terror Wail', spell: 'spell.maeiha' },
    ],
  },
  {
    id: 'enemy.oni', name: 'Oni', icon: '👹', color: '#e74c3c',
    description: 'A hulking red demon of Japanese legend. Carries an iron club and breathes fire.',
    hp: 90, attack: 22, defense: 14, speed: 9, xp: 58, gold: { min: 15, max: 45 },
    resistances: { fire: 0.5 },
    loot: 'loot.mid_demon',
    abilities: [
      { weight: 3, name: 'Iron Club', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+6', canCrit: true }], target: 'enemy' },
      { weight: 1, skill: 'skill.fire_breath' },
    ],
  },
  {
    id: 'enemy.ogre', name: 'Ogre', icon: '👾', color: '#b07d4a',
    description: 'A massive, brutish creature that relies entirely on raw strength.',
    hp: 100, attack: 24, defense: 12, speed: 6, xp: 55, gold: { min: 10, max: 40 },
    loot: 'loot.mid_demon',
    abilities: [
      { weight: 4, name: 'Crushing Blow', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+8', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Rampage', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+6', canCrit: false }], target: 'allEnemies' },
    ],
  },
  // ── Tier 3: Deep Dungeon ──────────────────────────────────────────────────────
  {
    id: 'enemy.skeleton', name: 'Skeleton Warrior', icon: '💀', color: '#dfe6e9',
    description: 'The animated bones of a fallen warrior, still wearing rusted armor.',
    hp: 85, attack: 19, defense: 16, speed: 8, xp: 52, gold: { min: 5, max: 25 },
    resistances: { physical: 0.25, dark: 0.5, poison: 1.0, holy: -0.5, ice: -0.25 },
    loot: 'loot.undead_drop',
    abilities: [
      { weight: 3, name: 'Rusted Blade', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+5', canCrit: true }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.succubus', name: 'Succubus', icon: '😈', color: '#6c5ce7',
    description: 'A powerful night demon who drains her victims dry, leaving nothing but a husk.',
    hp: 90, attack: 18, defense: 16, speed: 14, xp: 70, gold: { min: 20, max: 60 },
    resistances: { dark: 0.75, fire: 0.25, holy: -0.75 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, name: 'Soul Drain', spell: 'spell.eiga' },
      { weight: 2, name: 'Temptation', spell: 'spell.marin_karin' },
      { weight: 1, spell: 'spell.dormina' },
    ],
  },
  {
    id: 'enemy.incubus', name: 'Incubus', icon: '😈', color: '#a29bfe',
    description: 'The male counterpart to the Succubus. Sows panic and feeds on despair.',
    hp: 95, attack: 20, defense: 16, speed: 13, xp: 72, gold: { min: 20, max: 60 },
    resistances: { dark: 0.75, holy: -0.75 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, name: 'Night Terror', spell: 'spell.eiga' },
      { weight: 2, spell: 'spell.pulinpa' },
      { weight: 1, name: 'Nightmare Wave', spell: 'spell.maeiha' },
    ],
  },
  {
    id: 'enemy.naga', name: 'Naga', icon: '🐍', color: '#2ecc71',
    description: 'A serpentine demon of ancient power. Poisons all it strikes.',
    hp: 110, attack: 22, defense: 17, speed: 12, xp: 80, gold: { min: 18, max: 55 },
    resistances: { poison: 1.0, lightning: -0.25 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Venom Strike', spell: 'spell.bio' },
      { weight: 2, name: 'Toxic Spit', spell: 'spell.poison' },
      { weight: 1, skill: 'skill.poison_breath' },
    ],
  },
  {
    id: 'enemy.archangel', name: 'Archangel', icon: '👼', color: '#f9ca24',
    description: 'A mighty holy warrior bearing celestial arms and the will to smite evil.',
    hp: 100, attack: 22, defense: 20, speed: 14, xp: 88, gold: { min: 20, max: 60 },
    resistances: { holy: 1.0, dark: -0.75, fire: 0.25 },
    loot: 'loot.divine_drop',
    abilities: [
      { weight: 2, name: 'Hama Strike', spell: 'spell.kouha' },
      { weight: 1, name: 'Divine Light', spell: 'spell.makouha' },
      { weight: 1, spell: 'spell.media' },
    ],
  },
  {
    id: 'enemy.loup_garou', name: 'Loup-Garou', icon: '🐺', color: '#636e72',
    description: 'A werewolf of French legend. Rends flesh with supernatural fury under the moon.',
    hp: 120, attack: 26, defense: 16, speed: 16, xp: 90, gold: { min: 15, max: 50 },
    resistances: { physical: 0.25, fire: -0.25 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Savage Claw', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+8', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Moonlit Frenzy', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+6', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.lich', name: 'Lich', icon: '💀', color: '#6c5ce7',
    description: 'An undead archmage who transcended death through dark ritual. A master of death magic.',
    hp: 140, attack: 24, defense: 20, speed: 9, xp: 120, gold: { min: 30, max: 90 },
    resistances: { dark: 0.75, poison: 1.0, holy: -0.75, fire: 0.25 },
    loot: 'loot.strong_demon',
    abilities: [
      { weight: 2, spell: 'spell.eigaon' },
      { weight: 2, name: 'Death Wave', spell: 'spell.maeiga' },
      { weight: 1, name: 'Grasping Bones', effects: [{ t: 'status', status: 'status.bound', chance: 0.55 }], target: 'allEnemies' },
      { weight: 1, name: 'Dark Mending', spell: 'spell.diarama' },
    ],
  },
  // ── Boss Tier ─────────────────────────────────────────────────────────────────
  {
    id: 'enemy.troll', name: 'Troll', icon: '🧌', color: '#27ae60',
    description: 'A monstrous cave troll that regenerates rapidly. Must be burned or frozen to stop regeneration.',
    hp: 200, attack: 28, defense: 22, speed: 7, xp: 200, gold: { min: 50, max: 120 },
    resistances: { physical: 0.5, fire: -0.5, ice: -0.5 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, name: 'Smash', effects: [{ t: 'damage', dmgType: 'physical', amount: '4d6+10', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Cave-In Swing', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d8+8', canCrit: false }], target: 'allEnemies' },
      { weight: 1, spell: 'spell.regen' },
    ],
  },
  {
    id: 'enemy.baphomet', name: 'Baphomet', icon: '🐐', color: '#2d3436',
    description: 'The Sabbatic Goat. A demonic idol of chaos worshipped by cultists. Commands all elements.',
    hp: 220, attack: 30, defense: 24, speed: 12, xp: 250, gold: { min: 60, max: 150 },
    resistances: { dark: 0.75, fire: 0.5, ice: 0.5, lightning: 0.5, holy: -0.75 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 2, spell: 'spell.agidyne' },
      { weight: 2, spell: 'spell.eigaon' },
      { weight: 1, name: 'Storm of Chaos', spell: 'spell.maziodyne' },
      { weight: 1, name: 'Sabbath Call', effects: [{ t: 'status', status: 'status.charmed', chance: 0.50 }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.minotaur', name: 'Minotaur', icon: '🐂', color: '#b07d4a',
    description: 'The bull-headed guardian of the labyrinth. Unstoppable in the confines of its maze.',
    hp: 350, attack: 36, defense: 28, speed: 10, xp: 500, gold: { min: 100, max: 250 },
    resistances: { physical: 0.25, lightning: -0.25 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, name: 'Labrys Cleave', effects: [{ t: 'damage', dmgType: 'physical', amount: '5d6+12', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Earthshaker', effects: [{ t: 'damage', dmgType: 'physical', amount: '4d8+10', canCrit: false }], target: 'allEnemies' },
      { weight: 1, name: 'Chains of the Maze', effects: [{ t: 'status', status: 'status.bound', chance: 0.60 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.medusa', name: 'Medusa', icon: '🐍', color: '#a29bfe',
    description: 'The gorgon whose petrifying gaze turns the unwary to stone. Her serpent hair drips venom.',
    hp: 300, attack: 28, defense: 26, speed: 14, xp: 450, gold: { min: 80, max: 200 },
    resistances: { poison: 1.0, dark: 0.5, holy: -0.5 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 2, name: 'Serpent Venom', effects: [{ t: 'damage', dmgType: 'poison', amount: '3d8+8', canCrit: true }], target: 'enemy' },
      { weight: 2, skill: 'skill.petrifying_gaze' },
      { weight: 1, skill: 'skill.dread_gaze', target: 'allEnemies' },
    ],
  },
  // ── Final Fantasy bestiary — Tier 1 ───────────────────────────────────────────
  {
    id: 'enemy.goblin', name: 'Goblin', icon: '👺', color: '#27ae60',
    description: 'A scrawny green raider with a rusty knife and boundless overconfidence.',
    hp: 28, attack: 9, defense: 3, speed: 6, xp: 12, gold: { min: 3, max: 10 },
    loot: 'loot.weak_demon',
    abilities: [
      { weight: 3, name: 'Rusty Knife', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d6+1', canCrit: true }], target: 'enemy' },
      { weight: 1, skill: 'skill.goblin_punch' },
    ],
  },
  {
    id: 'enemy.sahagin', name: 'Sahagin', icon: '🐟', color: '#00b894',
    description: 'A fish-man of the shallows that fights with a barbed trident and foul water.',
    hp: 42, attack: 12, defense: 6, speed: 8, xp: 20, gold: { min: 4, max: 14 },
    resistances: { ice: 0.5, lightning: -0.5 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Trident Thrust', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d8+2', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Foul Water', effects: [{ t: 'status', status: 'status.poisoned', chance: 0.4 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.bomb', name: 'Bomb', icon: '🔥', color: '#e17055',
    description: 'A living fireball that swells with every wound — and detonates when cornered.',
    hp: 45, attack: 12, defense: 6, speed: 7, xp: 25, gold: { min: 5, max: 16 },
    resistances: { fire: 1.0, ice: -0.75 },
    loot: 'loot.weak_demon',
    abilities: [
      { weight: 3, name: 'Fireball', spell: 'spell.agi' },
      { weight: 6, skill: 'skill.self_destruct', when: { selfHpBelow: 0.35 } },
    ],
  },
  // ── Final Fantasy bestiary — Tier 2 ───────────────────────────────────────────
  {
    id: 'enemy.cactuar', name: 'Cactuar', icon: '🌵', color: '#6ab04c',
    description: 'A sprinting cactus that is nearly impossible to pin down. Its needles never miss.',
    hp: 40, attack: 14, defense: 20, speed: 20, xp: 60, gold: { min: 20, max: 60 },
    resistances: { physical: 0.5 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 2, skill: 'skill.thousand_needles' },
      { weight: 3, name: 'Needle Flick', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d4', canCrit: false }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.coeurl', name: 'Coeurl', icon: '🐆', color: '#a29bfe',
    description: 'An elegant great cat with whip-like whiskers that crackle with paralyzing current.',
    hp: 70, attack: 16, defense: 10, speed: 15, xp: 45, gold: { min: 10, max: 32 },
    resistances: { lightning: 0.5 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Pounce', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6+3', canCrit: true }], target: 'enemy' },
      { weight: 2, skill: 'skill.blaster' },
    ],
  },
  {
    id: 'enemy.ochu', name: 'Ochu', icon: '🌿', color: '#2ecc71',
    description: 'A shambling mass of vines and tendrils that spreads sickly-sweet spores.',
    hp: 85, attack: 18, defense: 10, speed: 6, xp: 48, gold: { min: 8, max: 26 },
    resistances: { poison: 1.0, fire: -0.5 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Tendril Lash', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d6+4', canCrit: false }], target: 'enemy' },
      { weight: 2, name: 'Poison Spores', effects: [{ t: 'status', status: 'status.poisoned', chance: 0.55 }], target: 'enemy' },
      { weight: 1, name: 'Sleep Spores', effects: [{ t: 'status', status: 'status.asleep', chance: 0.45 }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.zu', name: 'Zu', icon: '🦅', color: '#b07d4a',
    description: 'A colossal carrion bird whose wingbeats knock grown warriors off their feet.',
    hp: 80, attack: 19, defense: 8, speed: 13, xp: 46, gold: { min: 8, max: 28 },
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Dive Bomb', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+3', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Wing Buffet', effects: [{ t: 'damage', dmgType: 'physical', amount: '1d8+3', canCrit: false }], target: 'allEnemies' },
    ],
  },
  // ── Final Fantasy bestiary — Tier 3 ───────────────────────────────────────────
  {
    id: 'enemy.malboro', name: 'Malboro', icon: '🦠', color: '#6ab04c',
    description: 'A reeking tangle of eyes and tentacles. Its breath is legendary — for the worst reasons.',
    hp: 130, attack: 22, defense: 14, speed: 5, xp: 110, gold: { min: 20, max: 65 },
    resistances: { poison: 1.0, fire: -0.25 },
    size: 2,
    loot: 'loot.strong_demon',
    abilities: [
      { weight: 2, name: 'Flailing Tentacles', effects: [{ t: 'damage', dmgType: 'poison', amount: '2d8+6', canCrit: false }], target: 'enemy' },
      { weight: 2, skill: 'skill.bad_breath' },
    ],
  },
  {
    id: 'enemy.tonberry', name: 'Tonberry', icon: '🔪', color: '#00b894',
    description: 'A small hooded figure with a lantern and a kitchen knife. It walks toward you. Slowly.',
    hp: 160, attack: 30, defense: 22, speed: 2, xp: 130, gold: { min: 40, max: 120 },
    resistances: { physical: 0.25 },
    targeting: 'weakest',
    loot: 'loot.strong_demon',
    abilities: [
      { weight: 3, skill: 'skill.chefs_knife' },
      { weight: 1, name: "Everyone's Grudge", spell: 'spell.eigaon' },
    ],
  },
  {
    id: 'enemy.ahriman', name: 'Ahriman', icon: '👁️', color: '#6c5ce7',
    description: 'A winged eye that drifts through ruins, unraveling minds with its gaze.',
    hp: 100, attack: 20, defense: 14, speed: 12, xp: 78, gold: { min: 15, max: 45 },
    resistances: { dark: 0.5, holy: -0.5 },
    loot: 'loot.night_drop',
    abilities: [
      { weight: 2, name: 'Doom Gaze', spell: 'spell.eiga' },
      { weight: 2, skill: 'skill.dread_gaze' },
      { weight: 1, name: 'Unsettling Aura', spell: 'spell.slowga' },
    ],
  },
  {
    id: 'enemy.iron_giant', name: 'Iron Giant', icon: '🤖', color: '#636e72',
    description: 'A walking suit of colossal armor with nobody inside — only a greatsword and intent.',
    hp: 150, attack: 28, defense: 26, speed: 6, xp: 125, gold: { min: 30, max: 90 },
    resistances: { physical: 0.5, lightning: -0.5 },
    size: 2,
    loot: 'loot.strong_demon',
    abilities: [
      { weight: 3, name: 'Grand Sword', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d8+8', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Wide Slash', effects: [{ t: 'damage', dmgType: 'physical', amount: '2d8+8', canCrit: false }], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.chimera', name: 'Chimera', icon: '🦁', color: '#e17055',
    description: 'Lion, goat, and serpent fused into one furious beast. Each head breathes a different ruin.',
    hp: 135, attack: 24, defense: 18, speed: 12, xp: 115, gold: { min: 25, max: 75 },
    resistances: { fire: 0.5, ice: 0.5 },
    loot: 'loot.strong_demon',
    abilities: [
      { weight: 2, name: 'Blaze Breath', skill: 'skill.fire_breath' },
      { weight: 2, skill: 'skill.frost_breath' },
      { weight: 2, name: 'Lion Claw', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+8', canCrit: true }], target: 'enemy' },
    ],
  },
  {
    id: 'enemy.adamantoise', name: 'Adamantoise', icon: '🐢', color: '#b07d4a',
    description: 'A mountain that walks. Its shell has turned aside siege engines.',
    hp: 170, attack: 20, defense: 30, speed: 3, xp: 120, gold: { min: 25, max: 70 },
    resistances: { physical: 0.5, ice: -0.25 },
    size: 2,
    loot: 'loot.beast_drop',
    abilities: [
      { weight: 3, name: 'Headbutt', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d6+8', canCrit: false }], target: 'enemy' },
      { weight: 1, name: 'Shell Guard', spell: 'spell.rakukaja' },
    ],
  },
  // ── Final Fantasy bestiary — Boss Tier ────────────────────────────────────────
  {
    id: 'enemy.behemoth', name: 'Behemoth', icon: '🐗', color: '#8e44ad',
    description: 'The king of beasts — a horned purple titan whose rage calls stones from the sky.',
    hp: 320, attack: 34, defense: 24, speed: 13, xp: 480, gold: { min: 90, max: 220 },
    resistances: { physical: 0.25, fire: 0.25 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, name: 'Heave', effects: [{ t: 'damage', dmgType: 'physical', amount: '5d6+12', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Trample', effects: [{ t: 'damage', dmgType: 'physical', amount: '3d8+8', canCrit: false }], target: 'allEnemies' },
      // References the database spell — buff Meteor once, Behemoth follows.
      { weight: 3, spell: 'spell.meteor', when: { roundAtLeast: 3 } },
    ],
  },
  {
    id: 'enemy.zombie_dragon', name: 'Zombie Dragon', icon: '🐉', color: '#636e72',
    description: 'A dragon that death could not keep down. Its breath is a rolling wall of rot.',
    hp: 280, attack: 30, defense: 20, speed: 6, xp: 420, gold: { min: 70, max: 180 },
    resistances: { dark: 0.75, poison: 1.0, holy: -0.75, fire: -0.25 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, name: 'Undead Claw', effects: [{ t: 'damage', dmgType: 'physical', amount: '4d8+10', canCrit: true }], target: 'enemy' },
      { weight: 2, name: 'Miasma Breath', effects: [
        { t: 'damage', dmgType: 'poison', amount: '3d6+6', canCrit: false },
        { t: 'status', status: 'status.poisoned', chance: 0.5 },
      ], target: 'allEnemies' },
    ],
  },
  {
    id: 'enemy.omega', name: 'Omega', icon: '🛸', color: '#2d3436',
    description: 'An ancient war machine that has never stopped hunting. Nothing about it is fair.',
    hp: 500, attack: 40, defense: 34, speed: 18, xp: 999, gold: { min: 200, max: 500 },
    resistances: { physical: 0.5, fire: 0.5, ice: 0.5, poison: 1.0, dark: 0.5, holy: 0.5, lightning: -0.25 },
    size: 2,
    loot: 'loot.boss_drop',
    abilities: [
      { weight: 3, skill: 'skill.wave_cannon' },
      { weight: 2, name: 'Beam Blade', effects: [{ t: 'damage', dmgType: 'physical', amount: '6d6+12', canCrit: true }], target: 'enemy' },
      { weight: 1, name: 'Rocket Punch', effects: [
        { t: 'damage', dmgType: 'physical', amount: '3d6+6', canCrit: false },
        { t: 'status', status: 'status.panicked', chance: 0.5 },
      ], target: 'enemy' },
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
  {
    id: 'enc.verdant_wilds', name: 'Verdant Wilds', icon: '🌵', color: '#6ab04c',
    description: 'Sun-baked scrub and riverbanks. Goblins, fish-men, and the occasional sprinting cactus.',
    entries: [
      { enemy: 'enemy.goblin',   min: 1, max: 3, weight: 3 },
      { enemy: 'enemy.sahagin',  min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.bomb',     min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.cactuar',  min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: 'enc.feral_woods', name: 'Feral Woods', icon: '🐆', color: '#27ae60',
    description: 'Deep forest where the wildlife bites back. Watch for whiskers and spores.',
    entries: [
      { enemy: 'enemy.coeurl',  min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.ochu',    min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.zu',      min: 1, max: 2, weight: 2 },
      { enemy: 'enemy.malboro', min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: 'enc.ancient_ruins', name: 'Ancient Ruins', icon: '🏛️', color: '#636e72',
    description: 'Collapsed halls of a fallen civilization. Its guardians never got the news.',
    entries: [
      { enemy: 'enemy.ahriman',     min: 1, max: 2, weight: 3 },
      { enemy: 'enemy.iron_giant',  min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.chimera',     min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.adamantoise', min: 1, max: 1, weight: 2 },
      { enemy: 'enemy.tonberry',    min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: 'enc.behemoth_lair', name: "Behemoth's Lair", icon: '🐗', color: '#8e44ad',
    description: 'Boss: the king of beasts. From round 3 it begins calling meteors.',
    boss: true,
    entries: [{ enemy: 'enemy.behemoth', min: 1, max: 1, weight: 1 }],
  },
  {
    id: 'enc.dragon_crypt', name: 'Dragon Crypt', icon: '🐉', color: '#636e72',
    description: 'Boss: a dragon that refused to stay buried. Bring holy fire and antidotes.',
    boss: true,
    entries: [{ enemy: 'enemy.zombie_dragon', min: 1, max: 1, weight: 1 }],
  },
  {
    id: 'enc.omega_vault', name: 'Omega Vault', icon: '🛸', color: '#2d3436',
    description: 'Superboss: the sealed war machine. For parties with nothing left to prove.',
    boss: true,
    entries: [{ enemy: 'enemy.omega', min: 1, max: 1, weight: 1 }],
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
      { item: 'item.wolf_pelt',   qty: '1d2', chance: 0.25 },
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
      { item: 'item.bead_ring', qty: 1, chance: 0.05 },
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
      { item: 'item.spirit_shard',  qty: 1, chance: 0.25 },
      { item: 'item.bead_chain',    qty: 1, chance: 0.15 },
      { item: 'item.dragon_scale',  qty: 1, chance: 0.15 },
      { item: 'item.mythril_vest',  qty: 1, chance: 0.12 },
      { item: 'item.diamond',       qty: 1, chance: 0.08 },
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
      { item: 'item.bread',      qty: '1d2', chance: 0.30 },
      { item: 'item.cheese_wheel', qty: 1,   chance: 0.10 },
      { item: 'item.garnet',     qty: 1,     chance: 0.10 },
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
      { item: 'item.garnet',      qty: 1,     chance: 0.15 },
      { item: 'item.potion_strength', qty: 1, chance: 0.12 },
      { item: 'item.longsword',   qty: 1,     chance: 0.08 },
      { item: 'item.chain_mail',  qty: 1,     chance: 0.08 },
      { item: 'item.tome_eiha',   qty: 1,     chance: 0.05 },
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
      { item: 'item.emerald',       qty: 1, chance: 0.12 },
      { item: 'item.mythril_vest',  qty: 1, chance: 0.10 },
      { item: 'item.katana',        qty: 1, chance: 0.08 },
      { item: 'item.tome_kouha',    qty: 1, chance: 0.06 },
      { item: 'item.holy_spear',    qty: 1, chance: 0.06 },
      { item: 'item.diamond',       qty: 1, chance: 0.05 },
      { item: 'item.ebonsteel_sword', qty: 1, chance: 0.04 },
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

// ── Legacy weapon/armor-model migration ───────────────────────────────────────
// The weapon/armor "kind + weight" model was replaced by WeaponTypeDef /
// ArmorTypeDef tables. Rulesets saved before that (drafts, old .epochmap files)
// still carry the old fields, so we heal them on load.

/** Old weaponKind → single new WeaponTypeDef id (weight nudges the fan-outs). */
function weaponTypeFromLegacy(kind: string | undefined, weight: string | undefined): string | undefined {
  switch (kind) {
    case 'blade': return weight === 'heavy' ? 'wtype.greatsword' : 'wtype.sword'
    case 'gun':   return weight === 'heavy' ? 'wtype.heavy_gun' : 'wtype.gun'
    case 'axe':    return 'wtype.axe'
    case 'mace':   return 'wtype.mace'
    case 'hammer': return 'wtype.hammer'
    case 'dagger': return 'wtype.dagger'
    case 'staff':  return 'wtype.staff'
    case 'wand':   return 'wtype.rod'
    case 'spear':  return 'wtype.spear'
    case 'bow':    return 'wtype.bow'
    default:       return undefined
  }
}

/** Old weaponKind → the set of new types a class of that proficiency should get. */
function classWeaponTypesFromLegacy(kind: string): string[] {
  switch (kind) {
    case 'blade': return ['wtype.sword', 'wtype.katana', 'wtype.greatsword']
    case 'gun':   return ['wtype.gun', 'wtype.heavy_gun']
    case 'axe':    return ['wtype.axe']
    case 'mace':   return ['wtype.mace']
    case 'hammer': return ['wtype.hammer']
    case 'dagger': return ['wtype.dagger']
    case 'staff':  return ['wtype.staff']
    case 'wand':   return ['wtype.rod']
    case 'spear':  return ['wtype.spear']
    case 'bow':    return ['wtype.bow']
    default:       return []
  }
}

/** Old armor weight + slot → new ArmorTypeDef id. */
function armorTypeFromLegacy(weight: string | undefined, slot: string | undefined): string {
  if (slot === 'offhand') return weight === 'medium' || weight === 'heavy' ? 'atype.shield' : 'atype.buckler'
  if (weight === 'heavy') return 'atype.heavy'
  if (weight === 'medium') return 'atype.medium'
  return 'atype.light'
}

/** Old class armorWeights → the set of new armor types to allow. */
function classArmorTypesFromLegacy(weight: string): string[] {
  switch (weight) {
    case 'light':  return ['atype.light', 'atype.robe', 'atype.buckler']
    case 'medium': return ['atype.medium', 'atype.shield']
    case 'heavy':  return ['atype.heavy']
    default:       return []
  }
}

function stripKeys<T extends object>(obj: T, keys: string[]): T {
  const clone = { ...(obj as Record<string, unknown>) }
  for (const k of keys) delete clone[k]
  return clone as unknown as T
}

function migrateLegacyWeaponArmor(r: Ruleset): Pick<Ruleset, 'items' | 'classes'> {
  const items = (r.items ?? []).map(it => {
    const legacy = it as unknown as { weaponKind?: string; weight?: string }
    if (it.kind === 'weapon' && !it.weaponType && legacy.weaponKind) {
      return { ...stripKeys(it, ['weaponKind', 'weight']), weaponType: weaponTypeFromLegacy(legacy.weaponKind, legacy.weight) }
    }
    if (it.kind === 'armor' && !it.armorType) {
      return { ...stripKeys(it, ['weight']), armorType: armorTypeFromLegacy(legacy.weight, it.slot) }
    }
    return it
  })
  const classes = (r.classes ?? []).map(cls => {
    const legacy = cls as unknown as { weaponKinds?: string[]; armorWeights?: string[] }
    const base = stripKeys(cls, ['weaponKinds', 'weaponWeights', 'armorWeights'])
    const weaponTypes = cls.weaponTypes ?? Array.from(new Set((legacy.weaponKinds ?? []).flatMap(classWeaponTypesFromLegacy)))
    const armorTypes = cls.armorTypes ?? Array.from(new Set((legacy.armorWeights ?? []).flatMap(classArmorTypesFromLegacy)))
    return { ...base, weaponTypes, armorTypes }
  })
  return { items, classes }
}

/**
 * Backfill collections added after a ruleset was saved — drafts and imports
 * from older versions lack newer tables (events/npcs/quests, etc.) — and heal
 * the legacy weapon/armor model when the type tables are missing/empty.
 */
export function normalizeRuleset(r: Ruleset): Ruleset {
  // An absent-or-empty weaponTypes table means a pre-type-system ruleset: seed
  // the default types and remap the old kind/weight fields on items & classes.
  const legacy = !(r.weaponTypes && r.weaponTypes.length)
  const migrated = legacy ? migrateLegacyWeaponArmor(r) : { items: r.items ?? [], classes: r.classes ?? [] }

  // Spell schools: legacy rulesets stored schools as raw strings on spells and
  // classes. Default school ids ARE those strings, so seeding the table is the
  // whole migration — plus bare defs for any custom strings the author used.
  let spellSchools = r.spellSchools
  if (!spellSchools?.length) {
    const known = new Set(DEFAULT_SPELL_SCHOOLS.map(s => s.id))
    const extras = Array.from(new Set((r.spells ?? []).map(s => s.school).filter(s => s && !known.has(s))))
      .map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), icon: '✨' }))
    spellSchools = [...DEFAULT_SPELL_SCHOOLS, ...extras]
  }

  // Audio: a ruleset with no tracks at all gets the built-in chiptune library,
  // and any unset global music slot points at the matching built-in — a strict
  // improvement for silent drafts, while authored audio is left untouched.
  const hadNoAudio = !(r.audioTracks && r.audioTracks.length)
  const meta = hadNoAudio
    ? { ...DEFAULT_MUSIC_SLOTS, sfxSlots: DEFAULT_SFX_SLOTS, ...Object.fromEntries(Object.entries(r.meta).filter(([, v]) => v !== undefined)) } as typeof r.meta
    : r.meta

  return {
    ...r,
    meta,
    classes: migrated.classes,
    weaponTypes: r.weaponTypes?.length ? r.weaponTypes : DEFAULT_WEAPON_TYPES,
    armorTypes: r.armorTypes?.length ? r.armorTypes : DEFAULT_ARMOR_TYPES,
    spellSchools,
    // Built-in tracks merge into every ruleset (they cost nothing and the
    // 'chip.' namespace can't collide with authored ids) so the library is
    // always available in the pickers; authored tracks stay untouched.
    audioTracks: hadNoAudio ? [...DEFAULT_AUDIO_TRACKS, ...DEFAULT_SFX_TRACKS] : [
      ...(r.audioTracks ?? []),
      ...[...DEFAULT_AUDIO_TRACKS, ...DEFAULT_SFX_TRACKS].filter(t => !(r.audioTracks ?? []).some(x => x.id === t.id)),
    ],
    items: migrated.items,
    spells: r.spells ?? [],
    skills: r.skills ?? [],
    statusEffects: r.statusEffects ?? [],
    enemies: r.enemies ?? [],
    encounterTables: r.encounterTables ?? [],
    lootTables: r.lootTables ?? [],
    shops: r.shops ?? [],
    events: r.events ?? [],
    npcs: r.npcs ?? [],
    quests: r.quests ?? [],
    dialogues: r.dialogues ?? [],
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
      ...DEFAULT_MUSIC_SLOTS,
      sfxSlots: DEFAULT_SFX_SLOTS,
    },
    attributes: DEFAULT_ATTRIBUTES,
    classes: DEFAULT_CLASSES,
    races: DEFAULT_RACES,
    weaponTypes: DEFAULT_WEAPON_TYPES,
    armorTypes: DEFAULT_ARMOR_TYPES,
    spellSchools: DEFAULT_SPELL_SCHOOLS,
    audioTracks: [...DEFAULT_AUDIO_TRACKS, ...DEFAULT_SFX_TRACKS],
    items: DEFAULT_ITEMS,
    spells: DEFAULT_SPELLS,
    skills: DEFAULT_SKILLS,
    statusEffects: DEFAULT_STATUS_EFFECTS,
    enemies: DEFAULT_ENEMIES,
    encounterTables: DEFAULT_ENCOUNTER_TABLES,
    lootTables: DEFAULT_LOOT_TABLES,
    events: [],
    npcs: [],
    quests: [],
    dialogues: [],
    shops: DEFAULT_SHOPS,
  }
}
