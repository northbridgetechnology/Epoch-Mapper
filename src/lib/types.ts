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
 * - `note`     — optional free text (≤ 500 chars).
 *
 * Walls, doors, and other boundary data live in `MapData.boundaries`, not here.
 */
/** Position within a cell's 3×3×3 sub-cube grid. */
export interface SubcubePos {
  x: 0 | 1 | 2  // 0=West, 1=Center, 2=East
  y: 0 | 1 | 2  // 0=Floor, 1=Mid, 2=Ceiling
  z: 0 | 1 | 2  // 0=Near (south, player side), 1=Center, 2=Far (north)
}

/** A visual/interactive object placed in a sub-cube slot within a cell. */
export interface SubcubeObject {
  id: string
  pos: SubcubePos
  kind: string  // key from SUBCUBE_KIND_DEFS
  label?: string
  trigger?: 'onEnter' | 'onInteract' | 'onView'
  conditions?: import('./engine-types').Condition[]
  effects?: import('./engine-types').Effect[]
  encounter?: string  // DefRef<EncounterTableDef>
  once?: boolean
}

export interface CellData {
  base: number
  overlays: number[]
  note?: string
  /** L2 world placement entities — encounters, objects, events (engine layer). */
  entities?: import('./engine-types').CellEntity[]
  /** Sub-cell visual objects placed in the 3×3×3 sub-cube grid. */
  subcubeObjects?: SubcubeObject[]
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
  /**
   * Per-cell fog reveal for the Play-mode minimap (`"x,y"` keys). Unlike the
   * chunk-based editor fog (`revealedChunks`), these are revealed strictly by
   * exploration — a cell only appears once the party has actually seen it via
   * cardinal line-of-sight from a walked cell (see `seenCellsFrom`).
   */
  seenCells?: string[]
  /**
   * Boundary data keyed by canonical key from `boundaryKey()`.
   * Keys are of the form `"x,y:S"` or `"x,y:E"` — only south and east faces are
   * stored; north/west lookups are redirected by `boundaryKey()` automatically.
   */
  boundaries?: Record<string, import('./engine-types').BoundaryData>
  /** Seed used when procedurally generating this map. Stored for reference/reproduction. */
  seed?: number
  /** Visual theme ID — keys into THEMES in @/lib/themes. Defaults to 'stone_dungeon'. */
  theme?: string
  /** Dark map: view distance collapses to the party's light radius (torches,
   *  lanterns, light spells). Absent/false = fully lit (classic behavior). */
  dark?: boolean
  /** Looping background track for this level (AudioTrackDef id). Absent = fall
   *  back to the game's default track (GameMeta.defaultMusicId). */
  musicId?: string
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
  /** Uploaded audio blobs baked into the .epochmap, keyed by AudioTrackDef id
   *  and base64-encoded. Gathered from IndexedDB on export and written back on
   *  import; never part of the localStorage draft (which stays lean). */
  audioBlobs?: Record<string, string>
}

/** Built-in marker definition (base / overlay / edge tables). */
export interface MarkerDef {
  id: number
  label: string
  color: string // '#RRGGBB'
  icon?: string // emoji / short glyph shown in-cell and in legends
}
