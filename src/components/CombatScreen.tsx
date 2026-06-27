'use client'

import { useEffect, useRef, useState } from 'react'
import { Swords, Wind, SkipForward, Trophy, Skull, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type CombatState,
  type CombatActor,
  resolvePlayerAttack,
  resolvePlayerFlee,
  resolveEnemyTurn,
} from '@/lib/combat-engine'

interface CombatScreenProps {
  state: CombatState
  onAction: (next: CombatState) => void
  onClose: () => void
}

// ── HP bar ────────────────────────────────────────────────────────────────────

function HpBar({ hp, maxHp, dead }: { hp: number; maxHp: number; dead: boolean }) {
  const pct = dead ? 0 : Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const color = dead ? 'bg-zinc-700' : pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-mono tabular-nums w-16 text-right flex-shrink-0', dead ? 'text-white/25' : 'text-white/50')}>
        {dead ? 'KO' : `${hp}/${maxHp}`}
      </span>
    </div>
  )
}

// ── Actor row ─────────────────────────────────────────────────────────────────

function ActorRow({
  actor,
  isActive,
  isTargetable,
  onTarget,
}: {
  actor: CombatActor
  isActive: boolean
  isTargetable: boolean
  onTarget?: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all',
        !actor.alive && 'opacity-40',
        isActive && 'ring-1 ring-amber-400/60',
        isTargetable && actor.alive
          ? 'border-red-500/50 bg-red-950/30 hover:bg-red-900/40 cursor-pointer'
          : 'border-white/10 bg-zinc-900/60',
      )}
      onClick={isTargetable && actor.alive ? onTarget : undefined}
    >
      <span className="text-xl w-7 text-center flex-shrink-0 leading-none">{actor.icon ?? (actor.kind === 'enemy' ? '👾' : '🧑')}</span>
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-semibold truncate', actor.alive ? 'text-white/90' : 'text-white/30 line-through')}>
          {actor.name}
        </div>
        <HpBar hp={actor.hp} maxHp={actor.maxHp} dead={!actor.alive} />
      </div>
      {isTargetable && actor.alive && (
        <div className="text-xs text-red-400/70 flex-shrink-0">Attack</div>
      )}
    </div>
  )
}

// ── Combat log ────────────────────────────────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  damage: 'text-white/70',
  crit: 'text-amber-300',
  miss: 'text-white/40 italic',
  flee: 'text-sky-400',
  flee_fail: 'text-orange-400',
  info: 'text-white/50',
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CombatScreen({ state, onAction, onClose }: CombatScreenProps) {
  const [targeting, setTargeting] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Reset targeting when phase leaves player_action
  useEffect(() => {
    if (state.phase !== 'player_action') setTargeting(false)
  }, [state.phase])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log.length])

  // Auto-resolve enemy turns
  useEffect(() => {
    if (state.phase !== 'enemy_turn') return
    const timer = setTimeout(() => {
      onAction(resolveEnemyTurn(state, Math.random))
    }, 750)
    return () => clearTimeout(timer)
    // state is captured in closure intentionally — only fire when turnIdx/phase changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.turnIdx])

  const enemies = state.actors.filter(a => a.kind === 'enemy')
  const partyActors = state.actors.filter(a => a.kind === 'party')
  const currentActor = state.actors[state.turnIdx]
  const visibleLog = state.log.slice(-6)

  const isTerminal = state.phase === 'victory' || state.phase === 'defeat' || state.phase === 'fled'

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
            {state.phase === 'player_action' && currentActor && `${currentActor.name}'s turn`}
            {state.phase === 'targeting' && 'Choose a target'}
            {state.phase === 'enemy_turn' && currentActor && `${currentActor.name} is acting…`}
            {state.phase === 'victory' && '✓ Victory!'}
            {state.phase === 'defeat' && '✗ Defeated'}
            {state.phase === 'fled' && 'Escaped!'}
          </div>
        </div>

        {/* Enemies */}
        <div className="px-3 pt-3 pb-1 space-y-1.5">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-1 mb-1">Enemies</div>
          {enemies.map((actor, i) => {
            const actorIdx = state.actors.indexOf(actor)
            return (
              <ActorRow
                key={i}
                actor={actor}
                isActive={state.turnIdx === actorIdx}
                isTargetable={targeting}
                onTarget={() => {
                  setTargeting(false)
                  onAction(resolvePlayerAttack(state, actorIdx, Math.random))
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
          {partyActors.map((actor, i) => {
            const actorIdx = state.actors.indexOf(actor)
            return (
              <ActorRow
                key={i}
                actor={actor}
                isActive={state.turnIdx === actorIdx}
                isTargetable={false}
              />
            )
          })}
        </div>

        {/* Action bar */}
        <div className="px-3 pb-3 pt-1 border-t border-white/10">
          {state.phase === 'player_action' && !targeting && (
            <div className="flex gap-2">
              <button
                onClick={() => setTargeting(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
              >
                <Swords className="w-4 h-4" />
                Attack
              </button>
              <button
                onClick={() => onAction(resolvePlayerFlee(state, Math.random))}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/70 font-semibold text-sm transition-colors border border-white/10"
              >
                <Wind className="w-4 h-4" />
                Flee
              </button>
            </div>
          )}

          {state.phase === 'player_action' && targeting && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300/80">Select an enemy to attack</span>
              <button
                onClick={() => setTargeting(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-white/60 hover:bg-white/10 border border-white/10"
              >
                Cancel
              </button>
            </div>
          )}

          {state.phase === 'enemy_turn' && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/40">
              <SkipForward className="w-4 h-4 animate-pulse" />
              <span>Enemies acting…</span>
            </div>
          )}

          {state.phase === 'targeting' && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/40">
              <span>Choose a target above</span>
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
