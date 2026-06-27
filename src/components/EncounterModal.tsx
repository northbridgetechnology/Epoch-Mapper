'use client'

import { Swords, Wind } from 'lucide-react'
import type { ResolvedEncounter } from '@/lib/engine-types'

interface EncounterModalProps {
  encounter: ResolvedEncounter
  /** Called when the player chooses to fight (E4 wires real combat). */
  onFight: () => void
  /** Called when the player flees (always succeeds out of combat in E3). */
  onFlee: () => void
}

export function EncounterModal({ encounter, onFight, onFlee }: EncounterModalProps) {
  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-900/40 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-red-950/30 border-b border-red-900/30">
          <div className="text-xs font-semibold text-red-400/80 uppercase tracking-widest mb-0.5">
            Encounter!
          </div>
          <h2 className="text-lg font-bold text-white">{encounter.tableName}</h2>
        </div>

        {/* Enemy list */}
        <div className="px-6 py-4 space-y-2">
          {encounter.enemies.map((enemy, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg bg-zinc-900 border border-white/10 px-3 py-2">
              <div className="text-2xl w-8 text-center flex-shrink-0">
                {enemy.icon ?? '👾'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white/90">{enemy.name}</div>
                <div className="text-xs text-white/40">
                  ATK {enemy.attack} · DEF {enemy.defense} · SPD {enemy.speed}
                </div>
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
            <>
              <span>·</span>
              <span>{encounter.enemies.length} enemies</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onFight}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
          >
            <Swords className="w-4 h-4" />
            Fight
          </button>
          <button
            onClick={onFlee}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white/80 font-semibold text-sm transition-colors border border-white/10"
          >
            <Wind className="w-4 h-4" />
            Flee
          </button>
        </div>
      </div>
    </div>
  )
}
