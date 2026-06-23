# Epoch Mapper

A free, open-source dungeon and world map editor built for retro gaming —
inspired by tools like Grid Cartographer, but approachable, free, and tightly
integrated with the [Epoch](https://github.com/northbridgetechnology/epoch)
game library.

Draw room layouts, mark shops, inns, bosses, and points of interest as you
explore a game. Export your maps as a print-ready **PDF** or as a compact,
self-describing **`.epochmap`** binary you can share with other players.

This repository is **both**:

1. **A standalone web app** (Next.js) — open the editor in a browser tab, no
   login, no accounts, no server. State is file-based.
2. **The npm package `@epoch/mapper`** — the editor component, the PDF export
   pipeline, and the `.epochmap` codec, consumed directly by Epoch.

> **Status:** Phase 1 (extract & publish). The standalone app, the `.epochmap`
> binary format + codec, and the reusable package are complete. Custom markers
> (Phase 2) and Epoch integration (Phase 3) follow. See
> [`EPOCH_MAPPER_SPEC.md`](https://github.com/northbridgetechnology/epoch/blob/main/EPOCH_MAPPER_SPEC.md)
> in the Epoch repo for the full plan.

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
| `test:codec`        | Round-trip tests for the `.epochmap` codec              |
| `lint`              | ESLint                                                  |

`test:codec` runs under Node ≥ 22; the codec itself has no DOM dependencies, so
it works in the browser, Node, and edge runtimes.

---

## Using the package

```ts
import {
  DungeonMapper,            // the full React editor component
  exportMapsAsPdf,          // jsPDF export pipeline
  parseDotEpochmap,         // ArrayBuffer | Uint8Array -> EpochmapFile
  serializeDotEpochmap,     // EpochmapFile -> Uint8Array (gzipped)
  EpochmapParseError,
  type EpochmapFile,
  type MapData,
  type CellData,
  type CustomMarker,
} from '@epoch/mapper'
```

`DungeonMapper` is a client component (it uses React hooks). Import it from a
`'use client'` boundary in an RSC tree.

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

## Publishing

The package is publish-ready (`npm run build:lib` produces `dist/`), but the
actual `npm publish` to the `@epoch` scope requires registry credentials that
live outside this repo. `prepublishOnly` runs the library build automatically.

---

## License

MIT — see [`LICENSE`](LICENSE).
