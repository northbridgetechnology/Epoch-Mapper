/**
 * Epoch Mapper — shared type definitions.
 *
 * The in-memory model is built directly on the numeric type-ID taxonomy
 * defined by the `.epochmap` binary format (see EPOCH_MAPPER_SPEC.md §4.3).
 * Built-in IDs live in `constants.ts`; user-defined custom markers occupy
 * IDs 128–255 and travel inside each `.epochmap` file so any recipient can
 * render a map with no external dependencies.
 */

/** The four sides of a cell. */
export type EdgeDir = 'N' | 'S' | 'E' | 'W'

/**
 * A single cell on the infinite grid.
 *
 * - `base`     — base type ID (0 = empty/unrevealed). 1–127 built-in, 128–255 custom.
 * - `overlays` — overlay type IDs stacked on the cell (0 is never stored here).
 *                The editor and the localStorage draft support multiple overlays;
 *                the v1 `.epochmap` binary stores only the first (see codec).
 * - `edges`    — per-direction edge type ID. The editor supports a different type
 *                per side; the v1 binary stores one edge type for all marked sides.
 * - `note`     — optional free text (≤ 500 chars).
 */
export interface CellData {
  base: number
  overlays: number[]
  edges: Partial<Record<EdgeDir, number>>
  note?: string
  /** L2 world placement entities — encounters, objects, events (engine layer). */
  entities?: import('./engine-types').CellEntity[]
}

/** Sparse cell storage keyed by `"x,y"`. */
export type CellMap = Record<string, CellData>

/** A single map (floor / world map) within a session. */
export interface MapData {
  id: string
  name: string
  cells: CellMap
  playerX: number
  playerY: number
  /**
   * Revealed fog-of-war chunk keys (`"cx,cy"`). Optional in memory — when a
   * map is first created it is derived from the player position.
   */
  revealedChunks?: string[]
}

/** A user-defined cell type or overlay icon. IDs are 128–255. */
export interface CustomMarker {
  id: number
  kind: 'base' | 'overlay'
  label: string
  icon: string
  color: string // '#RRGGBB'
}

/** The fully-decoded contents of a `.epochmap` file. */
export interface EpochmapFile {
  version: number
  gameTitle: string
  romHash: string // hex SHA-256, '' if unknown
  customMarkers: CustomMarker[]
  maps: MapData[]
  /** L1 ruleset — present in v2 files and in localStorage drafts. */
  ruleset?: import('./engine-types').Ruleset
}

/** Built-in marker definition (base / overlay / edge tables). */
export interface MarkerDef {
  id: number
  label: string
  color: string // '#RRGGBB'
  icon?: string // emoji / short glyph shown in-cell and in legends
}
