# Engine roadmap — deferred feature specs

Specs for features discussed and approved in direction. Deferred entries are
written to be buildable without re-deriving design decisions; sections marked
*(shipped)* record how the shipped shape differs from the original spec.
Shipped features are otherwise documented in the code, the README's Game
engine section, and `docs/sprites.md`.

Current in-flight plan (implemented batch by batch):

- **Batch A** — light & darkness, trick tiles, wall inscriptions *(shipped)*
- **Batch B** — camp/rest + safe rooms, save points + slots, wipe/game-over flow, functional inns *(shipped)*
- **Batch C** — visible fixed encounters, FOE-style patrols (pure patrol loops) *(shipped)*
- **Batch D** — unidentified & cursed items, spell learning *(shipped)*
- **Batch E** — title / ending flow *(shipped)*
- **Batch F** — story & protagonist: opening story slides, Main Character
  (name/pronoun tokens, MC-death-ends-game, undismissable), player Character
  Builder (point-buy + portraits) *(shipped)*
- **Batch G** — NPCs ↔ party: `npcToCharacter` + dialogue-driven `recruit`
  effect + `NpcDef.startsInParty`; the Party workspace promoted to a
  **Characters** NPC Creator (place-in-cell, add-to-party), NPCs removed from
  the Database *(shipped)*

Everything below is deferred beyond those batches.

> **Follow-up to Batch G — FFT roster & bench** *(shipped)*: `SaveState.reserve`
> holds benched members and the Tab menu's Party screen benches/fields them with
> front/back row control (the hero can never be benched; the field is never
> emptied). Still deferred: battle-negotiation recruitment (§2).

---

## Batch F — Story & Protagonist *(shipped)*

Give a game a hand-authored opening and a player-built protagonist. Three
connected pieces; recruitment of authored NPCs into the party is a **separate
follow-up** (see §2 above) — this batch starts the player solo and lets the
party run under `partySize` until companions join later.

### F0. Data model

```ts
// Character (runtime, lives in SaveState.party)
isMc?: boolean                     // the one player-built protagonist
pronoun?: 'he' | 'she' | 'they'    // drives text substitution
bio?: string                       // backstory, shown in the Journal
// portrait?: string  — already present (data-URI or built-in portrait id)

// GameMeta (authoring, lives in .epochmap)
opening?: { slides: { text: string; image?: string }[]; skippable?: boolean }
partyCreation?: 'fixed' | 'customMc'   // default 'customMc'
mcDeathEndsGame?: boolean              // SMT/Wizardry protagonist rule
attrMethod?: 'fixed' | 'pointBuy'      // default 'pointBuy'
pointBuyPool?: number                  // points to spend (default 10)
```

All optional; `normalizeRuleset` backfills. `.epochmap` v2 JSON ext block
carries the meta additions; the player's MC only ever rides in save slots.

### F1. Text tokens (`text-tokens.ts`, pure)

`resolveText(str, mc?)` substitutes, case-insensitively:
`{mc}` / `{name}` → MC name; `{they}/{them}/{their}/{theirs}/{themself}`
and capitalized forms → pronoun set (he/him/his…, she/her…, they/them…).
Threaded through every authored-text surface: dialogue lines, inscriptions,
quest/journal text, opening slides, ending text. Missing MC → tokens pass
through unchanged.

### F2. Opening story

Multi-slide, skippable, optional per-slide splash image (data-URI, reuses the
sprite-upload pipeline). New-game phase machine in `DungeonMapper`:
`title → opening → build → play`. Slides advance on click/Enter, Esc skips;
loading a save skips straight to play. Authored via a slide list in
`SettingsWorkspace`. Reuses the ending overlay's styling.

### F3. Main Character behaviors

- **MC-death-ends-game** (`meta.mcDeathEndsGame`): when the MC's `alive`
  flips false — in combat defeat resolution and in exploration harm — trigger
  the existing game-over flow immediately, even if other members live.
- **Undismissable**: `PartyWorkspace` blocks removing the `isMc` member.
- **Identity**: portrait + name on the title/HUD/ending; bio in the Journal.

### F4. Character Builder (player-facing, `CharacterBuilder.tsx`)

Shown after the opening when `partyCreation === 'customMc'`, before spawn;
also reachable from `PartyWorkspace` for authoring/testing. Fields: name,
portrait (built-in pixel faces + upload), pronoun, class, race, **point-buy**
attributes, optional bio. Live derived-stat preview via `deriveMaxHp` /
`deriveMaxMp`.

Point-buy model (**flat pool, 1:1**): every attribute starts at its `default`;
the player spends `meta.pointBuyPool` points at 1 point = +1, clamped to each
attribute's `min`/`max`; class/race modifiers apply **after** allocation
(so the displayed pool is pure player choice). Pure helpers in
`char-build.ts` with tests; produces a `Character` (extends `newCharacter`).

### F5. Portraits (`portraits.tsx`)

~8–10 hand-drawn archetype faces in the existing pixel-sprite grid style,
keyed loosely to class/race (fighter, mage, cleric, rogue, ranger, …), with a
resolver `portraitSprite(id)` mirroring `creatureSprite`. Player may instead
upload a portrait (data-URI). Built-in ids travel in save state; uploads embed.

---

## 1. Press-turn combat (SMT weakness economy) *(shipped)*

Shipped in a fuller shape than this spec: `CombatMode = 'classic' | 'oneMore'
| 'pressTurn'` is a **global Game Rule** (`GameMeta.combatMode`; the legacy
per-map value is honored only when the global one is unset). 1-More grants a
Persona-style bonus action on weakness/crit; full press-turn runs the icon
economy (weakness/crit spends half an icon, a miss burns two), knockdown,
**All-Out Attack** when every foe is downed, and free member select. Enemy AI
overweights weakness-hitting abilities ×3 and hunts physically-weak members
in press modes. Still open (tracked below): the blink-conversion animation
flourish.

## 2. Negotiation & recruitment (SMT demon talk)

Talk as a battle command; enemies can join, pay, or turn hostile.

- `EnemyDef.personality?: 'timid' | 'proud' | 'sly' | 'feral'` and
  `EnemyDef.recruitable?: boolean`.
- New battle command **Talk** (replaces Defend position when the target is
  recruitable): opens a short exchange driven by personality —
  - timid: intimidate (STR check) or soothe (level check)
  - proud: flatter or challenge
  - sly: bribe (gold/item demand — may take payment and flee)
  - feral: only food items work
- Outcomes: join / give gold or item / flee / enrage (free attack).
- Joined enemies become party-owned `Character`s built from the EnemyDef
  stat block (the NpcDef→Character mirroring groundwork already exists);
  party size caps still apply — overflow goes to a roster (see below).
- Roster: `SaveState.reserve` already exists and the Tab menu swaps
  bench/field freely — joined overflow just lands in the reserve.
- Checks resolve through the seeded combat RNG so battles stay replayable.

## 3. Surprise & ambush rounds

- On encounter start roll `surprise` from party vs enemy speed averages
  (tunables: `surpriseChance`, `ambushChance` in `combatTuning`).
- **Party surprise**: enemies skip round 1 (all actors get `defending`-style
  no-op turns); message "The party strikes first!".
- **Ambush**: formation flips for round 1 — back row is treated as front
  (rank swap), enemies act first; message "Ambushed from behind!".
- Implementation point: `initCombat()` already orders actors by initiative;
  inject a `roundModifier` consumed by `resolveEnemyTurn` / turn advance.
- Safe rooms (`trick: safeRoom`) never ambush (already suppress encounters).

## 4. Exploration status pressure *(shipped)*

Shipped as `StatusEffectDef.persistsExploring` + `exploreStepInterval`
(`tickExplorationStatuses` in `src/lib/exploration.ts`, hooked into the
movement pipeline alongside torch burn-down and trick tiles). Poison ticks
every few steps and can knock a member out (feeding the game-over flow);
Regeneration heals while walking; exploration ticks decrement `remaining` so
statuses wear off on the move.

## 5. Audio hooks *(superseded — music shipped, SFX remain)*

Shipped bigger than this spec: a full **music subsystem** instead of bare
refs — an `AudioTrackDef` database (uploads stored in IndexedDB and baked
into the `.epochmap` on export; URLs streamed), gapless looping Web Audio
playback, and a resolution hierarchy (per-encounter custom track → boss →
generic battle → per-map `MapData.musicId` → `GameMeta.defaultMusicId`),
with volume/mute in the in-game Config screen.

Still deferred (the SFX half): a `{ t: 'playSound' }` effect for
events/objects and an engine sound-event bus for built-in moments (door,
lever, chest, hit, crit, level-up) — see the audio-niceties bullet below.

## 6. Step & time counters *(partially shipped)*

Shipped: `SaveState.stepsTaken` — the global step counter, incremented per
successful move, persisted in saves, and shown in the play HUD's Steps
readout.

Still deferred:

- Auto-flags: `steps.total`, `steps.sinceRest` exposed to the condition
  system so events can gate on them (`{ c: 'flag', flag: 'steps.total', … }`
  extended with a numeric `gte` comparator).
- Day/night: `meta.dayLengthSteps?: number` — when set, a `time.night`
  flag flips every half-cycle; the renderer tints ambient light at night
  (dark-map machinery already provides the fog ramp).
- Timed doors/events: authors combine `steps.*` conditions with onFlag
  events — no new event machinery needed.
- Journal display of steps walked / playtime (also in QoL below).

---

## Implementation notes that cut across specs

- All new fields are optional — `normalizeRuleset` backfills, `.epochmap`
  v2 JSON ext block carries them without codec changes.
- Combat changes must stay inside the pure engine (`combat-engine.ts`) with
  seeded-RNG determinism preserved (the balance simulator depends on it).
- Anti-magic zones currently block party casting only; when enemy ability
  gating is revisited (press-turn work), extend `antiMagic` to enemy
  spell-like abilities (flag on `EnemyAbility`).

## Known gaps & deferred work (scan of 2026-07-13; verified against the code 2026-07-14)

The three HIGH items from this scan are fixed (save-point policy detection,
item/status stat-modifier editors, two-handed hand blocking). The rest is
parked here, roughly by value:

### Medium — FIXED (2026-07-13 batch)
- ~~Wand/staff charges~~: combat use of equipped charged items (N⚡ in the
  Item submenu), spends applied to equipment at battle end, inert at 0.
  Still open: using charged items *outside* combat (field zaps).
- ~~XP curve~~: `Ruleset.formulas.xpToNext` (safe mini-evaluator,
  `src/lib/formula.ts`; variable `level`) + a Settings → Progression field.
  Still open: the other FormulaOverrides entries (maxHp/attack/…) remain
  declared-but-unwired.
- ~~Press-turn polish~~: side-aware turn preview; enemy AI overweights
  weakness-hitting abilities ×3 and hunts physically-weak members in press
  modes. Still open: blink-conversion animation flourish.
- ~~Skills system~~: SkillDef table (HP%-cost / MP-cost / round-cooldowns),
  class learn tables, auto-learn on level-up + creation/recruit seeding,
  battle Skill submenu, Database → Skills tab, 5 default martial skills.
  Still open: out-of-combat (field) skills; a Tab-menu Skills screen.
- ~~Enemy stat parity~~: dead `EnemyDef.attributes` removed (roadmap's
  "wire or remove").

### Low — cleanup, polish, nice-to-haves
- Enemy abilities referencing database spells/skills ignore MP/HP costs and
  cooldowns — weights and `when` gates control frequency instead. Wire real
  enemy resource pools only if a design ever needs them.
- Dead fields with zero consumers: `EnemyAbility.mpCost` (the AI never
  checks or spends it — hidden from the bestiary ability editor until wired),
  `GameMeta.startingPartyId`, `GameMeta.rows`,
  `RaceDef.traits` (could become racial perks). Wire or delete.
  (`SpellDef.level` left this list — it's the learn-level fallback for
  spell sorting.)
- Audio niceties: victory fanfare / boss-intro stingers, music ducking during
  dialogue, a separate SFX bus with its own volume.
- Spell-school depth: opposed schools, school-boost equipment
  (+Elemental power gear), per-school MP discounts — the SpellSchoolDef table
  already supports these without model changes.
- QoL: a one-time "ruleset migrated" toast when `normalizeRuleset` heals a
  legacy draft; a level-up summary popup (stat gains + spells learned) instead
  of a name toast; Journal shows steps walked / playtime.
- Exploration messages as an FF-style bottom-of-screen dialogue strip in the
  play view (doors, chests, NPC barks) — the Tab menu already uses modal FF
  alert windows via `notify()`; exploration still uses corner toasts by
  design, but a period-authentic strip would complete the look.
- Database editor QoL: bestiary list sorting/grouping (the shared
  `SortedList` pattern used by spells/statuses/skills/items is a drop-in);
  a Duplicate action on the other database lists (spells, items, skills) —
  the bestiary's helper pattern generalizes trivially; custom multipliers for
  **Make Elite** if the fixed ×1.5/×1.25/×2 preset feels limiting.
- Skills follow-ups (from the FF seeding pass): **Jump-style windup** (charge
  this turn, auto-release a stored ×2 attack next turn, untargetable mid-air);
  **Steal/Mug** (new `steal` effect: chance-based mid-battle roll of the enemy
  loot table, once per enemy); **Cover** (redirect damage from an ally),
  **Provoke** (taunt targeting override), **Drain/Lancet** (damage + self-heal
  effect). The Charge empower-next mechanic (StatusEffectDef.boostScope/
  boostMult) is live and reusable for all of these.
- **Player mode shell**: the Tab menu is now locked to player verbs
  (CharacterSheet `mode="play"` — identity/level/HP/MP/attributes are
  display-only; designers cheat via the Party workspace instead). The rest of
  the wall: a distribution flag that hides the design workspaces entirely so
  an exported `.epochmap` can be handed to players; optional "allow renaming
  in play" Game Rule if a game wants FF-style name changes.
