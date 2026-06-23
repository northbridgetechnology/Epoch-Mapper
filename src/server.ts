/**
 * `@epoch/mapper/server` — server-safe entry point.
 *
 * The main entry (`@epoch/mapper`) is a `"use client"` bundle because it ships
 * the React editor. Server code (e.g. Epoch's `.epochmap` import API route) must
 * not import a client module for runtime values, so the pure, DOM-free pieces —
 * the binary codec, marker helpers, type tables, and all types — are re-exported
 * here without the client boundary.
 */

export {
  parseDotEpochmap,
  serializeDotEpochmap,
  EpochmapParseError,
  EPOCHMAP_MAGIC,
  EPOCHMAP_VERSION,
  hexToRgb,
  rgbToHex,
} from './lib/epochmap-codec'

export { sameMarker, nextFreeMarkerId, resolveMarkerImport, remapMapMarkers } from './lib/markers'

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

export type {
  CellData,
  CellMap,
  MapData,
  CustomMarker,
  EpochmapFile,
  EdgeDir,
  MarkerDef,
} from './lib/types'
