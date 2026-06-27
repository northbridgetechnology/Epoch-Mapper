'use client'

import { useEffect, useRef, useState } from 'react'
import { Swords, Wind, SkipForward, Trophy, Skull, CheckCircle, Wand2, X, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type CombatState,
  type CombatActor,
  resolvePlayerAttack,
  resolvePlayerCast,
  resolvePlayerFlee,
  resolveEnemyTurn,
} from '@/lib/combat-engine'
import type { Character, Ruleset, SpellDef } from '@/lib/engine-types'

interface CombatScreenProps {
  state: CombatState
  ruleset: Ruleset
  party: Character[]
  onAction: (next: CombatState) => void
  onClose: () => void
}

// ── Local interaction mode ────────────────────────────────────────────────────

type CombatMode =
  | { kind: 'default' }
  | { kind: 'attack_target' }
  | { kind: 'spell_select' }
  | { kind: 'spell_target'; spell: SpellDef }
  | { kind: 'ally_target'; spell: SpellDef }

// ── HP/MP bars ────────────────────────────────────────────────────────────────

function ResourceBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-300', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Actor row ─────────────────────────────────────────────────────────────────

function ActorRow({
  actor, isActive, isTargetable, isCursor, targetLabel, showMp, onTarget,
}: {
  actor: CombatActor
  isActive: boolean
  isTargetable: boolean
  isCursor?: boolean
  targetLabel?: string
  showMp?: boolean
  onTarget?: () => void
}) {
  const hpPct = actor.maxHp > 0 ? actor.hp / actor.maxHp : 0
  const hpColor = !actor.alive || actor.hp === 0
    ? 'bg-zinc-600'
    : hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
        !actor.alive && 'opacity-40',
        isActive && 'ring-1 ring-amber-400/60',
        isCursor && actor.alive && 'ring-2 ring-sky-400/70',
        isTargetable && actor.alive
          ? 'border-sky-500/50 bg-sky-950/30 hover:bg-sky-900/40 cursor-pointer'
          : 'border-white/10 bg-zinc-900/60',
      )}
      onClick={isTargetable && actor.alive ? onTarget : undefined}
    >
      <span className="text-xl w-7 text-center flex-shrink-0 leading-none">
        {actor.icon ?? (actor.kind === 'enemy' ? '👾' : '🧑')}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-semibold truncate flex-1', actor.alive ? 'text-white/90' : 'text-white/30 line-through')}>
            {actor.name}
          </span>
          {actor.statuses.length > 0 && (
            <div className="flex gap-0.5">
              {actor.statuses.map(s => (
                <span key={s.def} className="text-[10px]" title={`${s.def} (${s.remaining}t)`}>
                  {s.def.includes('poison') ? '☠️' : s.def.includes('sleep') ? '💤' : s.def.includes('regen') ? '💚' : '✦'}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] text-red-400/60 w-4 flex-shrink-0">HP</span>
          <ResourceBar value={actor.hp} max={actor.maxHp} colorClass={hpColor} />
          <span className={cn('text-[9px] tabular-nums w-14 text-right flex-shrink-0', actor.alive ? 'text-white/40' : 'text-white/20')}>
            {actor.alive ? `${actor.hp}/${actor.maxHp}` : 'KO'}
          </span>
        </div>
        {showMp && actor.maxMp > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] text-sky-400/60 w-4 flex-shrink-0">MP</span>
            <ResourceBar value={actor.mp} max={actor.maxMp} colorClass="bg-sky-500" />
            <span className="text-[9px] tabular-nums text-white/40 w-14 text-right flex-shrink-0">
              {actor.mp}/{actor.maxMp}
            </span>
          </div>
        )}
      </div>
      {isTargetable && actor.alive && (
        <div className="text-xs flex-shrink-0">
          {isCursor ? <span className="text-sky-300">▶</span> : <span className="text-sky-400/60">{targetLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ── Combat log ────────────────────────────────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  damage:    'text-white/70',
  crit:      'text-amber-300',
  miss:      'text-white/40 italic',
  flee:      'text-sky-400',
  flee_fail: 'text-orange-400',
  info:      'text-white/50',
  spell:     'text-violet-300',
}

// ── Spell picker ──────────────────────────────────────────────────────────────

function SpellPicker({
  spells, actorMp, cursorIdx, onPick, onCancel,
}: {
  spells: SpellDef[]
  actorMp: number
  cursorIdx: number
  onPick: (spell: SpellDef) => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Choose Spell</span>
        <button onClick={onCancel} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
      </div>
      {spells.length === 0 && (
        <div className="text-xs text-white/30 text-center py-3">No combat spells known</div>
      )}
      {spells.map((spell, idx) => {
        const canCast = actorMp >= spell.mpCost
        const isSelected = idx === cursorIdx
        return (
          <button
            key={spell.id}
            disabled={!canCast}
            onClick={() => onPick(spell)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors',
              canCast
                ? 'border-white/15 hover:border-violet-400/40 hover:bg-violet-950/30 cursor-pointer'
                : 'border-white/8 opacity-40 cursor-not-allowed',
              isSelected && canCast && 'border-sky-400/50 bg-sky-950/20 ring-1 ring-sky-400/30',
            )}
          >
            <span className="text-lg leading-none w-6 text-center flex-shrink-0">{spell.icon ?? '✨'}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white/80 truncate">{spell.name}</div>
              <div className="text-[10px] text-white/40">{spell.school} · {spell.target}</div>
            </div>
            <div className={cn('text-xs font-mono flex-shrink-0', canCast ? 'text-sky-400' : 'text-white/30')}>
              {spell.mpCost} MP
            </div>
            {isSelected && canCast && <span className="text-sky-300 text-xs flex-shrink-0">▶</span>}
          </button>
        )
      })}
      <div className="text-[9px] text-white/20 text-center font-mono pt-1">↑↓ navigate · ↵ confirm · Esc back</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CombatScreen({ state, ruleset, party, onAction, onClose }: CombatScreenProps) {
  const [mode, setMode] = useState<CombatMode>({ kind: 'default' })
  const [cursor, setCursor] = useState(0)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Reset mode when phase leaves player_action
  useEffect(() => {
    if (state.phase !== 'player_action') setMode({ kind: 'default' })
  }, [state.phase])

  // Reset cursor when mode changes
  useEffect(() => { setCursor(0) }, [mode.kind])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log.length])

  // Auto-resolve enemy turns
  useEffect(() => {
    if (state.phase !== 'enemy_turn') return
    const timer = setTimeout(() => {
      onAction(resolveEnemyTurn(state, ruleset, Math.random))
    }, 750)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.turnIdx])

  const enemies = state.actors.filter(a => a.kind === 'enemy')
  const partyActors = state.actors.filter(a => a.kind === 'party')
  const currentActor = state.actors[state.turnIdx]
  const visibleLog = state.log.slice(-6)
  const isTerminal = state.phase === 'victory' || state.phase === 'defeat' || state.phase === 'fled'

  const castableSpells: SpellDef[] = (() => {
    if (!currentActor || currentActor.kind !== 'party') return []
    const char = party[currentActor.idx]
    if (!char) return []
    return (char.knownSpells ?? [])
      .map(id => ruleset.spells.find(s => s.id === id))
      .filter((s): s is SpellDef => !!s && s.inCombat)
  })()

  const aliveEnemyIdxs = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'enemy' && a.alive).map(({ i }) => i)
  const aliveAllyIdxs  = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'party' && a.alive).map(({ i }) => i)

  function handleSpellPick(spell: SpellDef) {
    switch (spell.target) {
      case 'self': {
        onAction(resolvePlayerCast(state, spell.id, [state.turnIdx], ruleset, Math.random))
        setMode({ kind: 'default' })
        break
      }
      case 'allEnemies':
      case 'enemyRow': {
        const idxs = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'enemy' && a.alive).map(({ i }) => i)
        onAction(resolvePlayerCast(state, spell.id, idxs, ruleset, Math.random))
        setMode({ kind: 'default' })
        break
      }
      case 'allAllies': {
        const idxs = state.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'party' && a.alive).map(({ i }) => i)
        onAction(resolvePlayerCast(state, spell.id, idxs, ruleset, Math.random))
        setMode({ kind: 'default' })
        break
      }
      case 'enemy':
        setMode({ kind: 'spell_target', spell })
        break
      case 'ally':
        setMode({ kind: 'ally_target', spell })
        break
      default:
        onAction(resolvePlayerCast(state, spell.id, [], ruleset, Math.random))
        setMode({ kind: 'default' })
    }
  }

  // Keyboard navigation — use a ref so the handler always sees fresh state
  const kbRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  kbRef.current = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName ?? '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (isTerminal) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose() }
      return
    }
    if (state.phase === 'enemy_turn' || state.phase !== 'player_action') return

    const numDefaultActions = 2 + (castableSpells.length > 0 ? 1 : 0)
    const fleeActionIdx = castableSpells.length > 0 ? 2 : 1

    if (mode.kind === 'default') {
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); setCursor(c => Math.min(numDefaultActions - 1, c + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); setCursor(c => Math.max(0, c - 1))
      } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        const c = Math.min(cursor, numDefaultActions - 1)
        if (c === 0) setMode({ kind: 'attack_target' })
        else if (c === 1 && castableSpells.length > 0) setMode({ kind: 'spell_select' })
        else onAction(resolvePlayerFlee(state, ruleset, Math.random))
      } else if (e.key === '1') {
        e.preventDefault(); setMode({ kind: 'attack_target' })
      } else if (e.key === '2' && castableSpells.length > 0) {
        e.preventDefault(); setMode({ kind: 'spell_select' })
      } else if (e.key === '3' || (e.key === '2' && castableSpells.length === 0)) {
        e.preventDefault(); onAction(resolvePlayerFlee(state, ruleset, Math.random))
      }
    }

    else if (mode.kind === 'attack_target' || mode.kind === 'spell_target') {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault(); setMode({ kind: 'default' })
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); setCursor(c => Math.min(aliveEnemyIdxs.length - 1, c + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); setCursor(c => Math.max(0, c - 1))
      } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        const targetIdx = aliveEnemyIdxs[Math.min(cursor, aliveEnemyIdxs.length - 1)]
        if (targetIdx !== undefined) {
          if (mode.kind === 'attack_target') {
            onAction(resolvePlayerAttack(state, targetIdx, ruleset, Math.random))
          } else {
            onAction(resolvePlayerCast(state, mode.spell.id, [targetIdx], ruleset, Math.random))
          }
          setMode({ kind: 'default' })
        }
      }
    }

    else if (mode.kind === 'ally_target') {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault(); setMode({ kind: 'spell_select' })
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); setCursor(c => Math.min(aliveAllyIdxs.length - 1, c + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); setCursor(c => Math.max(0, c - 1))
      } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        const targetIdx = aliveAllyIdxs[Math.min(cursor, aliveAllyIdxs.length - 1)]
        if (targetIdx !== undefined) {
          onAction(resolvePlayerCast(state, mode.spell.id, [targetIdx], ruleset, Math.random))
          setMode({ kind: 'default' })
        }
      }
    }

    else if (mode.kind === 'spell_select') {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault(); setMode({ kind: 'default' })
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); setCursor(c => Math.min(castableSpells.length - 1, c + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); setCursor(c => Math.max(0, c - 1))
      } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        const spell = castableSpells[Math.min(cursor, castableSpells.length - 1)]
        if (spell && currentActor && currentActor.mp >= spell.mpCost) handleSpellPick(spell)
      } else if (e.key >= '1' && e.key <= '9') {
        const spell = castableSpells[parseInt(e.key) - 1]
        if (spell && currentActor && currentActor.mp >= spell.mpCost) handleSpellPick(spell)
      }
    }

    // suppress unused warning
    void fleeActionIdx
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => kbRef.current?.(e)
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  const isAttackTargeting = mode.kind === 'attack_target'
  const isSpellTargeting  = mode.kind === 'spell_target' || mode.kind === 'ally_target'

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col gap-0 rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/60">
          <div className="flex items-center gap-2 text-sm font-bold text-white/80">
            <Swords className="w-4 h-4 text-red-400" />
            Battle
          </div>
          <div className="text-xs text-white/30">
            {state.phase === 'player_action' && currentActor && mode.kind === 'default'       && `${currentActor.name}'s turn`}
            {state.phase === 'player_action' && mode.kind === 'attack_target'                 && 'Choose enemy to attack'}
            {state.phase === 'player_action' && mode.kind === 'spell_select'                  && 'Choose a spell'}
            {state.phase === 'player_action' && mode.kind === 'spell_target'                  && `Target for ${mode.spell.name}`}
            {state.phase === 'player_action' && mode.kind === 'ally_target'                   && `Cast ${mode.spell.name} on ally`}
            {state.phase === 'enemy_turn'    && currentActor                                  && `${currentActor.name} is acting…`}
            {state.phase === 'victory' && '✓ Victory!'}
            {state.phase === 'defeat'  && '✗ Defeated'}
            {state.phase === 'fled'    && 'Escaped!'}
          </div>
        </div>

        {/* Enemies */}
        <div className="px-3 pt-3 pb-1 space-y-1.5">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 mb-1">Enemies</div>
          {enemies.map((actor) => {
            const actorIdx    = state.actors.indexOf(actor)
            const targetable  = isAttackTargeting || mode.kind === 'spell_target'
            const label       = isAttackTargeting ? 'Attack' : mode.kind === 'spell_target' ? 'Cast' : undefined
            const alivePos    = aliveEnemyIdxs.indexOf(actorIdx)
            const isCursor    = targetable && alivePos === cursor && actor.alive
            return (
              <ActorRow
                key={actorIdx}
                actor={actor}
                isActive={state.turnIdx === actorIdx}
                isTargetable={targetable}
                isCursor={isCursor}
                targetLabel={label}
                onTarget={() => {
                  if (isAttackTargeting) {
                    setMode({ kind: 'default' })
                    onAction(resolvePlayerAttack(state, actorIdx, ruleset, Math.random))
                  } else if (mode.kind === 'spell_target') {
                    const spell = mode.spell
                    setMode({ kind: 'default' })
                    onAction(resolvePlayerCast(state, spell.id, [actorIdx], ruleset, Math.random))
                  }
                }}
              />
            )
          })}
        </div>

        {/* Log */}
        <div className="mx-3 my-2 rounded-lg bg-black/40 border border-white/8 px-3 py-2 min-h-[72px] max-h-[96px] overflow-y-auto">
          {visibleLog.map((entry, i) => (
            <div key={i} className={cn('text-xs leading-5', LOG_COLORS[entry.kind] ?? 'text-white/50')}>
              {entry.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Party */}
        <div className="px-3 pb-2 space-y-1.5">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 mb-1">Party</div>
          {partyActors.map((actor) => {
            const actorIdx    = state.actors.indexOf(actor)
            const allyTargetable = mode.kind === 'ally_target'
            const alivePos    = aliveAllyIdxs.indexOf(actorIdx)
            const isCursor    = allyTargetable && alivePos === cursor && actor.alive
            return (
              <ActorRow
                key={actorIdx}
                actor={actor}
                isActive={state.turnIdx === actorIdx}
                isTargetable={allyTargetable}
                isCursor={isCursor}
                targetLabel={allyTargetable ? 'Cast' : undefined}
                showMp
                onTarget={() => {
                  if (mode.kind === 'ally_target') {
                    const spell = mode.spell
                    setMode({ kind: 'default' })
                    onAction(resolvePlayerCast(state, spell.id, [actorIdx], ruleset, Math.random))
                  }
                }}
              />
            )
          })}
        </div>

        {/* Action bar */}
        <div className="px-3 pb-3 pt-1 border-t border-white/10">
          {state.phase === 'player_action' && mode.kind === 'default' && (() => {
            const fleeIdx = castableSpells.length > 0 ? 2 : 1
            return (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode({ kind: 'attack_target' })}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors',
                      cursor === 0 && 'ring-2 ring-amber-300/60',
                    )}
                  >
                    {cursor === 0 && <span className="text-amber-200 text-xs leading-none">▶</span>}
                    <Swords className="w-4 h-4" />
                    Attack
                    <span className="text-[9px] text-white/35 ml-auto tabular-nums">[1]</span>
                  </button>
                  {castableSpells.length > 0 && (
                    <button
                      onClick={() => setMode({ kind: 'spell_select' })}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-violet-800 hover:bg-violet-700 text-white font-semibold text-sm transition-colors',
                        cursor === 1 && 'ring-2 ring-amber-300/60',
                      )}
                    >
                      {cursor === 1 && <span className="text-amber-200 text-xs leading-none">▶</span>}
                      <Wand2 className="w-4 h-4" />
                      Cast
                      <span className="text-[9px] text-white/35 ml-auto tabular-nums">[2]</span>
                    </button>
                  )}
                  <button
                    onClick={() => onAction(resolvePlayerFlee(state, ruleset, Math.random))}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/70 font-semibold text-sm transition-colors border border-white/10',
                      cursor === fleeIdx && 'ring-2 ring-amber-300/60',
                    )}
                  >
                    {cursor === fleeIdx && <span className="text-amber-200 text-xs leading-none">▶</span>}
                    <Wind className="w-4 h-4" />
                    Flee
                    <span className="text-[9px] text-white/35 ml-auto tabular-nums">[{fleeIdx + 1}]</span>
                  </button>
                </div>
                <div className="text-[9px] text-white/20 text-center font-mono">↑↓ select · ↵ / Z confirm · 1–{fleeIdx + 1} shortcut</div>
              </div>
            )
          })()}

          {state.phase === 'player_action' && mode.kind === 'spell_select' && (
            <SpellPicker
              spells={castableSpells}
              actorMp={currentActor?.mp ?? 0}
              cursorIdx={cursor}
              onPick={handleSpellPick}
              onCancel={() => setMode({ kind: 'default' })}
            />
          )}

          {state.phase === 'player_action' && (mode.kind === 'attack_target' || isSpellTargeting) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-sky-300/80">
                  {mode.kind === 'attack_target' && 'Select enemy to attack'}
                  {mode.kind === 'spell_target'  && `Select enemy for ${mode.spell.name}`}
                  {mode.kind === 'ally_target'   && `Select ally for ${mode.spell.name}`}
                </span>
                <button
                  onClick={() => setMode({ kind: 'default' })}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:bg-white/10 border border-white/10"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>
              <div className="text-[9px] text-white/20 text-center font-mono">↑↓ select · ↵ / Z confirm · Esc back</div>
            </div>
          )}

          {state.phase === 'enemy_turn' && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/40">
              <SkipForward className="w-4 h-4 animate-pulse" />
              <span>Enemies acting…</span>
            </div>
          )}

          {isTerminal && (
            <div className={cn(
              'rounded-xl border p-4 text-center space-y-2',
              state.phase === 'victory' ? 'border-emerald-500/30 bg-emerald-950/30' :
              state.phase === 'defeat'  ? 'border-red-500/30 bg-red-950/30' :
              'border-sky-500/30 bg-sky-950/30',
            )}>
              <div className="flex items-center justify-center gap-2">
                {state.phase === 'victory' && <Trophy className="w-5 h-5 text-amber-400" />}
                {state.phase === 'defeat'  && <Skull  className="w-5 h-5 text-red-400"   />}
                {state.phase === 'fled'    && <Wind   className="w-5 h-5 text-sky-400"   />}
                <span className={cn(
                  'font-bold text-base',
                  state.phase === 'victory' ? 'text-emerald-300' :
                  state.phase === 'defeat'  ? 'text-red-300' : 'text-sky-300',
                )}>
                  {state.phase === 'victory' ? 'Victory!' : state.phase === 'defeat' ? 'Defeated…' : 'You escaped!'}
                </span>
              </div>
              {state.phase === 'victory' && (
                <div className="flex items-center justify-center gap-4 text-sm">
                  <span className="text-amber-300/80">+{state.xpReward} XP</span>
                  <span className="text-white/30">·</span>
                  <span className="text-amber-300/80">+{state.goldReward} 🪙</span>
                </div>
              )}
              <button
                onClick={onClose}
                className={cn(
                  'mt-1 flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold transition-colors',
                  state.phase === 'victory'
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    : state.phase === 'defeat'
                      ? 'bg-zinc-700 hover:bg-zinc-600 text-white/80'
                      : 'bg-sky-700 hover:bg-sky-600 text-white',
                )}
              >
                <CheckCircle className="w-4 h-4" />
                Continue
                <span className="text-[9px] text-white/40 ml-1 tabular-nums">[↵]</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
