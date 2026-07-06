'use client'

/**
 * Characters workspace — the NPC Creator. Authors the game's cast (NpcDef): the
 * shared stat/dialogue editor, plus the two things that make an NPC part of the
 * world and the party: place it on the map, and (for testing) drop it straight
 * into the party. Recruitable / Starts-in-party are toggles on each definition.
 */

import { useState } from 'react'
import { Plus, Trash2, MapPin, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NpcDef, Ruleset } from '@/lib/engine-types'
import { blankNpc } from '@/lib/npc-schema'
import { NpcEditor } from '../forms/NpcEditor'
import { Portrait, isBuiltinPortrait } from '@/lib/portraits'
import { isBitmapSprite } from '@/lib/pixel-sprites'

function NpcAvatar({ npc, size = 28 }: { npc: NpcDef; size?: number }) {
  if (npc.portrait && (isBuiltinPortrait(npc.portrait) || isBitmapSprite(npc.portrait))) {
    return <Portrait value={npc.portrait} size={size} />
  }
  return (
    <span className="grid place-items-center rounded bg-zinc-800 border border-white/10 leading-none"
      style={{ width: size, height: size, fontSize: size * 0.6 }}>
      {npc.portrait ?? '🧑'}
    </span>
  )
}

export function CharactersWorkspace({
  ruleset, onRulesetChange, marker, onPlaceNpc, onAddToParty,
}: {
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
  /** Active map marker — the placement target. */
  marker?: { mapName: string; x: number; y: number } | null
  /** Place the NPC as an object entity on the active map's marker cell. */
  onPlaceNpc?: (npcId: string) => void
  /** Drop the NPC into the live party right now (testing). */
  onAddToParty?: (npcId: string) => void
}) {
  const npcs = ruleset.npcs ?? []
  const [selectedId, setSelectedId] = useState<string | null>(npcs[0]?.id ?? null)
  const selected = npcs.find(n => n.id === selectedId) ?? null

  function addNpc() {
    const id = `npc.npc_${npcs.length + 1}_${Date.now() % 1000}`
    onRulesetChange({ ...ruleset, npcs: [...npcs, blankNpc(id)] })
    setSelectedId(id)
  }
  function updateNpc(n: NpcDef) {
    onRulesetChange({ ...ruleset, npcs: npcs.map(x => x.id === n.id ? n : x) })
  }
  function deleteNpc(id: string) {
    const next = npcs.filter(n => n.id !== id)
    onRulesetChange({ ...ruleset, npcs: next })
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Roster list */}
      <div className="w-60 flex-shrink-0 flex flex-col border-r border-white/10 bg-zinc-950 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
            Characters ({npcs.length})
          </span>
          <button onClick={addNpc}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/10">
            <Plus className="w-3 h-3" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {npcs.length === 0 && (
            <div className="p-4 text-center text-xs text-white/30 italic">
              No characters yet. Create your cast — allies, townsfolk, and foes-to-be.
            </div>
          )}
          {npcs.map(npc => (
            <button key={npc.id} onClick={() => setSelectedId(npc.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-white/5 transition-colors',
                selectedId === npc.id ? 'bg-amber-950/30' : 'hover:bg-white/5',
              )}>
              <NpcAvatar npc={npc} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/85 truncate">{npc.name}</div>
                <div className="flex items-center gap-1 text-[10px] text-white/35">
                  {npc.recruitable && <span title="Recruitable">🤝</span>}
                  {npc.startsInParty && <span title="Starts in party">⭐</span>}
                  <span className="truncate font-mono">{npc.id}</span>
                </div>
              </div>
              <span onClick={e => { e.stopPropagation(); deleteNpc(npc.id) }}
                className="p-1 rounded text-white/25 hover:text-red-400 hover:bg-white/10">
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Detail: actions + editor */}
      <div className="flex-1 min-h-0 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-zinc-950/60 flex-shrink-0">
              <NpcAvatar npc={selected} size={22} />
              <span className="text-sm font-semibold text-white/80 truncate">{selected.name}</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => onPlaceNpc?.(selected.id)}
                  disabled={!marker || !onPlaceNpc}
                  title={marker ? `Place on ${marker.mapName} at (${marker.x}, ${marker.y})` : 'Move the player marker onto a cell first'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-sky-500/30 text-sky-300 hover:bg-sky-500/10 disabled:opacity-30 disabled:cursor-not-allowed">
                  <MapPin className="w-3.5 h-3.5" />
                  {marker ? `Place at (${marker.x}, ${marker.y})` : 'Place'}
                </button>
                <button
                  onClick={() => onAddToParty?.(selected.id)}
                  disabled={!onAddToParty}
                  title="Add to the live party now (for testing)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-30">
                  <UserPlus className="w-3.5 h-3.5" /> Add to party
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <NpcEditor npc={selected} ruleset={ruleset} onChange={updateNpc} />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-white/20 text-sm gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <span>Create a character to begin</span>
          </div>
        )}
      </div>
    </div>
  )
}
