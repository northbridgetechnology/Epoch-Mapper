/**
 * `.epochmap` binary format codec — encode / decode.
 *
 *   [UNCOMPRESSED HEADER]  magic "EPKM", version, gameTitle, romHash
 *   [GZIP COMPRESSED BODY] custom markers, maps, cells, notes, revealed chunks,
 *                          (v3) audio blobs, JSON extension block
 *
 * All multi-byte integers are little-endian. The header is never gzipped so the
 * magic/version/game association can be read without decompressing.
 *
 * Version history:
 *   v1 — visual-only: markers, maps, cells (base+overlay+legacy edge bits), notes.
 *   v2 — adds a JSON extension block (ruleset + entities + boundaries + audio,
 *        the audio base64-encoded inside the JSON).
 *   v3 — shrinks the format substantially:
 *        · the ruleset is stored as a DIFF against the built-in default ruleset
 *          (see ruleset-diff.ts) instead of in full — ~80% of every prior file
 *          was the unchanged default content.
 *        · audio blobs move to a raw length-prefixed binary block (no base64's
 *          +33%, no double-compressing text-encoded bytes).
 *        · romHash is packed as 32 raw bytes instead of 64 hex ASCII bytes.
 *        · dead per-cell edge bytes (always-zero mask + type) are dropped;
 *          boundaries live in the JSON block.
 *
 * v1 lossiness (documented in the spec): each cell stores a single overlay byte.
 * The editor's richer in-memory model (multiple overlays) is preserved in the
 * JSON localStorage draft; only the compact `.epochmap` export collapses it.
 */

import { gzipSync, gunzipSync } from 'fflate'
import type { CellData, CellMap, CustomMarker, EdgeDir, EpochmapFile, MapData } from './types'
import type { BoundaryData, CellEntity, Ruleset } from './engine-types'
import { diffRuleset, patchRuleset, type RulesetDiff } from './ruleset-diff'

export const EPOCHMAP_MAGIC = 'EPKM'
export const EPOCHMAP_VERSION = 3  // v1 = visual-only; v2 = +ruleset JSON; v3 = diffed ruleset + binary audio
const ROM_HASH_HEX_BYTES = 64   // v1/v2: romHash stored as 64 hex ASCII chars
const ROM_HASH_RAW_BYTES = 32   // v3: romHash packed as 32 raw bytes (SHA-256)
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

/** v3: pack a hex SHA-256 (64 hex chars) into 32 raw bytes; zeros = unknown. */
function writeRomHashRaw(w: ByteWriter, romHash: string) {
  const hex = (romHash || '').toLowerCase()
  const bytes = new Uint8Array(ROM_HASH_RAW_BYTES) // all-zero when unknown/malformed
  if (/^[0-9a-f]{64}$/.test(hex)) {
    for (let i = 0; i < ROM_HASH_RAW_BYTES; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
  }
  w.bytes(bytes)
}

function readRomHashRaw(r: ByteReader): string {
  const bytes = r.take(ROM_HASH_RAW_BYTES, 'romHash')
  if (bytes.every(b => b === 0)) return '' // all-zero → unknown
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0')
  return s
}

/** v1/v2: romHash stored as 64 hex ASCII chars, 0x00-padded when unknown/short. */
function readRomHashHex(r: ByteReader): string {
  const bytes = r.take(ROM_HASH_HEX_BYTES, 'romHash')
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  if (end === 0) return ''
  let s = ''
  for (let i = 0; i < end; i++) s += String.fromCharCode(bytes[i])
  return s
}

// ── base64 ↔ bytes (audio blobs travel as base64 in memory) ─────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000 // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
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
      body.u8(cell.overlays[0] ?? 0) // single overlay byte (boundaries in JSON ext block)
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

  // ----- audio block (raw binary; base64 in memory → raw bytes on disk) -----
  const audioBlobs = file.audioBlobs ?? {}
  const audioIds = Object.keys(audioBlobs)
  body.u32(audioIds.length)
  for (const id of audioIds) {
    body.str(id, (n) => body.u16(n))
    const bytes = base64ToBytes(audioBlobs[id])
    body.u32(bytes.length)
    body.bytes(bytes)
  }

  // ----- texture block (raw binary; dedup all maps' textureAssets into one pool) -----
  // Every `custom:<hash>` reference across all maps resolves through this shared
  // pool keyed by content hash, so a texture reused on many maps is stored once.
  // Collect only the custom hashes actually referenced by some map's textures,
  // so stale uploads never bloat the file.
  const referenced = new Set<string>()
  for (const m of maps) {
    for (const ref of [m.textures?.wall, m.textures?.floor, m.textures?.ceiling]) {
      if (ref && ref.startsWith('custom:')) referenced.add(ref.slice('custom:'.length))
    }
  }
  const texturePool: Record<string, string> = {}
  const collect = (src?: Record<string, string>) => {
    if (!src) return
    for (const [hash, uri] of Object.entries(src)) {
      if (referenced.has(hash) && !(hash in texturePool)) texturePool[hash] = uri
    }
  }
  collect(file.textureBlobs)
  for (const m of maps) collect(m.textureAssets)
  const textureIds = Object.keys(texturePool)
  body.u32(textureIds.length)
  for (const hash of textureIds) {
    body.str(hash, (n) => body.u16(n))
    const bytes = new TextEncoder().encode(texturePool[hash])  // store the data URI text verbatim
    body.u32(bytes.length)
    body.bytes(bytes)
  }

  // ----- v3 JSON extension block: ruleset DIFF + per-map entities/boundaries/meta -----
  const ext: {
    rulesetDiff?: RulesetDiff
    mapEntities?: Array<Record<string, CellEntity[]>>
    mapBoundaries?: Array<Record<string, BoundaryData>>
    mapMeta?: Array<{ theme?: string; dark?: boolean; seed?: number; musicId?: string; combatMode?: string; edgeLinks?: MapData['edgeLinks']; textures?: MapData['textures'] }>
  } = {}
  if (file.ruleset) ext.rulesetDiff = diffRuleset(file.ruleset)
  const mapMeta = maps.map(m => ({ theme: m.theme, dark: m.dark, seed: m.seed, musicId: m.musicId, combatMode: m.combatMode, edgeLinks: m.edgeLinks, textures: m.textures }))
  if (mapMeta.some(m => m.theme !== undefined || m.dark !== undefined || m.seed !== undefined || m.musicId !== undefined || m.combatMode !== undefined || m.edgeLinks !== undefined || m.textures !== undefined)) ext.mapMeta = mapMeta
  const mapEntities: Array<Record<string, CellEntity[]>> = maps.map(map => {
    const ent: Record<string, CellEntity[]> = {}
    for (const [key, cell] of Object.entries(map.cells)) {
      if (cell.entities?.length) ent[key] = cell.entities
    }
    return ent
  })
  if (mapEntities.some(m => Object.keys(m).length > 0)) ext.mapEntities = mapEntities
  const mapBoundaries = maps.map(map => map.boundaries ?? {})
  if (mapBoundaries.some(m => Object.keys(m).length > 0)) ext.mapBoundaries = mapBoundaries
  const jsonBytes = new TextEncoder().encode(JSON.stringify(ext))
  body.u32(jsonBytes.length)
  body.bytes(jsonBytes)

  const gzipped = gzipSync(body.done())

  // ----- header (never gzipped) -----
  const header = new ByteWriter(128)
  for (const ch of EPOCHMAP_MAGIC) header.u8(ch.charCodeAt(0))
  header.u8(EPOCHMAP_VERSION)
  header.str(file.gameTitle ?? '', (n) => header.u16(n))
  writeRomHashRaw(header, file.romHash ?? '')

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
  if (version !== 1 && version !== 2 && version !== 3) {
    throw new EpochmapParseError(`Unsupported .epochmap version ${version}`)
  }

  const gameTitleLen = head.u16()
  const gameTitle = head.str(gameTitleLen)
  const romHashBytes = version >= 3 ? ROM_HASH_RAW_BYTES : ROM_HASH_HEX_BYTES
  const romHash = version >= 3 ? readRomHashRaw(head) : readRomHashHex(head)

  // The rest is the gzipped body. Slice from the current header offset.
  const headerLen = 4 + 1 + 2 + gameTitleLen + romHashBytes
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
      cells[`${x},${y}`] = { base, overlays: overlay ? [overlay] : [] }
      // v1/v2 carried two always-zero edge bytes per cell (mask + type); v3
      // dropped them. Legacy edge bits → boundaries (backward compat).
      if (version < 3) {
        const mask = r.u8()
        const edgeType = r.u8()
        if (mask !== 0) {
          EDGE_DIRS.forEach((dir, bit) => {
            if (mask & (1 << bit)) {
              boundaries[bKey(x, y, dir)] = { wall: edgeType }
            }
          })
        }
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

  // v3: raw audio block (sits between the maps and the JSON extension block).
  if (version >= 3 && r.remaining >= 4) {
    try {
      const audioCount = r.u32()
      if (audioCount > 0) {
        const audioBlobs: Record<string, string> = {}
        for (let i = 0; i < audioCount; i++) {
          const id = r.str(r.u16())
          const byteLen = r.u32()
          audioBlobs[id] = bytesToBase64(r.take(byteLen, 'audio blob'))
        }
        result.audioBlobs = audioBlobs
      }
    } catch {
      // ignore malformed audio block — degrade gracefully
    }
  }

  // v3: raw texture block (sits between the audio block and the JSON extension).
  let textureBlobs: Record<string, string> | undefined
  if (version >= 3 && r.remaining >= 4) {
    try {
      const texCount = r.u32()
      if (texCount > 0) {
        textureBlobs = {}
        for (let i = 0; i < texCount; i++) {
          const hash = r.str(r.u16())
          const byteLen = r.u32()
          textureBlobs[hash] = new TextDecoder().decode(r.take(byteLen, 'texture blob'))
        }
        result.textureBlobs = textureBlobs
      }
    } catch {
      // ignore malformed texture block — degrade gracefully
    }
  }

  // v2/v3: JSON extension block (ruleset[-diff] + entities + boundaries + meta).
  if (version >= 2 && r.remaining >= 4) {
    try {
      const jsonLen = r.u32()
      if (jsonLen > 0 && r.remaining >= jsonLen) {
        const jsonStr = r.str(jsonLen)
        const ext = JSON.parse(jsonStr) as {
          ruleset?: Ruleset          // v2: full ruleset
          rulesetDiff?: RulesetDiff  // v3: diff against the default ruleset
          mapEntities?: Array<Record<string, CellEntity[]>>
          mapBoundaries?: Array<Record<string, BoundaryData>>
          mapMeta?: Array<{ theme?: string; dark?: boolean; seed?: number; musicId?: string; combatMode?: string; edgeLinks?: MapData['edgeLinks']; textures?: MapData['textures'] }>
          audioBlobs?: Record<string, string>  // v2 only (v3 uses the binary block)
        }
        if (ext.rulesetDiff) result.ruleset = patchRuleset(ext.rulesetDiff)
        else if (ext.ruleset) result.ruleset = ext.ruleset
        if (ext.audioBlobs && !result.audioBlobs) result.audioBlobs = ext.audioBlobs
        if (ext.mapMeta) {
          ext.mapMeta.forEach((meta, mi) => {
            const map = maps[mi]
            if (!map || !meta) return
            if (meta.theme !== undefined) map.theme = meta.theme
            if (meta.dark !== undefined) map.dark = meta.dark
            if (meta.seed !== undefined) map.seed = meta.seed
            if (meta.musicId !== undefined) map.musicId = meta.musicId
            if (meta.combatMode === 'classic' || meta.combatMode === 'oneMore' || meta.combatMode === 'pressTurn') map.combatMode = meta.combatMode
            if (meta.edgeLinks) map.edgeLinks = meta.edgeLinks
            if (meta.textures) {
              map.textures = meta.textures
              // Rehydrate only the custom assets this map references from the shared pool.
              const refs = [meta.textures.wall, meta.textures.floor, meta.textures.ceiling]
              const assets: Record<string, string> = {}
              for (const ref of refs) {
                if (ref && ref.startsWith('custom:')) {
                  const hash = ref.slice('custom:'.length)
                  const uri = textureBlobs?.[hash]
                  if (uri) assets[hash] = uri
                }
              }
              if (Object.keys(assets).length > 0) map.textureAssets = assets
            }
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
            // JSON boundaries override legacy edge-bit boundaries
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
