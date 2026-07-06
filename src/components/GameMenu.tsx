'use client'

/**
 * In-play main menu — a Final Fantasy-style full-screen hub (open with Tab).
 * Left rail of commands, a live party summary, and a footer with gold/location.
 * Commands: Item · Magic · Equip · Status · Party · Journal · Camp · Save ·
 * Config. Keyboard (↑/↓, Enter, Esc/Tab) and mouse both drive it. Reuses the
 * party editor's Equip/Status/Formation panels and the out-of-combat effect
 * resolvers, so it manages real state, not a mock.
 */

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Backpack, Sparkles, Shield, User, Users, ScrollText, Tent, Save as SaveIcon, Settings2, ChevronRight, X,
} from 'lucide-react'
import type { Character, Effect, Formation, ItemInstance, Ruleset, SpellDef } from '@/lib/engine-types'
import { Portrait } from '@/lib/portraits'
import { applyConsumable, applyEffectToChar } from '@/lib/apply-effects'
import { itemDisplayName } from '@/lib/item-schema'
import { questStageFlagKey, npcLineHeardFlagKey } from '@/lib/event-engine'
import { resolveText } from '@/lib/text-tokens'
import { listSaveSlots } from '@/lib/save-state'
import { EquipmentPanel, CharacterSheet, FormationWidget } from '@/components/workspaces/PartyWorkspace'
import { cn } from '@/lib/utils'

type Command = 'item' | 'magic' | 'equip' | 'status' | 'party' | 'journal' | 'camp' | 'save' | 'config'

const COMMANDS: { id: Command; label: string; icon: React.ReactNode }[] = [
  { id: 'item',    label: 'Item',    icon: <Backpack className="w-4 h-4" /> },
  { id: 'magic',   label: 'Magic',   icon: <Sparkles className="w-4 h-4" /> },
  { id: 'equip',   label: 'Equip',   icon: <Shield className="w-4 h-4" /> },
  { id: 'status',  label: 'Status',  icon: <User className="w-4 h-4" /> },
  { id: 'party',   label: 'Party',   icon: <Users className="w-4 h-4" /> },
  { id: 'journal', label: 'Journal', icon: <ScrollText className="w-4 h-4" /> },
  { id: 'camp',    label: 'Camp',    icon: <Tent className="w-4 h-4" /> },
  { id: 'save',    label: 'Save',    icon: <SaveIcon className="w-4 h-4" /> },
  { id: 'config',  label: 'Config',  icon: <Settings2 className="w-4 h-4" /> },
]

const PANEL = 'rounded-lg border border-sky-300/15 bg-[#0b1020]/85 shadow-[0_0_0_1px_rgba(120,160,255,0.08)_inset]'

export function GameMenu({
  ruleset, party, reserve, formation, inventory, gold, flags, mapName,
  canSaveHere, onRosterChange, onInventoryChange, onRest, onSaveSlot, onLoadSlot, onClose,
}: {
  ruleset: Ruleset
  party: Character[]
  reserve: Character[]
  formation: Formation
  inventory: ItemInstance[]
  gold: number
  flags: Record<string, boolean | number | string>
  mapName: string
  canSaveHere: boolean
  onRosterChange: (party: Character[], formation: Formation, reserve: Character[]) => void
  onInventoryChange: (inventory: ItemInstance[], gold: number) => void
  onRest?: () => void
  onSaveSlot?: (slot: number) => void
  onLoadSlot?: (slot: number) => void
  onClose: () => void
}) {
  const [cmd, setCmd] = useState<Command | null>(null)
  const [cursor, setCursor] = useState(0)
  const mc = useMemo(() => party.find(c => c.isMc) ?? null, [party])

  // Keyboard: Tab/Esc back out (subscreen → list → close); ↑/↓/Enter on the list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onClose(); return }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        if (cmd) setCmd(null); else onClose()
        return
      }
      if (cmd) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => (c + 1) % COMMANDS.length) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => (c - 1 + COMMANDS.length) % COMMANDS.length) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCmd(COMMANDS[cursor].id) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cmd, cursor, onClose])

  const updateChar = (idx: number, c: Character) =>
    onRosterChange(party.map((x, i) => (i === idx ? c : x)), formation, reserve)

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col p-4 sm:p-6 select-none text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold tracking-[0.25em] text-sky-200/80 uppercase">Menu</div>
        <button onClick={onClose} className="flex items-center gap-1 text-xs text-white/50 hover:text-white">
          <X className="w-4 h-4" /> Tab
        </button>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Command rail */}
        <div className={cn(PANEL, 'w-40 flex-shrink-0 p-2 flex flex-col gap-0.5')}>
          {COMMANDS.map((c, i) => (
            <button key={c.id}
              onMouseEnter={() => setCursor(i)}
              onClick={() => setCmd(c.id)}
              className={cn(
                'flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-left transition-colors',
                cmd === c.id ? 'bg-amber-500/20 text-amber-200'
                  : cursor === i && !cmd ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5',
              )}>
              <span className={cn('w-3', (cursor === i && !cmd) || cmd === c.id ? 'text-amber-300' : 'text-transparent')}>▶</span>
              {c.icon}{c.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={cn(PANEL, 'flex-1 min-w-0 p-4 overflow-y-auto')}>
          {cmd === null && <PartySummary party={party} ruleset={ruleset} />}
          {cmd === 'item' && <ItemScreen ruleset={ruleset} party={party} inventory={inventory} gold={gold}
            onApply={(p, inv) => { onRosterChange(p, formation, reserve); onInventoryChange(inv, gold) }} />}
          {cmd === 'magic' && <MagicScreen ruleset={ruleset} party={party}
            onApply={p => onRosterChange(p, formation, reserve)} />}
          {cmd === 'equip' && <MemberPick party={party} render={(char, idx) => (
            <EquipmentPanel char={char} ruleset={ruleset} inventory={inventory}
              onChange={c => updateChar(idx, c)} onInventoryChange={inv => onInventoryChange(inv, gold)} />
          )} />}
          {cmd === 'status' && <MemberPick party={party} render={(char, idx) => (
            <CharacterSheet char={char} ruleset={ruleset} inventory={inventory}
              onChange={c => updateChar(idx, c)} onInventoryChange={inv => onInventoryChange(inv, gold)} />
          )} />}
          {cmd === 'party' && <PartyScreen party={party} reserve={reserve} formation={formation} ruleset={ruleset}
            onRosterChange={onRosterChange} />}
          {cmd === 'journal' && <JournalScreen ruleset={ruleset} flags={flags} mc={mc} />}
          {cmd === 'camp' && <CampScreen onRest={onRest} onClose={onClose} />}
          {cmd === 'save' && <SaveScreen canSaveHere={canSaveHere} onSaveSlot={onSaveSlot} onLoadSlot={onLoadSlot} />}
          {cmd === 'config' && <ConfigScreen />}
        </div>

        {/* Party column */}
        <div className={cn(PANEL, 'w-52 flex-shrink-0 p-2 hidden md:flex flex-col gap-1.5 overflow-y-auto')}>
          {party.map(c => <PartyChip key={c.id} char={c} ruleset={ruleset} />)}
          {party.length === 0 && <div className="text-xs text-white/30 italic p-2">No party.</div>}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-white/50">
        <span>{mapName}</span>
        <span className="font-mono text-amber-200/80">{gold} G</span>
      </div>
    </div>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────────────

function HpMp({ char }: { char: Character }) {
  return (
    <div className="flex gap-2 text-[11px] font-mono">
      <span className="text-red-300">{char.hp}/{char.maxHp}</span>
      {char.maxMp > 0 && <span className="text-sky-300">{char.mp}/{char.maxMp}</span>}
    </div>
  )
}

function Avatar({ char, size = 28 }: { char: Character; size?: number }) {
  const cls = char.classId
  return char.portrait
    ? <div style={{ opacity: char.alive ? 1 : 0.4 }}><Portrait value={char.portrait} size={size} /></div>
    : <div className="grid place-items-center rounded bg-zinc-800 border border-white/10"
        style={{ width: size, height: size, opacity: char.alive ? 1 : 0.4 }} title={cls}><User className="w-4 h-4 text-white/50" /></div>
}

function PartyChip({ char, ruleset }: { char: Character; ruleset: Ruleset }) {
  const cls = ruleset.classes.find(c => c.id === char.classId)
  return (
    <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded border border-white/5 bg-white/[0.02]', !char.alive && 'opacity-50')}>
      <Avatar char={char} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white/85 truncate">{char.name}</div>
        <div className="text-[10px] text-white/40">Lv.{char.level} {cls?.name}</div>
      </div>
      <HpMp char={char} />
    </div>
  )
}

function PartySummary({ party, ruleset }: { party: Character[]; ruleset: Ruleset }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-white/40 mb-1">Party</div>
      {party.length === 0 && <div className="text-sm text-white/30 italic">No party members.</div>}
      <div className="grid sm:grid-cols-2 gap-2">
        {party.map(c => <PartyChip key={c.id} char={c} ruleset={ruleset} />)}
      </div>
    </div>
  )
}

/** Choose a party member, then render a per-character screen for them. */
function MemberPick({ party, render }: {
  party: Character[]; render: (char: Character, idx: number) => React.ReactNode
}) {
  const [idx, setIdx] = useState(0)
  const char = party[idx]
  if (party.length === 0) return <div className="text-sm text-white/30 italic">No party members.</div>
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {party.map((c, i) => (
          <button key={c.id} onClick={() => setIdx(i)}
            className={cn('flex items-center gap-1.5 px-2 py-1 rounded text-xs border',
              i === idx ? 'border-amber-400/50 bg-amber-500/15 text-amber-100' : 'border-white/10 text-white/60 hover:text-white')}>
            <Avatar char={c} size={18} /> {c.name}
          </button>
        ))}
      </div>
      {char && render(char, idx)}
    </div>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

function ItemScreen({ ruleset, party, inventory, onApply }: {
  ruleset: Ruleset; party: Character[]; inventory: ItemInstance[]; gold: number
  onApply: (party: Character[], inventory: ItemInstance[]) => void
}) {
  const [pending, setPending] = useState<string | null>(null)   // item id awaiting a target
  const usable = inventory.filter(inst => {
    const def = ruleset.items.find(d => d.id === inst.def)
    return def?.kind === 'consumable' && (def.onUse?.length ?? 0) > 0
  })
  const others = inventory.filter(inst => !usable.includes(inst))

  if (pending) {
    const def = ruleset.items.find(d => d.id === pending)
    return (
      <div className="space-y-3">
        <div className="text-sm text-white/70">Use <span className="text-amber-200">{def?.name}</span> on…</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {party.map((c, i) => (
            <button key={c.id} disabled={!c.alive} onClick={() => {
              const res = applyConsumable(pending, i, party, inventory, ruleset)
              if (res) { res.messages.forEach(m => toast(m)); onApply(res.party, res.inventory) }
              setPending(null)
            }} className={cn('flex items-center gap-2 px-2 py-2 rounded border text-left',
              c.alive ? 'border-white/10 hover:border-amber-400/40 hover:bg-amber-500/10' : 'border-white/5 opacity-40 cursor-not-allowed')}>
              <Avatar char={c} /> <div className="flex-1 min-w-0"><div className="text-sm truncate">{c.name}</div><HpMp char={c} /></div>
            </button>
          ))}
        </div>
        <button onClick={() => setPending(null)} className="text-xs text-white/40 hover:text-white">← Back</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-white/40">Consumables</div>
      {usable.length === 0 && <div className="text-sm text-white/30 italic">Nothing usable right now.</div>}
      <div className="space-y-1">
        {usable.map(inst => {
          const def = ruleset.items.find(d => d.id === inst.def)!
          return (
            <button key={inst.def} onClick={() => setPending(inst.def)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded border border-white/10 hover:border-amber-400/40 hover:bg-amber-500/10 text-left">
              <span>{def.icon ?? '🧪'}</span>
              <span className="flex-1 text-sm">{itemDisplayName(def, inst)}</span>
              <span className="text-xs text-white/40 font-mono">×{inst.qty}</span>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          )
        })}
      </div>
      {others.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wide text-white/40 pt-2">Other items</div>
          <div className="flex flex-wrap gap-1.5">
            {others.map(inst => {
              const def = ruleset.items.find(d => d.id === inst.def)
              return <span key={inst.def} className="px-2 py-1 rounded bg-white/5 text-xs text-white/60">{def?.icon} {itemDisplayName(def ?? { name: inst.def }, inst)} ×{inst.qty}</span>
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Magic ─────────────────────────────────────────────────────────────────────

function MagicScreen({ ruleset, party, onApply }: {
  ruleset: Ruleset; party: Character[]; onApply: (party: Character[]) => void
}) {
  const casters = party.filter(c => c.alive && c.knownSpells.some(id => ruleset.spells.find(s => s.id === id)?.outOfCombat))
  const [casterIdx, setCasterIdx] = useState<number>(() => party.findIndex(c => casters.includes(c)))
  const [spell, setSpell] = useState<SpellDef | null>(null)
  const caster = party[casterIdx]

  if (casters.length === 0) return <div className="text-sm text-white/30 italic">No one knows a field spell.</div>

  const spells = (caster?.knownSpells ?? [])
    .map(id => ruleset.spells.find(s => s.id === id))
    .filter((s): s is SpellDef => !!s && s.outOfCombat)

  const cast = (targetIdx: number) => {
    if (!spell || !caster) return
    if (caster.mp < spell.mpCost) { toast('Not enough MP.'); return }
    let p = party.map((c, i) => (i === casterIdx ? { ...c, mp: c.mp - spell.mpCost } : c))
    for (const eff of spell.effects as Effect[]) {
      const res = applyEffectToChar(eff, targetIdx, p, [], ruleset)
      p = res.party; res.messages.forEach(m => toast(m))
    }
    toast(`${caster.name} casts ${spell.name}.`)
    onApply(p)
    setSpell(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {party.map((c, i) => casters.includes(c) && (
          <button key={c.id} onClick={() => { setCasterIdx(i); setSpell(null) }}
            className={cn('flex items-center gap-1.5 px-2 py-1 rounded text-xs border',
              i === casterIdx ? 'border-amber-400/50 bg-amber-500/15 text-amber-100' : 'border-white/10 text-white/60 hover:text-white')}>
            <Avatar char={c} size={18} /> {c.name} <span className="text-sky-300 font-mono">{c.mp}/{c.maxMp}</span>
          </button>
        ))}
      </div>

      {!spell ? (
        <div className="space-y-1">
          {spells.length === 0 && <div className="text-sm text-white/30 italic">No field spells.</div>}
          {spells.map(s => (
            <button key={s.id} disabled={(caster?.mp ?? 0) < s.mpCost} onClick={() => setSpell(s)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 rounded border text-left',
                (caster?.mp ?? 0) < s.mpCost ? 'border-white/5 opacity-40' : 'border-white/10 hover:border-amber-400/40 hover:bg-amber-500/10')}>
              <span>{s.icon ?? '✨'}</span><span className="flex-1 text-sm">{s.name}</span>
              <span className="text-xs text-sky-300 font-mono">{s.mpCost} MP</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-white/70">Cast <span className="text-amber-200">{spell.name}</span> on…</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {party.map((c, i) => (
              <button key={c.id} disabled={!c.alive} onClick={() => cast(i)}
                className={cn('flex items-center gap-2 px-2 py-2 rounded border text-left',
                  c.alive ? 'border-white/10 hover:border-amber-400/40 hover:bg-amber-500/10' : 'border-white/5 opacity-40')}>
                <Avatar char={c} /><div className="flex-1 min-w-0"><div className="text-sm truncate">{c.name}</div><HpMp char={c} /></div>
              </button>
            ))}
          </div>
          <button onClick={() => setSpell(null)} className="text-xs text-white/40 hover:text-white">← Back</button>
        </div>
      )}
    </div>
  )
}

// ── Party (formation + bench/field) ────────────────────────────────────────────

function PartyScreen({ party, reserve, formation, ruleset, onRosterChange }: {
  party: Character[]; reserve: Character[]; formation: Formation; ruleset: Ruleset
  onRosterChange: (party: Character[], formation: Formation, reserve: Character[]) => void
}) {
  const cap = ruleset.meta.partySize ?? 6
  const remap = (nf: Formation, idx: number): Formation => {
    const r = (arr: number[]) => arr.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i))
    return { front: r(nf.front), back: r(nf.back) }
  }
  const bench = (idx: number) => {
    const c = party[idx]; if (!c) return
    onRosterChange(party.filter((_, i) => i !== idx), remap(formation, idx), [...reserve, c])
  }
  const field = (rIdx: number) => {
    const c = reserve[rIdx]; if (!c) return
    if (party.length >= cap) { toast('The party is full.'); return }
    onRosterChange([...party, c], formation, reserve.filter((_, i) => i !== rIdx))
  }

  return (
    <div className="space-y-4">
      <FormationWidget party={party} formation={formation}
        onFormationChange={nf => onRosterChange(party, nf, reserve)} />
      <div>
        <div className="text-xs uppercase tracking-wide text-white/40 mb-1.5">Active party ({party.length}/{cap})</div>
        <div className="space-y-1">
          {party.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/10 bg-white/[0.02]">
              <Avatar char={c} /><span className="flex-1 text-sm truncate">{c.name}</span><HpMp char={c} />
              <button onClick={() => bench(i)} className="text-[11px] px-2 py-0.5 rounded border border-sky-400/30 text-sky-300 hover:bg-sky-500/10">Bench</button>
            </div>
          ))}
        </div>
      </div>
      {reserve.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40 mb-1.5">Reserve ({reserve.length})</div>
          <div className="space-y-1">
            {reserve.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/5 bg-white/[0.01]">
                <Avatar char={c} /><span className="flex-1 text-sm text-white/70 truncate">{c.name}</span>
                <button onClick={() => field(i)} disabled={party.length >= cap}
                  className="text-[11px] px-2 py-0.5 rounded border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-30">Field</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Journal ─────────────────────────────────────────────────────────────────────

function JournalScreen({ ruleset, flags, mc }: {
  ruleset: Ruleset; flags: Record<string, boolean | number | string>; mc: Character | null
}) {
  const quests = (ruleset.quests ?? []).map(q => {
    const stage = Number(flags[questStageFlagKey(q.id)] ?? 0)
    return { q, stage, done: q.stages.length > 0 && stage >= q.stages.length }
  }).filter(x => x.stage >= 1)
  const lore = (ruleset.npcs ?? []).map(npc => ({
    npc, heard: (npc.lines ?? []).filter(l => flags[npcLineHeardFlagKey(npc.id, l.id)]),
  })).filter(x => x.heard.length > 0)

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-xs uppercase tracking-wide text-white/40 mb-1.5">Quests</div>
        {quests.length === 0 && <div className="text-white/30 italic text-xs">No active quests.</div>}
        {quests.map(({ q, stage, done }) => (
          <div key={q.id} className="rounded border border-white/10 bg-white/[0.02] px-3 py-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-amber-200/90 text-xs font-semibold">
              {done ? '✓' : '📜'} {q.name}<span className="ml-auto text-white/30 font-normal">{done ? 'done' : `${stage}/${q.stages.length}`}</span>
            </div>
            <div className="text-xs text-white/60 mt-1">{resolveText(q.stages[stage - 1]?.description ?? q.description, mc)}</div>
          </div>
        ))}
      </div>
      {lore.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-white/40 mb-1.5">Lore</div>
          {lore.map(({ npc, heard }) => (
            <div key={npc.id} className="rounded border border-white/10 bg-white/[0.02] px-3 py-2 mb-1.5">
              <div className="text-xs text-white/70 font-semibold mb-1">{npc.name}</div>
              {heard.map(l => <div key={l.id} className="text-xs text-white/50 italic">&ldquo;{resolveText(l.text.join(' '), mc)}&rdquo;</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Camp / Save / Config ────────────────────────────────────────────────────────

function CampScreen({ onRest, onClose }: { onRest?: () => void; onClose: () => void }) {
  if (!onRest) return <div className="text-sm text-white/30 italic">Camping is disabled for this game.</div>
  return (
    <div className="space-y-3 max-w-sm">
      <div className="text-sm text-white/70">Make camp to restore HP/MP and clear status ailments. On dangerous ground you may be ambushed.</div>
      <button onClick={() => { onRest(); onClose() }}
        className="flex items-center gap-2 px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold">
        <Tent className="w-4 h-4" /> Make camp
      </button>
    </div>
  )
}

function SaveScreen({ canSaveHere, onSaveSlot, onLoadSlot }: {
  canSaveHere: boolean; onSaveSlot?: (s: number) => void; onLoadSlot?: (s: number) => void
}) {
  const [slots, setSlots] = useState(() => listSaveSlots())
  const refresh = () => setSlots(listSaveSlots())
  return (
    <div className="space-y-2 max-w-md">
      {!canSaveHere && <div className="text-xs text-amber-300/80">You can only save at a save point here.</div>}
      {slots.map((s, i) => (
        <div key={i} className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-3 py-2">
          <SaveIcon className="w-4 h-4 text-white/40" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white/85">Slot {i + 1}</div>
            <div className="text-[11px] text-white/40">{s ? new Date(s.at).toLocaleString() : 'Empty'}</div>
          </div>
          <button onClick={() => { onSaveSlot?.(i); refresh() }} disabled={!canSaveHere}
            className="text-xs px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-30 text-white">Save</button>
          <button onClick={() => onLoadSlot?.(i)} disabled={!s}
            className="text-xs px-2.5 py-1 rounded border border-sky-400/30 text-sky-300 hover:bg-sky-500/10 disabled:opacity-30">Load</button>
        </div>
      ))}
    </div>
  )
}

function ConfigScreen() {
  return (
    <div className="space-y-2 text-sm text-white/60 max-w-sm">
      <div className="text-xs uppercase tracking-wide text-white/40 mb-1">Controls</div>
      <Row k="Move / turn" v="WASD or arrows" />
      <Row k="Interact" v="E" />
      <Row k="Menu" v="Tab" />
      <Row k="Toggle map" v="M" />
      <div className="text-[11px] text-white/30 pt-2">More options coming soon.</div>
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-white/5 py-1"><span>{k}</span><span className="font-mono text-white/80">{v}</span></div>
}
