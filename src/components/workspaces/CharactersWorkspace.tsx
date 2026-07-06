'use client'

/**
 * Characters workspace — one home for the whole cast, split into two tabs:
 *
 *  • Party — the live party (full runtime editing: identity, class/race,
 *    attributes, equipment, formation). The player-built Main Character shows
 *    with a crown; recruited members appear here too.
 *  • Cast — authored NpcDef definitions (stat block + dialogue). An NPC that
 *    has been recruited moves out of this list into the Party tab.
 */

import { useState } from 'react'
import { Plus, Trash2, Users, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Character, Formation, ItemInstance, NpcDef, Ruleset } from '@/lib/engine-types'
import { blankNpc } from '@/lib/npc-schema'
import { NpcEditor } from '../forms/NpcEditor'
import { PartyWorkspace } from './PartyWorkspace'
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

function CastTab({ ruleset, onRulesetChange, party }: {
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
  party: Character[]
}) {
  // NPCs already recruited into the party live under the Party tab, not here.
  const recruited = new Set(party.map(c => c.sourceNpc).filter(Boolean) as string[])
  const npcs = (ruleset.npcs ?? []).filter(n => !recruited.has(n.id))
  const [selectedId, setSelectedId] = useState<string | null>(npcs[0]?.id ?? null)
  const selected = npcs.find(n => n.id === selectedId) ?? null

  function addNpc() {
    const id = `npc.npc_${(ruleset.npcs ?? []).length + 1}_${Date.now() % 1000}`
    onRulesetChange({ ...ruleset, npcs: [...(ruleset.npcs ?? []), blankNpc(id)] })
    setSelectedId(id)
  }
  function updateNpc(n: NpcDef) {
    onRulesetChange({ ...ruleset, npcs: (ruleset.npcs ?? []).map(x => x.id === n.id ? n : x) })
  }
  function deleteNpc(id: string) {
    const next = (ruleset.npcs ?? []).filter(n => n.id !== id)
    onRulesetChange({ ...ruleset, npcs: next })
    if (selectedId === id) setSelectedId(next.find(n => !recruited.has(n.id))?.id ?? null)
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-60 flex-shrink-0 flex flex-col border-r border-white/10 bg-zinc-950 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Cast ({npcs.length})</span>
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
      <div className="flex-1 min-h-0">
        {selected ? (
          <NpcEditor npc={selected} ruleset={ruleset} onChange={updateNpc} />
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

export function CharactersWorkspace({
  ruleset, onRulesetChange, party, formation, inventory, gold, onPartyChange, onInventoryChange,
}: {
  ruleset: Ruleset
  onRulesetChange: (r: Ruleset) => void
  party: Character[]
  formation: Formation
  inventory: ItemInstance[]
  gold: number
  onPartyChange: (party: Character[], formation: Formation) => void
  onInventoryChange: (inventory: ItemInstance[], gold: number) => void
}) {
  const [tab, setTab] = useState<'party' | 'cast'>('party')

  // Cast excludes NPCs already living in the party (they show under Party).
  const recruited = new Set(party.map(c => c.sourceNpc).filter(Boolean) as string[])
  const castCount = (ruleset.npcs ?? []).filter(n => !recruited.has(n.id)).length

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/10 flex-shrink-0">
        <TabButton active={tab === 'party'} onClick={() => setTab('party')} icon={<UserRound className="w-3.5 h-3.5" />}>
          Party ({party.length})
        </TabButton>
        <TabButton active={tab === 'cast'} onClick={() => setTab('cast')} icon={<Users className="w-3.5 h-3.5" />}>
          Cast ({castCount})
        </TabButton>
      </div>
      <div className="flex-1 min-h-0">
        {tab === 'party' ? (
          <PartyWorkspace
            ruleset={ruleset}
            party={party}
            formation={formation}
            inventory={inventory}
            gold={gold}
            onPartyChange={onPartyChange}
            onInventoryChange={onInventoryChange}
          />
        ) : (
          <CastTab ruleset={ruleset} onRulesetChange={onRulesetChange} party={party} />
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={cn('flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors',
        active ? 'bg-amber-600/20 text-amber-300' : 'text-white/40 hover:text-white hover:bg-white/5')}>
      {icon}{children}
    </button>
  )
}
