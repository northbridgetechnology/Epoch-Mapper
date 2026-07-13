'use client'

import { useRef } from 'react'
import { Upload, Plus, Trash2, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MapData } from '@/lib/types'
import type { AudioTrackDef, GameMeta, OpeningStory } from '@/lib/engine-types'
import { toast } from 'sonner'
import { THEMES, getTheme } from '@/lib/themes'
import { fileToImageDataUri, IMAGE_ACCEPT_ATTR } from '@/lib/sprite-upload'

const OPENING_IMG_MAXDIM = 960
const OPENING_IMG_MAXBYTES = 1_500_000

interface SettingsWorkspaceProps {
  maps: MapData[]
  onThemeChange: (mapIdx: number, themeId: string) => void
  onDarkChange?: (mapIdx: number, dark: boolean) => void
  meta?: GameMeta
  onMetaChange?: (patch: Partial<GameMeta>) => void
  /** Audio tracks (from the ruleset) for the music pickers. */
  tracks?: AudioTrackDef[]
  onMusicChange?: (mapIdx: number, musicId: string | undefined) => void
  onCombatModeChange?: (mapIdx: number, mode: 'classic' | 'oneMore' | 'pressTurn') => void
}

const COMBAT_MODES: { id: 'classic' | 'oneMore' | 'pressTurn'; label: string; hint: string }[] = [
  { id: 'classic',   label: 'Classic',    hint: 'Speed-ordered round-robin.' },
  { id: 'oneMore',   label: '1-More',     hint: 'Persona-style: weakness or crit grants a bonus action.' },
  { id: 'pressTurn', label: 'Press-Turn', hint: 'SMT-style turn icons: weakness/crit press on, miss/null lose turns.' },
]

const MUSIC_SELECT = 'px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-amber-500/40'

function TrackSelect({ tracks, value, onChange, noneLabel = '— none —' }: {
  tracks: AudioTrackDef[]
  value: string | undefined
  onChange: (id: string | undefined) => void
  noneLabel?: string
}) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || undefined)} className={MUSIC_SELECT}>
      <option value="">{noneLabel}</option>
      {tracks.map(t => <option key={t.id} value={t.id}>{t.icon ?? '🎵'} {t.name}</option>)}
    </select>
  )
}

function MusicSettings({ meta, tracks, onMetaChange }: {
  meta: GameMeta
  tracks: AudioTrackDef[]
  onMetaChange: (patch: Partial<GameMeta>) => void
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white/70 mb-1">Music</h2>
      <p className="text-xs text-white/35 leading-relaxed mb-3">
        Looping background tracks. Build the track library in <span className="text-white/50">Database → Music</span>,
        then assign the default, battle, and boss themes here and per-level music below.
      </p>
      {tracks.length === 0 ? (
        <div className="text-xs text-white/30 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          No tracks yet — add some in Database → Music.
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/70">Default / title theme</span>
            <TrackSelect tracks={tracks} value={meta.defaultMusicId} onChange={id => onMetaChange({ defaultMusicId: id })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/70">Battle theme</span>
            <TrackSelect tracks={tracks} value={meta.battleMusicId} onChange={id => onMetaChange({ battleMusicId: id })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/70">Boss theme</span>
            <TrackSelect tracks={tracks} value={meta.bossMusicId} onChange={id => onMetaChange({ bossMusicId: id })} />
          </label>
        </div>
      )}
    </div>
  )
}

const RULE_INPUT = 'w-20 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-amber-500/40'

function GameRules({ meta, onMetaChange }: { meta: GameMeta; onMetaChange: (patch: Partial<GameMeta>) => void }) {
  const pct = (v: number | undefined, dflt: number) => Math.round((v ?? dflt) * 100)
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white/70 mb-1">Game Rules</h2>
        <p className="text-xs text-white/35 leading-relaxed">
          Survival-loop tuning: saving, camping, and what a party wipe costs.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Game title</span>
          <input type="text" value={meta.title} placeholder="Untitled Dungeon"
            onChange={e => onMetaChange({ title: e.target.value })}
            className="px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-amber-500/40" />
        </label>
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Author</span>
          <input type="text" value={meta.author ?? ''} placeholder="you"
            onChange={e => onMetaChange({ author: e.target.value || undefined })}
            className="px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-amber-500/40" />
        </label>
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Save policy</span>
          <select
            value={meta.savePolicy ?? 'anywhere'}
            onChange={e => onMetaChange({ savePolicy: e.target.value as 'anywhere' | 'savePoints' })}
            className="px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none"
          >
            <option value="anywhere">Anywhere</option>
            <option value="savePoints">Save points only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Wipe gold penalty (%)</span>
          <input type="number" min={0} max={100} value={pct(meta.wipeGoldPenalty, 0.5)}
            onChange={e => onMetaChange({ wipeGoldPenalty: Math.min(100, Math.max(0, e.target.valueAsNumber || 0)) / 100 })}
            className={RULE_INPUT} />
        </label>
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Rest ambush chance (%)</span>
          <input type="number" min={0} max={100} value={pct(meta.restAmbushChance, 0.25)}
            onChange={e => onMetaChange({ restAmbushChance: Math.min(100, Math.max(0, e.target.valueAsNumber || 0)) / 100 })}
            className={RULE_INPUT} />
        </label>
        <label className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={meta.permadeath}
            onChange={e => onMetaChange({ permadeath: e.target.checked })}
            className="h-4 w-4 rounded accent-red-500" />
          <span className="text-[11px] text-white/60 font-medium">💀 Permadeath</span>
          <span className="text-[10px] text-white/30">A wipe forfeits all saves.</span>
        </label>
      </div>
    </div>
  )
}

function StoryAndProtagonist({ meta, onMetaChange }: { meta: GameMeta; onMetaChange: (patch: Partial<GameMeta>) => void }) {
  const opening: OpeningStory = meta.opening ?? { slides: [] }
  const setOpening = (next: OpeningStory) =>
    onMetaChange({ opening: next.slides.length === 0 && next.skippable !== false ? undefined : next })
  const patchSlide = (i: number, p: Partial<{ text: string; image?: string }>) =>
    setOpening({ ...opening, slides: opening.slides.map((s, n) => (n === i ? { ...s, ...p } : s)) })
  const addSlide = () => setOpening({ ...opening, slides: [...opening.slides, { text: '' }] })
  const removeSlide = (i: number) => setOpening({ ...opening, slides: opening.slides.filter((_, n) => n !== i) })
  const moveSlide = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= opening.slides.length) return
    const next = [...opening.slides]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOpening({ ...opening, slides: next })
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white/70 mb-1">Story &amp; Protagonist</h2>
        <p className="text-xs text-white/35 leading-relaxed">
          The opening shown on New Game, and how the player&apos;s Main Character is made. Use
          <code className="text-amber-200/80"> {'{mc}'} </code> and pronoun tokens
          (<code className="text-amber-200/80">{'{they}'}</code>, <code className="text-amber-200/80">{'{their}'}</code>…)
          anywhere in dialogue, quests, story, and endings — they resolve to the hero.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Party creation</span>
          <select value={meta.partyCreation ?? 'customMc'}
            onChange={e => onMetaChange({ partyCreation: e.target.value as 'customMc' | 'fixed' })}
            className="px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none">
            <option value="customMc">Player builds the hero</option>
            <option value="fixed">Author ships the party</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Attributes</span>
          <select value={meta.attrMethod ?? 'pointBuy'}
            onChange={e => onMetaChange({ attrMethod: e.target.value as 'pointBuy' | 'fixed' })}
            className="px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80 focus:outline-none">
            <option value="pointBuy">Point-buy</option>
            <option value="fixed">Fixed (class/race only)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
          <span className="text-[11px] text-white/60 font-medium">Point-buy pool</span>
          <input type="number" min={0} max={99} value={meta.pointBuyPool ?? 10}
            onChange={e => onMetaChange({ pointBuyPool: Math.min(99, Math.max(0, e.target.valueAsNumber || 0)) })}
            className={RULE_INPUT} />
        </label>
        <label className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={!!meta.mcDeathEndsGame}
            onChange={e => onMetaChange({ mcDeathEndsGame: e.target.checked || undefined })}
            className="h-4 w-4 rounded accent-red-500" />
          <span className="text-[11px] text-white/60 font-medium">⚔️ MC death ends the game</span>
        </label>
      </div>

      <div className="rounded-lg border border-white/8 bg-white/4 px-3 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/60 font-medium">Opening story ({opening.slides.length} {opening.slides.length === 1 ? 'slide' : 'slides'})</span>
          <label className="flex items-center gap-1.5 text-[10px] text-white/40 cursor-pointer">
            <input type="checkbox" checked={opening.skippable !== false}
              onChange={e => setOpening({ ...opening, skippable: e.target.checked })}
              className="h-3.5 w-3.5 rounded accent-amber-500" />
            Skippable (Esc)
          </label>
        </div>
        {opening.slides.map((slide, i) => (
          <OpeningSlideRow key={i} slide={slide} index={i} count={opening.slides.length}
            onText={t => patchSlide(i, { text: t })}
            onImage={img => patchSlide(i, { image: img })}
            onMove={dir => moveSlide(i, dir)}
            onRemove={() => removeSlide(i)} />
        ))}
        <button onClick={addSlide}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-white/15 text-xs text-white/45 hover:text-white hover:border-white/30">
          <Plus className="w-3.5 h-3.5" /> Add slide
        </button>
      </div>
    </div>
  )
}

function OpeningSlideRow({ slide, index, count, onText, onImage, onMove, onRemove }: {
  slide: { text: string; image?: string }
  index: number
  count: number
  onText: (t: string) => void
  onImage: (img: string | undefined) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      onImage(await fileToImageDataUri(file, { maxDim: OPENING_IMG_MAXDIM, maxBytes: OPENING_IMG_MAXBYTES }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add that image.')
    }
  }
  return (
    <div className="flex gap-2 rounded-md border border-white/8 bg-zinc-900/50 p-2">
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <span className="text-[10px] font-mono text-white/30">{index + 1}</span>
        <button onClick={() => onMove(-1)} disabled={index === 0} className="text-white/30 hover:text-white disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} className="text-white/30 hover:text-white disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <textarea value={slide.text} onChange={e => onText(e.target.value)} rows={2}
          placeholder="A screen of the tale…"
          className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/85 placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 resize-none" />
        <div className="flex items-center gap-2">
          {slide.image
            ? (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70">
                <ImageIcon className="w-3.5 h-3.5" /> image set
                <button onClick={() => onImage(undefined)} className="text-white/30 hover:text-red-400">clear</button>
              </span>
            )
            : (
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white">
                <Upload className="w-3 h-3" /> add image
              </button>
            )}
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT_ATTR} className="hidden" onChange={onFile} />
        </div>
      </div>
      <button onClick={onRemove} className="self-start text-white/25 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}

export function SettingsWorkspace({ maps, onThemeChange, onDarkChange, meta, onMetaChange, tracks = [], onMusicChange, onCombatModeChange }: SettingsWorkspaceProps) {
  if (maps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
        No maps yet — create one in the Map workspace.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-8">
        {meta && onMetaChange && <GameRules meta={meta} onMetaChange={onMetaChange} />}
        {meta && onMetaChange && <StoryAndProtagonist meta={meta} onMetaChange={onMetaChange} />}
        {meta && onMetaChange && <MusicSettings meta={meta} tracks={tracks} onMetaChange={onMetaChange} />}
        <div>
          <h2 className="text-sm font-semibold text-white/70 mb-1">Visual Themes</h2>
          <p className="text-xs text-white/35 leading-relaxed">
            Each map can have its own visual theme — colours drive both the 2D editor and the first-person renderer.
          </p>
        </div>

        {maps.map((map, idx) => {
          const activeTheme = getTheme(map.theme)
          return (
            <div key={map.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  {map.name}
                </span>
                <span className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/25">{activeTheme.name}</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {THEMES.map(t => {
                  const active = t.id === activeTheme.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => onThemeChange(idx, t.id)}
                      title={t.description}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all',
                        active
                          ? 'border-white/30 bg-white/10 ring-1 ring-white/20'
                          : 'border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/8',
                      )}
                    >
                      {/* Mini preview swatch */}
                      <div
                        className="w-full rounded-md overflow-hidden"
                        style={{ aspectRatio: '4/3', background: t.fogColor }}
                      >
                        <div className="h-full flex flex-col">
                          {/* Ceiling strip */}
                          <div className="flex-1" style={{ background: `hsl(${t.ceilHue} ${t.ceilSat}% ${t.ceilLBase}%)` }} />
                          {/* Wall strip */}
                          <div className="flex-[2]" style={{ background: `hsl(${t.wallHue} ${t.wallSat}% ${t.wallLBase}%)` }} />
                          {/* Floor strip */}
                          <div className="flex-1" style={{ background: `hsl(${t.floorHue} ${t.floorSat}% ${t.floorLBase}%)` }} />
                        </div>
                      </div>

                      <span className="text-base leading-none">{t.icon}</span>
                      <span className={cn(
                        'text-[10px] font-medium leading-tight text-center',
                        active ? 'text-white/90' : 'text-white/50',
                      )}>
                        {t.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              {onDarkChange && (
                <label className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2 cursor-pointer hover:border-white/15">
                  <input
                    type="checkbox"
                    checked={!!map.dark}
                    onChange={e => onDarkChange(idx, e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  <span className="text-xs text-white/70">🌑 Dark map</span>
                  <span className="text-[10px] text-white/30">
                    View collapses to the party&apos;s light — torches, lanterns, and light magic matter here.
                  </span>
                </label>
              )}

              {onMusicChange && (
                <label className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
                  <span className="text-xs text-white/70">🎵 Level music</span>
                  <TrackSelect tracks={tracks} value={map.musicId} onChange={id => onMusicChange(idx, id)}
                    noneLabel={meta?.defaultMusicId ? '— use default —' : '— none —'} />
                  <span className="text-[10px] text-white/30">Loops while exploring this level.</span>
                </label>
              )}

              {onCombatModeChange && (
                <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
                  <span className="text-xs text-white/70">⚔️ Combat</span>
                  <div className="flex gap-1">
                    {COMBAT_MODES.map(m => {
                      const active = (map.combatMode ?? 'classic') === m.id
                      return (
                        <button key={m.id} onClick={() => onCombatModeChange(idx, m.id)} title={m.hint}
                          className={cn('px-2 py-0.5 rounded text-xs border transition-colors',
                            active ? 'bg-amber-600/25 border-amber-500/50 text-amber-200' : 'bg-zinc-800 border-white/10 text-white/45 hover:text-white/70')}>
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-[10px] text-white/30">{COMBAT_MODES.find(m => m.id === (map.combatMode ?? 'classic'))?.hint}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
