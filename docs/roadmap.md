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

Everything below is deferred beyond those batches.

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
- Poison walk: lose HP per interval, floor at 1 HP out of combat (no
  exploration deaths until the wipe flow ships; revisit after Batch B).
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
