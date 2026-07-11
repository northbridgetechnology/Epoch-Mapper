/**
 * Gapless background-music controller (Web Audio API). A single module-level
 * instance owns the AudioContext, decodes tracks into buffers for seamless
 * looping, and crossfades between them. React never touches the audio graph
 * directly — it calls play/stop/setVolume on the exported `music` singleton.
 *
 * Browser autoplay policy: an AudioContext starts suspended until a user
 * gesture. Call `music.unlock()` from the first click/keypress; any track
 * requested before then is queued and starts on unlock.
 *
 * Browser-only: guarded so importing this module is SSR-safe.
 */

import { getTrack } from './audio-store'
import type { AudioTrackDef } from './engine-types'

const MASTER_KEY = 'epoch.music.master' // { volume, muted } — a client preference

interface Voice {
  id: string
  source: AudioBufferSourceNode
  gain: GainNode
}

class MusicController {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private current: Voice | null = null
  private buffers = new Map<string, AudioBuffer>()
  private pending: { track: AudioTrackDef; crossfadeMs: number } | null = null
  private volume = 0.7
  private muted = false
  private unlocked = false

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(MASTER_KEY)
        if (raw) {
          const p = JSON.parse(raw) as { volume?: number; muted?: boolean }
          if (typeof p.volume === 'number') this.volume = Math.min(1, Math.max(0, p.volume))
          if (typeof p.muted === 'boolean') this.muted = p.muted
        }
      } catch { /* ignore */ }
    }
  }

  private supported(): boolean {
    return typeof window !== 'undefined' &&
      (typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window)
  }

  private ensureCtx(): AudioContext | null {
    if (!this.supported()) return null
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Call from a user gesture. Resumes the context and starts any queued track. */
  unlock(): void {
    const ctx = this.ensureCtx()
    if (!ctx) return
    this.unlocked = true
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    if (this.pending) {
      const { track, crossfadeMs } = this.pending
      this.pending = null
      void this.play(track, { crossfadeMs })
    }
  }

  currentTrackId(): string | null {
    return this.current?.id ?? null
  }

  getVolume(): number { return this.volume }
  isMuted(): boolean { return this.muted }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
    this.applyMaster()
    this.persist()
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.applyMaster()
    this.persist()
  }

  private applyMaster(): void {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05)
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(MASTER_KEY, JSON.stringify({ volume: this.volume, muted: this.muted })) } catch { /* ignore */ }
  }

  private async fetchArrayBuffer(track: AudioTrackDef): Promise<ArrayBuffer | null> {
    if (track.source === 'url') {
      if (!track.src) return null
      const res = await fetch(track.src)
      if (!res.ok) throw new Error(`Track fetch failed: ${res.status}`)
      return res.arrayBuffer()
    }
    const blob = await getTrack(track.id)
    return blob ? blob.arrayBuffer() : null
  }

  private async getBuffer(track: AudioTrackDef): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(track.id)
    if (cached) return cached
    const ctx = this.ensureCtx()
    if (!ctx) return null
    const raw = await this.fetchArrayBuffer(track)
    if (!raw) return null
    const buf = await ctx.decodeAudioData(raw)
    this.buffers.set(track.id, buf)
    return buf
  }

  /**
   * Crossfade to `track` (looping). No-op if it is already the current track.
   * Before unlock the request is queued and starts on the next `unlock()`.
   */
  async play(track: AudioTrackDef, opts?: { crossfadeMs?: number }): Promise<void> {
    const crossfadeMs = opts?.crossfadeMs ?? 800
    if (this.current?.id === track.id) return
    if (!this.supported()) return
    if (!this.unlocked) { this.pending = { track, crossfadeMs }; return }

    const ctx = this.ensureCtx()
    if (!ctx || !this.master) return
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    let buffer: AudioBuffer | null
    try { buffer = await this.getBuffer(track) } catch { return }
    if (!buffer) return
    // A newer play() may have superseded us while decoding.
    if (this.pending || (this.current?.id === track.id)) return

    const now = ctx.currentTime
    const fade = crossfadeMs / 1000
    const target = Math.min(1, Math.max(0, track.volume ?? 1))

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + fade)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = track.loop ?? true
    source.connect(gain).connect(this.master)
    source.start()

    const prev = this.current
    this.current = { id: track.id, source, gain }
    if (prev) {
      prev.gain.gain.cancelScheduledValues(now)
      prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), now)
      prev.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade)
      try { prev.source.stop(now + fade + 0.05) } catch { /* already stopped */ }
    }
  }

  /** Fade out and stop whatever is playing. */
  stop(opts?: { fadeMs?: number }): void {
    this.pending = null
    if (!this.ctx || !this.current) { this.current = null; return }
    const fade = (opts?.fadeMs ?? 600) / 1000
    const now = this.ctx.currentTime
    const v = this.current
    v.gain.gain.cancelScheduledValues(now)
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now)
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade)
    try { v.source.stop(now + fade + 0.05) } catch { /* already stopped */ }
    this.current = null
  }
}

/** Process-wide singleton. */
export const music = new MusicController()
