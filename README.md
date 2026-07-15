# Epoch Mapper

A free, open-source **first-person dungeon-crawler engine and authoring tool**
in the tradition of Eye of the Beholder, Shin Megami Tensei, and Wizardry —
approachable, free, and tightly integrated with the
[Epoch](https://github.com/northbridgetechnology/epoch) game library.

Draw grid maps, build a full ruleset (classes, spells, items, enemies, NPCs,
quests, events), and **play the result in a pseudo-3D first-person view** — with
turn-based combat, party management, exploration hazards, and a save system.
Export your maps as a print-ready **PDF** or as a compact, self-describing
**`.epochmap`** binary you can share with other players.

This repository is **both**:

1. **A standalone web app** (Next.js) — open the editor in a browser tab, no
   login, no accounts, no server. State is file-based.
2. **The npm package `@northbridgetechnology/epoch-mapper`** — the editor
   component, the game engine, the PDF export pipeline, and the `.epochmap`
   codec, consumed directly by Epoch.

> **Status:** the map editor, the `.epochmap` codec, the custom-marker system,
> and the Epoch integration are complete — and on top of that sits a full
> **game engine**: a first-person renderer, turn-based combat in three battle
> systems (classic / Persona-style 1-More / full SMT press-turn), a 15-table
> content database with richly seeded defaults, character progression, music,
> events/quests/NPCs, and deep exploration systems. See the **Game engine**
> section below, [`docs/roadmap.md`](docs/roadmap.md) for deferred specs, and
> [`docs/sprites.md`](docs/sprites.md) for the sprite system.

---

## Game engine

Beyond the map editor, Epoch Mapper ships a playable first-person engine. Build
content in the **Database** and **Party** workspaces, place it on the grid with
the **Cell Inspector**, then switch to **Play** to walk your dungeon.

### First-person exploration

- **Pseudo-3D painter's renderer** (Eye of the Beholder / SMT style) with
  per-cell water/lava/void, ceiling/floor mortar grids, code-authored pixel
  sprites for objects and creatures (plus creator PNG uploads with two-frame
  animation), and real 3D stairs that descend into a pit or climb through a lit
  ceiling opening.
- **Light & darkness** — dark maps collapse view distance to the party's light
  radius; torches and lanterns shed light (with optional burn-down over steps),
  and light spells help too.
- **Trick tiles** — spinner, pit, silent teleport, anti-magic, darkness, safe
  room. Plus wall switches & switch-sealed doors, wall inscriptions, locked &
  keyed doors/chests, visible fixed encounters, and FOE-style patrols.
- **Step counter & status pressure** — Poison keeps ticking every few steps
  while exploring; Regeneration heals as you walk.
- **Minimap fog by exploration** — cells appear only once actually seen via
  line-of-sight from a walked cell.
- **Camp/rest** with ambush risk, functional inns, save slots + save-point
  policy (save anywhere, or only on save points), and a wipe/game-over flow
  with gold penalty and respawn.

### Turn-based combat

- **Three battle systems**, a global Game Rule: **Classic** (one action per
  actor), **1-More** (Persona — weakness/crit grants an extra action), and
  **full SMT press-turn** (turn icons; weakness/crit spends half an icon, a
  miss burns two, knockdown, **All-Out Attack** when every foe is downed, and
  free member select).
- **FF-style command bar** — Attack / Skill / Spell / Item / Defend / Flee —
  over a 3×3 enemy playfield with front/back ranks on both sides.
- **Skills** — martial actives costing % of max HP, MP, or a round cooldown,
  gated by class learn tables, with a battle Skill submenu.
- **Empower-next mechanics** — Charge!/Focus Aim (next physical ×2) and
  Concentrate (next spell ×2). Boosts never stack and re-applying wastes the
  action — the log says so.
- **Elemental weaknesses & resistances** shape damage; status-effect modifiers
  shape hit math; spell schools scale power off their key attribute.
- **Charged equipment** — wands and staves can be zapped from the Item submenu
  (N⚡), spending charges that persist to the gear after battle.
- **Seeded, deterministic RNG** — same seed + same actions = same battle, which
  powers the built-in **balance simulator** for encounter tuning.
- Battle outcomes apply XP, level-ups, attribute growth, banked level points,
  newly learned spells/skills, loot, and gold in one pure resolution step.

### Enemies & bosses

- **Weighted, named ability kits** — each ability draws its substance from a
  **database spell**, a **database skill**, or custom inline effects, so
  monsters and player classes share one vocabulary (buff Bio once, every
  caster of Bio moves with it). The battle log speaks: "Malboro uses Bad
  Breath!"
- **Boss phases** — abilities can be gated behind HP thresholds ("below 35%
  own HP") or round numbers ("from round 3"); Bombs detonate when cornered,
  Behemoth starts calling Meteor.
- **Targeting AI** — random or hunt-the-weakest; in press modes enemies
  overweight weakness-hitting abilities and hunt physically-weak members.
- **Bestiary editor** — structured ability cards (weight with a live "% of
  turns" readout, enemy-perspective targets, phase gates, the shared effect
  builder) and per-element resistance sliders. **Duplicate** and **Make
  Elite** (×1.5 HP, ×1.25 ATK/DEF, ×2 rewards) turn any mob into a variant in
  one click.
- **Seeded bestiary** — 41 enemies across SMT-mythology and FF5–9 rosters
  (Jack Frost to Cactuar, Tonberry, Malboro, Behemoth, and the superboss
  Omega), each with a named kit, plus field/boss encounter tables.

### Character progression

- **Classes & races** with attribute modifiers, hit/spell dice, and
  proficiencies; a point-buy **Character Builder** for the protagonist.
- **FF-style equip restrictions** — weapon/armor **type tables** drive class
  proficiency, scaling attribute, damage element, range, armor speed penalty,
  and two-handed hand blocking.
- **Hybrid leveling** — classes auto-grow attributes per level *and* bank
  level points the player spends freely in the Tab menu (capped per
  attribute); an XP curve **formula override** (safe mini-evaluator) tunes
  pacing.
- **Spell learning** by school + level, plus single-use **spell tomes**
  (class school gates apply automatically); skills learn by class level.

### Content database

Fifteen tables, all with structured schema-driven editors (no raw JSON):
items, weapon types, armor types, music, classes, loot tables, bestiary,
encounter tables, spells, status effects, spell schools, skills, shops,
events, and quests — with **sortable, collapsible grouped lists** (spells by
school, statuses by kind, skills by class, items by kind/slot) built for
hundreds of entries.

Seeded defaults ship a playable baseline: **123 items** (iron→ebonsteel
material tiers, enchanted element weapons that drop unidentified, cursed
trap jewelry, artifacts, buff potions, thrown flasks, spell tomes, food, and
vendor treasure), **~60 spells** (full elemental lines plus dark and holy
damage schools, ailments, buffs, and the endgame quartet Holy / Flare /
Meteor / Ultima), **32 skills** (class actives plus the Blue-Magic monster
set: 1000 Needles, Bad Breath, Self-Destruct…), and loot tables that feed
the identify/curse economy.

### Music & audio

A **Music database** — upload tracks (stored in IndexedDB, baked into the
`.epochmap` on export) or stream by URL — with gapless looping Web Audio
playback. Tracks resolve by hierarchy: per-encounter custom music → boss
track → generic battle track → per-map track → game default. Volume and mute
live in the in-game Config screen.

### Story systems

- **Cell events** (sequential chains, `onEnter`/`onInteract`/`onFlag`
  reactive) plus a global event library; **quests-as-flags** with a lore
  journal; From-Software-style **NPCs** (the player listens; NPCs speak) with
  dialogue-driven recruitment into the party.
- **Story & protagonist** — a paced **opening story** (slides with optional
  splash art), the player-built **Main Character** (name, portrait, pronoun,
  class/race, point-buy attributes), `{mc}`/pronoun text tokens resolved
  across all authored text, and an optional protagonist-death-ends-game rule.

### In-game menu (Tab)

An authentic FF-style full-screen hub — Item / Magic / Equip / Status /
Party / Journal / Camp / Save / Config — with complete keyboard control.
Notifications inside the menu are **front-and-center FF alert windows** (no
corner toasts). The Status screen is locked to player verbs while playing
(attributes rise only through the point-spend panel; designers keep full
god-mode editing in the workspaces), the hero can never be benched out of
the party, and Config carries music volume/mute and the control reference.

### Hazards

Traps spring their effects when stepped on, damage edges bite every crossing,
and event/boundary `damage`/`status`/`cure` effects resolve out of combat
(respecting race resistances; lethal, so a wipe rolls game-over).

### Generator

"Randomly Generate & Populate" builds a two-level demo world (main floor + a
dark *Depths*) wiring every system, in one of three layout styles: **Rooms**
(BSP), **EotB** (dense thin-wall maze), or **SMT** (arterial lattice). Every
generated door provably leads somewhere.

---

## Quick start

```bash
bun install          # or: npm install
bun run dev          # standalone editor at http://localhost:3100
```

### Scripts

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `dev`               | Run the standalone app (Next.js, port 3100)             |
| `build`             | Production build of the standalone app                  |
| `build:lib`         | Bundle the npm package into `dist/` (JS + `.d.ts`)      |
| `test`              | Full suite (200+ checks): codec, markers, combat, switches, events, generator, sprites, exploration, story, recruit, equipment, music, formula, spell-sort, bestiary |
| `lint`              | ESLint                                                  |

Tests run via `tsx` (no DOM needed) — the codec, combat engine, event/effect
resolver, generator, and sprite library are all pure, so they work in the
browser, Node, and edge runtimes.

---

## Using the package

```ts
// Client entry — the React editor and everything it needs.
import {
  DungeonMapper,            // the full React editor component
  type DungeonMapperProps,
  exportMapsAsPdf,          // jsPDF export pipeline
  parseDotEpochmap,         // ArrayBuffer | Uint8Array -> EpochmapFile
  serializeDotEpochmap,     // EpochmapFile -> Uint8Array (gzipped)
  type EpochmapFile,
} from '@northbridgetechnology/epoch-mapper'

// Server entry — codec, marker helpers, type tables, and types only.
// No "use client" boundary, so it is safe to import in route handlers /
// server components (e.g. an .epochmap import API).
import { parseDotEpochmap, resolveMarkerImport, type EpochmapFile } from '@northbridgetechnology/epoch-mapper/server'
```

`DungeonMapper` is a client component (it uses React hooks). Import it from a
`'use client'` boundary in an RSC tree.

### Embedding (host-owned persistence)

By default the editor is file-based (localStorage draft + `.epochmap` files). A
host app can instead own persistence and seed/save the session:

```tsx
<DungeonMapper
  layout="fixed"                 // locked 12×12 grid for embeds; 'fill' = standalone
  initialSession={session}       // EpochmapFile loaded from your store
  onSessionChange={persist}      // debounced; you write it back (e.g. to a DB)
  welcomeOnFirstVisit={false}
/>
```

When `initialSession`/`onSessionChange` are provided the localStorage draft and
first-visit welcome are skipped. This is exactly how Epoch backs the editor with
its `DungeonMap` table — see `Epoch/src/components/arcade/DungeonMapPanel.tsx`.

---

## Distributing a finished game

A built game is self-contained (ruleset + maps + baked audio + sprites, all in
one `.epochmap`) and the engine is serverless client code, so a game ships as a
**standalone, editor-free player** three ways:

- **Single HTML file** — File → **Export Standalone HTML** (or
  `scripts/bake-game.mjs`) bakes the game into one double-click-to-play `.html`.
  Perfect for itch.io HTML5.
- **Hosted web build** — File → **Export Web Build (.zip)** downloads
  `index.html` + `game.epochmap` to unzip onto any static host or upload to
  itch.io (or `npm run build:player` for the folder).
- **Native desktop app** — a [Tauri](https://tauri.app) scaffold (`src-tauri/`)
  wraps the same build into a small Windows/macOS/Linux binary
  (`npm run desktop:build`).

All three come from one player build (`DungeonMapper distribution`, wrapped by
`<GamePlayer>`). Full walkthrough — including save-persistence and code-signing
caveats — in [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md).

---

## The `.epochmap` format

A compact, gzip-compressed, self-describing binary. The header is **never
gzipped** so the magic bytes, version, game title, and ROM hash can be read
without decompressing.

```
[UNCOMPRESSED HEADER]
  4   magic         "EPKM"
  1   version       1
  2   gameTitleLen  (uint16 LE)
  N   gameTitle     UTF-8
  64  romHash       hex SHA-256 (lowercase ASCII), 0x00-padded if unknown

[GZIP-COMPRESSED BODY]
  custom markers · maps · cells · notes · revealed fog chunks
```

All multi-byte integers are little-endian. Full layout, built-in type ID tables
(base / overlay / edge), and design goals live in the spec, mirrored in
[`src/lib/epochmap-codec.ts`](src/lib/epochmap-codec.ts) and
[`src/lib/constants.ts`](src/lib/constants.ts).

### v1 design notes

The in-memory editor model is richer than the v1 binary in two places, by
design (the format reserves these for a future v2):

- **Overlays:** a cell may hold *multiple* overlays in the editor and in the
  auto-saved JSON draft; the v1 `.epochmap` stores the **first** overlay byte.
- **Edges:** the editor supports a *different* type per side (N/S/E/W); the v1
  `.epochmap` stores a 4-bit "which sides are marked" mask plus a **single**
  edge type for the cell.

Round-tripping a map with mixed overlay/edge types through `.epochmap` collapses
those to the v1 representation. The codec's test suite asserts this behaviour
explicitly (`test/codec.test.ts`).

---

## Custom markers

Open the **Marker Palette** (palette icon in the toolbar) to define your own cell
types and overlay icons. Each marker has a label (≤ 32 chars), a color, and an
icon (single emoji or ASCII character), and is assigned a stable ID in the
128–255 range. Custom markers appear in the sidebar palettes alongside the
built-ins and are embedded in every `.epochmap` export, so anyone who opens the
file sees your types correctly.

- **IDs** are monotonic within a session and never reused (deleting #130 then
  adding a new marker yields #131).
- **Deleting** a marker that's in use warns you and reverts those cells to Empty
  (base) or no-overlay (overlay).
- **Importing** a file resolves ID conflicts per spec §5.3: a free ID keeps its
  value, an identical definition is reused, and a clashing definition is
  reassigned to the next free ID with the affected imported cells remapped. This
  logic is exported (`resolveMarkerImport`, `remapMapMarkers`) for reuse in
  Epoch's server-side import route.

---

## Standalone persistence

No server. Everything is file-based:

- **Auto-save draft** — `localStorage.epochmapper.draft` holds a JSON snapshot of
  the current session, debounced 500 ms. Restored automatically on the next
  visit (with a non-blocking "Restored unsaved session" toast).
- **Permanent save** — File → Save downloads a `.epochmap` binary.
- **Open / Import** — file picker or drag-and-drop a `.epochmap` onto the window.

The Welcome modal is shown once (`localStorage.epochmapper.welcomed`) and can be
re-opened any time with the **?** toolbar button or the `?` key.

---

## Keyboard shortcuts

| Key                  | Action                                  |
| -------------------- | --------------------------------------- |
| Arrow keys / WASD    | Move player marker                      |
| `F`                  | Toggle fog-of-war reveal for the chunk  |
| `N`                  | Add / edit a note on the current cell   |
| `Z` / `Ctrl+Z`       | Undo last cell edit                     |
| `Ctrl+S`             | Save session to `.epochmap`             |
| `Ctrl+P`             | Export PDF                              |
| `+` / `-`            | Zoom in / out                           |
| `?`                  | Open the help modal                     |

In **Play** mode:

| Key                  | Action                                  |
| -------------------- | --------------------------------------- |
| WASD / arrows        | Move / turn                             |
| `E`                  | Interact (doors, chests, NPCs, levers)  |
| `Tab`                | Open / close the in-game menu           |
| `M`                  | Toggle the full map view                |
| ↑/↓ · Enter · Esc    | Navigate menus / confirm / back         |

---

## Stack & deviations from the spec

Next.js (App Router) · TypeScript · Tailwind CSS — the same family as Epoch so
components port directly. The spec names "Next.js 14"; this repo uses **Next 15
/ React 19 / Tailwind 3**, matching Epoch's actual modern stack. gzip is
provided by [`fflate`](https://github.com/101arrowz/fflate) (browser + Node).

---

## Publishing (GitHub Packages)

The package is published to **GitHub Packages** as
`@northbridgetechnology/epoch-mapper` (the scope must match the org, which is why
it isn't `@epoch/*`).

**Automated (recommended):** bump `version` in `package.json`, then create a
GitHub Release. The [`publish` workflow](.github/workflows/publish.yml) builds
`dist/` and publishes using the built-in `GITHUB_TOKEN` — no secrets to set up.
You can also run it manually from the Actions tab.

**Manual (from a machine with a PAT that has `write:packages`):**

```bash
npm run build:lib
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT" >> ~/.npmrc
npm publish        # publishConfig already targets npm.pkg.github.com
```

Consumers (Epoch) authenticate to the same registry for `@northbridgetechnology`
— see Epoch's `.npmrc`.

---

## Support the project ☕

Epoch Mapper is free and open source — no accounts, no ads, no paywalls. If it
has saved you time or you simply appreciate the work, you can show your support
by [**buying me a coffee**](https://www.buymeacoffee.com/northbridgetechnology).
Every cup helps keep the project maintained and is genuinely appreciated. The
app also has a coffee button in the bottom-right corner. Thank you!

---

## License

MIT — see [`LICENSE`](LICENSE).
