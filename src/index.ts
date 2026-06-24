/**
 * `@northbridgetechnology/epoch-mapper` — public package entry point.
 *
 * Consumers (such as Epoch) import the editor component, the PDF export pipeline,
 * the `.epochmap` binary codec, and all shared types from here.
 */

// Components
export { DungeonMapper, type DungeonMapperProps } from './components/DungeonMapper'
export { WelcomeModal } from './components/WelcomeModal'
export { CellTooltip } from './components/CellTooltip'
export { Toolbar } from './components/Toolbar'

// PDF export
export { exportMapsAsPdf } from './lib/dungeon-export'

// .epochmap codec
export {
  parseDotEpochmap,
  serializeDotEpochmap,
  EpochmapParseError,
  EPOCHMAP_MAGIC,
  EPOCHMAP_VERSION,
  hexToRgb,
  rgbToHex,
} from './lib/epochmap-codec'

// Custom-marker helpers (import conflict resolution, §5.3)
export { sameMarker, nextFreeMarkerId, resolveMarkerImport, remapMapMarkers } from './lib/markers'

// Built-in type tables & grid constants
export {
  BASE,
  OVERLAY,
  EDGE,
  BASE_TYPES,
  OVERLAY_TYPES,
  EDGE_TYPES,
  BASE_PALETTE,
  OVERLAY_PALETTE,
  EDGE_PALETTE,
  CHUNK_SIZE,
  VIEWPORT_CELLS,
  DEFAULT_CELL,
  CUSTOM_ID_MIN,
  CUSTOM_ID_MAX,
  MAX_NOTE_LEN,
  MAX_MARKER_LABEL_LEN,
  baseDef,
  overlayDef,
  edgeDef,
  isCustomId,
} from './lib/constants'

// Types
export type {
  CellData,
  CellMap,
  MapData,
  CustomMarker,
  EpochmapFile,
  EdgeDir,
  MarkerDef,
} from './lib/types'
