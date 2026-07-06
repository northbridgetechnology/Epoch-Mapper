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
> **game engine**: a first-person renderer, turn-based combat, a content
> database (classes/races/items/spells/enemies/shops/loot), events/quests/NPCs,
> and exploration systems (light & darkness, trick tiles, wall switches,
> inscriptions, camp/rest, save slots, traps & damage hazards, FOE patrols,
> stairs between floors). See the **Game engine** section below,
> [`docs/roadmap.md`](docs/roadmap.md) for deferred specs, and
> [`docs/sprites.md`](docs/sprites.md) for the sprite system.

---

## Game engine

Beyond the map editor, Epoch Mapper ships a playable first-person engine. Build
content in the **Database** and **Party** workspaces, place it on the grid with
the **Cell Inspector**, then switch to **Play** to walk your dungeon.

- **First-person renderer** — a pseudo-3D painter's view (Eye of the Beholder /
  SMT style) with per-cell water/lava/void, ceiling/floor mortar grids, code-
  authored pixel sprites for objects and creatures, and real 3D stairs that
  descend into a pit or climb through a lit ceiling opening.
- **Turn-based combat** — enemies stand on a 3×3 playfield, an FF-style command
  bar (Attack / Spell / Item / Defend / Flee), front/back ranks, elemental
  weaknesses & resistances, seeded RNG (deterministic, so the balance simulator
  can replay it), boss ability phases, and loot drops.
- **Content database** — classes, races, attributes, items (with equipment
  modifiers, light sources, cursed & unidentified gear), spells (with level-up
  learn tables), status effects, enemies, encounter/loot tables, shops.
- **Story systems** — cell events (sequential, `onEnter`/`onInteract`/`onFlag`
  reactive), a global event library, quests-as-flags with a lore journal, and
  From-Software-style NPCs (the player listens; NPCs speak).
- **Exploration systems** — light & darkness (torches/lanterns with optional
  burn-down), trick tiles (spinner, pit, silent teleport, anti-magic, darkness,
  safe room), wall switches & switch-sealed doors, wall inscriptions, camp/rest
  with ambush risk, save slots + save points, a wipe/game-over flow, functional
  inns, visible fixed encounters, and FOE-style patrols.
- **Hazards** — traps spring their effects when stepped on, damage edges bite
  every crossing, and event/boundary `damage`/`status`/`cure` effects resolve
  out of combat (respecting race resistances; lethal, so a wipe rolls
  game-over). See [`docs/roadmap.md`](docs/roadmap.md) for deferred combat specs.
- **Generator** — "Randomly Generate & Populate" builds a two-level demo world
  (main floor + a dark *Depths*) wiring every system, in one of three layout
  styles: **Rooms** (BSP), **EotB** (dense thin-wall maze), or **SMT** (arterial
  lattice). Every generated door provably leads somewhere.

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
| `test`              | Full suite: codec, markers, combat, switches, events, generator, sprites, exploration |
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

## License

MIT — see [`LICENSE`](LICENSE).
