/**
 * IndexedDB blob store for uploaded music tracks. Audio bytes never live in the
 * ruleset JSON (which autosaves to the ~5 MB localStorage draft) — they are kept
 * here, keyed by AudioTrackDef id, and baked into the .epochmap only on export.
 *
 * Browser-only: every call is guarded so importing this module is SSR-safe.
 */

const DB_NAME = 'epoch-audio'
const STORE = 'tracks'
const DB_VERSION = 1

function hasIDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error('IndexedDB unavailable'))
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    })
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  }))
}

/** Store (or replace) a track's audio blob under its id. */
export function putTrack(id: string, blob: Blob): Promise<void> {
  return tx<IDBValidKey>('readwrite', s => s.put(blob, id)).then(() => undefined)
}

/** Fetch a track's blob, or undefined if it isn't stored. */
export async function getTrack(id: string): Promise<Blob | undefined> {
  if (!hasIDB()) return undefined
  const val = await tx<unknown>('readonly', s => s.get(id))
  return val instanceof Blob ? val : undefined
}

/** Remove a track's blob (no-op if absent or unsupported). */
export async function deleteTrack(id: string): Promise<void> {
  if (!hasIDB()) return
  await tx<undefined>('readwrite', s => s.delete(id))
}

/** True if a blob is stored for this id. */
export async function hasTrack(id: string): Promise<boolean> {
  if (!hasIDB()) return false
  const key = await tx<IDBValidKey | undefined>('readonly', s => s.getKey(id))
  return key !== undefined
}

/** All stored track ids. */
export async function listTrackIds(): Promise<string[]> {
  if (!hasIDB()) return []
  const keys = await tx<IDBValidKey[]>('readonly', s => s.getAllKeys())
  return keys.map(String)
}

// ── .epochmap bake / unpack ───────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '') // strip the data: prefix
    fr.onerror = () => reject(fr.error ?? new Error('read failed'))
    fr.readAsDataURL(blob)
  })
}

function base64ToBlob(b64: string, mime = 'application/octet-stream'): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** Pull the given tracks' blobs out of IndexedDB as base64, for baking into a
 *  .epochmap export. Missing/unstored ids are skipped. */
export async function gatherAudioBlobs(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of ids) {
    const blob = await getTrack(id)
    if (blob) out[id] = await blobToBase64(blob)
  }
  return out
}

/** Write base64 blobs unpacked from an imported .epochmap back into IndexedDB. */
export async function restoreAudioBlobs(blobs: Record<string, string> | undefined): Promise<void> {
  if (!blobs || !hasIDB()) return
  for (const [id, b64] of Object.entries(blobs)) {
    if (b64) await putTrack(id, base64ToBlob(b64))
  }
}
