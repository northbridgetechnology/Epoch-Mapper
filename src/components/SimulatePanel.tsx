'use client'

/**
 * Balance simulator panel — lives in the Database workspace's encounter
 * table editor. Runs the headless battle simulator (real combat engine,
 * basic-attack party policy) and reports survivability stats.
 */

import { useState } from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { simulateEncounterTable, type SimResult } from '@/lib/battle-sim'
import type { Ruleset } from '@/lib/engine-types'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded bg-zinc-800 border border-white/10 px-2 py-1.5 text-center">
      <div className={cn('text-sm font-semibold tabular-nums', tone ?? 'text-white/85')}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-white/35 mt-0.5">{label}</div>
    </div>
  )
}

export function SimulatePanel({ tableId, ruleset }: { tableId: string; ruleset: Ruleset }) {
  const [partySize, setPartySize] = useState(4)
  const [level, setLevel] = useState(3)
  const [iterations, setIterations] = useState(500)
  const [result, setResult] = useState<SimResult | null>(null)

  function run() {
    setResult(simulateEncounterTable(tableId, ruleset, { partySize, level, iterations }))
  }

  const winPct = result ? result.winRate * 100 : 0
  const winTone = winPct >= 85 ? 'text-emerald-300' : winPct >= 55 ? 'text-amber-300' : 'text-red-400'

  return (
    <div className="pt-2 border-t border-white/10">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Simulate</span>
      </div>

      <div className="flex items-end gap-3 text-xs mb-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-white/30 text-[10px]">Party size</span>
          <input type="number" min={1} max={6} value={partySize}
            onChange={e => setPartySize(Math.max(1, Math.min(6, e.target.valueAsNumber || 1)))}
            className="w-14 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 font-mono text-white/90 focus:outline-none" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-white/30 text-[10px]">Level</span>
          <input type="number" min={1} max={30} value={level}
            onChange={e => setLevel(Math.max(1, Math.min(30, e.target.valueAsNumber || 1)))}
            className="w-14 px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 font-mono text-white/90 focus:outline-none" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-white/30 text-[10px]">Battles</span>
          <select value={iterations} onChange={e => setIterations(Number(e.target.value))}
            className="px-1.5 py-0.5 rounded bg-zinc-700 border border-white/10 text-white/90 focus:outline-none">
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
        <button onClick={run}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-700/70 hover:bg-amber-600/70 text-amber-100 text-xs font-medium transition-colors">
          <Play className="w-3 h-3" /> Run
        </button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            <Stat label="Win rate" value={`${winPct.toFixed(1)}%`} tone={winTone} />
            <Stat label="Party wipes" value={`${result.defeats}`} tone={result.defeats > 0 ? 'text-red-400' : undefined} />
            <Stat label="Avg rounds" value={result.avgRounds.toFixed(1)} />
            <Stat label="HP lost / win" value={`${(result.avgPartyHpLostPct * 100).toFixed(0)}%`} />
          </div>
          <div className="mt-1.5 text-[10px] text-white/30 leading-snug">
            {result.runs} battles, basic-attack party policy (no spells/items) — a conservative floor.
            {result.stalls > 0 && ` ${result.stalls} stalled (likely mutual immunity).`}
          </div>
        </>
      )}
    </div>
  )
}
