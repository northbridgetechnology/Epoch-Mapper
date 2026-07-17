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
import { chipSpecById, renderChip, renderSfx, SFX_DEFS } from './chiptune'
import type { AudioTrackDef } from './engine-types'

const MASTER_KEY = 'epoch.music.master' // { volume, muted, sfxVolume, sfxMuted } — client prefs

interface Voice {
  id: string
  sources: AudioBufferSourceNode[]
  gain: GainNode
}

const DUCK_LEVEL = 0.35

class MusicController {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** Music routes through this bus so dialogue ducking never touches SFX. */
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private current: Voice | null = null
  private buffers = new Map<string, AudioBuffer>()
  private sfxBuffers = new Map<string, AudioBuffer>()
  private pending: { track: AudioTrackDef; crossfadeMs: number; intro?: AudioTrackDef } | null = null
  private volume = 0.7
  private muted = false
  private sfxVolume = 0.8
  private sfxMuted = false
  private ducked = false
  private unlocked = false

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(MASTER_KEY)
        if (raw) {
          const p = JSON.parse(raw) as { volume?: number; muted?: boolean; sfxVolume?: number; sfxMuted?: boolean }
          if (typeof p.volume === 'number') this.volume = Math.min(1, Math.max(0, p.volume))
          if (typeof p.muted === 'boolean') this.muted = p.muted
          if (typeof p.sfxVolume === 'number') this.sfxVolume = Math.min(1, Math.max(0, p.sfxVolume))
          if (typeof p.sfxMuted === 'boolean') this.sfxMuted = p.sfxMuted
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
      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = this.ducked ? DUCK_LEVEL : 1
      this.musicBus.connect(this.master)
      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = this.sfxMuted ? 0 : this.sfxVolume
      this.sfxBus.connect(this.ctx.destination)
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
      const { track, crossfadeMs, intro } = this.pending
      this.pending = null
      void this.play(track, { crossfadeMs, intro })
    }
  }

  currentTrackId(): string | null {
    return this.current?.id ?? null
  }

  getVolume(): number { return this.volume }
  isMuted(): boolean { return this.muted }
  getSfxVolume(): number { return this.sfxVolume }
  isSfxMuted(): boolean { return this.sfxMuted }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.min(1, Math.max(0, v))
    this.applySfx()
    this.persist()
  }

  setSfxMuted(m: boolean): void {
    this.sfxMuted = m
    this.applySfx()
    this.persist()
  }

  private applySfx(): void {
    if (this.ctx && this.sfxBus) {
      this.sfxBus.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.ctx.currentTime, 0.05)
    }
  }

  /** Duck the music bus (dialogue/inscription overlays). SFX stay full. */
  duck(on: boolean): void {
    this.ducked = on
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(on ? DUCK_LEVEL : 1, this.ctx.currentTime, 0.08)
    }
  }

  /** Fire a one-shot sound effect from the built-in kit. Safe pre-unlock
   *  (silently dropped) and outside the browser. */
  sfx(name: string): void {
    if (!(name in SFX_DEFS)) return
    if (!this.supported() || !this.unlocked) return
    const ctx = this.ensureCtx()
    if (!ctx || !this.sfxBus) return
    const cached = this.sfxBuffers.get(name)
    const fire = (buf: AudioBuffer) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.sfxBus!)
      src.start()
    }
    if (cached) { fire(cached); return }
    void renderSfx(name).then(buf => {
      if (!buf) return
      this.sfxBuffers.set(name, buf)
      fire(buf)
    })
  }

  /** Play an SFX AudioTrackDef one-shot — a built-in synth (id `sfx.<name>`),
   *  an uploaded blob, or a URL. Cached by track id, routed through the SFX
   *  bus so it ignores music ducking. */
  playSfxTrack(track: AudioTrackDef): void {
    if (!this.supported() || !this.unlocked) return
    const ctx = this.ensureCtx()
    if (!ctx || !this.sfxBus) return
    const fire = (buf: AudioBuffer) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.sfxBus!)
      src.start()
    }
    const cached = this.sfxBuffers.get(track.id)
    if (cached) { fire(cached); return }
    const load = async (): Promise<AudioBuffer | null> => {
      if (track.source === 'builtin') return renderSfx(track.id.replace(/^sfx\./, ''))
      const raw = await this.fetchArrayBuffer(track)
      return raw ? await ctx.decodeAudioData(raw) : null
    }
    void load().then(buf => {
      if (!buf) return
      this.sfxBuffers.set(track.id, buf)
      fire(buf)
    }).catch(() => { /* ignore */ })
  }

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
    try {
      window.localStorage.setItem(MASTER_KEY, JSON.stringify({
        volume: this.volume, muted: this.muted, sfxVolume: this.sfxVolume, sfxMuted: this.sfxMuted,
      }))
    } catch { /* ignore */ }
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
    let buf: AudioBuffer | null
    if (track.source === 'builtin') {
      const spec = chipSpecById(track.id)
      buf = spec ? await renderChip(spec) : null
    } else {
      const raw = await this.fetchArrayBuffer(track)
      buf = raw ? await ctx.decodeAudioData(raw) : null
    }
    if (!buf) return null
    this.buffers.set(track.id, buf)
    return buf
  }

  /**
   * Crossfade to `track` (looping). No-op if it is already the current track.
   * Before unlock the request is queued and starts on the next `unlock()`.
   * `opts.intro` plays a one-shot stinger first, chaining seamlessly into the
   * looping track (boss intros).
   */
  async play(track: AudioTrackDef, opts?: { crossfadeMs?: number; intro?: AudioTrackDef }): Promise<void> {
    const crossfadeMs = opts?.crossfadeMs ?? 800
    if (this.current?.id === track.id) return
    if (!this.supported()) return
    if (!this.unlocked) { this.pending = { track, crossfadeMs, intro: opts?.intro }; return }

    const ctx = this.ensureCtx()
    if (!ctx || !this.musicBus) return
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})

    let buffer: AudioBuffer | null
    let introBuffer: AudioBuffer | null = null
    try {
      buffer = await this.getBuffer(track)
      if (opts?.intro) introBuffer = await this.getBuffer(opts.intro)
    } catch { return }
    if (!buffer) return
    // A newer play() may have superseded us while decoding.
    if (this.pending || (this.current?.id === track.id)) return

    const now = ctx.currentTime
    const fade = crossfadeMs / 1000
    const target = Math.min(1, Math.max(0, track.volume ?? 1))

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + fade)
    gain.connect(this.musicBus)

    const sources: AudioBufferSourceNode[] = []
    const loopStart = introBuffer ? now + introBuffer.duration : now
    if (introBuffer) {
      const introSrc = ctx.createBufferSource()
      introSrc.buffer = introBuffer
      introSrc.connect(gain)
      introSrc.start(now)
      sources.push(introSrc)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = track.loop ?? true
    source.connect(gain)
    source.start(loopStart)
    sources.push(source)

    const prev = this.current
    this.current = { id: track.id, sources, gain }
    if (prev) {
      prev.gain.gain.cancelScheduledValues(now)
      prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), now)
      prev.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade)
      for (const src of prev.sources) { try { src.stop(now + fade + 0.05) } catch { /* already stopped */ } }
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
    for (const src of v.sources) { try { src.stop(now + fade + 0.05) } catch { /* already stopped */ } }
    this.current = null
  }
}

/** Process-wide singleton. */
export const music = new MusicController()
