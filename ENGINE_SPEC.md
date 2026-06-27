# Epoch Engine — Feature Specification

**Version**: 0.1-draft
**Status**: Design / Pre-implementation
**Scope**: Evolve Epoch Mapper from a dungeon-map editor into a lightweight,
data-driven **blobber** (first-person, grid-based, party) dungeon-crawler
**creation toolkit + runtime**. Defines the data model, file-format evolution,
the pure runtime engine, the default ruleset, and the editor UI architecture.

> Companion to `EPOCH_MAPPER_SPEC.md` (the mapper). This document assumes the
> mapper exists: infinite chunked grid, cells (base/overlay/edge type IDs),
> custom markers (IDs 128–255), fog of war, the `.epochmap` codec, the
> first-person crawler viewport (facing + grid collision), and the
> `@northbridgetechnology/epoch-mapper` package consumed by Epoch.

---

## 1. Overview

Epoch Mapper already lets you draw a dungeon and walk it in a retro
first-person view. The engine layer adds the systems needed to turn a drawn map
into a playable crawler: party characters with stats, items, spells, enemies,
encounters, interactive objects, events, and turn-based combat.

The product identity becomes: **a mini "RPG-Maker for blobbers"** — author a
dungeon, define your ruleset, place encounters and objects, build a party, and
playtest it — while remaining, with game features off, exactly the clean map
editor it is today (and exactly what Epoch embeds as a map annotator).

### 1.1 Guiding principles

1. **Three layers, strictly separated** (Section 2). Content definitions, world
   placement, and runtime save state are different kinds of data with different
   lifetimes and must never be conflated.
2. **Pure, testable engine.** All rules (combat, inventory, encounters, effect
   resolution) live in a DOM-free library — the same lineage as the existing
   `crawler.ts`, `epochmap-codec.ts`, and `markers.ts`, all of which are pure
   and unit-tested. React/Canvas are views over engine state.
3. **Data-driven with a default ruleset.** Everything (classes, items, spells,
   enemies) is an authorable definition; a sensible default ruleset ships
   preloaded so a new project is playable immediately.
4. **Additive & opt-in.** `.epochmap` grows to v2 additively; v1 files keep
   loading. With game features off — and in Epoch's embed — none of this chrome
   appears.
5. **Separate engine module.** Runtime logic ships as
   `@northbridgetechnology/epoch-engine` (a sibling/subpath, Section 9) so the
   mapper stays focused and Epoch can opt into just the editor.

### 1.2 Lineage / inspiration

Blobber navigation and combat in the spirit of Wizardry, Bard's Tale, Might &
Magic, Phantasy Star (1), Grimrock, and Grid Cartographer — without copying any
one of them. The default stat/combat model is intentionally **simpler than
Wizardry** (no tiered spell slots; an MP pool; a compact attribute set) and can
be deepened later by editing the ruleset.

---

## 2. Architecture: Three Layers

| Layer | Name | Lifetime | Lives in | Example |
|---|---|---|---|---|
| **L1** | **Ruleset** (content definitions) | Authored, static | `.epochmap` v2 `ruleset` section | "A Goblin has 12 HP", "Fireball costs 6 MP" |
| **L2** | **World placement** | Authored, on the map | `.epochmap` v2 cell/overlay/edge payloads | "A Goblin pack guards (12,−4)", "This chest holds 50g" |
| **L3** | **Runtime save state** | Mutated while playing | `.epochsave` (separate) / Epoch DB | "Party at (3,1) facing E, Borin 8/20 HP, flag `bossDead`" |

The pure **engine** (Section 6) is the only thing that reads all three:
`engine(ruleset, world, saveState, action) → (saveState', events[])`.

### 2.1 Why the split matters

- The same dungeon (L1+L2) can be replayed by many parties (many L3 saves), and
  shared as a single `.epochmap` without leaking a playthrough into it.
- The editor mutates L1/L2; the runtime mutates only L3.
- Epoch can store L3 saves in its DB keyed by ROM/map hash, exactly like it
  already stores `DungeonMap` rows and save states.

### 2.2 Identifier scheme

All definitions are referenced by a **stable string id** (`"enemy.goblin"`,
`"item.bronze_key"`, `"spell.fireball"`) — human-readable, stable across edits,
and namespaced by table. (Numeric marker IDs 128–255 remain for the existing
cell/overlay marker tables; new tables use string ids to avoid the 128-entry
ceiling.) A `DefRef<T>` is just a branded string for type-safety.

---

## 3. Layer 1 — Ruleset (content definitions)

The ruleset is a bag of typed tables. Every table entry shares a common shape.

```typescript
interface Definition {
  id: string            // "enemy.goblin" — stable, namespaced
  name: string          // "Goblin"
  icon?: string         // emoji / short glyph (reuses the marker icon convention)
  color?: string        // '#RRGGBB'
  description?: string
}

interface Ruleset {
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
  formulas?: FormulaOverrides   // optional tweaks to the default derived-stat math
}
```

### 3.1 Game meta

```typescript
interface GameMeta {
  title: string
  author?: string
  version: string
  startMapId: string
  startPosition: { x: number; y: number; facing: 'N' | 'S' | 'E' | 'W' }
  startingPartyId?: string      // a Party template (Section 5.1), optional
  partySize: number             // default 6
  rows: number                  // formation rows, default 2 (front/back)
  permadeath: boolean           // default false
  startingGold: number
}
```

### 3.2 Attributes (configurable)

```typescript
interface AttributeDef extends Definition {
  abbr: string          // "MGT"
  min: number; max: number; default: number
}
```

**Default ruleset attributes** (6): `might`, `agility`, `intellect`, `spirit`,
`endurance`, `luck`. Derived resources (HP/MP) and combat numbers are computed
from these via the default formulas (Section 6.3), which a ruleset may override.

### 3.3 Classes & races

```typescript
interface ClassDef extends Definition {
  hitDie: number                       // HP growth per level
  spellDie: number                     // MP growth per level (0 = non-caster)
  spellSchools: string[]               // which SpellDef.school values it can learn
  allowedEquip: ItemSlot[]             // which equipment slots it may use
  weaponKinds: string[]                // allowed weapon kinds (e.g. ["blade","bow"])
  startingSpells?: DefRef<SpellDef>[]
  attrGrowth: Partial<Record<string, number>>  // per-level attribute gains
  attrModifiers: Partial<Record<string, number>> // flat class modifiers
}

interface RaceDef extends Definition {
  attrModifiers: Partial<Record<string, number>>
  resistances?: Partial<Record<DamageType, number>>  // 0..1
  traits?: string[]
}
```

**Default classes**: Fighter, Mage, Cleric, Rogue. **Default races**: Human,
Elf, Dwarf, Halfling. (All editable/removable.)

### 3.4 Items

```typescript
type ItemSlot = 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'feet' | 'ring' | 'amulet'
type ItemKind = 'weapon' | 'armor' | 'consumable' | 'key' | 'quest' | 'misc'

interface ItemDef extends Definition {
  kind: ItemKind
  slot?: ItemSlot                      // for equippable items
  weaponKind?: string                  // "blade", "bow", ...
  modifiers?: StatModifier[]           // applied while equipped
  onUse?: Effect[]                     // consumables / usable equipment (Section 3.8)
  value: number                        // shop price (gold)
  stackable: boolean
  twoHanded?: boolean
  charges?: number                     // for wands etc. (undefined = unlimited)
}

interface StatModifier {
  target: 'attribute' | 'derived'      // e.g. attribute "might" or derived "defense"
  key: string
  op: 'add' | 'mul'
  amount: number
}
```

### 3.5 Spells

```typescript
type SpellTarget =
  | 'self' | 'ally' | 'allAllies'
  | 'enemy' | 'allEnemies' | 'enemyRow'
  | 'none'                              // utility (light, teleport)

interface SpellDef extends Definition {
  school: string                       // "arcane", "divine", ...
  level: number                        // min caster level to learn
  mpCost: number
  target: SpellTarget
  inCombat: boolean                    // usable in combat
  outOfCombat: boolean                 // usable while exploring
  effects: Effect[]                    // Section 3.8
}
```

The default ruleset uses an **MP pool** rather than Wizardry-style per-level
spell slots. (A slot system can be layered later via `FormulaOverrides` + a
resource def; out of scope for v0.)

### 3.6 Status effects

```typescript
interface StatusEffectDef extends Definition {
  kind: 'buff' | 'debuff' | 'dot' | 'hot' | 'control'  // control = stun/sleep/etc.
  durationTurns: number                 // 0 = until cured/combat end
  modifiers?: StatModifier[]            // while active
  tickEffects?: Effect[]                // applied each turn (poison, regen)
  blocksAction?: boolean                // sleep/stun
}
```

### 3.7 Enemies (bestiary)

```typescript
interface EnemyDef extends Definition {
  hp: number
  attributes: Partial<Record<string, number>>
  attack: number; defense: number
  speed: number                         // initiative
  resistances?: Partial<Record<DamageType, number>>
  abilities?: EnemyAbility[]            // weighted action list
  xp: number
  gold: { min: number; max: number }
  loot?: DefRef<LootTableDef>
  sprite?: string                       // asset id / emoji fallback
  size?: 1 | 2                          // back/front-row footprint (default 1)
}

interface EnemyAbility {
  weight: number                        // selection weight
  effects: Effect[]
  target: SpellTarget
  mpCost?: number
}
```

### 3.8 Effects (the shared verb vocabulary)

A single structured **effect** model is reused by items (`onUse`), spells,
enemy abilities, traps, and cell events. This is the spine of the whole system —
build the editor for it once (Section 8.8).

```typescript
type DamageType = 'physical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'holy' | 'dark'

type Effect =
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
  | { t: 'teleport'; mapId: string; x: number; y: number; facing?: 'N'|'S'|'E'|'W' }
  | { t: 'startCombat'; encounter: DefRef<EncounterTableDef> }
  | { t: 'message'; text: string }
  | { t: 'openShop'; shop: DefRef<ShopDef> }
  | { t: 'dialogue'; node: DialogueRef }
  | { t: 'reveal'; radius: number }     // magic mapping / light
  | { t: 'damageType' }                 // (reserved)

// "Dice" supports flat numbers and dice notation: 8, "2d6", "1d8+2"
type Dice = number | string
```

`Effect`s are evaluated by the engine against a context (caster, targets, party,
world, flags, RNG). Conditions (e.g. "only if flag X") are expressed as a
guarded effect list on the **event/trigger** that invokes them (Section 4.4),
keeping `Effect` itself a pure verb.

### 3.9 Encounter & loot tables, shops, dialogue

```typescript
interface EncounterTableDef extends Definition {
  entries: { enemy: DefRef<EnemyDef>; min: number; max: number; weight: number }[]
  // resolves to a concrete enemy group when combat starts
}

interface LootTableDef extends Definition {
  gold?: { min: number; max: number }
  drops: { item: DefRef<ItemDef>; qty?: Dice; chance: number }[]
}

interface ShopDef extends Definition {
  buys: boolean
  sellModifier: number                  // price multiplier when selling to player
  stock: { item: DefRef<ItemDef>; price?: number; qty?: number }[]
}

// Dialogue is a small node graph (out of scope to fully spec in v0; modeled as
// a table of nodes with text + choices that fire Effect[]).
type DialogueRef = string
```

---

## 4. Layer 2 — World placement

Placement extends the existing cell model. The mapper already stores per-cell
`base` / `overlays` / `edges` / `note`; v2 adds an optional **entities** payload.

```typescript
interface CellData {              // extends the existing mapper CellData
  base: number
  overlays: number[]
  edges: Partial<Record<EdgeDir, number>>
  note?: string
  entities?: CellEntity[]         // NEW (Layer 2)
}

type CellEntity =
  | { t: 'encounter'; table: DefRef<EncounterTableDef>; mode: 'fixed' | 'zone'; rate?: number; oncePerVisit?: boolean }
  | { t: 'object'; object: ObjectInstance }
  | { t: 'event'; event: CellEvent }
  | { t: 'partyStart' }
  | { t: 'mapLink'; mapId: string; x: number; y: number; facing?: EdgeDir }  // stairs/teleport target
```

### 4.1 Encounters

- **Fixed**: a specific group at a cell (a boss). Fires on enter; `oncePerVisit`
  guards repeats via a flag.
- **Zone**: a `rate` (per-step chance) sampled while the party walks cells tagged
  with the same zone — classic random encounters scoped to a region/floor.

### 4.2 Objects

```typescript
interface ObjectInstance {
  kind: 'chest' | 'door' | 'lever' | 'sign' | 'npc' | 'shop' | 'trap' | 'teleporter'
  id: string                       // unique within the map (for flag keys)
  locked?: { key: DefRef<ItemDef> } // requires an item to open/pass
  loot?: DefRef<LootTableDef> | { gold?: number; items?: DefRef<ItemDef>[] }
  shop?: DefRef<ShopDef>
  dialogue?: DialogueRef
  trapEffects?: Effect[]
  onInteract?: Effect[]
  consumed?: boolean               // chests/one-shot levers set their own flag
}
```

Many of these already exist visually as overlays (chest, NPC, save point,
warp). v2 binds the **data** to those overlays via `entities`; the overlay icon
is still drawn by the existing renderer.

### 4.3 Edges as gates

Wall/locked-door edges already block movement (`crawler.ts#canPass`). v2 lets a
`locked_door` edge carry `{ key }` and an `onUnlock: Effect[]`, so a door can
require an item and fire effects (set flag, message) when opened.

### 4.4 Events & triggers (RPG-Maker-lite)

```typescript
interface CellEvent {
  id: string
  trigger: 'onEnter' | 'onInteract' | 'onFlag'
  conditions?: Condition[]         // ALL must pass
  effects: Effect[]
  once?: boolean                   // self-sets a flag after firing
}

type Condition =
  | { c: 'flag'; flag: string; equals: boolean | number | string }
  | { c: 'hasItem'; item: DefRef<ItemDef>; qty?: number }
  | { c: 'partyLevel'; min: number }
  | { c: 'random'; chance: number }
```

This `(trigger → conditions → effects)` shape covers doors, levers, dialogue,
ambushes, quest gates, and one-shot scripted moments with one small editor.

---

## 5. Layer 3 — Runtime save state

Mutated only by the engine. Never written into `.epochmap`.

```typescript
interface SaveState {
  rulesetVersion: string
  mapHash: string                  // ties a save to its dungeon
  position: { mapId: string; x: number; y: number; facing: 'N'|'S'|'E'|'W' }
  party: Character[]
  formation: { front: number[]; back: number[] }  // indices into party
  gold: number
  sharedInventory: ItemInstance[]
  flags: Record<string, boolean | number | string>  // events, opened chests, kills
  revealed: Record<string, string[]>                 // per-map revealed chunk keys
  rngSeed: number
  playtimeMs: number
}
```

### 5.1 Characters & party

```typescript
interface Character {
  name: string
  classId: DefRef<ClassDef>
  raceId: DefRef<RaceDef>
  level: number; xp: number
  attributes: Record<string, number>     // base rolled values
  hp: number; maxHp: number              // maxHp derived; hp is current
  mp: number; maxMp: number
  equipment: Partial<Record<ItemSlot, ItemInstance>>
  knownSpells: DefRef<SpellDef>[]
  statuses: ActiveStatus[]
  alive: boolean
  portrait?: string
}

interface ItemInstance { def: DefRef<ItemDef>; qty: number; charges?: number }
interface ActiveStatus { def: DefRef<StatusEffectDef>; remaining: number }

// A Party template (for GameMeta.startingPartyId) is just Character[] + formation,
// authored in the Party workspace and cloned into a fresh SaveState on "new game".
```

Blobber model: the whole party shares `position`; **formation** rows decide who
can be hit / melee (front) vs. who is protected / ranged-magic (back).

---

## 6. The runtime engine (pure)

`@northbridgetechnology/epoch-engine` — DOM-free, deterministic given a seed.

```typescript
function newGame(ruleset: Ruleset, world: World, opts?: NewGameOptions): SaveState
function step(ctx: EngineContext, action: Action): StepResult

interface EngineContext { ruleset: Ruleset; world: World; state: SaveState }
interface StepResult { state: SaveState; events: GameEvent[] }

type Action =
  | { a: 'move'; dir: 'forward' | 'back' | 'strafeL' | 'strafeR' }
  | { a: 'turn'; dir: 'left' | 'right' }
  | { a: 'interact' }                    // the cell ahead / current
  | { a: 'useItem'; member: number; item: DefRef<ItemDef>; target?: number }
  | { a: 'castSpell'; member: number; spell: DefRef<SpellDef>; target?: Target }
  | { a: 'combat'; command: CombatCommand }
  | { a: 'rest' }

type GameEvent =
  | { e: 'moved' } | { e: 'blocked'; reason: 'wall' | 'nofloor' }
  | { e: 'encounter'; enemies: EnemyInstance[] }
  | { e: 'message'; text: string }
  | { e: 'combatStart' | 'combatEnd'; result?: 'win' | 'flee' | 'wipe' }
  | { e: 'loot'; gold: number; items: DefRef<ItemDef>[] }
  | { e: 'levelUp'; member: number }
  | { e: 'died'; member: number }
  | { e: 'flagSet'; flag: string }
```

Movement/turn/collision reuse the existing `crawler.ts` (`canPass`,
`DIR_VECTOR`, facing math). The engine wraps it so a step also resolves
encounters, traps, and `onEnter` events.

### 6.1 Combat (turn-based blobber)

- **Initiative** ordered by `speed` (enemies) / agility-derived (characters),
  re-rolled each round with a small random jitter.
- **Rows**: front row can melee and is the default melee target; back row takes
  reduced melee but full ranged/magic. Reach weapons (`weaponKind`) and AoE
  ignore row protection.
- **Commands** per living member each round: `Attack`, `Cast`, `UseItem`,
  `Defend`, `Flee`. Enemies pick weighted `abilities`.
- **Resolution** runs each actor's `Effect[]` against targets; damage uses the
  default formula (Section 6.3) with resistances and crit.
- **End**: win → XP + gold + loot (+ level-ups); wipe → game over (or revert to
  last save / town, per `permadeath`); flee → chance based on agility.

```typescript
type CombatCommand =
  | { member: number; cmd: 'attack'; target: number }
  | { member: number; cmd: 'cast'; spell: DefRef<SpellDef>; target?: Target }
  | { member: number; cmd: 'item'; item: DefRef<ItemDef>; target?: number }
  | { member: number; cmd: 'defend' }
  | { cmd: 'flee' }
```

### 6.2 Determinism

A single seeded PRNG drives all rolls (`Dice`, encounter, crit, flee). `step`
threads the seed through `SaveState.rngSeed`, so playthroughs are reproducible
and combat can be replayed/tested — and unit-tested with fixed seeds.

### 6.3 Default formulas (overridable)

A compact default model (deliberately simpler than Wizardry):

```
maxHp  = class.hitDie * level + endurance * 2
maxMp  = class.spellDie * level + max(intellect, spirit)
attack = might + weapon.attack + level
defense= agility/2 + armor.defense
initiative = agility + 1d6
meleeDamage = max(1, attack - target.defense) rolled over weapon dice
hitChance  = clamp(0.7 + (attackerAgi - defenderAgi)*0.03, 0.05, 0.95)
critChance = luck * 0.01
xpToNext   = round(50 * level^1.5)
```

`Ruleset.formulas` may override any of these (string expressions evaluated by a
tiny safe expression evaluator — no `eval`).

---

## 7. File formats & persistence

### 7.1 `.epochmap` v2

Bump the format `version` byte to **2**, additively:

- **Header** unchanged (magic `EPKM`, version, gameTitle, romHash).
- **Compressed body** gains, after the existing maps section:
  - a **ruleset** block (Section 3), serialized as gzipped JSON for flexibility
    (the binary cell tables stay binary; the ruleset is JSON-in-gzip — it is
    edited rarely and benefits from schema flexibility over byte-packing);
  - per-cell **entities** payloads (Section 4), appended to each cell record
    guarded by a "has entities" bit so v1-shaped cells cost nothing.
- **v1 compatibility**: a v1 file has no ruleset/entities; the parser yields an
  empty ruleset and no entities. A v2 reader reads both; a v1 reader rejects v2
  by version (already specified behavior).

> Rationale: the cell grid stays compact binary (it's large and hot); the
> ruleset/placement metadata is comparatively small and irregular, so JSON keeps
> the editor and codec simple. Both live inside the same gzip stream.

### 7.2 `.epochsave` (runtime)

A standalone gzipped-JSON `SaveState` (Section 5) + a header carrying the
`mapHash` it belongs to. Standalone app stores it as a download and in
`localStorage.epochengine.save.<mapHash>`; multiple saves allowed.

### 7.3 Epoch integration

Epoch stores `SaveState` rows keyed by `(userId, mapHash)` alongside its existing
`DungeonMap` / save-state tables — the same pattern already used for emulator
save states. The mapper embed gains an optional "Play" affordance; gated off by
default so the drawer stays a map annotator.

---

## 8. Editor UI architecture

The whole new surface rides on **two patterns**: workspaces (split by concern)
and a single context **Inspector** (edit whatever is selected). No modal soup.

```
┌──┬───────────────┬──────────────────────────────┬───────────────┐
│A │  CONTEXT LIST  │         MAIN CANVAS          │   INSPECTOR   │
│C │ (maps / db     │  (2D grid · db entry · party │ (props of the │
│T │  entries /     │   sheet · or play view)      │  selection;   │
│I │  party)        │                              │  tabbed with  │
│V │                │                              │  First-person)│
│BAR│               │                              │               │
└──┴───────────────┴──────────────────────────────┴───────────────┘
```

### 8.1 Activity bar / workspaces

A left icon rail switches workspaces: **Map · Database · Party · Play · Settings**.
`Map` is exactly today's editor; the rest are new spaces, so the mapper never
gets cluttered.

### 8.2 Map workspace (Layer 2 placement)

Today's editor plus a **"Game" tool group** in the left palette: `Encounter`,
`Chest`, `Door/Lock`, `Lever`, `NPC`, `Sign`, `Teleporter`, `Trigger`,
`Party Start`. Placing/selecting one opens it in the **Inspector** for instance
config (which table/def + payload). A new **Select** tool opens the **Cell
Inspector** showing everything on a cell (base/overlays/edges/note/entities) in
one place — the "full cell editor" the mapper spec always intended; the Note
dialog graduates into it.

### 8.3 Database workspace (Layer 1)

The RPG-Maker pattern, which is the Marker Palette scaled up: a category rail
(Attributes · Classes · Races · Items · Spells · Status · Enemies · Encounter
Tables · Loot Tables · Shops) → an entry list → a generated editor form.
Cross-references (enemy abilities → spells, loot → items) are pickers into other
tables. Existing custom markers fold in as the cell/overlay-type tables.

### 8.4 Party workspace (Layer 3 authoring)

Roster of up to `partySize` character cards → click one → **character sheet** in
the Inspector (name, class, race, rolled attributes, portrait, starting gear &
spells). A **formation** widget assigns front/back rows. This authors the
starting/test party template.

### 8.5 Play / Test workspace (runtime)

The first-person panel becomes the **game view**, with a party HUD (portraits +
HP/MP bars), inventory/spell screens, and a combat screen — all views over
engine `SaveState`. "Test your dungeon" is one click; supports save/load.

### 8.6 The Inspector pattern

One persistent right-docked panel renders the properties of the current
selection — cell, placed entity, database entry, or party member — adapting by
selection type. This is what replaces a modal-per-thing. It shares the dock with
the First-person view via tabs.

### 8.7 Schema-driven forms

Every definition is a `{ schema, value }`; one **form generator** renders inputs
from field types: `text · number · color · icon · enum · ref<table> · list ·
dice · effects · modifiers`. Each Database table is `(schema + list)`; adding a
new definition type is a schema, not a new screen. Retro-fits the Marker Palette.

### 8.8 Effect & event builder

The hardest widget, built once and reused across Items/Spells/Enemy abilities/
Traps/Triggers: an **Effect list editor** (add → pick verb → fill params, with
`Dice` and `ref` fields), and an **Event editor** wrapping it with
`trigger + conditions`. No scripting language in v0 — a structured list keeps it
authorable and safe.

### 8.9 Gating & Epoch embed

All engine chrome sits behind a **"Game features"** switch (auto-enabled the
moment a project gains a ruleset entry beyond the defaults, or toggled in
Settings). Off — and in Epoch's embedded annotator — only the Map workspace
shows; the editor is byte-for-byte today's experience.

---

## 9. Package / module layout

```
@northbridgetechnology/epoch-mapper        # editor + map model + .epochmap codec (exists)
  ├── (existing exports)
  └── /server                              # pure codec/types (exists)

@northbridgetechnology/epoch-engine        # NEW — pure runtime + ruleset types
  ├── ruleset types (L1), world types (L2), save types (L3)
  ├── newGame / step / combat / effects / formulas   (pure, tested)
  ├── default ruleset (preloaded content)
  └── no React, no DOM
```

- `epoch-engine` has **no UI and no DOM** — testable in Node, reusable by Epoch
  server-side (e.g. validating a save) just like `@epoch/mapper/server`.
- The editor UI (workspaces, Inspector, Play view) lives in **epoch-mapper**,
  which adds `epoch-engine` as a dependency. Epoch keeps depending on
  `epoch-mapper`; the engine comes along but its chrome stays gated.
- Both publish to GitHub Packages via the existing `publish.yml` pattern.

---

## 10. Implementation phases

Each phase is independently shippable and testable.

### Phase E1 — Foundations
Attribute schema + `Character`/`Party` model + `SaveState` (L3) + `.epochsave` +
the Party workspace + the activity-bar shell + the Inspector dock + the
schema-driven form generator. Default ruleset (classes/races/attributes) loads.
*Outcome*: build a party; HP/MP exist; nothing to fight yet.

### Phase E2 — Items & inventory
`ItemDef` table + the Database workspace (items first) + inventory/equip on the
character sheet + chest placement & loot. Effect builder v1 (heal/restore/give).
*Outcome*: loot chests, equip gear, use potions out of combat.

### Phase E3 — Bestiary & encounters
`EnemyDef` + `EncounterTable`/`LootTable` tables + fixed & zone encounter
placement + the encounter roll on `step`. *Outcome*: walking triggers fights
(stubbed resolution).

### Phase E4 — Combat core
The pure turn-based combat engine (rows, initiative, attack/defend/flee, default
formulas, seeded RNG) + the Play workspace combat screen + XP/level-up/loot.
*Outcome*: a playable fight loop.

### Phase E5 — Spells & status
`SpellDef` + `StatusEffectDef` + MP + casting in/out of combat + the full Effect
vocabulary. *Outcome*: mages and clerics work.

### Phase E6 — Objects, events, flags
Levers, locked doors + keys, teleporters/map links, NPCs/shops/dialogue, the
event/trigger editor, and the flag system. `.epochmap` v2 finalized.
*Outcome*: scripted dungeons, locks, shops, quests.

### Phase E7 — Epoch integration & polish
`SaveState` persistence in Epoch's DB, the gated "Play" affordance in the embed,
balancing helpers, and a default starter dungeon. *Outcome*: end-to-end from
Epoch.

---

## 11. Open questions / deferred

1. **Spell system depth** — default is an MP pool. Wizardry-style per-level spell
   slots are deferred to a later ruleset option.
2. **Dialogue graph** — modeled as a referenced node table; the authoring UI and
   full node schema are deferred (Phase E6 ships a minimal version: text +
   choices that fire effects).
3. **Real-time vs. turn-based exploration** — exploration stays grid/turn
   stepped (blobber). No real-time movement.
4. **Assets/sprites** — enemy/portrait art: emoji/glyph fallback in v0; an asset
   pipeline (upload, pack into `.epochmap` or sidecar) is deferred.
5. **Multi-party / NPC followers, mounts, vehicles** — out of scope.
6. **Scripting** — intentionally no scripting language; structured effects only.
   Revisit if authors hit a ceiling.
7. **Balancing tools** — encounter difficulty estimation, XP curves: a Phase E7
   nicety, not core.
8. **Format trade-off** — ruleset stored as JSON-in-gzip vs. fully binary;
   chosen JSON for editor simplicity. Revisit only if size becomes a problem.

---

*This spec is the single source of truth for the engine layer. Start with Phase
E1 (foundations + shell) before any combat. Each section maps to concrete
modules in `@northbridgetechnology/epoch-engine` (pure logic) and editor
workspaces in `@northbridgetechnology/epoch-mapper` (UI).*
