'use client'

import { useEffect, useRef, useState } from 'react'
import { Swords, Wind } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResolvedEncounter } from '@/lib/engine-types'

interface EncounterModalProps {
  encounter: ResolvedEncounter
  onFight: () => void
  onFlee: () => void
}

export function EncounterModal({ encounter, onFight, onFlee }: EncounterModalProps) {
  const [cursor, setCursor] = useState(0)  // 0=Fight, 1=Flee

  const kbRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  kbRef.current = (e: KeyboardEvent) => {
    const tag = (document.activeElement?.tagName ?? '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); setCursor(c => c === 0 ? 1 : 0)
    } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault()
      if (cursor === 0) onFight(); else onFlee()
    } else if (e.key === 'Escape') {
      e.preventDefault(); onFlee()
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault(); onFight()
    }
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => kbRef.current?.(e)
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [])

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-900/40 bg-zinc-950 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 bg-red-950/30 border-b border-red-900/30">
          <div className="text-xs font-semibold text-red-400/80 uppercase tracking-widest mb-0.5">Encounter!</div>
          <h2 className="text-lg font-bold text-white">{encounter.tableName}</h2>
        </div>

        {/* Enemy list */}
        <div className="px-6 py-4 space-y-2">
          {encounter.enemies.map((enemy, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg bg-zinc-900 border border-white/10 px-3 py-2">
              <div className="text-2xl w-8 text-center flex-shrink-0">{enemy.icon ?? '👾'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white/90">{enemy.name}</div>
                <div className="text-xs text-white/40">ATK {enemy.attack} · DEF {enemy.defense} · SPD {enemy.speed}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-red-400">{enemy.hp} HP</div>
              </div>
            </div>
          ))}
        </div>

        {/* Rewards preview */}
        <div className="px-6 pb-3 flex items-center gap-4 text-xs text-white/40">
          <span>+{encounter.xpReward} XP</span>
          <span>·</span>
          <span>+{encounter.goldReward} 🪙</span>
          {encounter.enemies.length > 1 && (
            <><span>·</span><span>{encounter.enemies.length} enemies</span></>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/10 space-y-2">
          <div className="flex gap-3">
            <button
              onClick={onFight}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors',
                cursor === 0 && 'ring-2 ring-amber-300/60',
              )}
            >
              {cursor === 0 && <span className="text-amber-200 text-xs">▶</span>}
              <Swords className="w-4 h-4" />
              Fight
              <span className="text-[9px] text-white/35 ml-auto">[F / ↵]</span>
            </button>
            <button
              onClick={onFlee}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/80 font-semibold text-sm transition-colors border border-white/10',
                cursor === 1 && 'ring-2 ring-amber-300/60',
              )}
            >
              {cursor === 1 && <span className="text-amber-200 text-xs">▶</span>}
              <Wind className="w-4 h-4" />
              Flee
              <span className="text-[9px] text-white/35 ml-auto">[Esc]</span>
            </button>
          </div>
          <div className="text-[9px] text-white/20 text-center font-mono">← → switch · ↵ / Z confirm · F fight · Esc flee</div>
        </div>
      </div>
    </div>
  )
}
