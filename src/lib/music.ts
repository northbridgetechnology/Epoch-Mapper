/**
 * Pure music resolution — which track should be playing given the current
 * scene. Kept separate from the audio engine so the fallback hierarchy is
 * testable without a browser.
 *
 * Hierarchy:
 *   exploring → map.musicId → meta.defaultMusicId → silence
 *   battle    → encounter.musicId → meta.battleMusicId → (exploration track)
 *   boss      → encounter.musicId → meta.bossMusicId → meta.battleMusicId → (exploration track)
 *
 * When a battle has no track configured, exploration music simply continues
 * (rather than cutting to silence) — battle music is opt-in.
 */

import type { AudioTrackDef, GameMeta } from './engine-types'

/** Default values for a blank new AudioTrackDef. */
export function blankAudioTrack(id: string): AudioTrackDef {
  return { id, name: 'New Track', source: 'upload', loop: true, volume: 1 }
}

export interface MusicContext {
  meta: GameMeta
  /** The current level's musicId (MapData.musicId), if any. */
  mapMusicId?: string
  /** The active battle, or null/undefined while exploring. */
  battle?: { musicId?: string; boss?: boolean } | null
}

/** The exploration track id for this context (map's own, else the global default). */
function exploreMusicId(ctx: MusicContext): string | undefined {
  return ctx.mapMusicId || ctx.meta.defaultMusicId || undefined
}

/** The AudioTrackDef id that should be playing right now, or undefined for silence. */
export function resolveMusicId(ctx: MusicContext): string | undefined {
  const b = ctx.battle
  if (b) {
    const battleId = b.boss
      ? (ctx.meta.bossMusicId || ctx.meta.battleMusicId)
      : ctx.meta.battleMusicId
    const id = b.musicId || battleId
    // No battle track configured → keep the exploration track playing.
    return id || exploreMusicId(ctx)
  }
  return exploreMusicId(ctx)
}

/** Look up a track by id. */
export function trackById(tracks: AudioTrackDef[], id: string | undefined): AudioTrackDef | undefined {
  if (!id) return undefined
  return tracks.find(t => t.id === id)
}

/** The AudioTrackDef that should be playing right now, or undefined for silence. */
export function resolveTrack(ctx: MusicContext, tracks: AudioTrackDef[]): AudioTrackDef | undefined {
  return trackById(tracks, resolveMusicId(ctx))
}
