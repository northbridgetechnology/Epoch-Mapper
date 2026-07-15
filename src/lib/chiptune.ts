/**
 * Built-in chiptune library — 16 royalty-free 16-bit-style music loops plus a
 * boss-intro stinger and a small SFX kit, all synthesized from sequenced note
 * data. No audio assets: every track is composed deterministically from a
 * compact spec (key, mode, tempo, progression, style, seed) and rendered to an
 * AudioBuffer with OfflineAudioContext in the browser.
 *
 * The composition layer (specs → note events) is pure and runs in Node, so the
 * test suite can validate every track without a DOM. Only `renderChip` /
 * `renderSfx` touch Web Audio.
 */

// ── Composition model ───────────────────────────────────────────────────────────

export type ChipWave = 'square' | 'triangle' | 'sawtooth' | 'sine'
export type ChipStyle = 'calm' | 'march' | 'drive' | 'sparse' | 'fanfare' | 'dirge'

export interface ChipSpec {
  /** AudioTrackDef id ('chip.*'). */
  id: string
  name: string
  bpm: number
  /** Loop length in 4/4 bars. */
  bars: number
  /** MIDI root note of the key (e.g. 57 = A3). */
  root: number
  mode: 'major' | 'minor' | 'dorian' | 'phrygian'
  /** Scale degrees (0-based) of the chord root per bar, cycled over `bars`. */
  progression: number[]
  style: ChipStyle
  seed: number
}

/** One rendered note event (times/durations in seconds). */
export interface ChipEvent {
  time: number
  dur: number
  freq: number
  gain: number
  wave: ChipWave
}

/** One noise percussion hit. */
export interface ChipNoise {
  time: number
  dur: number
  gain: number
  /** 'low' = kick-ish thump, 'high' = hat-ish tick. */
  band: 'low' | 'high'
}

export interface ChipScore {
  events: ChipEvent[]
  noise: ChipNoise[]
  /** Exact loop duration in seconds. */
  duration: number
}

const MODES: Record<ChipSpec['mode'], number[]> = {
  major:    [0, 2, 4, 5, 7, 9, 11],
  minor:    [0, 2, 3, 5, 7, 8, 10],
  dorian:   [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** Scale degree (any integer, octaves wrap) → MIDI note. */
function degreeToMidi(root: number, mode: ChipSpec['mode'], degree: number): number {
  const scale = MODES[mode]
  const oct = Math.floor(degree / 7)
  const idx = ((degree % 7) + 7) % 7
  return root + oct * 12 + scale[idx]
}

/** Compose a spec into concrete note events. Pure and deterministic. */
export function composeChip(spec: ChipSpec): ChipScore {
  const rand = mulberry32(spec.seed)
  const beat = 60 / spec.bpm
  const barDur = beat * 4
  const duration = barDur * spec.bars
  const events: ChipEvent[] = []
  const noise: ChipNoise[] = []
  const deg = (bar: number) => spec.progression[bar % spec.progression.length]
  const s = spec.style

  for (let bar = 0; bar < spec.bars; bar++) {
    const t0 = bar * barDur
    const chordDeg = deg(bar)
    const chord = [chordDeg, chordDeg + 2, chordDeg + 4] // triad in scale degrees

    // ── Bass — root motion sets the pulse ──
    const bassMidi = degreeToMidi(spec.root, spec.mode, chordDeg) - 12
    const bassSteps = s === 'drive' ? 8 : s === 'march' ? 4 : s === 'dirge' ? 1 : 2
    for (let i = 0; i < bassSteps; i++) {
      const alt = s === 'drive' && i % 2 === 1 ? 12 : 0 // octave bounce when driving
      events.push({
        time: t0 + (i * barDur) / bassSteps,
        dur: (barDur / bassSteps) * 0.85,
        freq: midiHz(bassMidi + alt),
        gain: s === 'dirge' ? 0.16 : 0.14,
        wave: 'triangle',
      })
    }

    // ── Pad — held chord tones for the gentle styles ──
    if (s === 'calm' || s === 'sparse' || s === 'dirge') {
      for (const [k, d] of chord.entries()) {
        events.push({
          time: t0,
          dur: barDur * 0.98,
          freq: midiHz(degreeToMidi(spec.root, spec.mode, d)),
          gain: 0.035 - k * 0.005,
          wave: 'sine',
        })
      }
    }

    // ── Lead — style-shaped melody over the chord ──
    if (s === 'fanfare') {
      // Arpeggio bursts up the triad, cadence hold on the last bar.
      const last = bar === spec.bars - 1
      const notes = last ? [chord[0] + 7] : [chord[0], chord[1], chord[2], chord[0] + 7]
      const step = barDur / (last ? 1 : 4)
      notes.forEach((d, i) => {
        events.push({
          time: t0 + i * step,
          dur: step * (last ? 0.95 : 0.6),
          freq: midiHz(degreeToMidi(spec.root, spec.mode, d) + 12),
          gain: 0.11,
          wave: 'square',
        })
      })
    } else if (s !== 'dirge' || bar % 2 === 1) {
      // Rhythm grid by style; seeded random walk over chord + passing tones.
      const slots = s === 'drive' ? 8 : s === 'march' ? 6 : s === 'sparse' ? 3 : 4
      const density = s === 'sparse' ? 0.55 : s === 'calm' ? 0.7 : 0.85
      let cursor = chord[Math.floor(rand() * 3)] + 7
      for (let i = 0; i < slots; i++) {
        if (rand() > density) continue
        const move = rand()
        cursor += move < 0.3 ? -1 : move < 0.6 ? 1 : move < 0.75 ? 2 : move < 0.85 ? -2 : 0
        // Pull back toward the chord's octave-up root when straying far.
        if (cursor > chord[0] + 12) cursor -= 3
        if (cursor < chord[0] + 3) cursor += 2
        const onChord = i === 0 || rand() < 0.4
        const d = onChord ? chord[Math.floor(rand() * 3)] + 7 : cursor
        events.push({
          time: t0 + (i * barDur) / slots,
          dur: (barDur / slots) * (s === 'calm' ? 0.9 : 0.7),
          freq: midiHz(degreeToMidi(spec.root, spec.mode, d) + 12),
          gain: s === 'dirge' ? 0.06 : 0.085,
          wave: s === 'drive' || s === 'march' ? 'square' : 'square',
        })
        cursor = d
      }
    }

    // ── Percussion — noise kit for the rhythmic styles ──
    if (s === 'drive' || s === 'march') {
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) noise.push({ time: t0 + i * beat, dur: 0.09, gain: 0.09, band: 'low' })
        else noise.push({ time: t0 + i * beat, dur: 0.05, gain: 0.05, band: 'high' })
      }
      if (s === 'drive') for (let i = 0; i < 8; i++) {
        noise.push({ time: t0 + (i * barDur) / 8, dur: 0.025, gain: 0.028, band: 'high' })
      }
    } else if (s === 'sparse' && bar % 2 === 0) {
      noise.push({ time: t0, dur: 0.1, gain: 0.05, band: 'low' })
    }
  }

  return { events, noise, duration }
}

// ── The built-in library — 16 tracks + a boss-intro stinger ────────────────────

export const CHIP_TRACKS: ChipSpec[] = [
  { id: 'chip.title',      name: 'Title Theme',      bpm: 96,  bars: 8, root: 60, mode: 'major',    progression: [0, 5, 3, 4],       style: 'calm',    seed: 101 },
  { id: 'chip.overworld',  name: 'Overworld March',  bpm: 112, bars: 8, root: 62, mode: 'major',    progression: [0, 3, 4, 0],       style: 'march',   seed: 202 },
  { id: 'chip.town',       name: 'Town Square',      bpm: 100, bars: 8, root: 64, mode: 'major',    progression: [0, 4, 5, 3],       style: 'calm',    seed: 303 },
  { id: 'chip.shop',       name: 'Curio Shop',       bpm: 108, bars: 8, root: 62, mode: 'dorian',   progression: [0, 3, 0, 4],       style: 'march',   seed: 404 },
  { id: 'chip.dungeon',    name: 'Dungeon Depths',   bpm: 84,  bars: 8, root: 57, mode: 'minor',    progression: [0, 5, 2, 6],       style: 'sparse',  seed: 505 },
  { id: 'chip.cavern',     name: 'Echoing Cavern',   bpm: 76,  bars: 8, root: 55, mode: 'phrygian', progression: [0, 1, 0, 6],       style: 'sparse',  seed: 606 },
  { id: 'chip.crypt',      name: 'Sunken Crypt',     bpm: 66,  bars: 8, root: 53, mode: 'minor',    progression: [0, 3, 5, 6],       style: 'dirge',   seed: 707 },
  { id: 'chip.forest',     name: 'Verdant Forest',   bpm: 92,  bars: 8, root: 64, mode: 'dorian',   progression: [0, 2, 3, 4],       style: 'calm',    seed: 808 },
  { id: 'chip.sanctuary',  name: 'Sanctuary',        bpm: 72,  bars: 8, root: 65, mode: 'major',    progression: [0, 3, 0, 4],       style: 'calm',    seed: 909 },
  { id: 'chip.mystery',    name: 'Veiled Mystery',   bpm: 80,  bars: 8, root: 59, mode: 'phrygian', progression: [0, 1, 3, 1],       style: 'sparse',  seed: 111 },
  { id: 'chip.tension',    name: 'Rising Tension',   bpm: 120, bars: 8, root: 57, mode: 'minor',    progression: [0, 0, 5, 6],       style: 'drive',   seed: 222 },
  { id: 'chip.battle',     name: 'Battle!',          bpm: 148, bars: 8, root: 57, mode: 'minor',    progression: [0, 6, 5, 6],       style: 'drive',   seed: 333 },
  { id: 'chip.boss',       name: 'Boss Battle',      bpm: 160, bars: 8, root: 55, mode: 'phrygian', progression: [0, 1, 0, 6],       style: 'drive',   seed: 444 },
  { id: 'chip.victory',    name: 'Victory Fanfare',  bpm: 132, bars: 4, root: 60, mode: 'major',    progression: [0, 3, 4, 0],       style: 'fanfare', seed: 555 },
  { id: 'chip.gameover',   name: 'Game Over',        bpm: 56,  bars: 4, root: 52, mode: 'minor',    progression: [0, 5, 3, 0],       style: 'dirge',   seed: 666 },
  { id: 'chip.ending',     name: 'Ending Credits',   bpm: 88,  bars: 8, root: 60, mode: 'major',    progression: [0, 5, 1, 4],       style: 'calm',    seed: 777 },
]

/** Short pre-boss stinger (played once, then the boss loop enters). */
export const CHIP_BOSS_INTRO: ChipSpec =
  { id: 'chip.boss_intro', name: 'Boss Intro (Stinger)', bpm: 100, bars: 2, root: 55, mode: 'phrygian', progression: [0, 1], style: 'fanfare', seed: 888 }

const ALL_SPECS = [...CHIP_TRACKS, CHIP_BOSS_INTRO]

export function chipSpecById(id: string): ChipSpec | undefined {
  return ALL_SPECS.find(t => t.id === id)
}

export function isBuiltinTrackId(id: string): boolean {
  return ALL_SPECS.some(t => t.id === id)
}

// ── SFX kit ─────────────────────────────────────────────────────────────────────

/** One synthesis segment of a sound effect. */
export interface SfxSeg {
  wave: ChipWave | 'noise'
  /** Start/end frequency (Hz); noise ignores it (uses band filtering feel via dur). */
  f0: number
  f1?: number
  /** Offset from the effect start (s). */
  at?: number
  dur: number
  gain: number
}

export const SFX_DEFS: Record<string, SfxSeg[]> = {
  blip:     [{ wave: 'square', f0: 880, f1: 1320, dur: 0.06, gain: 0.12 }],
  confirm:  [{ wave: 'square', f0: 660, f1: 990, dur: 0.05, gain: 0.1 }, { wave: 'square', f0: 990, f1: 1320, at: 0.06, dur: 0.08, gain: 0.1 }],
  door:     [{ wave: 'noise', f0: 0, dur: 0.22, gain: 0.1 }, { wave: 'triangle', f0: 110, f1: 70, dur: 0.25, gain: 0.08 }],
  locked:   [{ wave: 'square', f0: 220, f1: 180, dur: 0.09, gain: 0.1 }, { wave: 'square', f0: 200, f1: 160, at: 0.12, dur: 0.09, gain: 0.1 }],
  lever:    [{ wave: 'square', f0: 300, f1: 220, dur: 0.06, gain: 0.09 }, { wave: 'noise', f0: 0, at: 0.07, dur: 0.08, gain: 0.06 }],
  chest:    [{ wave: 'triangle', f0: 523, f1: 659, dur: 0.09, gain: 0.1 }, { wave: 'triangle', f0: 784, f1: 1046, at: 0.1, dur: 0.16, gain: 0.1 }],
  hit:      [{ wave: 'noise', f0: 0, dur: 0.08, gain: 0.11 }, { wave: 'square', f0: 180, f1: 90, dur: 0.09, gain: 0.09 }],
  crit:     [{ wave: 'noise', f0: 0, dur: 0.12, gain: 0.13 }, { wave: 'sawtooth', f0: 300, f1: 60, dur: 0.16, gain: 0.11 }],
  heal:     [{ wave: 'sine', f0: 523, f1: 784, dur: 0.14, gain: 0.09 }, { wave: 'sine', f0: 784, f1: 1046, at: 0.12, dur: 0.2, gain: 0.08 }],
  spell:    [{ wave: 'sawtooth', f0: 440, f1: 1760, dur: 0.22, gain: 0.07 }, { wave: 'sine', f0: 1760, f1: 880, at: 0.2, dur: 0.12, gain: 0.06 }],
  levelup:  [{ wave: 'square', f0: 523, dur: 0.09, gain: 0.1 }, { wave: 'square', f0: 659, at: 0.09, dur: 0.09, gain: 0.1 }, { wave: 'square', f0: 784, at: 0.18, dur: 0.09, gain: 0.1 }, { wave: 'square', f0: 1046, at: 0.27, dur: 0.2, gain: 0.11 }],
  save:     [{ wave: 'sine', f0: 660, f1: 880, dur: 0.12, gain: 0.09 }, { wave: 'sine', f0: 880, f1: 660, at: 0.14, dur: 0.12, gain: 0.08 }],
}

export type SfxName = keyof typeof SFX_DEFS

// ── Rendering (browser-only) ────────────────────────────────────────────────────

const RATE = 44100

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext

function offlineCtx(seconds: number): OfflineAudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = (window.OfflineAudioContext
    ?? (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext) as OfflineCtor | undefined
  if (!Ctor) return null
  return new Ctor(2, Math.max(1, Math.ceil(seconds * RATE)), RATE)
}

function noiseBuffer(ctx: OfflineAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(seconds * RATE)), RATE)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** Render one composed track to an AudioBuffer. Returns null outside a browser. */
export async function renderChip(spec: ChipSpec): Promise<AudioBuffer | null> {
  const score = composeChip(spec)
  const ctx = offlineCtx(score.duration)
  if (!ctx) return null

  for (const ev of score.events) {
    const osc = ctx.createOscillator()
    osc.type = ev.wave
    osc.frequency.value = ev.freq
    const g = ctx.createGain()
    const a = Math.min(0.012, ev.dur * 0.2)
    g.gain.setValueAtTime(0.0001, ev.time)
    g.gain.linearRampToValueAtTime(ev.gain, ev.time + a)
    g.gain.setValueAtTime(ev.gain, Math.max(ev.time + a, ev.time + ev.dur * 0.7))
    g.gain.linearRampToValueAtTime(0.0001, ev.time + ev.dur)
    osc.connect(g).connect(ctx.destination)
    osc.start(ev.time)
    osc.stop(ev.time + ev.dur + 0.02)
  }

  for (const n of score.noise) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, n.dur)
    const filt = ctx.createBiquadFilter()
    filt.type = n.band === 'low' ? 'lowpass' : 'highpass'
    filt.frequency.value = n.band === 'low' ? 220 : 5000
    const g = ctx.createGain()
    g.gain.setValueAtTime(n.gain, n.time)
    g.gain.linearRampToValueAtTime(0.0001, n.time + n.dur)
    src.connect(filt).connect(g).connect(ctx.destination)
    src.start(n.time)
  }

  return ctx.startRendering()
}

/** Render one SFX to an AudioBuffer. Returns null outside a browser. */
export async function renderSfx(name: string): Promise<AudioBuffer | null> {
  const segs = SFX_DEFS[name]
  if (!segs) return null
  const total = Math.max(...segs.map(sg => (sg.at ?? 0) + sg.dur)) + 0.05
  const ctx = offlineCtx(total)
  if (!ctx) return null

  for (const sg of segs) {
    const at = sg.at ?? 0
    const g = ctx.createGain()
    g.gain.setValueAtTime(sg.gain, at)
    g.gain.linearRampToValueAtTime(0.0001, at + sg.dur)
    if (sg.wave === 'noise') {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, sg.dur)
      src.connect(g).connect(ctx.destination)
      src.start(at)
    } else {
      const osc = ctx.createOscillator()
      osc.type = sg.wave
      osc.frequency.setValueAtTime(sg.f0, at)
      if (sg.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sg.f1), at + sg.dur)
      osc.connect(g).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + sg.dur + 0.02)
    }
  }

  return ctx.startRendering()
}
