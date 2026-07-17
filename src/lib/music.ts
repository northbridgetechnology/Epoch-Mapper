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

import type { AudioTrackDef, GameMeta, Ruleset, SfxEvent } from './engine-types'

/** Default values for a blank new AudioTrackDef. */
export function blankAudioTrack(id: string): AudioTrackDef {
  return { id, name: 'New Track', source: 'upload', loop: true, volume: 1 }
}

/** Default values for a blank new SFX AudioTrackDef. */
export function blankSfxTrack(id: string): AudioTrackDef {
  return { id, name: 'New Sound', role: 'sfx', source: 'upload', loop: false, volume: 1 }
}

export const isSfxTrack = (t: AudioTrackDef): boolean => t.role === 'sfx'

/**
 * The SFX track to play for an engine event: a per-object override wins, then
 * the ruleset's event→SFX assignment, then the matching built-in (`sfx.<event>`).
 * Returns undefined only if none of those resolve (caller can then no-op).
 */
export function resolveSfxTrack(
  event: SfxEvent,
  ruleset: Ruleset,
  overrideId?: string,
): AudioTrackDef | undefined {
  const byId = (id?: string) => (id ? ruleset.audioTracks.find(t => t.id === id) : undefined)
  return byId(overrideId) ?? byId(ruleset.meta.sfxSlots?.[event]) ?? byId(`sfx.${event}`)
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
