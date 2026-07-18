/**
 * Class-signature gear — ~10 pieces per armor slot for each class, locked to
 * that class (ItemDef.classes), plus a shared pool of rings, amulets, and
 * off-hand shields any eligible class can use. Names are tasteful homages to
 * gear from film, TV, games, and books.
 *
 * Authored as compact rows and expanded into full ItemDefs so the catalog
 * stays readable and easy to rebalance. Stat shorthand: attribute keys
 * (might/agility/intellect/spirit/endurance/luck) map to attribute modifiers;
 * defense/attack/speed map to derived modifiers.
 */

import type { ItemDef, ItemSlot, StatModifier, DamageType, LootTableDef, ShopDef } from './engine-types'

const DERIVED = new Set(['attack', 'defense', 'speed'])
function toMods(spec: Record<string, number>): StatModifier[] {
  return Object.entries(spec).map(([key, amount]) => ({
    target: DERIVED.has(key) ? 'derived' : 'attribute', key, op: 'add', amount,
  } as StatModifier))
}

const SLOT_ICON: Record<string, string> = { head: '🪖', body: '🧥', hands: '🧤', feet: '🥾', offhand: '🛡️', ring: '💍', amulet: '📿' }
const VALUE: Record<string, number> = { head: 130, body: 280, hands: 110, feet: 120, offhand: 200, ring: 220, amulet: 240 }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/** One gear row: [name, flavor, armorType, modifiers, iconOverride?] */
type Row = [string, string, string, Record<string, number>, string?]

function expand(prefix: string, slot: ItemSlot, rows: Row[], classes: string[] | null): ItemDef[] {
  return rows.map(([name, desc, atype, mods, icon]) => ({
    id: `item.${prefix}_${slug(name)}`,
    name, icon: icon ?? SLOT_ICON[slot], color: '#b2bec3',
    description: desc,
    kind: (slot === 'ring' || slot === 'amulet') ? 'accessory' : 'armor',
    slot,
    ...(slot === 'ring' || slot === 'amulet' ? {} : { armorType: atype }),
    value: VALUE[slot], stackable: false,
    modifiers: toMods(mods),
    ...(classes ? { classes } : {}),
  } as ItemDef))
}

// ── Gunslinger (agility · luck · crit→luck · accuracy→agility) ─────────────────
const GS = 'class.gunslinger'
const GUNSLINGER_HEAD: Row[] = [
  ['Weathered Stetson', "A sun-bleached wide-brim that's seen a hundred noons.", 'atype.light', { agility: 2, defense: 1 }, '🤠'],
  ['Desert Ranger Hat', 'Campaign felt and a road-worn brim, cut for the wastes.', 'atype.medium', { defense: 2, endurance: 1 }],
  ["Cattleman's Wide-Brim", 'Tall crown, curled brim — the drover’s crown of the plains.', 'atype.light', { luck: 2 }, '🤠'],
  ["Bounty Hunter's Hood", 'A quiet cowl for a quieter approach.', 'atype.light', { agility: 3 }, '🥷'],
  ["Gambler's Top Hat", 'Silk and a hidden card — fortune favours the sharp.', 'atype.light', { luck: 2, agility: 1 }, '🎩'],
  ['Amber Shooting-Glasses', 'Tinted lenses that turn glare into a clean sight-line.', 'atype.light', { agility: 3 }, '🕶️'],
  ['Ivory Gambler’s Hat', 'Pale brim of a coldblooded shot-caller.', 'atype.light', { agility: 2, luck: 1 }, '🎩'],
  ["Marshal's Star-Brim", 'Tin star pinned to hard felt — the law rides here.', 'atype.medium', { defense: 2, might: 1 }],
  ["Hunter's Tricorn", 'A three-cornered hat from a long, bloody night.', 'atype.light', { agility: 3 }, '🎩'],
  ["Sandrider's Kerchief", 'A dead man’s scarf, knotted against the dust of Mid-World.', 'atype.light', { agility: 2, luck: 1 }, '🧣'],
]
const GUNSLINGER_BODY: Row[] = [
  ['Trail Duster', 'Long oilcloth that keeps the wind and the world at arm’s length.', 'atype.light', { defense: 2, agility: 2 }],
  ['Oilskin Long Coat', 'Waxed against rain and river — the outrider’s second skin.', 'atype.medium', { defense: 3, endurance: 1 }],
  ['Desert Ranger Coat', 'Patched armor-cloth of the last patrol on the frontier.', 'atype.medium', { defense: 3, endurance: 2 }],
  ["No-Name's Serape", 'A faded poncho hiding iron and worse intentions.', 'atype.light', { luck: 3 }],
  ['Crimson Longcoat', 'A humanoid typhoon’s red coat — trouble in a friendly shape.', 'atype.light', { agility: 2, luck: 2 }, '🧥'],
  ['Beskar-Lite Cuirass', 'A scavenged plate over worn leathers — this is the way.', 'atype.medium', { defense: 4 }],
  ["Preacher's Black Coat", 'A gospel of lead, buttoned to the throat.', 'atype.light', { luck: 2, spirit: 1 }],
  ["Deadman's Coat", 'A coffin-maker’s coat, cut for a man who buries his own.', 'atype.medium', { defense: 3, might: 1 }],
  ["Hunter's Garb", 'Blood-stained coat and cravat from the old hunt.', 'atype.light', { agility: 3 }],
  ['Sorrow’s Crimson Mantle', 'A tattered red cloak worn by a haunted marksman.', 'atype.light', { agility: 2, luck: 2 }, '🧥'],
]
const GUNSLINGER_HANDS: Row[] = [
  ['Fringed Riding Gloves', 'Soft leather with a shooter’s trimmed trigger finger.', 'atype.light', { agility: 2 }],
  ['Quick-Draw Gauntlets', 'Cut so the iron clears leather a hair faster.', 'atype.light', { agility: 2, luck: 1 }],
  ["Revolver's Gloves", 'The gloves of a man who never stops spinning his piece.', 'atype.light', { agility: 2, luck: 1 }],
  ['Fanning Gloves', 'Callused palms built to fan a hammer dry.', 'atype.light', { agility: 3 }],
  ['Trigger-Finger Wraps', 'Bare-knuckle wraps that read the trigger like braille.', 'atype.light', { luck: 2 }],
  ["Ranger's Gloves", 'Armored knuckles from a long-dead republic.', 'atype.medium', { defense: 2 }],
  ["Sharpshooter's Gloves", 'Steady leathers that still a shaking hand.', 'atype.light', { agility: 3 }],
  ["Duelist's Gloves", 'White kid gloves for a gentleman’s killing.', 'atype.light', { luck: 2 }],
  ['Rawhide Gloves', 'Honest, tough, and cheap as a bad night.', 'atype.light', { defense: 1, agility: 1 }],
  ["Gunsmith's Gloves", 'Oil-dark gloves that know every part by feel.', 'atype.light', { agility: 2 }],
]
const GUNSLINGER_FEET: Row[] = [
  ['Spurred Riding Boots', 'Jingling steel and a mile-eating stride.', 'atype.light', { agility: 2 }],
  ['Snakeskin Boots', 'Scaled and showy — the mark of a man with money and nerve.', 'atype.light', { luck: 2 }],
  ['Ranger Combat Boots', 'Reinforced marching boots for the long road.', 'atype.medium', { defense: 2, endurance: 1 }],
  ['Rattlesnake Spurs', 'Rowels that bite as sure as the snake they’re named for.', 'atype.light', { agility: 2, luck: 1 }],
  ['Silver-Spur Boots', 'Fortune walks in on polished silver.', 'atype.light', { luck: 2 }],
  ['Bounty Hunter Greaves', 'Plated shins for chasing prices across the badlands.', 'atype.medium', { defense: 3 }],
  ['Dusty Trail Boots', 'A hundred towns worn into the soles.', 'atype.light', { agility: 2 }],
  ['Deadwood Boots', 'Mud, whiskey, and worse ground into the leather.', 'atype.medium', { defense: 2 }],
  ["Hunter's Boots", 'Quick, quiet, and ready for a long night’s work.', 'atype.light', { agility: 3 }],
  ['Coffin-Dodger Boots', 'Boots that have out-run the undertaker one more time.', 'atype.light', { agility: 2, luck: 1 }],
]

// ── Fighter (might · endurance · defense — any armor type) ─────────────────────
const FT = 'class.fighter'
const FIGHTER_HEAD: Row[] = [
  ['Winged Great Helm', 'A crowned helm fit for a returning king.', 'atype.heavy', { defense: 3, might: 1 }],
  ['Dragonslayer Helm', 'Scarred iron from a duel with something enormous.', 'atype.heavy', { defense: 3, endurance: 1 }],
  ['Nordic Horned Helm', 'Fur-lined steel from the frozen holds.', 'atype.medium', { might: 2, endurance: 1 }],
  ['Elite Knight Helm', 'A dented visor that has weathered a hundred sieges.', 'atype.heavy', { defense: 3 }],
  ['Berserker’s Iron Mask', 'A crude mask for a man who fights past the pain.', 'atype.heavy', { might: 3, defense: 1 }],
  ['Legionary Galea', 'Crested bronze of a disciplined front line.', 'atype.medium', { defense: 2, might: 1 }],
  ['Spartan Helm', 'Full-face bronze — this is where we hold.', 'atype.heavy', { defense: 3, endurance: 1 }],
  ['Wolf-Crest Sallet', 'A lord’s hunting helm, grey as a winter wolf.', 'atype.medium', { defense: 2, endurance: 1 }],
  ['Barbarian War-Helm', 'Bone and iron from beyond the maps.', 'atype.medium', { might: 2, defense: 1 }],
  ['Crusader’s Greathelm', 'A holy flat-top scarred by distant wars.', 'atype.heavy', { defense: 3 }],
]
const FIGHTER_BODY: Row[] = [
  ['Kingsguard Plate', 'Gilded steel sworn to a throne.', 'atype.heavy', { defense: 5, might: 1 }],
  ['Dragonscale Cuirass', 'Overlapping scales that shrug off fang and flame.', 'atype.heavy', { defense: 4, endurance: 2 }],
  ['Berserker Armor', 'Cursed black plate that feeds on its wearer’s rage.', 'atype.heavy', { might: 4, defense: 2 }],
  ['Ebony Plate', 'Volcanic-glass armor, dark and near unbreakable.', 'atype.heavy', { defense: 5 }],
  ['Legionary Lorica', 'Segmented iron of an empire’s finest.', 'atype.medium', { defense: 3, endurance: 2 }],
  ['Nordic Steel Cuirass', 'Bear-strong plate from the mountain holds.', 'atype.heavy', { defense: 4, might: 1 }],
  ['Bull-Crest Breastplate', 'A gladiator’s prize armor, won in blood.', 'atype.medium', { might: 3, defense: 2 }],
  ['Wolf-Lord’s Harness', 'A commander’s war-plate, grey and grim.', 'atype.heavy', { defense: 4, endurance: 1 }],
  ['Conqueror’s Cuirass', 'Barbarian iron worn by a would-be king.', 'atype.medium', { might: 3, endurance: 2 }],
  ['Fell-Knight Plate', 'The heavy armor of a knight who would not fall.', 'atype.heavy', { defense: 4, might: 2 }],
]
const FIGHTER_HANDS: Row[] = [
  ['Gauntlets of the King', 'Steel-clad hands that once bore a crown’s weight.', 'atype.heavy', { might: 2, defense: 1 }],
  ['Dragonslayer Gauntlets', 'Grip forged to hold on when the beast pulls back.', 'atype.heavy', { might: 3 }],
  ['Ironclad Fists', 'Plated knuckles that turn a punch into a hammer.', 'atype.heavy', { might: 2, defense: 1 }],
  ['Berserker Gauntlets', 'Blood-grooved iron that never loosens its hold.', 'atype.medium', { might: 3 }],
  ['Legionary Bracers', 'Studded leather-and-iron of the shield wall.', 'atype.medium', { defense: 2 }],
  ['Nordic Gauntlets', 'Fur-cuffed steel for a frozen grip.', 'atype.medium', { might: 2 }],
  ['Gladiator’s Manica', 'Layered plate down the sword arm.', 'atype.medium', { might: 2, defense: 1 }],
  ['Wolf-Steel Gauntlets', 'A captain’s gloves, worn to the fit of a blade.', 'atype.heavy', { defense: 2, might: 1 }],
  ['Bone-Crusher Grips', 'Barbarian gauntlets studded with old trophies.', 'atype.medium', { might: 3 }],
  ['Crusader Gauntlets', 'Faithful steel that has held the line for gods.', 'atype.heavy', { defense: 2, endurance: 1 }],
]
const FIGHTER_FEET: Row[] = [
  ['Sabatons of the King', 'Gold-chased warboots for a long march home.', 'atype.heavy', { defense: 3 }],
  ['Dragonslayer Greaves', 'Braced plate that stands its ground.', 'atype.heavy', { defense: 3, endurance: 1 }],
  ['Ironclad Warboots', 'Heavy tread that shakes the shield wall.', 'atype.heavy', { defense: 2, might: 1 }],
  ['Berserker Greaves', 'Black iron that keeps walking through the wound.', 'atype.medium', { endurance: 2, might: 1 }],
  ['Legionary Caligae', 'Hobnailed marching boots of the legions.', 'atype.medium', { endurance: 2 }],
  ['Nordic War-Boots', 'Fur and iron for the highland cold.', 'atype.medium', { endurance: 2, defense: 1 }],
  ['Gladiator’s Greaves', 'Sand-scoured shin-plate from the arena.', 'atype.medium', { defense: 2, might: 1 }],
  ['Wolf-Guard Sabatons', 'A grey lord’s steel-shod stride.', 'atype.heavy', { defense: 3 }],
  ['Barbarian Warboots', 'Hide-wrapped iron from the far cold north.', 'atype.medium', { might: 2, endurance: 1 }],
  ['Crusader Sabatons', 'Plated boots that never stepped back.', 'atype.heavy', { defense: 3, endurance: 1 }],
]

// ── Mage (intellect — body only; robe/light) ──────────────────────────────────
const MG = 'class.mage'
const MAGE_BODY: Row[] = [
  ['Grey Pilgrim’s Robes', 'The travel-worn wizard-grey of a wandering sage.', 'atype.robe', { intellect: 4, spirit: 1 }, '🧙'],
  ['Archmage Robes', 'Star-stitched vestments of a master of the art.', 'atype.robe', { intellect: 5 }, '🧙'],
  ['Sorcerer’s Nightgown', 'Threadbare robes humming with old power.', 'atype.robe', { intellect: 4 }],
  ['Cloak of the Sorcerer Supreme', 'A living relic that guards its wearer’s mind.', 'atype.robe', { intellect: 4, spirit: 2 }, '🧣'],
  ['Elder Scroll Vestments', 'Robes inked with knowledge better left unread.', 'atype.robe', { intellect: 5 }],
  ['Black Mage Vest', 'A pointed-hat conjurer’s dark travelling coat.', 'atype.light', { intellect: 3, agility: 1 }],
  ['Aes Sedai Shawl', 'A fringed shawl marking a wielder of the Source.', 'atype.robe', { intellect: 4, spirit: 1 }, '🧣'],
  ['Runemaster’s Robes', 'Cloth sewn with sigils that drink the mana.', 'atype.robe', { intellect: 4 }],
  ['Frost-Weave Garb', 'Chill silks that never scorch when the spell goes wrong.', 'atype.light', { intellect: 3, endurance: 1 }],
  ['Robes of the Nine', 'Vestments of a secret order of high magi.', 'atype.robe', { intellect: 5, spirit: 1 }],
]

// ── Cleric (spirit · endurance · defense; medium/light/robe) ──────────────────
const CL = 'class.cleric'
const CLERIC_HEAD: Row[] = [
  ['Bishop’s Mitre', 'A tall holy crown that turns aside the dark.', 'atype.robe', { spirit: 3 }, '⛪'],
  ['Templar Helm', 'Cross-slit steel sworn to the light.', 'atype.medium', { defense: 2, spirit: 1 }],
  ['Crusader Circlet', 'A blessed band worn beneath the hood.', 'atype.light', { spirit: 2, endurance: 1 }],
  ['Inquisitor’s Hood', 'A grim cowl for those who judge the wicked.', 'atype.light', { spirit: 2 }, '🥷'],
  ['Paladin’s Great Helm', 'Radiant steel that shrugs off despair.', 'atype.medium', { defense: 3 }],
  ['Sunlight Coif', 'A pilgrim’s hood that catches the first light.', 'atype.light', { spirit: 2, endurance: 1 }],
  ['Belmont’s Headband', 'A holy hunter’s simple, unbreakable resolve.', 'atype.light', { spirit: 2, might: 1 }, '🎗️'],
  ['Grand Cleric’s Veil', 'A high priest’s solemn, warding veil.', 'atype.robe', { spirit: 3 }],
  ['Warpriest Helm', 'Battle-dented steel that still hears the hymn.', 'atype.medium', { defense: 2, spirit: 1 }],
  ['Halo Circlet', 'A ring of gilded light for the truly faithful.', 'atype.light', { spirit: 3 }],
]
const CLERIC_BODY: Row[] = [
  ['Vestments of the Light', 'White-and-gold robes that push back the dark.', 'atype.robe', { spirit: 4, endurance: 1 }, '⛪'],
  ['Templar Hauberk', 'Cross-emblazoned mail sworn to a holy order.', 'atype.medium', { defense: 3, spirit: 1 }],
  ['Paladin Plate', 'Blessed steel that will not let its bearer fall.', 'atype.medium', { defense: 4, spirit: 1 }],
  ['Inquisitor’s Coat', 'Heavy vestments for hunting the profane.', 'atype.medium', { spirit: 3, endurance: 1 }],
  ['Warpriest Chainmail', 'Battle-mail worn over a censer and a prayer.', 'atype.medium', { defense: 3, spirit: 1 }],
  ['Grand Cleric’s Robes', 'A high priest’s radiant ceremonial garb.', 'atype.robe', { spirit: 5 }],
  ['Crusader Surcoat', 'A cross-marked coat over honest mail.', 'atype.medium', { defense: 3, endurance: 1 }],
  ['Sunlight Tabard', 'Cloth that seems to glow at the dawn.', 'atype.light', { spirit: 3, endurance: 1 }],
  ['Monk’s Hallowed Habit', 'Plain wool that hides a saint’s resolve.', 'atype.robe', { spirit: 4 }],
  ['Aegis of Faith', 'Layered mail and prayer-cloth, proof against evil.', 'atype.medium', { defense: 4, spirit: 1 }],
]
const CLERIC_HANDS: Row[] = [
  ['Blessed Gauntlets', 'Steel gloves anointed against the unclean.', 'atype.medium', { spirit: 2, defense: 1 }],
  ['Templar Gauntlets', 'Cross-etched grip sworn to the order.', 'atype.medium', { defense: 2 }],
  ['Healer’s Wraps', 'Soft linen for hands that mend as well as smite.', 'atype.light', { spirit: 3 }],
  ['Inquisitor’s Gloves', 'Iron-backed gloves for grim, holy work.', 'atype.medium', { spirit: 2 }],
  ['Paladin Gauntlets', 'Radiant steel that steadies a shaking oath.', 'atype.medium', { defense: 2, spirit: 1 }],
  ['Censer-Bearer Gloves', 'Smoke-stained gloves that carry the incense.', 'atype.light', { spirit: 2, endurance: 1 }],
  ['Warpriest Bracers', 'Mailed forearms for swinging a holy mace.', 'atype.medium', { defense: 2, might: 1 }],
  ['Grand Cleric’s Gloves', 'Silk-and-gold gloves of the high altar.', 'atype.robe', { spirit: 3 }],
  ['Sunlight Gauntlets', 'Warm bronze that never quite goes cold.', 'atype.light', { spirit: 2 }],
  ['Oathkeeper Gloves', 'Faithful grip that holds when hope is thin.', 'atype.medium', { spirit: 2, defense: 1 }],
]
const CLERIC_FEET: Row[] = [
  ['Pilgrim’s Sandals', 'Worn straps that have walked a thousand holy miles.', 'atype.light', { spirit: 2, endurance: 1 }],
  ['Templar Sabatons', 'Cross-marked steel that holds the sacred ground.', 'atype.medium', { defense: 3 }],
  ['Paladin Greaves', 'Blessed plate that will not be moved.', 'atype.medium', { defense: 3, spirit: 1 }],
  ['Inquisitor’s Boots', 'Quiet, grim boots for the profane’s doorstep.', 'atype.light', { spirit: 2 }],
  ['Warpriest Warboots', 'Iron-shod boots for a marching hymn.', 'atype.medium', { defense: 2, endurance: 1 }],
  ['Sunlight Sandals', 'Gilded soles warmed by the dawn.', 'atype.light', { spirit: 2, endurance: 1 }],
  ['Grand Cleric’s Slippers', 'Soft, silent tread of the high altar.', 'atype.robe', { spirit: 3 }],
  ['Crusader Sabatons', 'Faithful steel that never stepped back from evil.', 'atype.medium', { defense: 3, spirit: 1 }],
  ['Monk’s Straw Sandals', 'Humble footwear, unbreakable in spirit.', 'atype.light', { spirit: 2, endurance: 1 }],
  ['Aureate Greaves', 'Golden shin-guards that shine even in the deep.', 'atype.medium', { defense: 2, spirit: 1 }],
]

// ── Rogue (agility · luck; light/medium) ──────────────────────────────────────
const RG = 'class.rogue'
const ROGUE_HEAD: Row[] = [
  ['Assassin’s Hood', 'A peaked cowl that swallows the face in shadow.', 'atype.light', { agility: 3 }, '🥷'],
  ['Master Thief’s Hood', 'A city-grey hood that has never once been caught.', 'atype.light', { agility: 2, luck: 1 }, '🥷'],
  ['Nightingale Hood', 'A twilight cowl stitched with old, quiet magic.', 'atype.light', { agility: 2, luck: 1 }],
  ['Corvo’s Mask', 'A clockwork half-mask that misses nothing.', 'atype.medium', { agility: 2, defense: 1 }, '🎭'],
  ['Sheikah Cowl', 'A hidden tribe’s wrap for a silent step.', 'atype.light', { agility: 3 }],
  ['Outlaw’s Hood', 'The green hood of a very generous thief.', 'atype.light', { agility: 2, luck: 1 }],
  ['Cowl of the Bat', 'A pointed-ear cowl that turns fear on its owner.', 'atype.medium', { agility: 2, defense: 1 }, '🦇'],
  ['Bandit’s Bandana', 'Cheap cloth, priceless anonymity.', 'atype.light', { agility: 2 }, '🧣'],
  ['Shadowblade Mask', 'A featureless mask worn by killers in the dark.', 'atype.light', { agility: 2, luck: 1 }, '🎭'],
  ['Thieves’ Guild Hood', 'Standard-issue for the well-organised underworld.', 'atype.light', { agility: 3 }, '🥷'],
]
const ROGUE_BODY: Row[] = [
  ['Assassin’s Robes', 'Layered whites and leather built for rooftops.', 'atype.light', { agility: 3, defense: 1 }],
  ['Master Thief’s Leathers', 'Supple, silent, and full of hidden pockets.', 'atype.light', { agility: 3, luck: 1 }],
  ['Nightingale Armor', 'Twilight-blue leather humming with quiet magic.', 'atype.medium', { agility: 2, luck: 2 }],
  ['Blink Coat', 'A clockwork spy’s coat, cut for a vanishing act.', 'atype.medium', { agility: 3, defense: 1 }],
  ['Sheikah Bodysuit', 'A hidden tribe’s wrap, snug as a second skin.', 'atype.light', { agility: 4 }],
  ['Outlaw’s Lincoln Green', 'A merry marksman’s forest-worn leathers.', 'atype.light', { agility: 2, luck: 2 }],
  ['Batsuit Weave', 'A fear-proof mesh over armored plating.', 'atype.medium', { agility: 2, defense: 2 }],
  ['Sneaking Suit', 'A soldier-spy’s skintight infiltration gear.', 'atype.medium', { agility: 3 }],
  ['Shadowblade Garb', 'Matte-black leathers that eat the torchlight.', 'atype.light', { agility: 3, luck: 1 }],
  ['Guildmaster’s Leathers', 'The finest set the thieves’ guild can steal.', 'atype.medium', { agility: 3, defense: 1 }],
]
const ROGUE_HANDS: Row[] = [
  ['Hidden Blade Bracer', 'A spring-loaded gauntlet — a killer’s best-kept secret.', 'atype.light', { agility: 2, luck: 1 }],
  ['Thief’s Gloves', 'Fingerless leather for feeling out a lock.', 'atype.light', { agility: 2 }],
  ['Nightingale Gloves', 'Twilight leather that quiets a grasping hand.', 'atype.light', { agility: 2, luck: 1 }],
  ['Blink Gloves', 'Fine gloves wired to a vanishing trick.', 'atype.medium', { agility: 2 }],
  ['Sheikah Gloves', 'Wrapped hands for a soundless grip.', 'atype.light', { agility: 3 }],
  ['Outlaw’s Archer Gloves', 'A marksman’s trimmed shooting gloves.', 'atype.light', { agility: 2, luck: 1 }],
  ['Grapple Gauntlets', 'A caped crusader’s line-and-grapple gloves.', 'atype.medium', { agility: 2, defense: 1 }],
  ['Cutpurse Gloves', 'Quick fingers, quicker exits.', 'atype.light', { agility: 2, luck: 1 }],
  ['Shadowblade Gloves', 'Silent leather for a silent kill.', 'atype.light', { agility: 3 }],
  ['Lockpick Gloves', 'Tools sewn into every seam.', 'atype.light', { agility: 2, luck: 1 }],
]
const ROGUE_FEET: Row[] = [
  ['Assassin’s Boots', 'Soft soles that never so much as scuff a tile.', 'atype.light', { agility: 3 }],
  ['Thief’s Soft Boots', 'The quietest boots coin can buy.', 'atype.light', { agility: 2, luck: 1 }],
  ['Nightingale Boots', 'Twilight leather that muffles every step.', 'atype.medium', { agility: 2, luck: 1 }],
  ['Blink Boots', 'Light boots for a spy who is never quite there.', 'atype.medium', { agility: 3 }],
  ['Sheikah Sandals', 'A hidden tribe’s footwear, swift and silent.', 'atype.light', { agility: 3 }],
  ['Outlaw’s Forest Boots', 'Moss-quiet boots for the greenwood.', 'atype.light', { agility: 2, luck: 1 }],
  ['Grapnel Boots', 'Rubber-soled boots for rooftop landings.', 'atype.medium', { agility: 2, defense: 1 }],
  ['Fleetfoot Boots', 'Boots made for a very fast getaway.', 'atype.light', { agility: 3 }],
  ['Shadowblade Boots', 'Black boots that leave no track.', 'atype.light', { agility: 2, luck: 1 }],
  ['Guild Runner’s Boots', 'Standard issue for a rooftop courier.', 'atype.light', { agility: 3 }],
]

// ── Shared: rings, amulets, off-hand shields (no class lock) ───────────────────
const RINGS: Row[] = [
  ['Ring of Power', 'A plain gold band that whispers when no one listens.', '', { agility: 2, luck: 1 }],
  ['Signet of the Serpent', 'A coiled-snake ring favoured by the ambitious.', '', { might: 2 }],
  ['Band of Accuracy', 'Steadies the hand and sharpens the eye.', '', { agility: 3 }],
  ['Ruby Ring of Vigor', 'A blood-red stone that quickens the pulse.', '', { endurance: 3 }],
  ['Sapphire Ring of the Mind', 'Cool blue clarity for the spellcaster.', '', { intellect: 3 }],
  ['Ring of the Faithful', 'A blessed band that steadies the soul.', '', { spirit: 3 }],
  ['Gambler’s Lucky Ring', 'Every coin seems to land its way.', '', { luck: 3 }],
  ['Ironwill Band', 'A soldier’s ring worn smooth by hard years.', '', { might: 1, endurance: 2 }],
  ['Ring of Deft Hands', 'A thief’s quiet little advantage.', '', { agility: 2, luck: 1 }],
  ['Ring of Warding', 'A protective sigil turns a killing blow aside.', '', { defense: 3 }],
  ['One Band of Fortune', 'A precious little ring — best not to keep it too long.', '', { agility: 1, luck: 2 }],
  ['Ring of the Ancestors', 'Passed down until the names were forgotten.', '', { endurance: 2, spirit: 1 }],
]
const AMULETS: Row[] = [
  ['Amulet of Vitality', 'A warm stone that steadies a failing heart.', '', { endurance: 3, defense: 1 }],
  ['Talisman of the Tiger', 'Carved fang that lends a striker’s ferocity.', '', { might: 3 }],
  ['Pendant of Insight', 'A clear crystal that focuses a racing mind.', '', { intellect: 3, spirit: 1 }],
  ['Holy Symbol', 'A sacred emblem that wards the wearer’s spirit.', '', { spirit: 3 }],
  ['Charm of the Cat', 'Nine-lives luck strung on a leather cord.', '', { agility: 2, luck: 2 }],
  ['Beast-Bone Necklace', 'Trophies of old hunts, humming with strength.', '', { might: 2, endurance: 1 }],
  ['Locket of the Lost', 'A keepsake that steels the will to survive.', '', { endurance: 2, spirit: 1 }],
  ['Evil Eye Pendant', 'A blue-glass eye that turns misfortune away.', '', { luck: 3 }],
  ['Wardstone Amulet', 'A rune-cut stone proof against harm.', '', { defense: 3 }],
  ['Phoenix Feather Charm', 'A single ember-red plume, warm to the touch.', '', { spirit: 2, endurance: 1 }],
  ['Serpent Eye Amulet', 'A slitted jewel that sharpens every sense.', '', { agility: 3 }],
  ['Heart of the Mountain', 'A heavy gem that anchors the body and the will.', '', { endurance: 3, might: 1 }],
]
const SHIELDS: Row[] = [
  ['Round Wooden Shield', 'An honest board and boss — cheap and reliable.', 'atype.buckler', { defense: 2 }],
  ['Kite Shield', 'A tall knight’s shield for the shield wall.', 'atype.shield', { defense: 4 }],
  ['Tower Shield', 'A wall of iron you can hide behind.', 'atype.shield', { defense: 5, speed: -1 }],
  ['Targe Buckler', 'A nimble little shield for a duelist’s parry.', 'atype.buckler', { defense: 2, agility: 1 }],
  ['Aegis of the Faithful', 'A blessed shield that shrugs off despair.', 'atype.shield', { defense: 4, spirit: 1 }],
  ['Dragon-Crest Shield', 'A famous kite shield emblazoned with a wyrm.', 'atype.shield', { defense: 4, endurance: 1 }],
  ['Spiked Buckler', 'A small shield that bites back.', 'atype.buckler', { defense: 2, might: 1 }],
  ['Silver Knight Shield', 'Gleaming ceremonial guard of an elite order.', 'atype.shield', { defense: 4 }],
  ['Bulwark of the Legion', 'A rectangular scutum for the front rank.', 'atype.shield', { defense: 5, endurance: 1, speed: -1 }],
  ['Sentinel Buckler', 'A watchman’s quick, light guard.', 'atype.buckler', { defense: 3 }],
]

// ── Weapons ───────────────────────────────────────────────────────────────────
const WTYPE_ICON: Record<string, string> = {
  'wtype.sword': '⚔️', 'wtype.katana': '🗡️', 'wtype.greatsword': '⚔️', 'wtype.axe': '🪓',
  'wtype.mace': '🔨', 'wtype.hammer': '🔨', 'wtype.spear': '🔱', 'wtype.bow': '🏹',
  'wtype.staff': '🪄', 'wtype.rod': '✨', 'wtype.dagger': '🗡️', 'wtype.gun': '🔫', 'wtype.heavy_gun': '🔫',
}
/** [name, flavor, weaponType, modifiers, opts?] */
type WRow = [string, string, string, Record<string, number>, {
  twoHanded?: boolean; charges?: number; damageType?: DamageType; value?: number; icon?: string
}?]

function weapons(prefix: string, rows: WRow[], classes: string[]): ItemDef[] {
  return rows.map(([name, desc, wtype, mods, o]) => ({
    id: `item.${prefix}_${slug(name)}`,
    name, icon: o?.icon ?? WTYPE_ICON[wtype] ?? '⚔️', color: '#dfe6e9',
    description: desc, kind: 'weapon', slot: 'weapon', weaponType: wtype,
    value: o?.value ?? 700, stackable: false,
    modifiers: toMods(mods),
    ...(o?.twoHanded ? { twoHanded: true } : {}),
    ...(o?.charges ? { charges: o.charges } : {}),
    ...(o?.damageType ? { damageType: o.damageType } : {}),
    classes,
  } as ItemDef))
}

const FIGHTER_WEAPONS: WRow[] = [
  ['Andúril, Flame of the West', 'A king’s blade reforged from the shards of a legend.', 'wtype.sword', { might: 3, attack: 3 }, { value: 1400 }],
  ['Excalibur', 'The sword in the stone, promised to a rightful hand.', 'wtype.sword', { might: 2, attack: 2, luck: 1 }, { value: 1500 }],
  ['Dragonslayer', 'A slab of iron more raw will than sword.', 'wtype.greatsword', { might: 5, attack: 4 }, { twoHanded: true, value: 1600 }],
  ['Buster Blade', 'An enormous flat-bladed sword carried in memory.', 'wtype.greatsword', { might: 4, attack: 3 }, { twoHanded: true, value: 1300 }],
  ['Frostmourne', 'A runeblade that hungers, and whispers, and chills.', 'wtype.sword', { might: 3, attack: 3 }, { damageType: 'ice', value: 1500 }],
  ['Gungnir', 'A spear that never misses the mark it is thrown at.', 'wtype.spear', { might: 3, attack: 2, agility: 1 }, { value: 1200 }],
  ['Mjölnir', 'A thunder-hammer only the worthy can lift.', 'wtype.hammer', { might: 4, attack: 3 }, { twoHanded: true, damageType: 'lightning', value: 1600 }],
  ['Stormbreaker', 'A axe-hammer forged in the heart of a dying star.', 'wtype.axe', { might: 4, attack: 4 }, { twoHanded: true, value: 1500 }],
  ['Masamune', 'A perfect katana, folded ten thousand times.', 'wtype.katana', { might: 3, attack: 3, agility: 1 }, { value: 1300 }],
  ['Gram', 'The blade that slew a dragon and cursed a bloodline.', 'wtype.sword', { might: 3, attack: 2 }, { value: 1100 }],
]
const MAGE_WEAPONS: WRow[] = [
  ['Staff of the Magi', 'A gnarled length of power crackling with the arcane.', 'wtype.staff', { intellect: 4, attack: 1 }, { value: 1400 }],
  ['Grey Wanderer’s Staff', 'A pilgrim-wizard’s walking staff, wiser than it looks.', 'wtype.staff', { intellect: 3, spirit: 1 }, { value: 1200 }],
  ['Elder Wand', 'The most storied wand there is — and the deadliest to own.', 'wtype.rod', { intellect: 4 }, { value: 1500 }],
  ['Fire Rod', 'A ruby-tipped rod that spits a bolt of flame.', 'wtype.rod', { intellect: 2 }, { charges: 12, damageType: 'fire', value: 800 }],
  ['Frost Rod', 'A rime-cold rod that hurls a shard of ice.', 'wtype.rod', { intellect: 2 }, { charges: 12, damageType: 'ice', value: 800 }],
  ['Storm Rod', 'A brass rod humming with caged lightning.', 'wtype.rod', { intellect: 2 }, { charges: 12, damageType: 'lightning', value: 850 }],
  ['Archmage’s Staff', 'The staff of a master who forgot more magic than most learn.', 'wtype.staff', { intellect: 5 }, { value: 1600 }],
  ['Ritual Athame', 'A ceremonial dagger that channels raw power.', 'wtype.dagger', { intellect: 3, agility: 1 }, { value: 900 }],
  ['Serpent Staff', 'A twined-snake stave, cool and patient.', 'wtype.staff', { intellect: 3, spirit: 1 }, { value: 1000 }],
  ['Void Rod', 'A rod tipped with a stone that drinks the light.', 'wtype.rod', { intellect: 4, attack: 1 }, { damageType: 'dark', value: 1200 }],
]
const CLERIC_WEAPONS: WRow[] = [
  ['Mace of the Faithful', 'A blessed head that rings like a church bell on impact.', 'wtype.mace', { spirit: 3, attack: 2 }, { value: 1000 }],
  ['Dawnbreaker', 'A holy mace that flares with the light of the sun.', 'wtype.mace', { spirit: 3, attack: 2 }, { damageType: 'holy', value: 1300 }],
  ['Warhammer of Light', 'A two-handed maul that judges the wicked.', 'wtype.hammer', { spirit: 2, attack: 4 }, { twoHanded: true, damageType: 'holy', value: 1400 }],
  ['Bishop’s Crozier', 'A shepherd’s crook of the high clergy.', 'wtype.staff', { spirit: 4 }, { value: 1100 }],
  ['Hammer of Judgement', 'A great hammer that falls like a verdict.', 'wtype.hammer', { spirit: 3, attack: 3 }, { twoHanded: true, damageType: 'holy', value: 1300 }],
  ['Holy-Water Sprinkler', 'A spiked mace once swung by warrior-priests.', 'wtype.mace', { spirit: 2, attack: 2 }, { value: 800 }],
  ['Saint’s Staff', 'A relic-staff warm with a martyr’s blessing.', 'wtype.staff', { spirit: 4, endurance: 1 }, { value: 1200 }],
  ['Censer Flail', 'A swinging censer that smites and sanctifies.', 'wtype.mace', { spirit: 2, attack: 2 }, { value: 850 }],
  ['Hammer of the Dawn', 'A radiant maul that calls down the morning.', 'wtype.hammer', { spirit: 3, attack: 3 }, { twoHanded: true, damageType: 'holy', value: 1400 }],
  ['Crusader’s Mace', 'A plain, faithful weapon that has ended many heresies.', 'wtype.mace', { spirit: 2, attack: 3 }, { value: 950 }],
]
const ROGUE_WEAPONS: WRow[] = [
  ['Hidden Blade', 'A spring-loaded bracer-blade for a silent creed.', 'wtype.dagger', { agility: 3, attack: 2 }, { value: 1100 }],
  ['Assassin’s Kris', 'A wavy, poison-grooved blade for close work.', 'wtype.dagger', { agility: 2, luck: 1 }, { damageType: 'poison', value: 950 }],
  ['Tanto', 'A short, wickedly sharp blade drawn in a blink.', 'wtype.dagger', { agility: 2, attack: 2 }, { value: 800 }],
  ['Duelist’s Rapier', 'A slender thrusting sword for the quick and the clever.', 'wtype.sword', { agility: 3, attack: 2 }, { value: 1000 }],
  ['Outlaw’s Longbow', 'A yew bow that never seems to run out of arrows.', 'wtype.bow', { agility: 3, attack: 2 }, { value: 1050 }],
  ['Emerald Longbow', 'A trick-arrow bow in a very particular shade of green.', 'wtype.bow', { agility: 2, luck: 1, attack: 2 }, { value: 1100 }],
  ['Poisoned Rondel', 'A stiletto meant for the gaps in a man’s armor.', 'wtype.dagger', { agility: 2, attack: 2 }, { damageType: 'poison', value: 900 }],
  ['Silenced Holdout', 'A muffled little pistol for wet work in the dark.', 'wtype.gun', { agility: 2, attack: 2 }, { charges: 8, value: 1200 }],
  ['Fan of Knives', 'A bandolier of balanced throwing blades.', 'wtype.dagger', { agility: 3 }, { value: 850 }],
  ['Folding Blade', 'A masked killer’s collapsible sword, quiet as a whisper.', 'wtype.sword', { agility: 3, attack: 2 }, { value: 1150 }],
]
const GUNSLINGER_WEAPONS: WRow[] = [
  ['Sandalwood Revolvers', 'Great irons with worn sandalwood grips, born of a melted blade.', 'wtype.gun', { agility: 3, luck: 1 }, { charges: 6, value: 1600 }],
  ['The Peacemaker', 'The gun that won a frontier, plain and deadly.', 'wtype.gun', { agility: 2, attack: 2 }, { charges: 6, value: 900 }],
  ['Deadeye Revolver', 'A shootist’s piece that seems to slow time itself.', 'wtype.gun', { agility: 2, luck: 2 }, { charges: 6, value: 1100 }],
  ['Vash’s Punisher', 'A humanoid typhoon’s oversized silver sidearm.', 'wtype.heavy_gun', { agility: 3, attack: 3 }, { twoHanded: true, charges: 6, value: 1500 }],
  ['Single Action Army', 'A revolver-spinner’s weapon of choice — and vice.', 'wtype.gun', { agility: 3, luck: 1 }, { charges: 6, value: 1000 }],
  ['Ranger Sequoia', 'A hand-engraved magnum of a fallen republic’s finest.', 'wtype.gun', { agility: 2, attack: 3 }, { charges: 6, value: 1300 }],
  ['Lever-Action Repeater', 'A trusty long gun that speaks in a steady rhythm.', 'wtype.heavy_gun', { agility: 2, attack: 3 }, { twoHanded: true, charges: 7, value: 1200 }],
  ['Sawed-Off Coach Gun', 'Two barrels of very persuasive argument.', 'wtype.heavy_gun', { agility: 1, attack: 5 }, { twoHanded: true, charges: 2, value: 1000 }],
  ['Ivory Hex-Shooter', 'A gambler-gunslinger’s pearl-handled, fanning revolver.', 'wtype.gun', { agility: 2, luck: 2 }, { charges: 6, value: 1150 }],
  ['Gilead’s Iron', 'A gunslinger’s birthright, forged for a long, hard road.', 'wtype.gun', { agility: 3, attack: 2, luck: 1 }, { charges: 6, value: 1500 }],
]

export const CLASS_GEAR_ITEMS: ItemDef[] = [
  ...weapons('ftr', FIGHTER_WEAPONS, [FT]),
  ...weapons('mag', MAGE_WEAPONS, [MG]),
  ...weapons('clr', CLERIC_WEAPONS, [CL]),
  ...weapons('rog', ROGUE_WEAPONS, [RG]),
  ...weapons('gun', GUNSLINGER_WEAPONS, [GS]),
  ...expand('gun', 'head', GUNSLINGER_HEAD, [GS]),
  ...expand('gun', 'body', GUNSLINGER_BODY, [GS]),
  ...expand('gun', 'hands', GUNSLINGER_HANDS, [GS]),
  ...expand('gun', 'feet', GUNSLINGER_FEET, [GS]),
  ...expand('ftr', 'head', FIGHTER_HEAD, [FT]),
  ...expand('ftr', 'body', FIGHTER_BODY, [FT]),
  ...expand('ftr', 'hands', FIGHTER_HANDS, [FT]),
  ...expand('ftr', 'feet', FIGHTER_FEET, [FT]),
  ...expand('mag', 'body', MAGE_BODY, [MG]),
  ...expand('clr', 'head', CLERIC_HEAD, [CL]),
  ...expand('clr', 'body', CLERIC_BODY, [CL]),
  ...expand('clr', 'hands', CLERIC_HANDS, [CL]),
  ...expand('clr', 'feet', CLERIC_FEET, [CL]),
  ...expand('rog', 'head', ROGUE_HEAD, [RG]),
  ...expand('rog', 'body', ROGUE_BODY, [RG]),
  ...expand('rog', 'hands', ROGUE_HANDS, [RG]),
  ...expand('rog', 'feet', ROGUE_FEET, [RG]),
  ...expand('acc', 'ring', RINGS, null),
  ...expand('acc', 'amulet', AMULETS, null),
  ...expand('off', 'offhand', SHIELDS, null),
]

// ── Class loot tables + shops (generated from the pools above) ─────────────────
const pool = (cls: string, slot?: ItemSlot) => CLASS_GEAR_ITEMS.filter(i => i.classes?.[0] === cls && (!slot || i.slot === slot))
const sharedSlot = (slot: ItemSlot) => CLASS_GEAR_ITEMS.filter(i => !i.classes && i.slot === slot)
const ARMOR_SLOTS: ItemSlot[] = ['head', 'body', 'hands', 'feet']
const ACC_SAMPLE = [...sharedSlot('ring').slice(0, 4), ...sharedSlot('amulet').slice(0, 4)]

interface ClassMeta {
  cls: string; usesOffhand: boolean; ammo?: string[]
  shop: { id: string; name: string; icon: string; description: string }
  loot: { id: string; name: string; icon: string }
}
const META: ClassMeta[] = [
  { cls: GS, usesOffhand: false, ammo: ['item.pistol_ammo', 'item.rifle_ammo', 'item.arrows'],
    shop: { id: 'shop.gunsmith', name: 'Gunsmith', icon: '🔫', description: 'Irons, ammunition, and a gunslinger’s trail gear.' },
    loot: { id: 'loot.gunslinger_cache', name: 'Gunslinger’s Cache', icon: '🔫' } },
  { cls: FT, usesOffhand: true,
    shop: { id: 'shop.blacksmith', name: 'Blacksmith', icon: '⚔️', description: 'Blades, plate, and shields for the front line.' },
    loot: { id: 'loot.warrior_trove', name: 'Warrior’s Trove', icon: '⚔️' } },
  { cls: MG, usesOffhand: false,
    shop: { id: 'shop.arcanum', name: 'The Arcanum', icon: '🔮', description: 'Staves, rods, and robes for the learned.' },
    loot: { id: 'loot.mage_reliquary', name: 'Sorcerer’s Reliquary', icon: '🔮' } },
  { cls: CL, usesOffhand: true,
    shop: { id: 'shop.reliquary', name: 'Temple Reliquary', icon: '✝️', description: 'Blessed arms and vestments of the faithful.' },
    loot: { id: 'loot.sacred_cache', name: 'Sacred Cache', icon: '✝️' } },
  { cls: RG, usesOffhand: true,
    shop: { id: 'shop.fence', name: 'The Fence', icon: '🗡️', description: '“Acquired” blades, bows, and shadow-leathers. No questions asked.' },
    loot: { id: 'loot.thiefs_stash', name: 'Thief’s Stash', icon: '🗡️' } },
]

export const CLASS_SHOPS: ShopDef[] = META.map(m => {
  const stock: ShopDef['stock'] = []
  for (const w of pool(m.cls, 'weapon')) stock.push({ item: w.id, price: w.value })
  for (const s of ARMOR_SLOTS) for (const a of pool(m.cls, s).slice(0, 3)) stock.push({ item: a.id, price: a.value })
  for (const acc of ACC_SAMPLE) stock.push({ item: acc.id, price: acc.value })
  if (m.usesOffhand) for (const sh of sharedSlot('offhand').slice(0, 4)) stock.push({ item: sh.id, price: sh.value })
  for (const ammo of m.ammo ?? []) stock.push({ item: ammo, qty: 99 })
  return { id: m.shop.id, name: m.shop.name, icon: m.shop.icon, color: '#b2bec3', description: m.shop.description, buys: true, sellModifier: 0.4, stock }
})

export const CLASS_LOOT_TABLES: LootTableDef[] = META.map(m => {
  const sample = [...pool(m.cls, 'weapon').slice(0, 3), ...ARMOR_SLOTS.flatMap(s => pool(m.cls, s).slice(0, 2))]
  return {
    id: m.loot.id, name: m.loot.name, icon: m.loot.icon, color: '#b8860b',
    gold: { min: 20, max: 120 },
    drops: sample.map(i => ({ item: i.id, qty: 1, chance: 0.12 })),
  }
})
