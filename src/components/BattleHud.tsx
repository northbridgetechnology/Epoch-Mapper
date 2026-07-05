'use client'

/**
 * FF-style battle command bar + controller hook.
 *
 * `useBattleController` owns all battle UI state (menu mode, target cursor,
 * enemy-turn autoplay) and returns:
 *   - `view`: highlight/placement state for FirstPersonView (enemies on the
 *     playfield, amber active ring, red target ring)
 *   - `hud`:  props for <BattleHud>, the bottom command bar
 * PlayWorkspace calls the hook and renders both.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Swords, Wand2, Shield, FlaskConical, Wind, ChevronLeft, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type CombatState,
  type CombatActor,
  resolvePlayerAttack,
  resolvePlayerCast,
  resolvePlayerFlee,
  resolvePlayerDefend,
  resolvePlayerUseItem,
  resolveEnemyTurn,
  upcomingTurns,
} from '@/lib/combat-engine'
import { buildBattlePlacements, type BattleViewState } from '@/lib/battle-scene'
import type { Character, ItemDef, ItemInstance, Ruleset, SpellDef } from '@/lib/engine-types'

type Mode =
  | { k: 'menu' }
  | { k: 'targets'; spell?: SpellDef; item?: ItemDef }
  | { k: 'spells' }
  | { k: 'items' }
  | { k: 'allies'; spell?: SpellDef; item?: ItemDef }

/** A consumable the party can still use this battle (qty net of itemsUsed). */
export interface UsableItem {
  def: ItemDef
  remaining: number
}

export interface BattleHudProps {
  combat: CombatState
  mode: Mode
  currentActor: CombatActor | undefined
  castableSpells: SpellDef[]
  usableItems: UsableItem[]
  selectedIdx: number | null
  onAttack: () => void
  onOpenSpells: () => void
  onChooseSpell: (spell: SpellDef) => void
  onOpenItems: () => void
  onChooseItem: (item: ItemDef) => void
  onDefend: () => void
  onAllyTarget: (actorIdx: number) => void
  onConfirmTarget: () => void
  onFlee: () => void
  onBack: () => void
}

export function useBattleController({ combat, ruleset, party, inventory, onAction }: {
  combat: CombatState | null
  ruleset: Ruleset
  party: Character[]
  inventory: ItemInstance[]
  onAction: (next: CombatState) => void
}): { view: BattleViewState | null; hud: BattleHudProps | null } {
  const [mode, setMode] = useState<Mode>({ k: 'menu' })
  const [sel, setSel] = useState<number | null>(null)

  // Latest combat in a ref so keyboard/timer callbacks never act on stale state
  const combatRef = useRef(combat)
  combatRef.current = combat

  const placements = useMemo(
    () => (combat ? buildBattlePlacements(combat) : []),
    [combat],
  )

  const aliveEnemyIdxs = useMemo(
    () => (combat ? combat.actors.map((a, i) => ({ a, i })).filter(({ a }) => a.kind === 'enemy' && a.alive).map(({ i }) => i) : []),
    [combat],
  )

  // Reset menu whenever the turn moves or battle starts/ends
  const inBattle = combat !== null
  useEffect(() => {
    setMode({ k: 'menu' })
    setSel(null)
  }, [combat?.turnIdx, inBattle])

  // Auto-resolve enemy turns
  useEffect(() => {
    if (!combat || combat.phase !== 'enemy_turn') return
    const timer = setTimeout(() => {
      const cur = combatRef.current
      if (cur && cur.phase === 'enemy_turn') onAction(resolveEnemyTurn(cur, ruleset))
    }, 750)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.phase, combat?.turnIdx])

  const currentActor = combat ? combat.actors[combat.turnIdx] : undefined

  const castableSpells = useMemo<SpellDef[]>(() => {
    if (!combat || !currentActor || currentActor.kind !== 'party') return []
    if (combat.antiMagic) return []   // anti-magic zone: Spell command is dead
    const char = party[currentActor.idx]
    if (!char) return []
    return (char.knownSpells ?? [])
      .map(id => ruleset.spells.find(s => s.id === id))
      .filter((s): s is SpellDef => !!s && s.inCombat)
  }, [combat, currentActor, party, ruleset])

  // Consumables with onUse effects the party still holds (net of this battle's usage)
  const usableItems = useMemo<UsableItem[]>(() => {
    if (!combat) return []
    return ruleset.items
      .filter(it => it.kind === 'consumable' && (it.onUse?.length ?? 0) > 0)
      .map(it => {
        const held = inventory.find(i => i.def === it.id)?.qty ?? 0
        return { def: it, remaining: held - (combat.itemsUsed[it.id] ?? 0) }
      })
      .filter(e => e.remaining > 0)
  }, [combat, inventory, ruleset])

  function execAttack(targetIdx: number) {
    const cur = combatRef.current
    if (!cur) return
    onAction(resolvePlayerAttack(cur, targetIdx, ruleset))
    setMode({ k: 'menu' }); setSel(null)
  }
  function execCast(spell: SpellDef, targetIdxs: number[]) {
    const cur = combatRef.current
    if (!cur) return
    onAction(resolvePlayerCast(cur, spell.id, targetIdxs, ruleset))
    setMode({ k: 'menu' }); setSel(null)
  }
  function execUseItem(item: ItemDef, targetIdxs: number[]) {
    const cur = combatRef.current
    if (!cur) return
    onAction(resolvePlayerUseItem(cur, item.id, targetIdxs, ruleset))
    setMode({ k: 'menu' }); setSel(null)
  }

  function enterTargets(spell?: SpellDef, item?: ItemDef) {
    setMode({ k: 'targets', spell, item })
    setSel(aliveEnemyIdxs[0] ?? null)
  }

  // Items whose effects include damage are thrown at enemies; the rest aid allies
  function chooseItem(item: ItemDef) {
    const offensive = item.onUse?.some(e => e.t === 'damage') ?? false
    if (offensive) enterTargets(undefined, item)
    else setMode({ k: 'allies', item })
  }

  function chooseSpell(spell: SpellDef) {
    const target = spell.target ?? 'enemy'
    if (target === 'enemy') return enterTargets(spell)
    if (target === 'allEnemies' || target === 'enemyRow') return execCast(spell, aliveEnemyIdxs)
    if (target === 'ally') return setMode({ k: 'allies', spell })
    if (target === 'allAllies') {
      const allies = combatRef.current?.actors
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => a.kind === 'party' && a.alive)
        .map(({ i }) => i) ?? []
      return execCast(spell, allies)
    }
    // self / none → engine defaults targets to the caster
    execCast(spell, [])
  }

  function selectTarget(actorIdx: number) {
    if (mode.k !== 'targets') return
    if (sel === actorIdx) confirmTarget(actorIdx)
    else setSel(actorIdx)
  }
  function confirmTarget(idx?: number) {
    if (mode.k !== 'targets') return
    const target = idx ?? sel
    if (target == null) return
    if (mode.item) execUseItem(mode.item, [target])
    else if (mode.spell) execCast(mode.spell, [target])
    else execAttack(target)
  }

  // Back out of targeting to the submenu it came from (spells / items / menu)
  function backOut() {
    setMode(m => {
      if (m.k === 'targets' && m.spell) return { k: 'spells' }
      if (m.k === 'targets' && m.item) return { k: 'items' }
      return { k: 'menu' }
    })
  }

  // Keyboard: cycle targets with arrows, Enter confirms, Esc backs out
  useEffect(() => {
    if (!combat || combat.phase !== 'player_action') return
    const onKey = (e: KeyboardEvent) => {
      if (mode.k === 'targets') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          if (aliveEnemyIdxs.length === 0) return
          const cur = sel != null ? aliveEnemyIdxs.indexOf(sel) : -1
          const step = e.key === 'ArrowRight' ? 1 : -1
          setSel(aliveEnemyIdxs[(cur + step + aliveEnemyIdxs.length) % aliveEnemyIdxs.length])
        } else if (e.key === 'Enter') {
          e.preventDefault(); confirmTarget()
        } else if (e.key === 'Escape') {
          e.preventDefault(); backOut(); setSel(null)
        }
      } else if (mode.k === 'spells' || mode.k === 'items' || mode.k === 'allies') {
        if (e.key === 'Escape') { e.preventDefault(); setMode({ k: 'menu' }) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.phase, mode, sel, aliveEnemyIdxs])

  if (!combat) return { view: null, hud: null }

  const view: BattleViewState = {
    placements,
    actors: combat.actors,
    activeIdx: combat.turnIdx,
    targetableIdxs: mode.k === 'targets' ? aliveEnemyIdxs : [],
    selectedIdx: mode.k === 'targets' ? sel : null,
    events: combat.events,
    eventSeq: combat.eventSeq,
    onSelectTarget: selectTarget,
  }

  const hud: BattleHudProps = {
    combat, mode, currentActor, castableSpells, usableItems,
    selectedIdx: sel,
    onAttack: () => enterTargets(),
    onOpenSpells: () => setMode({ k: 'spells' }),
    onChooseSpell: chooseSpell,
    onOpenItems: () => setMode({ k: 'items' }),
    onChooseItem: chooseItem,
    onDefend: () => { const cur = combatRef.current; if (cur) onAction(resolvePlayerDefend(cur, ruleset)) },
    onAllyTarget: (idx) => {
      if (mode.k !== 'allies') return
      if (mode.item) execUseItem(mode.item, [idx])
      else if (mode.spell) execCast(mode.spell, [idx])
    },
    onConfirmTarget: () => confirmTarget(),
    onFlee: () => { const cur = combatRef.current; if (cur) onAction(resolvePlayerFlee(cur, ruleset)) },
    onBack: () => { backOut(); setSel(null) },
  }

  return { view, hud }
}

// ── Presentational pieces ─────────────────────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  damage: 'text-white/70', crit: 'text-amber-300', miss: 'text-white/40',
  info: 'text-sky-300/80', flee: 'text-emerald-300', flee_fail: 'text-red-300', spell: 'text-violet-300',
}

function MenuButton({ icon, label, onClick, disabled, title }: {
  icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; title?: string
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      className={cn(
        'flex items-center gap-2 w-full px-2.5 py-1 rounded text-xs font-medium transition-colors text-left',
        disabled
          ? 'text-white/25 cursor-not-allowed'
          : 'text-white/75 hover:text-white hover:bg-white/10 active:bg-white/15',
      )}
    >
      {icon}{label}
    </button>
  )
}

export function BattleHud({
  combat, mode, currentActor, castableSpells, usableItems, selectedIdx,
  onAttack, onOpenSpells, onChooseSpell, onOpenItems, onChooseItem, onDefend,
  onAllyTarget, onConfirmTarget, onFlee, onBack,
}: BattleHudProps) {
  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [combat.log.length])

  const isPlayerTurn = combat.phase === 'player_action' && currentActor?.kind === 'party'
  const selName = selectedIdx != null ? combat.actors[selectedIdx]?.name : null
  const isTerminal = combat.phase === 'victory' || combat.phase === 'defeat' || combat.phase === 'fled'
  const upcoming = isTerminal ? [] : upcomingTurns(combat, 6)

  return (
    <div className="w-full">
      {upcoming.length > 0 && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-[9px] uppercase tracking-wide text-white/30 mr-1">Turn order</span>
          {upcoming.map((idx, i) => {
            const a = combat.actors[idx]
            return (
              <div key={i} title={a?.name}
                className={cn(
                  'w-6 h-6 grid place-items-center rounded border text-sm leading-none',
                  i === 0 ? 'border-amber-400/80 bg-amber-950/40' : 'border-white/10 bg-zinc-900/70 opacity-70',
                )}
              >{a?.icon ?? (a?.kind === 'enemy' ? '👾' : '🧑')}</div>
            )
          })}
        </div>
      )}
      <div className="flex items-stretch gap-3 w-full min-h-[92px]">
      {/* Command menu */}
      <div className="w-44 flex-shrink-0 rounded-lg border border-amber-500/25 bg-zinc-900/80 p-1.5">
        {!isPlayerTurn ? (
          <div className="h-full grid place-items-center text-xs text-white/40 italic px-2 text-center">
            {combat.phase === 'enemy_turn' ? `${currentActor?.name ?? 'Enemy'} is acting…` : '…'}
          </div>
        ) : mode.k === 'menu' ? (
          <div className="space-y-0.5">
            <div className="px-2 pb-0.5 text-[10px] uppercase tracking-wide text-amber-300/70">
              {currentActor?.name}
            </div>
            <MenuButton icon={<Swords className="w-3.5 h-3.5" />} label="Attack" onClick={onAttack} />
            <MenuButton icon={<Wand2 className="w-3.5 h-3.5" />} label="Spell"
              onClick={onOpenSpells} disabled={castableSpells.length === 0}
              title={combat.antiMagic ? 'An anti-magic field smothers all spellcraft here'
                : castableSpells.length === 0 ? 'No combat spells known' : undefined} />
            <MenuButton icon={<FlaskConical className="w-3.5 h-3.5" />} label="Item"
              onClick={onOpenItems} disabled={usableItems.length === 0}
              title={usableItems.length === 0 ? 'No usable items' : undefined} />
            <MenuButton icon={<Shield className="w-3.5 h-3.5" />} label="Defend" onClick={onDefend}
              title="Halve incoming damage until your next turn" />
            <MenuButton icon={<Wind className="w-3.5 h-3.5" />} label="Flee" onClick={onFlee} />
          </div>
        ) : mode.k === 'items' ? (
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {usableItems.map(({ def, remaining }) => (
              <MenuButton key={def.id}
                icon={<span className="text-sm leading-none">{def.icon ?? '🧪'}</span>}
                label={`${def.name} ×${remaining}`}
                onClick={() => onChooseItem(def)} />
            ))}
            <MenuButton icon={<ChevronLeft className="w-3.5 h-3.5" />} label="Back" onClick={onBack} />
          </div>
        ) : mode.k === 'spells' ? (
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            {castableSpells.map(sp => {
              const tooPoor = (currentActor?.mp ?? 0) < sp.mpCost
              return (
                <MenuButton key={sp.id}
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                  label={`${sp.name} (${sp.mpCost})`}
                  onClick={() => onChooseSpell(sp)} disabled={tooPoor}
                  title={tooPoor ? 'Not enough MP' : undefined} />
              )
            })}
            <MenuButton icon={<ChevronLeft className="w-3.5 h-3.5" />} label="Back" onClick={onBack} />
          </div>
        ) : mode.k === 'targets' ? (
          <div className="space-y-1">
            <div className="px-2 text-[11px] text-red-300/90 leading-snug">
              Target: <span className="font-semibold">{selName ?? '—'}</span>
              <div className="text-[9px] text-white/35">click enemy · ←/→ · Enter</div>
            </div>
            <MenuButton icon={<Check className="w-3.5 h-3.5" />} label="Confirm" onClick={onConfirmTarget} disabled={selectedIdx == null} />
            <MenuButton icon={<ChevronLeft className="w-3.5 h-3.5" />} label="Back" onClick={onBack} />
          </div>
        ) : (
          <div className="space-y-0.5 max-h-24 overflow-y-auto">
            <div className="px-2 text-[10px] uppercase tracking-wide text-emerald-300/70">
              {mode.k === 'allies' && mode.item ? 'Use on…' : 'Cast on…'}
            </div>
            {combat.actors.map((a, i) => (a.kind === 'party' && a.alive) ? (
              <MenuButton key={i} icon={<span className="text-sm leading-none">{a.icon ?? '🧑'}</span>}
                label={a.name} onClick={() => onAllyTarget(i)} />
            ) : null)}
            <MenuButton icon={<ChevronLeft className="w-3.5 h-3.5" />} label="Back" onClick={onBack} />
          </div>
        )}
      </div>

      {/* Combat log */}
      <div className="flex-1 min-w-0 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-1.5 overflow-y-auto text-[11px] leading-snug max-h-24">
        {combat.log.slice(-8).map((entry, i) => (
          <div key={i} className={LOG_COLORS[entry.kind] ?? 'text-white/60'}>{entry.text}</div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Party status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {combat.actors.map((a, i) => {
          if (a.kind !== 'party') return null
          const isActive = i === combat.turnIdx
          const hpPct = a.maxHp > 0 ? a.hp / a.maxHp : 0
          const dead = !a.alive
          return (
            <div key={i} className={cn(
              'rounded-lg border px-2 py-1.5 w-[104px]',
              isActive ? 'border-amber-400/70 bg-amber-950/30' : 'border-white/10 bg-zinc-900/70',
              dead && 'opacity-40',
            )}>
              <div className={cn('text-[11px] font-semibold truncate flex items-center gap-1', dead ? 'text-white/30 line-through' : 'text-white/80')}>
                <span>{a.icon ?? '🧑'}</span>{a.name}
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className={cn('h-full', hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-400' : 'bg-red-500')}
                  style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%` }} />
              </div>
              {a.maxMp > 0 && (
                <div className="mt-0.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, (a.mp / a.maxMp) * 100))}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

// ── Terminal outcome overlay (victory / defeat / fled) ───────────────────────

export function BattleOutcomeOverlay({ state, ruleset, onContinue }: {
  state: CombatState
  ruleset: Ruleset
  onContinue: () => void
}) {
  const outcome = state.phase
  if (outcome !== 'victory' && outcome !== 'defeat' && outcome !== 'fled') return null
  const title = outcome === 'victory' ? 'Victory!' : outcome === 'defeat' ? 'Defeat…' : 'Escaped!'
  const color = outcome === 'victory' ? 'text-amber-300' : outcome === 'defeat' ? 'text-red-400' : 'text-emerald-300'
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/55">
      <div className="rounded-xl border border-white/15 bg-zinc-900/95 px-8 py-6 text-center shadow-2xl min-w-[240px]">
        <div className={cn('text-2xl font-bold mb-2', color)}>{title}</div>
        {outcome === 'victory' && (
          <div className="text-sm text-white/60 mb-4">
            +{state.xpReward} XP · +{state.goldReward} gold
            {state.drops.length > 0 && (
              <div className="mt-2 space-y-0.5 text-xs text-white/70">
                {state.drops.map(d => {
                  const def = ruleset.items.find(i => i.id === d.item)
                  return (
                    <div key={d.item}>
                      <span className="mr-1">{def?.icon ?? '📦'}</span>
                      {def?.name ?? d.item}{d.qty > 1 ? ` ×${d.qty}` : ''}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {outcome === 'defeat' && (
          <div className="text-sm text-white/60 mb-4">The party has fallen.</div>
        )}
        {outcome === 'fled' && <div className="text-sm text-white/60 mb-4">You got away safely.</div>}
        <button
          onClick={onContinue}
          className="px-5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-semibold text-zinc-950 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
