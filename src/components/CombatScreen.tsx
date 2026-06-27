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

function ResourceBar({
  value,
  max,
  colorClass,
}: {
  value: number
  max: number
  colorClass: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-300', colorClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Actor row ─────────────────────────────────────────────────────────────────

function ActorRow({
  actor,
  isActive,
  isTargetable,
  targetLabel,
  showMp,
  onTarget,
}: {
  actor: CombatActor
  isActive: boolean
  isTargetable: boolean
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
        isTargetable && actor.alive
          ? 'border-sky-500/50 bg-sky-950/30 hover:bg-sky-900/40 cursor-pointer'
          : 'border-white/10 bg-zinc-900/60',
      )}
      onClick={isTargetable && actor.alive ? onTarget : undefined}
    >
      <span className="text-xl w-7 text-center flex-shrink-0 leading-none">{actor.icon ?? (actor.kind === 'enemy' ? '👾' : '🧑')}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-semibold truncate flex-1', actor.alive ? 'text-white/90' : 'text-white/30 line-through')}>
            {actor.name}
          </span>
          {actor.statuses.length > 0 && (
            <div className="flex gap-0.5">
              {actor.statuses.map(s => {
                return (
                  <span key={s.def} className="text-[10px]" title={`${s.def} (${s.remaining}t)`}>
                    {s.def.includes('poison') ? '☠️' : s.def.includes('sleep') ? '💤' : s.def.includes('regen') ? '💚' : '✦'}
                  </span>
                )
              })}
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
      {isTargetable && actor.alive && targetLabel && (
        <div className="text-xs text-sky-400/70 flex-shrink-0">{targetLabel}</div>
      )}
    </div>
  )
}

// ── Combat log ────────────────────────────────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  damage:   'text-white/70',
  crit:     'text-amber-300',
  miss:     'text-white/40 italic',
  flee:     'text-sky-400',
  flee_fail:'text-orange-400',
  info:     'text-white/50',
  spell:    'text-violet-300',
}

// ── Spell picker ──────────────────────────────────────────────────────────────

function SpellPicker({
  spells,
  actorMp,
  onPick,
  onCancel,
}: {
  spells: SpellDef[]
  actorMp: number
  onPick: (spell: SpellDef) => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Choose Spell</span>
        <button onClick={onCancel} className="text-white/30 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {spells.length === 0 && (
        <div className="text-xs text-white/30 text-center py-3">No combat spells known</div>
      )}
      {spells.map(spell => {
        const canCast = actorMp >= spell.mpCost
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
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CombatScreen({ state, ruleset, party, onAction, onClose }: CombatScreenProps) {
  const [mode, setMode] = useState<CombatMode>({ kind: 'default' })
  const logEndRef = useRef<HTMLDivElement>(null)

  // Reset mode when phase leaves player_action
  useEffect(() => {
    if (state.phase !== 'player_action') setMode({ kind: 'default' })
  }, [state.phase])

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

  // Castable spells for the current party actor
  const castableSpells: SpellDef[] = (() => {
    if (!currentActor || currentActor.kind !== 'party') return []
    const char = party[currentActor.idx]
    if (!char) return []
    return (char.knownSpells ?? [])
      .map(id => ruleset.spells.find(s => s.id === id))
      .filter((s): s is SpellDef => !!s && s.inCombat)
  })()

  function handleSpellPick(spell: SpellDef) {
    // Determine if this spell needs target selection
    switch (spell.target) {
      case 'self': {
        // Resolve immediately against caster
        const casterIdx = state.turnIdx
        onAction(resolvePlayerCast(state, spell.id, [casterIdx], ruleset, Math.random))
        setMode({ kind: 'default' })
        break
      }
      case 'allEnemies':
      case 'enemyRow': {
        const targetIdxs = state.actors.map((a, i) => ({ a, i }))
          .filter(({ a }) => a.kind === 'enemy' && a.alive)
          .map(({ i }) => i)
        onAction(resolvePlayerCast(state, spell.id, targetIdxs, ruleset, Math.random))
        setMode({ kind: 'default' })
        break
      }
      case 'allAllies': {
        const targetIdxs = state.actors.map((a, i) => ({ a, i }))
          .filter(({ a }) => a.kind === 'party' && a.alive)
          .map(({ i }) => i)
        onAction(resolvePlayerCast(state, spell.id, targetIdxs, ruleset, Math.random))
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
        // 'none' — no targets
        onAction(resolvePlayerCast(state, spell.id, [], ruleset, Math.random))
        setMode({ kind: 'default' })
    }
  }

  const isAttackTargeting = mode.kind === 'attack_target'
  const isSpellTargeting = mode.kind === 'spell_target' || mode.kind === 'ally_target'

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
            {state.phase === 'player_action' && currentActor && mode.kind === 'default' && `${currentActor.name}'s turn`}
            {state.phase === 'player_action' && mode.kind === 'attack_target' && 'Choose an enemy to attack'}
            {state.phase === 'player_action' && mode.kind === 'spell_select' && 'Choose a spell'}
            {state.phase === 'player_action' && mode.kind === 'spell_target' && `Target for ${mode.spell.name}`}
            {state.phase === 'player_action' && mode.kind === 'ally_target' && `Cast ${mode.spell.name} on ally`}
            {state.phase === 'enemy_turn' && currentActor && `${currentActor.name} is acting…`}
            {state.phase === 'victory' && '✓ Victory!'}
            {state.phase === 'defeat' && '✗ Defeated'}
            {state.phase === 'fled' && 'Escaped!'}
          </div>
        </div>

        {/* Enemies */}
        <div className="px-3 pt-3 pb-1 space-y-1.5">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 mb-1">Enemies</div>
          {enemies.map((actor) => {
            const actorIdx = state.actors.indexOf(actor)
            const targetable = isAttackTargeting || mode.kind === 'spell_target'
            const label = isAttackTargeting ? 'Attack' : mode.kind === 'spell_target' ? 'Cast' : undefined
            return (
              <ActorRow
                key={actorIdx}
                actor={actor}
                isActive={state.turnIdx === actorIdx}
                isTargetable={targetable}
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
            const actorIdx = state.actors.indexOf(actor)
            const allyTargetable = mode.kind === 'ally_target'
            return (
              <ActorRow
                key={actorIdx}
                actor={actor}
                isActive={state.turnIdx === actorIdx}
                isTargetable={allyTargetable}
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
          {state.phase === 'player_action' && mode.kind === 'default' && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode({ kind: 'attack_target' })}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
              >
                <Swords className="w-4 h-4" />
                Attack
              </button>
              {castableSpells.length > 0 && (
                <button
                  onClick={() => setMode({ kind: 'spell_select' })}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-violet-800 hover:bg-violet-700 text-white font-semibold text-sm transition-colors"
                >
                  <Wand2 className="w-4 h-4" />
                  Cast
                </button>
              )}
              <button
                onClick={() => onAction(resolvePlayerFlee(state, ruleset, Math.random))}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/70 font-semibold text-sm transition-colors border border-white/10"
              >
                <Wind className="w-4 h-4" />
                Flee
              </button>
            </div>
          )}

          {state.phase === 'player_action' && mode.kind === 'spell_select' && (
            <SpellPicker
              spells={castableSpells}
              actorMp={currentActor?.mp ?? 0}
              onPick={handleSpellPick}
              onCancel={() => setMode({ kind: 'default' })}
            />
          )}

          {state.phase === 'player_action' && (mode.kind === 'attack_target' || isSpellTargeting) && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-sky-300/80">
                {mode.kind === 'attack_target' && 'Select an enemy above to attack'}
                {mode.kind === 'spell_target' && `Select an enemy above for ${mode.spell.name}`}
                {mode.kind === 'ally_target' && `Select an ally above for ${mode.spell.name}`}
              </span>
              <button
                onClick={() => setMode({ kind: 'default' })}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:bg-white/10 border border-white/10"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
          )}

          {state.phase === 'enemy_turn' && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/40">
              <SkipForward className="w-4 h-4 animate-pulse" />
              <span>Enemies acting…</span>
            </div>
          )}

          {/* Terminal states */}
          {isTerminal && (
            <div className={cn(
              'rounded-xl border p-4 text-center space-y-2',
              state.phase === 'victory' ? 'border-emerald-500/30 bg-emerald-950/30' :
              state.phase === 'defeat' ? 'border-red-500/30 bg-red-950/30' :
              'border-sky-500/30 bg-sky-950/30',
            )}>
              <div className="flex items-center justify-center gap-2">
                {state.phase === 'victory' && <Trophy className="w-5 h-5 text-amber-400" />}
                {state.phase === 'defeat' && <Skull className="w-5 h-5 text-red-400" />}
                {state.phase === 'fled' && <Wind className="w-5 h-5 text-sky-400" />}
                <span className={cn(
                  'font-bold text-base',
                  state.phase === 'victory' ? 'text-emerald-300' :
                  state.phase === 'defeat' ? 'text-red-300' :
                  'text-sky-300',
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
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
