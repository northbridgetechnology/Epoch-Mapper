/**
 * `.epochmap` binary format codec — encode / decode.
 *
 * Implements EPOCH_MAPPER_SPEC.md §4 exactly:
 *
 *   [UNCOMPRESSED HEADER]  magic "EPKM", version, gameTitle, 64-byte romHash
 *   [GZIP COMPRESSED BODY] custom markers, maps, cells, notes, revealed chunks
 *
 * All multi-byte integers are little-endian. The header is never gzipped so the
 * magic/version/game association can be read without decompressing.
 *
 * v1 lossiness (documented in the spec): each cell stores a single overlay byte
 * and a single edge type for all marked sides. The editor's richer in-memory
 * model (multiple overlays, per-side edge types) is preserved in the JSON
 * localStorage draft; only the compact `.epochmap` export collapses it. Per-side
 * edge types are reserved for a future v2.
 */

import { gzipSync, gunzipSync } from 'fflate'
import type { CellData, CellMap, CustomMarker, EdgeDir, EpochmapFile, MapData } from './types'
import type { BoundaryData, CellEntity, Ruleset } from './engine-types'

export const EPOCHMAP_MAGIC = 'EPKM'
export const EPOCHMAP_VERSION = 2  // v1 = visual-only; v2 adds ruleset + entities JSON block
const ROM_HASH_BYTES = 64
const EDGE_DIRS: EdgeDir[] = ['N', 'S', 'E', 'W'] // bit order: N=0, S=1, E=2, W=3

export class EpochmapParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EpochmapParseError'
  }
}

// ── Byte writer (auto-growing) ─────────────────────────────────────────────────

class ByteWriter {
  private buf: Uint8Array
  private view: DataView
  private pos = 0
  private static enc = new TextEncoder()

  constructor(initial = 1024) {
    this.buf = new Uint8Array(initial)
    this.view = new DataView(this.buf.buffer)
  }

  private ensure(n: number) {
    if (this.pos + n <= this.buf.length) return
    let cap = this.buf.length * 2
    while (cap < this.pos + n) cap *= 2
    const next = new Uint8Array(cap)
    next.set(this.buf)
    this.buf = next
    this.view = new DataView(this.buf.buffer)
  }

  u8(v: number) {
    this.ensure(1)
    this.view.setUint8(this.pos, v & 0xff)
    this.pos += 1
  }

  u16(v: number) {
    this.ensure(2)
    this.view.setUint16(this.pos, v & 0xffff, true)
    this.pos += 2
  }

  i16(v: number) {
    this.ensure(2)
    this.view.setInt16(this.pos, v, true)
    this.pos += 2
  }

  u32(v: number) {
    this.ensure(4)
    this.view.setUint32(this.pos, v >>> 0, true)
    this.pos += 4
  }

  bytes(b: Uint8Array) {
    this.ensure(b.length)
    this.buf.set(b, this.pos)
    this.pos += b.length
  }

  /** UTF-8 string prefixed with a length, written via `lenFn`. */
  str(s: string, lenFn: (n: number) => void) {
    const b = ByteWriter.enc.encode(s)
    lenFn(b.length)
    this.bytes(b)
  }

  encodeStr(s: string): Uint8Array {
    return ByteWriter.enc.encode(s)
  }

  done(): Uint8Array {
    return this.buf.slice(0, this.pos)
  }
}

// ── Byte reader ────────────────────────────────────────────────────────────────

class ByteReader {
  private view: DataView
  private pos = 0
  private static dec = new TextDecoder()

  constructor(private buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }

  get remaining() {
    return this.buf.length - this.pos
  }

  private need(n: number, what: string) {
    if (this.pos + n > this.buf.length) {
      throw new EpochmapParseError(`Unexpected end of data while reading ${what}`)
    }
  }

  u8() {
    this.need(1, 'u8')
    return this.view.getUint8(this.pos++)
  }

  u16() {
    this.need(2, 'u16')
    const v = this.view.getUint16(this.pos, true)
    this.pos += 2
    return v
  }

  i16() {
    this.need(2, 'i16')
    const v = this.view.getInt16(this.pos, true)
    this.pos += 2
    return v
  }

  u32() {
    this.need(4, 'u32')
    const v = this.view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  take(n: number, what = 'bytes'): Uint8Array {
    this.need(n, what)
    const slice = this.buf.subarray(this.pos, this.pos + n)
    this.pos += n
    return slice
  }

  str(len: number): string {
    return ByteReader.dec.decode(this.take(len, 'string'))
  }
}

// ── romHash helpers ────────────────────────────────────────────────────────────

function writeRomHash(w: ByteWriter, romHash: string) {
  const hex = (romHash || '').toLowerCase()
  const bytes = new Uint8Array(ROM_HASH_BYTES) // zero-padded (0x00) when unknown/short
  for (let i = 0; i < Math.min(hex.length, ROM_HASH_BYTES); i++) {
    bytes[i] = hex.charCodeAt(i) & 0xff
  }
  w.bytes(bytes)
}

function readRomHash(r: ByteReader): string {
  const bytes = r.take(ROM_HASH_BYTES, 'romHash')
  // Trim trailing 0x00 padding; all-zero means "unknown" → ''.
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  if (end === 0) return ''
  let s = ''
  for (let i = 0; i < end; i++) s += String.fromCharCode(bytes[i])
  return s
}

// ── Boundary key (inlined from constants to avoid circular import) ─────────────

function bKey(x: number, y: number, dir: EdgeDir): string {
  switch (dir) {
    case 'N': return `${x},${y - 1}:S`
    case 'S': return `${x},${y}:S`
    case 'E': return `${x},${y}:E`
    case 'W': return `${x - 1},${y}:E`
  }
}

// ── Serialize ──────────────────────────────────────────────────────────────────

export function serializeDotEpochmap(file: EpochmapFile): Uint8Array {
  // ----- body (will be gzipped) -----
  const body = new ByteWriter(4096)

  // custom markers
  const markers = file.customMarkers ?? []
  body.u16(markers.length)
  for (const m of markers) {
    body.u8(m.id)
    body.u8(m.kind === 'overlay' ? 1 : 0)
    body.str(m.label, (n) => body.u8(n))
    body.str(m.icon, (n) => body.u8(n))
    const [r, g, b] = hexToRgb(m.color)
    body.u8(r)
    body.u8(g)
    body.u8(b)
  }

  // maps
  const maps = file.maps ?? []
  body.u32(maps.length)
  for (const map of maps) {
    body.str(map.name, (n) => body.u16(n))
    body.i16(map.playerX)
    body.i16(map.playerY)

    // Split cells into "renderable" cells and notes.
    const cellEntries: Array<[number, number, CellData]> = []
    const noteEntries: Array<[number, number, string]> = []
    for (const key of Object.keys(map.cells)) {
      const [x, y] = key.split(',').map(Number)
      const cell = map.cells[key]
      const hasGeometry = (cell.base ?? 0) !== 0 || cell.overlays.length > 0
      if (hasGeometry) cellEntries.push([x, y, cell])
      if (cell.note && cell.note.length > 0) noteEntries.push([x, y, cell.note])
    }

    body.u32(cellEntries.length)
    for (const [x, y, cell] of cellEntries) {
      body.i16(x)
      body.i16(y)
      body.u8(cell.base ?? 0)
      body.u8(cell.overlays[0] ?? 0) // v1: single overlay byte
      body.u8(0) // edge mask — boundaries now in JSON ext block
      body.u8(0) // edge type — boundaries now in JSON ext block
    }

    body.u32(noteEntries.length)
    for (const [x, y, text] of noteEntries) {
      body.i16(x)
      body.i16(y)
      body.str(text, (n) => body.u16(n))
    }

    const chunks = map.revealedChunks ?? []
    body.u32(chunks.length)
    for (const ck of chunks) {
      const [cx, cy] = ck.split(',').map(Number)
      body.i16(cx)
      body.i16(cy)
    }
  }

  // ----- v2 JSON extension block: ruleset + per-map cell entities + boundaries -----
  const v2ext: {
    ruleset?: Ruleset
    mapEntities?: Array<Record<string, CellEntity[]>>
    mapBoundaries?: Array<Record<string, BoundaryData>>
    mapMeta?: Array<{ theme?: string; dark?: boolean; seed?: number }>
  } = {}
  if (file.ruleset) v2ext.ruleset = file.ruleset
  const mapMeta = maps.map(m => ({ theme: m.theme, dark: m.dark, seed: m.seed }))
  if (mapMeta.some(m => m.theme !== undefined || m.dark !== undefined || m.seed !== undefined)) v2ext.mapMeta = mapMeta
  const mapEntities: Array<Record<string, CellEntity[]>> = maps.map(map => {
    const ent: Record<string, CellEntity[]> = {}
    for (const [key, cell] of Object.entries(map.cells)) {
      if (cell.entities?.length) ent[key] = cell.entities
    }
    return ent
  })
  if (mapEntities.some(m => Object.keys(m).length > 0)) v2ext.mapEntities = mapEntities
  const mapBoundaries = maps.map(map => map.boundaries ?? {})
  if (mapBoundaries.some(m => Object.keys(m).length > 0)) v2ext.mapBoundaries = mapBoundaries
  const jsonBytes = new TextEncoder().encode(JSON.stringify(v2ext))
  body.u32(jsonBytes.length)
  body.bytes(jsonBytes)

  const gzipped = gzipSync(body.done())

  // ----- header (never gzipped) -----
  const header = new ByteWriter(128)
  for (const ch of EPOCHMAP_MAGIC) header.u8(ch.charCodeAt(0))
  header.u8(EPOCHMAP_VERSION)
  header.str(file.gameTitle ?? '', (n) => header.u16(n))
  writeRomHash(header, file.romHash ?? '')

  const headerBytes = header.done()
  const out = new Uint8Array(headerBytes.length + gzipped.length)
  out.set(headerBytes, 0)
  out.set(gzipped, headerBytes.length)
  return out
}

// ── Parse ──────────────────────────────────────────────────────────────────────

export function parseDotEpochmap(buffer: ArrayBuffer | Uint8Array): EpochmapFile {
  const all = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const head = new ByteReader(all)

  // magic
  let magic = ''
  for (let i = 0; i < 4; i++) magic += String.fromCharCode(head.u8())
  if (magic !== EPOCHMAP_MAGIC) {
    throw new EpochmapParseError(`Not an .epochmap file (bad magic "${magic}")`)
  }

  const version = head.u8()
  if (version !== 1 && version !== 2) {
    throw new EpochmapParseError(`Unsupported .epochmap version ${version}`)
  }

  const gameTitleLen = head.u16()
  const gameTitle = head.str(gameTitleLen)
  const romHash = readRomHash(head)

  // The rest is the gzipped body. Slice from the current header offset.
  const headerLen = 4 + 1 + 2 + gameTitleLen + ROM_HASH_BYTES
  let bodyBytes: Uint8Array
  try {
    bodyBytes = gunzipSync(all.subarray(headerLen))
  } catch (e) {
    throw new EpochmapParseError(`Failed to decompress body: ${(e as Error).message}`)
  }

  const r = new ByteReader(bodyBytes)

  // custom markers
  const markerCount = r.u16()
  const customMarkers: CustomMarker[] = []
  for (let i = 0; i < markerCount; i++) {
    const id = r.u8()
    const kind = r.u8() === 1 ? 'overlay' : 'base'
    const label = r.str(r.u8())
    const icon = r.str(r.u8())
    const cr = r.u8()
    const cg = r.u8()
    const cb = r.u8()
    customMarkers.push({ id, kind, label, icon, color: rgbToHex(cr, cg, cb) })
  }

  // maps
  const mapCount = r.u32()
  const maps: MapData[] = []
  for (let mi = 0; mi < mapCount; mi++) {
    const name = r.str(r.u16())
    const playerX = r.i16()
    const playerY = r.i16()

    const cells: CellMap = {}
    const boundaries: Record<string, BoundaryData> = {}
    const cellCount = r.u32()
    for (let ci = 0; ci < cellCount; ci++) {
      const x = r.i16()
      const y = r.i16()
      const base = r.u8()
      const overlay = r.u8()
      const mask = r.u8()
      const edgeType = r.u8()
      cells[`${x},${y}`] = { base, overlays: overlay ? [overlay] : [] }
      // Legacy edge bits → boundaries (backward compat for v1 files)
      if (mask !== 0) {
        EDGE_DIRS.forEach((dir, bit) => {
          if (mask & (1 << bit)) {
            boundaries[bKey(x, y, dir)] = { wall: edgeType }
          }
        })
      }
    }

    const noteCount = r.u32()
    for (let ni = 0; ni < noteCount; ni++) {
      const x = r.i16()
      const y = r.i16()
      const text = r.str(r.u16())
      const key = `${x},${y}`
      const existing = cells[key] ?? { base: 0, overlays: [] }
      existing.note = text
      cells[key] = existing
    }

    const chunkCount = r.u32()
    const revealedChunks: string[] = []
    for (let k = 0; k < chunkCount; k++) {
      const cx = r.i16()
      const cy = r.i16()
      revealedChunks.push(`${cx},${cy}`)
    }

    maps.push({ id: `imported-${mi}`, name, cells, boundaries, playerX, playerY, revealedChunks })
  }

  const result: EpochmapFile = { version, gameTitle, romHash, customMarkers, maps }

  // v2: read JSON extension block (ruleset + entities + boundaries)
  if (version === 2 && r.remaining >= 4) {
    try {
      const jsonLen = r.u32()
      if (jsonLen > 0 && r.remaining >= jsonLen) {
        const jsonStr = r.str(jsonLen)
        const ext = JSON.parse(jsonStr) as {
          ruleset?: Ruleset
          mapEntities?: Array<Record<string, CellEntity[]>>
          mapBoundaries?: Array<Record<string, BoundaryData>>
          mapMeta?: Array<{ theme?: string; dark?: boolean; seed?: number }>
        }
        if (ext.ruleset) result.ruleset = ext.ruleset
        if (ext.mapMeta) {
          ext.mapMeta.forEach((meta, mi) => {
            const map = maps[mi]
            if (!map || !meta) return
            if (meta.theme !== undefined) map.theme = meta.theme
            if (meta.dark !== undefined) map.dark = meta.dark
            if (meta.seed !== undefined) map.seed = meta.seed
          })
        }
        if (ext.mapEntities) {
          ext.mapEntities.forEach((mapEnt, mi) => {
            const map = maps[mi]
            if (!map || !mapEnt) return
            for (const [key, entities] of Object.entries(mapEnt)) {
              if (!entities?.length) continue
              const cell = map.cells[key] ?? { base: 0, overlays: [] }
              cell.entities = entities
              map.cells[key] = cell
            }
          })
        }
        if (ext.mapBoundaries) {
          ext.mapBoundaries.forEach((mapBounds, mi) => {
            const map = maps[mi]
            if (!map || !mapBounds) return
            // v2 boundaries override legacy edge-bit boundaries
            map.boundaries = { ...(map.boundaries ?? {}), ...mapBounds }
          })
        }
      }
    } catch {
      // ignore malformed extension — degrade gracefully
    }
  }

  return result
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '')
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
  }
  if (h.length >= 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  return [255, 255, 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
