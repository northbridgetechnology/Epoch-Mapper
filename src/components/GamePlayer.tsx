'use client'

/**
 * Standalone game player — the runtime shell for a distributed game.
 *
 * Decodes an embedded `.epochmap` (a decoded `EpochmapFile`, base64 bytes, or a
 * URL to fetch), restores its baked audio into IndexedDB, then mounts the
 * engine in distribution mode (no editor surfaces, boots to the title screen).
 * This is what a bundled standalone HTML / hosted build / desktop app renders.
 */

import { useEffect, useState } from 'react'
import { DungeonMapper } from './DungeonMapper'
import { parseDotEpochmap } from '@/lib/epochmap-codec'
import { restoreAudioBlobs } from '@/lib/audio-store'
import type { EpochmapFile } from '@/lib/types'

export interface GamePlayerProps {
  /** A pre-decoded game. */
  session?: EpochmapFile
  /** Base64-encoded `.epochmap` bytes (the standalone-HTML embed path). */
  base64?: string
  /** URL to fetch a `.epochmap` from (the hosted / sidecar-file path). */
  url?: string
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '')
  const bin = atob(clean)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function GamePlayer({ session, base64, url }: GamePlayerProps) {
  const [file, setFile] = useState<EpochmapFile | null>(session ?? null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(!!session)

  useEffect(() => {
    if (session) { setFile(session); setReady(true); return }
    let cancelled = false
    void (async () => {
      try {
        let bytes: Uint8Array | null = null
        if (base64) bytes = base64ToBytes(base64)
        else if (url) {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`Could not load game (${res.status}).`)
          bytes = new Uint8Array(await res.arrayBuffer())
        }
        if (!bytes) throw new Error('No game data was provided.')
        const decoded = parseDotEpochmap(bytes)
        // Baked audio → IndexedDB so uploaded tracks play (builtins need nothing).
        if (decoded.audioBlobs) await restoreAudioBlobs(decoded.audioBlobs)
        if (!cancelled) { setFile(decoded); setReady(true) }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load the game.')
      }
    })()
    return () => { cancelled = true }
  }, [session, base64, url])

  if (error) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-zinc-950 text-center p-6">
        <div className="space-y-2">
          <div className="text-3xl">🗺️</div>
          <div className="text-sm font-semibold text-red-300">This game could not be loaded</div>
          <div className="text-xs text-white/40 max-w-sm">{error}</div>
        </div>
      </div>
    )
  }
  if (!ready || !file) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-zinc-950">
        <div className="text-sm text-white/40 animate-pulse">Loading…</div>
      </div>
    )
  }
  return (
    <DungeonMapper distribution layout="fill" welcomeOnFirstVisit={false} initialSession={file} />
  )
}
