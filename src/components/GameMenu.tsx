'use client'

/**
 * In-play main menu — an authentic Final Fantasy-style full-screen hub (Tab).
 * Blue gradient windows, a blinking pointer cursor, and *full keyboard control*:
 * every list is driven by ↑/↓ (←/→ where noted), Enter confirms, Esc backs out
 * (nested → screen → menu), Tab closes. Mouse works everywhere too. Reuses the
 * party editor's Equip/Status panels and the out-of-combat effect resolvers.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Backpack, Sparkles, Shield, User, Users, ScrollText, Tent, Save as SaveIcon, Settings2, X,
} from 'lucide-react'
import type { Character, Effect, Formation, ItemInstance, Ruleset, SpellDef } from '@/lib/engine-types'
import { Portrait } from '@/lib/portraits'
import { applyConsumable, applyEffectToChar } from '@/lib/apply-effects'
import { itemDisplayName } from '@/lib/item-schema'
import { questStageFlagKey, npcLineHeardFlagKey } from '@/lib/event-engine'
import { resolveText } from '@/lib/text-tokens'
import { listSaveSlots } from '@/lib/save-state'
import { EquipmentPanel, CharacterSheet } from '@/components/workspaces/PartyWorkspace'
import { cn } from '@/lib/utils'

// ── FF window styling ────────────────────────────────────────────────────────────

const ffWindow: React.CSSProperties = {
  background: 'linear-gradient(165deg, rgba(22,46,110,0.94) 0%, rgba(11,24,60,0.95) 55%, rgba(6,12,34,0.96) 100%)',
  border: '2px solid rgba(150,180,255,0.7)',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 0 22px rgba(40,80,200,0.25), 0 8px 34px rgba(0,0,0,0.6)',
  borderRadius: 8,
}
const ROW_SEL = 'bg-[rgba(120,160,255,0.18)]'

function Cursor({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="inline-block w-3 flex-shrink-0 text-amber-300"
      style={on ? { animation: 'ffblink 0.8s steps(1,end) infinite' } : { opacity: 0 }}>▶</span>
  )
}

function isFormField(e: KeyboardEvent): boolean {
  const t = (e.target as HTMLElement)?.tagName
  return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA'
}

/** Capture-phase keydown. Return true to consume (stops the game + sibling handlers). */
function useKeydown(handler: (e: KeyboardEvent) => boolean) {
  const ref = useRef(handler); ref.current = handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (ref.current(e)) { e.preventDefault(); e.stopImmediatePropagation() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

/** Vertical list cursor: ↑/↓ move (clamped), returns [cursor, setCursor, keyStep]. */
function useCursor(count: number): [number, (n: number) => void, (e: KeyboardEvent) => boolean] {
  const [cursor, setCursor] = useState(0)
  useEffect(() => { if (cursor > count - 1) setCursor(Math.max(0, count - 1)) }, [count, cursor])
  const keyStep = (e: KeyboardEvent): boolean => {
    if (e.key === 'ArrowDown') { setCursor(c => Math.min(count - 1, c + 1)); return true }
    if (e.key === 'ArrowUp') { setCursor(c => Math.max(0, c - 1)); return true }
    return false
  }
  return [cursor, setCursor, keyStep]
}

// ── Menu ─────────────────────────────────────────────────────────────────────────

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
  const exit = () => setCmd(null)

  // Tab closes from anywhere; the command list drives itself when no screen is open.
  useKeydown((e) => {
    if (e.key === 'Tab') { onClose(); return true }
    if (cmd !== null) return false
    if (isFormField(e)) return false
    if (e.key === 'ArrowDown') { setCursor(c => (c + 1) % COMMANDS.length); return true }
    if (e.key === 'ArrowUp') { setCursor(c => (c - 1 + COMMANDS.length) % COMMANDS.length); return true }
    if (e.key === 'Enter' || e.key === ' ') { setCmd(COMMANDS[cursor].id); return true }
    if (e.key === 'Escape') { onClose(); return true }
    return false
  })

  const updateChar = (idx: number, c: Character) =>
    onRosterChange(party.map((x, i) => (i === idx ? c : x)), formation, reserve)

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col p-4 sm:p-6 select-none text-white"
      style={{ fontFamily: 'ui-sans-serif, system-ui' }}>
      <style>{`@keyframes ffblink{0%,44%{opacity:1}55%,100%{opacity:0.08}}`}</style>

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold tracking-[0.3em] text-sky-200/90 uppercase" style={{ textShadow: '0 0 10px rgba(120,160,255,0.5)' }}>Menu</div>
        <button onClick={onClose} className="flex items-center gap-1 text-xs text-white/50 hover:text-white"><X className="w-4 h-4" /> Tab</button>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        {/* Command rail */}
        <div className="w-44 flex-shrink-0 p-2 flex flex-col gap-0.5" style={ffWindow}>
          {COMMANDS.map((c, i) => (
            <button key={c.id} onMouseEnter={() => !cmd && setCursor(i)} onClick={() => setCmd(c.id)}
              className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-left transition-colors',
                cmd === c.id ? 'text-amber-200' : cursor === i && !cmd ? cn(ROW_SEL, 'text-white') : 'text-white/75 hover:bg-white/5')}>
              <Cursor on={cursor === i && !cmd} />{c.icon}<span className="tracking-wide">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 overflow-y-auto" style={ffWindow}>
          {cmd === null && <PartySummary party={party} ruleset={ruleset} />}
          {cmd === 'item' && <ItemScreen ruleset={ruleset} party={party} inventory={inventory} onExit={exit}
            onApply={(p, inv) => { onRosterChange(p, formation, reserve); onInventoryChange(inv, gold) }} />}
          {cmd === 'magic' && <MagicScreen ruleset={ruleset} party={party} onExit={exit}
            onApply={p => onRosterChange(p, formation, reserve)} />}
          {cmd === 'equip' && <MemberScreen party={party} onExit={exit} render={(char, idx) => (
            <EquipmentPanel char={char} ruleset={ruleset} inventory={inventory}
              onChange={c => updateChar(idx, c)} onInventoryChange={inv => onInventoryChange(inv, gold)} />
          )} />}
          {cmd === 'status' && <MemberScreen party={party} onExit={exit} render={(char, idx) => (
            <CharacterSheet char={char} ruleset={ruleset} inventory={inventory}
              onChange={c => updateChar(idx, c)} onInventoryChange={inv => onInventoryChange(inv, gold)} />
          )} />}
          {cmd === 'party' && <PartyScreen party={party} reserve={reserve} formation={formation} ruleset={ruleset}
            onRosterChange={onRosterChange} onExit={exit} />}
          {cmd === 'journal' && <JournalScreen ruleset={ruleset} flags={flags} mc={mc} onExit={exit} />}
          {cmd === 'camp' && <CampScreen onRest={onRest} onClose={onClose} onExit={exit} />}
          {cmd === 'save' && <SaveScreen canSaveHere={canSaveHere} onSaveSlot={onSaveSlot} onLoadSlot={onLoadSlot} onExit={exit} />}
          {cmd === 'config' && <ConfigScreen onExit={exit} />}
        </div>

        {/* Party column */}
        <div className="w-52 flex-shrink-0 p-2 hidden md:flex flex-col gap-1.5 overflow-y-auto" style={ffWindow}>
          {party.map(c => <PartyChip key={c.id} char={c} ruleset={ruleset} />)}
          {party.length === 0 && <div className="text-xs text-white/30 italic p-2">No party.</div>}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/60 px-1">
        <span className="tracking-wide">{mapName}</span>
        <span className="font-mono text-amber-200/90">{gold} <span className="text-white/50">G</span></span>
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
  return char.portrait
    ? <div style={{ opacity: char.alive ? 1 : 0.4 }}><Portrait value={char.portrait} size={size} /></div>
    : <div className="grid place-items-center rounded bg-zinc-800 border border-white/10"
        style={{ width: size, height: size, opacity: char.alive ? 1 : 0.4 }}><User className="w-4 h-4 text-white/50" /></div>
}

function PartyChip({ char, ruleset }: { char: Character; ruleset: Ruleset }) {
  const cls = ruleset.classes.find(c => c.id === char.classId)
  return (
    <div className={cn('flex items-center gap-2 px-2 py-1.5 rounded border border-white/5 bg-white/[0.03]', !char.alive && 'opacity-50')}>
      <Avatar char={char} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white/90 truncate">{char.name}</div>
        <div className="text-[10px] text-white/45">Lv.{char.level} {cls?.name}</div>
      </div>
      <HpMp char={char} />
    </div>
  )
}

function PartySummary({ party, ruleset }: { party: Character[]; ruleset: Ruleset }) {
  return (
    <div className="space-y-2">
      <Heading>Party</Heading>
      {party.length === 0 && <div className="text-sm text-white/30 italic">No party members.</div>}
      <div className="grid sm:grid-cols-2 gap-2">{party.map(c => <PartyChip key={c.id} char={c} ruleset={ruleset} />)}</div>
      <div className="text-[11px] text-white/35 pt-2">↑/↓ select · Enter confirm · Esc back · Tab close</div>
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.2em] text-sky-200/70 mb-1.5" style={{ textShadow: '0 0 8px rgba(120,160,255,0.4)' }}>{children}</div>
}

/** A keyboard-navigable row; shows the blinking cursor when selected. */
function Row({ sel, onClick, disabled, children }: {
  sel: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-sm transition-colors',
        disabled ? 'opacity-35' : sel ? cn(ROW_SEL, 'text-white') : 'text-white/75 hover:bg-white/5')}>
      <Cursor on={sel} />{children}
    </button>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

function ItemScreen({ ruleset, party, inventory, onExit, onApply }: {
  ruleset: Ruleset; party: Character[]; inventory: ItemInstance[]; onExit: () => void
  onApply: (party: Character[], inventory: ItemInstance[]) => void
}) {
  const usable = inventory.filter(inst => {
    const def = ruleset.items.find(d => d.id === inst.def)
    return def?.kind === 'consumable' && (def.onUse?.length ?? 0) > 0
  })
  const [mode, setMode] = useState<'list' | 'target'>('list')
  const [iCur, , iStep] = useCursor(usable.length)
  const [tCur, , tStep] = useCursor(party.length)

  const use = (targetIdx: number) => {
    const inst = usable[iCur]; if (!inst) return
    const res = applyConsumable(inst.def, targetIdx, party, inventory, ruleset)
    if (res) { res.messages.forEach(m => toast(m)); onApply(res.party, res.inventory) }
    setMode('list')
  }

  useKeydown((e) => {
    if (isFormField(e)) return false
    if (mode === 'list') {
      if (iStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (usable[iCur]) setMode('target'); return true }
      if (e.key === 'Escape') { onExit(); return true }
    } else {
      if (tStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (party[tCur]?.alive) use(tCur); return true }
      if (e.key === 'Escape') { setMode('list'); return true }
    }
    return false
  })

  if (usable.length === 0) return <ScreenEmpty onExit={onExit}>Nothing usable right now.</ScreenEmpty>

  return (
    <div className="space-y-3">
      <Heading>{mode === 'list' ? 'Items' : `Use ${ruleset.items.find(d => d.id === usable[iCur]?.def)?.name} on…`}</Heading>
      {mode === 'list' ? (
        <div className="space-y-0.5 max-w-lg">
          {usable.map((inst, i) => {
            const def = ruleset.items.find(d => d.id === inst.def)!
            return (
              <Row key={inst.def} sel={i === iCur} onClick={() => { setMode('target') }}>
                <span>{def.icon ?? '🧪'}</span><span className="flex-1">{itemDisplayName(def, inst)}</span>
                <span className="text-xs text-white/45 font-mono">×{inst.qty}</span>
              </Row>
            )
          })}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-1.5 max-w-lg">
          {party.map((c, i) => (
            <Row key={c.id} sel={i === tCur} disabled={!c.alive} onClick={() => use(i)}>
              <Avatar char={c} size={20} /><span className="flex-1 truncate">{c.name}</span><HpMp char={c} />
            </Row>
          ))}
        </div>
      )}
      <Hint>{mode === 'list' ? '↑/↓ · Enter use · Esc back' : '↑/↓ target · Enter · Esc cancel'}</Hint>
    </div>
  )
}

// ── Magic ─────────────────────────────────────────────────────────────────────

function MagicScreen({ ruleset, party, onExit, onApply }: {
  ruleset: Ruleset; party: Character[]; onExit: () => void; onApply: (party: Character[]) => void
}) {
  const casterIdxs = party.map((c, i) => ({ c, i }))
    .filter(({ c }) => c.alive && c.knownSpells.some(id => ruleset.spells.find(s => s.id === id)?.outOfCombat))
  const [mode, setMode] = useState<'caster' | 'spell' | 'target'>('caster')
  const [cCur, , cStep] = useCursor(casterIdxs.length)
  const caster = casterIdxs[cCur]?.c
  const casterIdx = casterIdxs[cCur]?.i ?? -1
  const spells = (caster?.knownSpells ?? []).map(id => ruleset.spells.find(s => s.id === id))
    .filter((s): s is SpellDef => !!s && s.outOfCombat)
  const [sCur, , sStep] = useCursor(spells.length)
  const [tCur, , tStep] = useCursor(party.length)
  const spell = spells[sCur]

  const cast = (targetIdx: number) => {
    if (!spell || !caster) return
    if (caster.mp < spell.mpCost) { toast('Not enough MP.'); return }
    let p = party.map((c, i) => (i === casterIdx ? { ...c, mp: c.mp - spell.mpCost } : c))
    for (const eff of spell.effects as Effect[]) { const r = applyEffectToChar(eff, targetIdx, p, [], ruleset); p = r.party; r.messages.forEach(m => toast(m)) }
    toast(`${caster.name} casts ${spell.name}.`)
    onApply(p); setMode('spell')
  }

  useKeydown((e) => {
    if (isFormField(e)) return false
    if (mode === 'caster') {
      if (cStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (caster) setMode('spell'); return true }
      if (e.key === 'Escape') { onExit(); return true }
    } else if (mode === 'spell') {
      if (sStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (spell && caster && caster.mp >= spell.mpCost) setMode('target'); return true }
      if (e.key === 'Escape') { setMode('caster'); return true }
    } else {
      if (tStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (party[tCur]?.alive) cast(tCur); return true }
      if (e.key === 'Escape') { setMode('spell'); return true }
    }
    return false
  })

  if (casterIdxs.length === 0) return <ScreenEmpty onExit={onExit}>No one knows a field spell.</ScreenEmpty>

  return (
    <div className="space-y-3 max-w-lg">
      <Heading>Magic — {caster?.name}</Heading>
      {mode === 'caster' && (
        <div className="space-y-0.5">
          {casterIdxs.map(({ c }, i) => (
            <Row key={c.id} sel={i === cCur} onClick={() => setMode('spell')}>
              <Avatar char={c} size={20} /><span className="flex-1 truncate">{c.name}</span>
              <span className="text-sky-300 font-mono text-xs">{c.mp}/{c.maxMp} MP</span>
            </Row>
          ))}
        </div>
      )}
      {mode === 'spell' && (
        <div className="space-y-0.5">
          {spells.length === 0 && <div className="text-sm text-white/30 italic">No field spells.</div>}
          {spells.map((s, i) => (
            <Row key={s.id} sel={i === sCur} disabled={(caster?.mp ?? 0) < s.mpCost} onClick={() => setMode('target')}>
              <span>{s.icon ?? '✨'}</span><span className="flex-1">{s.name}</span>
              <span className="text-xs text-sky-300 font-mono">{s.mpCost} MP</span>
            </Row>
          ))}
        </div>
      )}
      {mode === 'target' && (
        <div className="grid sm:grid-cols-2 gap-1.5">
          {party.map((c, i) => (
            <Row key={c.id} sel={i === tCur} disabled={!c.alive} onClick={() => cast(i)}>
              <Avatar char={c} size={20} /><span className="flex-1 truncate">{c.name}</span><HpMp char={c} />
            </Row>
          ))}
        </div>
      )}
      <Hint>↑/↓ · Enter · Esc back</Hint>
    </div>
  )
}

// ── Equip / Status (member picker + reused panel) ──────────────────────────────

function MemberScreen({ party, onExit, render }: {
  party: Character[]; onExit: () => void; render: (char: Character, idx: number) => React.ReactNode
}) {
  const [cur, , step] = useCursor(party.length)
  useKeydown((e) => {
    if (isFormField(e)) return false   // let the panel's own selects/inputs take keys
    if (step(e)) return true
    if (e.key === 'Escape') { onExit(); return true }
    return false
  })
  if (party.length === 0) return <ScreenEmpty onExit={onExit}>No party members.</ScreenEmpty>
  const char = party[cur]
  return (
    <div className="flex gap-3 min-h-0">
      <div className="w-40 flex-shrink-0 space-y-0.5">
        {party.map((c, i) => (
          <Row key={c.id} sel={i === cur} onClick={() => { /* click selects via cursor below */ }}>
            <Avatar char={c} size={18} /><span className="flex-1 truncate">{c.name}</span>
          </Row>
        ))}
        <Hint>↑/↓ member · Tab into fields · Esc back</Hint>
      </div>
      <div className="flex-1 min-w-0 rounded border border-white/10 bg-black/20 p-1">
        {char && render(char, party.indexOf(char))}
      </div>
    </div>
  )
}

// ── Party (formation + bench/field, fully keyboard) ────────────────────────────

function PartyScreen({ party, reserve, formation, ruleset, onRosterChange, onExit }: {
  party: Character[]; reserve: Character[]; formation: Formation; ruleset: Ruleset
  onRosterChange: (party: Character[], formation: Formation, reserve: Character[]) => void
  onExit: () => void
}) {
  const cap = ruleset.meta.partySize ?? 6
  const rows = party.length + reserve.length
  const [cur, , step] = useCursor(rows)
  const inFront = (i: number) => formation.front.includes(i)

  const remap = (nf: Formation, idx: number): Formation => {
    const r = (arr: number[]) => arr.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i))
    return { front: r(nf.front), back: r(nf.back) }
  }
  const setRow = (idx: number, front: boolean) => {
    const nf: Formation = {
      front: front ? [...new Set([...formation.front, idx])] : formation.front.filter(i => i !== idx),
      back: front ? formation.back.filter(i => i !== idx) : [...new Set([...formation.back, idx])],
    }
    onRosterChange(party, nf, reserve)
  }
  const bench = (idx: number) => { const c = party[idx]; if (c) onRosterChange(party.filter((_, i) => i !== idx), remap(formation, idx), [...reserve, c]) }
  const field = (rIdx: number) => {
    const c = reserve[rIdx]; if (!c) return
    if (party.length >= cap) { toast('The party is full.'); return }
    onRosterChange([...party, c], formation, reserve.filter((_, i) => i !== rIdx))
  }

  useKeydown((e) => {
    if (isFormField(e)) return false
    if (step(e)) return true
    const inParty = cur < party.length
    if (e.key === 'ArrowLeft') { if (inParty) setRow(cur, true); return true }
    if (e.key === 'ArrowRight') { if (inParty) setRow(cur, false); return true }
    if (e.key === 'Enter' || e.key === ' ') { if (inParty) bench(cur); else field(cur - party.length); return true }
    if (e.key === 'Escape') { onExit(); return true }
    return false
  })

  return (
    <div className="space-y-3 max-w-xl">
      <Heading>Active party ({party.length}/{cap})</Heading>
      <div className="space-y-0.5">
        {party.map((c, i) => (
          <Row key={c.id} sel={cur === i} onClick={() => bench(i)}>
            <Avatar char={c} size={20} /><span className="flex-1 truncate">{c.name}</span>
            <button onClick={e => { e.stopPropagation(); setRow(i, !inFront(i)) }}
              className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono', inFront(i) ? 'bg-amber-500/20 text-amber-200' : 'bg-sky-500/20 text-sky-200')}>
              {inFront(i) ? 'FRONT' : 'BACK'}</button>
            <HpMp char={c} />
            <span className="text-[10px] text-sky-300/70">bench ⏎</span>
          </Row>
        ))}
      </div>
      {reserve.length > 0 && (
        <>
          <Heading>Reserve ({reserve.length})</Heading>
          <div className="space-y-0.5">
            {reserve.map((c, i) => (
              <Row key={c.id} sel={cur === party.length + i} disabled={party.length >= cap} onClick={() => field(i)}>
                <Avatar char={c} size={20} /><span className="flex-1 truncate text-white/70">{c.name}</span>
                <span className="text-[10px] text-emerald-300/70">field ⏎</span>
              </Row>
            ))}
          </div>
        </>
      )}
      <Hint>↑/↓ · ←/→ front/back · Enter bench/field · Esc back</Hint>
    </div>
  )
}

// ── Journal ─────────────────────────────────────────────────────────────────────

function JournalScreen({ ruleset, flags, mc, onExit }: {
  ruleset: Ruleset; flags: Record<string, boolean | number | string>; mc: Character | null; onExit: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  useKeydown((e) => {
    if (isFormField(e)) return false
    if (e.key === 'ArrowDown') { scroller.current?.scrollBy({ top: 60 }); return true }
    if (e.key === 'ArrowUp') { scroller.current?.scrollBy({ top: -60 }); return true }
    if (e.key === 'Escape') { onExit(); return true }
    return false
  })
  const quests = (ruleset.quests ?? []).map(q => {
    const stage = Number(flags[questStageFlagKey(q.id)] ?? 0)
    return { q, stage, done: q.stages.length > 0 && stage >= q.stages.length }
  }).filter(x => x.stage >= 1)
  const lore = (ruleset.npcs ?? []).map(npc => ({ npc, heard: (npc.lines ?? []).filter(l => flags[npcLineHeardFlagKey(npc.id, l.id)]) })).filter(x => x.heard.length > 0)

  return (
    <div ref={scroller} className="space-y-4 text-sm overflow-y-auto max-h-full pr-1">
      <Heading>Quests</Heading>
      {quests.length === 0 && <div className="text-white/30 italic text-xs">No active quests.</div>}
      {quests.map(({ q, stage, done }) => (
        <div key={q.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-1.5 text-amber-200/90 text-xs font-semibold">{done ? '✓' : '📜'} {q.name}<span className="ml-auto text-white/30 font-normal">{done ? 'done' : `${stage}/${q.stages.length}`}</span></div>
          <div className="text-xs text-white/60 mt-1">{resolveText(q.stages[stage - 1]?.description ?? q.description, mc)}</div>
        </div>
      ))}
      {lore.length > 0 && <>
        <Heading>Lore</Heading>
        {lore.map(({ npc, heard }) => (
          <div key={npc.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
            <div className="text-xs text-white/70 font-semibold mb-1">{npc.name}</div>
            {heard.map(l => <div key={l.id} className="text-xs text-white/50 italic">&ldquo;{resolveText(l.text.join(' '), mc)}&rdquo;</div>)}
          </div>
        ))}
      </>}
      <Hint>↑/↓ scroll · Esc back</Hint>
    </div>
  )
}

// ── Camp / Save / Config ────────────────────────────────────────────────────────

function CampScreen({ onRest, onClose, onExit }: { onRest?: () => void; onClose: () => void; onExit: () => void }) {
  useKeydown((e) => {
    if (e.key === 'Enter' || e.key === ' ') { if (onRest) { onRest(); onClose() } return true }
    if (e.key === 'Escape') { onExit(); return true }
    return false
  })
  if (!onRest) return <ScreenEmpty onExit={onExit}>Camping is disabled for this game.</ScreenEmpty>
  return (
    <div className="space-y-3 max-w-sm">
      <Heading>Camp</Heading>
      <div className="text-sm text-white/70">Restore HP/MP and clear status ailments. On dangerous ground you may be ambushed.</div>
      <Row sel onClick={() => { onRest(); onClose() }}><Tent className="w-4 h-4" /><span className="flex-1">Make camp</span></Row>
      <Hint>Enter confirm · Esc back</Hint>
    </div>
  )
}

function SaveScreen({ canSaveHere, onSaveSlot, onLoadSlot, onExit }: {
  canSaveHere: boolean; onSaveSlot?: (s: number) => void; onLoadSlot?: (s: number) => void; onExit: () => void
}) {
  const [slots, setSlots] = useState(() => listSaveSlots())
  const [cur, , step] = useCursor(slots.length)
  useKeydown((e) => {
    if (isFormField(e)) return false
    if (step(e)) return true
    if (e.key === 'Enter' || e.key === ' ') { if (canSaveHere) { onSaveSlot?.(cur); setSlots(listSaveSlots()) } return true }
    if (e.key === 'l' || e.key === 'L') { if (slots[cur]) onLoadSlot?.(cur); return true }
    if (e.key === 'Escape') { onExit(); return true }
    return false
  })
  return (
    <div className="space-y-2 max-w-md">
      <Heading>Save</Heading>
      {!canSaveHere && <div className="text-xs text-amber-300/80">You can only save at a save point here.</div>}
      <div className="space-y-0.5">
        {slots.map((s, i) => (
          <Row key={i} sel={cur === i} onClick={() => { if (canSaveHere) { onSaveSlot?.(i); setSlots(listSaveSlots()) } }}>
            <SaveIcon className="w-4 h-4 text-white/45" />
            <div className="flex-1 min-w-0"><div className="text-sm">Slot {i + 1}</div><div className="text-[10px] text-white/40">{s ? new Date(s.at).toLocaleString() : 'Empty'}</div></div>
            {s && <button onClick={e => { e.stopPropagation(); onLoadSlot?.(i) }} className="text-[10px] px-2 py-0.5 rounded border border-sky-400/30 text-sky-300 hover:bg-sky-500/10">Load</button>}
          </Row>
        ))}
      </div>
      <Hint>↑/↓ · Enter save · L load · Esc back</Hint>
    </div>
  )
}

function ConfigScreen({ onExit }: { onExit: () => void }) {
  useKeydown((e) => { if (e.key === 'Escape') { onExit(); return true } return false })
  return (
    <div className="space-y-2 text-sm text-white/70 max-w-sm">
      <Heading>Controls</Heading>
      {[['Move / turn', 'WASD or arrows'], ['Interact', 'E'], ['Menu', 'Tab'], ['Toggle map', 'M']].map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-white/5 py-1"><span>{k}</span><span className="font-mono text-white/85">{v}</span></div>
      ))}
      <Hint>Esc back</Hint>
    </div>
  )
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-white/35 pt-2">{children}</div>
}
function ScreenEmpty({ children, onExit }: { children: React.ReactNode; onExit: () => void }) {
  useKeydown((e) => { if (e.key === 'Escape') { onExit(); return true } return false })
  return <div className="text-sm text-white/30 italic">{children}<Hint>Esc back</Hint></div>
}
