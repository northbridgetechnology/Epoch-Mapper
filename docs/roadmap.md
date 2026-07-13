# Engine roadmap — deferred feature specs

Specs for features discussed and approved in direction but **not yet
implemented**. Each is written to be buildable without re-deriving design
decisions. Shipped features are documented in the code and in `docs/sprites.md`.

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

> **Follow-up to Batch G — FFT roster & bench.** Recruitment is flat (capped at
> `partySize`). A full roster with an active-party selection + swap/formation UI
> at camp/inn/save (SaveState.roster), plus battle-negotiation recruitment
> (§2), is the deferred next step.

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

## 1. Press-turn combat (SMT weakness economy)

The signature SMT mechanic: exploiting weaknesses buys actions, wasting
attacks loses them.

- Each side starts its round with `N` turn icons (N = living combatants on
  that side).
- An action normally consumes one full icon.
- Hitting a **weakness** (negative resistance) or landing a **crit** consumes
  only half an icon (a full icon flips to a "blinking" half; a blinking icon
  is consumed).
- Hitting an **immunity** (resistance ≥ 1) consumes **two** icons; a miss
  consumes two as well.
- Data model: `CombatState.turnIcons: { side: 'party' | 'enemy'; full: number; half: number }`;
  `advanceTurn()` decides consumption from the action's resolved outcome
  (already surfaced via `CombatEvent.kind: 'weak' | 'resist' | 'miss' | 'crit'`).
- UI: icon strip above the battle log (full = solid gem, blinking = pulsing
  gem — reuse the SMT-style cues already rendered for weakness hits).
- Tuning: `combatTuning.pressTurn: boolean` gates the whole system so classic
  one-action-per-actor remains the default.
- Enemy AI: enemies with a known player weakness (already expressed in
  abilities) naturally benefit; no AI change needed for v1.

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
- Roster: `SaveState.reserve: Character[]` — swap at save points / camp.
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

## 4. Exploration status pressure

Statuses that tick while walking, not just in combat.

- `StatusEffectDef.tickOutOfCombat?: boolean` — when true, `tickEffects`
  apply every N steps (default 4; tunable `stepTickInterval`).
- Poison walk: lose HP per interval. Exploration damage is now lethal and
  triggers the game-over flow (see `applyExploreHarm`), so a step tick that
  drops the last member wipes the party — decide whether poison should floor
  at 1 HP out of combat or be allowed to kill.
- Duration: exploration ticks also decrement `remaining` so a Blind that
  would last 3 combat turns wears off after ~12 steps.
- Implementation point: the movement pipeline in `DungeonMapper.handleMove`
  (same hook as torch burn-down / trick tiles).

## 5. Audio hooks

The engine emits sound *references*; the consuming app decides how to play
them (no audio assets in this package).

- `GameMeta.music?: { title?: string; battle?: string; gameOver?: string }`
- `MapData.music?: string` (per-floor track ref)
- New effect: `{ t: 'playSound'; sound: string }` for events/objects.
- Engine-side: a lightweight event bus — `onEngineSound(cb)` — fired for
  built-in moments (door open, lever, chest, stairs, hit, crit, spell, level
  up). Refs are plain strings; Epoch maps them to actual files.
- Editor: text fields on map settings and game meta; no asset management.

## 6. Step & time counters

World clocks driven by movement.

- `SaveState.steps: number` — incremented per successful move (the torch
  burn-down already counts steps per item; this is the global counter).
- Auto-flags: `steps.total`, `steps.sinceRest` exposed to the condition
  system so events can gate on them (`{ c: 'flag', flag: 'steps.total', … }`
  extended with a numeric `gte` comparator).
- Day/night: `meta.dayLengthSteps?: number` — when set, a `time.night`
  flag flips every half-cycle; the renderer tints ambient light at night
  (dark-map machinery already provides the fog ramp).
- Timed doors/events: authors combine `steps.*` conditions with onFlag
  events — no new event machinery needed.

---

## Implementation notes that cut across specs

- All new fields are optional — `normalizeRuleset` backfills, `.epochmap`
  v2 JSON ext block carries them without codec changes.
- Combat changes must stay inside the pure engine (`combat-engine.ts`) with
  seeded-RNG determinism preserved (the balance simulator depends on it).
- Anti-magic zones currently block party casting only; when enemy ability
  gating is revisited (press-turn work), extend `antiMagic` to enemy
  spell-like abilities (flag on `EnemyAbility`).

## Known gaps & deferred work (scan of 2026-07-13)

The three HIGH items from this scan are fixed (save-point policy detection,
item/status stat-modifier editors, two-handed hand blocking). The rest is
parked here, roughly by value:

### Medium — half-wired features & system gaps
- **Wand/staff charges never deplete.** The item editor promises
  "Charges (wands/staves)" but `ItemInstance.charges` is only consumed by
  torch burn-down (`burnSteps`). Design: cast-from-item consumes a charge;
  at 0 the item breaks or goes inert.
- **XP curve is hardcoded** (`xpToNextLevel = 50 × level^1.5`). Move it into
  `FormulaOverrides` so authors can pace progression — and audit
  `FormulaOverrides` generally: combat-engine doesn't read it either.
- **Press-turn polish:** the HUD turn-order strip previews classic
  round-robin during side phases; enemy AI neither exploits weaknesses nor
  spends its icon economy deliberately; blink-icon animation.
- **Skills system.** The Tab menu reserved room for Skills; martial classes
  have no active abilities. A class-gated Skills table (stamina/cooldown)
  would give Fighters/Rogues submenus and press-turn weakness tools.
- **Enemy stat parity:** `EnemyDef.attributes` is a dead field — combat uses
  flat attack/defense/speed. Wire it (enemy school scaling, stat-driven
  bosses) or remove it.

### Low — cleanup, polish, nice-to-haves
- Dead fields with zero consumers: `GameMeta.startingPartyId`, `GameMeta.rows`,
  `RaceDef.traits` (could become racial perks), `SpellDef.level` (redundant
  with the `learn` table). Wire or delete.
- Audio niceties: victory fanfare / boss-intro stingers, music ducking during
  dialogue, a separate SFX bus with its own volume.
- Spell-school depth: opposed schools, school-boost equipment
  (+Elemental power gear), per-school MP discounts — the SpellSchoolDef table
  already supports these without model changes.
- QoL: a one-time "ruleset migrated" toast when `normalizeRuleset` heals a
  legacy draft; a level-up summary popup (stat gains + spells learned) instead
  of a name toast; Journal shows steps walked / playtime.
