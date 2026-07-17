'use client'

/**
 * In-play main menu — an authentic Final Fantasy-style full-screen hub (Tab).
 * Blue gradient windows, a blinking pointer cursor, and *full keyboard control*:
 * every list is driven by ↑/↓ (←/→ where noted), Enter confirms, Esc backs out
 * (nested → screen → menu), Tab closes. Mouse works everywhere too. Reuses the
 * party editor's Equip/Status panels and the out-of-combat effect resolvers.
 *
 * Notifications inside the menu are front-and-center FF alert windows, not
 * corner toasts: while mounted, the menu registers itself as the notify()
 * sink, so messages from its own screens, the reused panels, and the
 * save/load handlers all land in the modal alert queue.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Backpack, Sparkles, Shield, User, Users, ScrollText, Tent, Save as SaveIcon, Settings2, X,
} from 'lucide-react'
import type { Character, Effect, Formation, ItemDef, ItemInstance, Ruleset, SpellDef } from '@/lib/engine-types'
import { deriveMaxHp, deriveMaxMp } from '@/lib/engine-types'
import { Portrait } from '@/lib/portraits'
import { applyConsumable, applyEffectToChar } from '@/lib/apply-effects'
import { canEquip } from '@/lib/equipment'
import { itemDisplayName } from '@/lib/item-schema'
import { questStageFlagKey, dialogueSeenFlagKey } from '@/lib/event-engine'
import { resolveText } from '@/lib/text-tokens'
import { listSaveSlots } from '@/lib/save-state'
import { music } from '@/lib/audio-controller'
import { notify, setNotifySink, type NotifyKind } from '@/lib/notify'
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

// ── Front-and-center menu alerts (replaces corner toasts inside the menu) ────────

/** While an alert window is up, the menu is modal: this holds its dismiss
 *  action so every keydown handler feeds keys to the alert instead of its own
 *  screen. Module scope — all handlers in this file share it. */
const alertDismiss: { current: (() => void) | null } = { current: null }

interface MenuAlertMsg { lines: string[]; kind: NotifyKind }

/** FF-style message window, dead center. Enter/Space/Esc or a click confirms;
 *  further messages queue behind it. */
function MenuAlertBox({ alert, queued, onDismiss }: { alert: MenuAlertMsg; queued: number; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/45" onClick={onDismiss}>
      <div className="min-w-[300px] max-w-lg px-7 py-5 text-center space-y-1" style={ffWindow}>
        {alert.lines.map((l, i) => (
          <div key={i} className={cn('text-sm leading-relaxed', alert.kind === 'error' ? 'text-rose-200' : 'text-white/95')}>{l}</div>
        ))}
        <div className="pt-1.5 flex items-center justify-center gap-2 text-amber-300 text-xs">
          <span style={{ animation: 'ffblink 0.8s steps(1,end) infinite' }}>▼</span>
          {queued > 0 && <span className="text-[10px] text-white/40 font-mono">+{queued} more</span>}
        </div>
      </div>
    </div>
  )
}

/** Capture-phase keydown. Return true to consume (stops the game + sibling handlers). */
function useKeydown(handler: (e: KeyboardEvent) => boolean) {
  const ref = useRef(handler); ref.current = handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open alert is modal: the first handler to see the key confirms it
      // and swallows the event from every sibling and the game beneath.
      const dismiss = alertDismiss.current
      if (dismiss) {
        if (!e.repeat && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) dismiss()
        e.preventDefault(); e.stopImmediatePropagation()
        return
      }
      if (ref.current(e)) { e.preventDefault(); e.stopImmediatePropagation() }
    }
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
  const [desc, setDesc] = useState<React.ReactNode>(null)   // description bar content
  const mc = useMemo(() => party.find(c => c.isMc) ?? null, [party])
  const exit = () => setCmd(null)
  useEffect(() => { setDesc(null) }, [cmd])   // clear the description bar on screen change

  // While the menu is up, every notify() — including those fired by reused
  // panels and the save/load handlers — becomes a queued FF alert window.
  const [alerts, setAlerts] = useState<MenuAlertMsg[]>([])
  useEffect(() => setNotifySink((lines, kind) => setAlerts(q => [...q, { lines, kind }])), [])
  const dismissAlert = useCallback(() => setAlerts(q => q.slice(1)), [])
  const alertOpen = alerts.length > 0
  useEffect(() => {
    alertDismiss.current = alertOpen ? dismissAlert : null
    return () => { alertDismiss.current = null }
  }, [alertOpen, dismissAlert])

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

  const pendingPoints = party.reduce((s, c) => s + (c.unspentPoints ?? 0), 0)

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
              {c.id === 'status' && pendingPoints > 0 && (
                <span className="ml-auto text-[10px] px-1 rounded bg-amber-500/25 text-amber-200 font-bold">+{pendingPoints}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 overflow-y-auto" style={ffWindow}>
          {cmd === null && <PartySummary party={party} ruleset={ruleset} />}
          {cmd === 'item' && <ItemScreen ruleset={ruleset} party={party} inventory={inventory} onExit={exit} onDesc={setDesc}
            onApply={(p, inv) => { onRosterChange(p, formation, reserve); onInventoryChange(inv, gold) }} />}
          {cmd === 'magic' && <MagicScreen ruleset={ruleset} party={party} onExit={exit} onDesc={setDesc}
            onApply={p => onRosterChange(p, formation, reserve)} />}
          {cmd === 'equip' && <MemberScreen party={party} onExit={exit} render={(char, idx) => (
            <EquipmentPanel char={char} ruleset={ruleset} inventory={inventory}
              onChange={c => updateChar(idx, c)} onInventoryChange={inv => onInventoryChange(inv, gold)} />
          )} />}
          {cmd === 'status' && <MemberScreen party={party} onExit={exit} render={(char, idx) => (
            <div className="space-y-3">
              <PointSpend char={char} ruleset={ruleset} onChange={c => updateChar(idx, c)} />
              <CharacterSheet char={char} ruleset={ruleset} inventory={inventory} mode="play"
                onChange={c => updateChar(idx, c)} onInventoryChange={inv => onInventoryChange(inv, gold)} />
            </div>
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

      {/* Description bar — reflects the focused row (keyboard cursor or mouse hover) */}
      {desc && (
        <div className="mt-3 px-3 py-2 text-sm text-white/85 min-h-[2.5rem] flex items-center" style={ffWindow}>
          {desc}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-white/60 px-1">
        <span className="tracking-wide">{mapName}</span>
        <span className="font-mono text-amber-200/90">{gold} <span className="text-white/50">G</span></span>
      </div>

      {alerts.length > 0 && <MenuAlertBox alert={alerts[0]} queued={alerts.length - 1} onDismiss={dismissAlert} />}
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

/** A keyboard-navigable row; shows the blinking cursor when selected. Hovering
 *  moves the focus (so the mouse and keyboard share one cursor). */
function Row({ sel, onClick, onHover, disabled, children }: {
  sel: boolean; onClick?: () => void; onHover?: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button disabled={disabled} onClick={onClick} onMouseEnter={onHover}
      className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-sm transition-colors',
        disabled ? 'opacity-35' : sel ? cn(ROW_SEL, 'text-white') : 'text-white/75 hover:bg-white/5')}>
      <Cursor on={sel} />{children}
    </button>
  )
}

// ── Inventory / description helpers ──────────────────────────────────────────────

function addOne(inv: ItemInstance[], id: string): ItemInstance[] {
  const idx = inv.findIndex(i => i.def === id && !i.unidentified)
  if (idx >= 0) return inv.map((x, i) => (i === idx ? { ...x, qty: x.qty + 1 } : x))
  return [...inv, { def: id, qty: 1 }]
}
function removeN(inv: ItemInstance[], id: string, n: number): ItemInstance[] {
  let left = n
  return inv.map(x => {
    if (x.def !== id || left <= 0) return x
    const take = Math.min(left, x.qty); left -= take
    return { ...x, qty: x.qty - take }
  }).filter(x => x.qty > 0)
}

const KIND_ORDER: Record<string, number> = { weapon: 0, armor: 1, consumable: 2, misc: 3, key: 4, quest: 5 }
function sortInv(inv: ItemInstance[], ruleset: Ruleset): ItemInstance[] {
  return [...inv].sort((a, b) => {
    const da = ruleset.items.find(i => i.id === a.def), db = ruleset.items.find(i => i.id === b.def)
    const ka = KIND_ORDER[da?.kind ?? 'misc'] ?? 3, kb = KIND_ORDER[db?.kind ?? 'misc'] ?? 3
    return ka !== kb ? ka - kb : (da?.name ?? a.def).localeCompare(db?.name ?? b.def)
  })
}

/** Equip an inventory item onto a member; returns changed=false (with a reason)
 *  when the slot is disallowed or the current item is cursed. */
function equipFrom(char: Character, itemId: string, ruleset: Ruleset, inventory: ItemInstance[]): { char: Character; inventory: ItemInstance[]; message: string; changed: boolean } {
  const def = ruleset.items.find(i => i.id === itemId)
  if (!def?.slot) return { char, inventory, message: 'That cannot be equipped.', changed: false }
  const cls = ruleset.classes.find(c => c.id === char.classId)
  const gate = canEquip(cls, def, ruleset, char.equipment)
  if (!gate.ok) return { char, inventory, message: gate.reason ?? `${char.name} can't equip that.`, changed: false }
  let inv = inventory
  const current = char.equipment[def.slot]
  if (current) {
    if (ruleset.items.find(i => i.id === current.def)?.cursed) return { char, inventory, message: 'The equipped item is cursed — it will not come off.', changed: false }
    inv = addOne(inv, current.def)
  }
  inv = removeN(inv, itemId, 1)
  const message = def.cursed ? `${char.name} equips ${def.name} — it seizes hold! Cursed!` : `${char.name} equips ${def.name}.`
  return { char: { ...char, equipment: { ...char.equipment, [def.slot]: { def: itemId, qty: 1 } } }, inventory: inv, message, changed: true }
}

function summarizeEffects(effects: Effect[], ruleset: Ruleset): string {
  const bits: string[] = []
  for (const e of effects) {
    if (e.t === 'heal') bits.push(`restores ${e.amount} HP`)
    else if (e.t === 'restoreMp') bits.push(`restores ${e.amount} MP`)
    else if (e.t === 'fullHeal') bits.push('fully restores')
    else if (e.t === 'reviveRandom') bits.push('revives an ally')
    else if (e.t === 'cure') bits.push(`cures ${e.status === 'all' ? 'all ailments' : ruleset.statusEffects.find(s => s.id === e.status)?.name ?? e.status}`)
    else if (e.t === 'damage') bits.push(`${e.amount} ${e.dmgType} damage`)
    else if (e.t === 'status') bits.push(`inflicts ${ruleset.statusEffects.find(s => s.id === e.status)?.name ?? e.status}`)
  }
  return bits.join('; ')
}

function describeItem(def: ItemDef | undefined, ruleset: Ruleset): React.ReactNode {
  if (!def) return null
  const bits: string[] = []
  if (def.kind === 'consumable') bits.push(summarizeEffects(def.onUse ?? [], ruleset))
  else if (def.kind === 'weapon') bits.push('Weapon')
  else if (def.kind === 'armor') bits.push('Armor')
  else if (def.kind === 'accessory') bits.push('Accessory')
  else if (def.kind === 'key') bits.push('Key item')
  else if (def.kind === 'quest') bits.push('Quest item')
  const mods = (def.modifiers ?? []).map(m => `${m.op === 'mul' ? '×' : '+'}${m.amount} ${m.key}`).join(', ')
  if (mods) bits.push(mods)
  const extra = bits.filter(Boolean).join(' · ')
  return <span><span className="text-amber-200">{def.name}</span>{def.description ? <span className="text-white/75"> — {def.description}</span> : null}{extra ? <span className="text-white/45"> ({extra})</span> : null}</span>
}

function describeSpell(def: SpellDef | undefined, ruleset: Ruleset): React.ReactNode {
  if (!def) return null
  const eff = summarizeEffects(def.effects, ruleset)
  return <span><span className="text-amber-200">{def.name}</span> <span className="text-sky-300 font-mono">MP {def.mpCost}</span>{def.description ? <span className="text-white/75"> — {def.description}</span> : null}{eff ? <span className="text-white/45"> ({eff})</span> : null}</span>
}

// ── Item ──────────────────────────────────────────────────────────────────────

type ItemAction = 'use' | 'equip' | 'drop'
function itemActions(def: ItemDef | undefined): { id: ItemAction; label: string }[] {
  if (!def) return []
  const out: { id: ItemAction; label: string }[] = []
  if (def.kind === 'consumable' && (def.onUse?.length ?? 0) > 0) out.push({ id: 'use', label: 'Use' })
  if ((def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'accessory') && def.slot) out.push({ id: 'equip', label: 'Equip' })
  if (def.kind !== 'key' && def.kind !== 'quest') out.push({ id: 'drop', label: 'Drop' })   // story items protected
  return out
}

function ItemScreen({ ruleset, party, inventory, onExit, onApply, onDesc }: {
  ruleset: Ruleset; party: Character[]; inventory: ItemInstance[]; onExit: () => void
  onApply: (party: Character[], inventory: ItemInstance[]) => void
  onDesc: (node: React.ReactNode) => void
}) {
  const [mode, setMode] = useState<'list' | 'action' | 'target' | 'member' | 'drop'>('list')
  const [iCur, setICur, iStep] = useCursor(inventory.length)
  const [tCur, , tStep] = useCursor(party.length)
  const [dropQty, setDropQty] = useState(1)
  const sel = inventory[iCur]
  const selDef = sel ? ruleset.items.find(d => d.id === sel.def) : undefined
  const actions = itemActions(selDef)
  const [aCur, , aStep] = useCursor(actions.length)

  // Description bar follows the focused item.
  useEffect(() => { onDesc(describeItem(selDef, ruleset)) }, [iCur, mode, inventory, selDef, ruleset, onDesc])

  const doUse = (t: number) => { if (!sel) return; const r = applyConsumable(sel.def, t, party, inventory, ruleset); if (r) { notify(r.messages); onApply(r.party, r.inventory) } setMode('list') }
  const doEquip = (m: number) => {
    if (!sel) return
    const r = equipFrom(party[m], sel.def, ruleset, inventory)
    if (r.changed) { notify(r.message, 'success'); onApply(party.map((c, i) => (i === m ? r.char : c)), r.inventory) }
    else notify(r.message)
    setMode('list')
  }
  const doDrop = () => { if (!sel) return; onApply(party, removeN(inventory, sel.def, Math.min(dropQty, sel.qty))); setMode('list') }
  const openActions = () => { if (actions.length) setMode('action') }

  useKeydown((e) => {
    if (isFormField(e)) return false
    if (mode === 'list') {
      if (iStep(e)) return true
      if ((e.key === 's' || e.key === 'S')) { onApply(party, sortInv(inventory, ruleset)); return true }
      if (e.key === 'Enter' || e.key === ' ') { openActions(); return true }
      if (e.key === 'Escape') { onExit(); return true }
    } else if (mode === 'action') {
      if (aStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') {
        const a = actions[aCur]?.id
        if (a === 'use') setMode('target'); else if (a === 'equip') setMode('member'); else if (a === 'drop') { setDropQty(1); setMode('drop') }
        return true
      }
      if (e.key === 'Escape') { setMode('list'); return true }
    } else if (mode === 'target') {
      if (tStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (party[tCur]?.alive) doUse(tCur); return true }
      if (e.key === 'Escape') { setMode('action'); return true }
    } else if (mode === 'member') {
      if (tStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { doEquip(tCur); return true }
      if (e.key === 'Escape') { setMode('action'); return true }
    } else { // drop
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setDropQty(q => Math.min(sel?.qty ?? 1, q + 1)); return true }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setDropQty(q => Math.max(1, q - 1)); return true }
      if (e.key === 'Enter' || e.key === ' ') { doDrop(); return true }
      if (e.key === 'Escape') { setMode('action'); return true }
    }
    return false
  })

  if (inventory.length === 0) return <ScreenEmpty onExit={onExit}>Your pack is empty.</ScreenEmpty>

  return (
    <div className="flex gap-3">
      {/* Item list (always visible) */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between mb-1">
          <Heading>Items</Heading>
          <button onClick={() => onApply(party, sortInv(inventory, ruleset))}
            className="text-[10px] px-2 py-0.5 rounded border border-white/15 text-white/50 hover:text-white">Sort (S)</button>
        </div>
        {inventory.map((inst, i) => {
          const def = ruleset.items.find(d => d.id === inst.def)
          return (
            <Row key={`${inst.def}_${i}`} sel={i === iCur && mode !== 'target' && mode !== 'member'}
              onHover={() => { if (mode === 'list' || mode === 'action') setICur(i) }}
              onClick={() => { setICur(i); if (mode === 'list') openActions() }}>
              <span>{def?.icon ?? '📦'}</span>
              <span className="flex-1 truncate">{itemDisplayName(def ?? { name: inst.def }, inst)}</span>
              <span className="text-xs text-white/45 font-mono">×{inst.qty}</span>
            </Row>
          )
        })}
      </div>

      {/* Contextual sub-panel */}
      <div className="w-52 flex-shrink-0">
        {mode === 'action' && (
          <div className="space-y-0.5">
            <Heading>{selDef?.name}</Heading>
            {actions.map((a, i) => (
              <Row key={a.id} sel={i === aCur} onClick={() => {
                if (a.id === 'use') setMode('target'); else if (a.id === 'equip') setMode('member'); else { setDropQty(1); setMode('drop') }
              }}><span className="flex-1">{a.label}</span></Row>
            ))}
            {actions.length === 0 && <div className="text-xs text-white/30 italic">Nothing to do.</div>}
            <Hint>↑/↓ · Enter · Esc</Hint>
          </div>
        )}
        {(mode === 'target' || mode === 'member') && (
          <div className="space-y-0.5">
            <Heading>{mode === 'target' ? 'Use on…' : 'Equip to…'}</Heading>
            {party.map((c, i) => (
              <Row key={c.id} sel={i === tCur} disabled={mode === 'target' && !c.alive}
                onClick={() => (mode === 'target' ? doUse(i) : doEquip(i))}>
                <Avatar char={c} size={18} /><span className="flex-1 truncate">{c.name}</span><HpMp char={c} />
              </Row>
            ))}
            <Hint>↑/↓ · Enter · Esc</Hint>
          </div>
        )}
        {mode === 'drop' && sel && (
          <div className="space-y-2">
            <Heading>Drop how many?</Heading>
            <div className="flex items-center gap-3 text-lg font-mono">
              <span className="text-white/40">◀</span>
              <span className="text-amber-200">{dropQty}</span>
              <span className="text-white/40">▶</span>
              <span className="text-xs text-white/40">/ {sel.qty}</span>
            </div>
            <Hint>←/→ qty · Enter drop · Esc</Hint>
          </div>
        )}
        {mode === 'list' && <div className="text-[11px] text-white/35 pt-6">↑/↓ select · Enter · S sort · Esc back</div>}
      </div>
    </div>
  )
}

// ── Magic ─────────────────────────────────────────────────────────────────────

function MagicScreen({ ruleset, party, onExit, onApply, onDesc }: {
  ruleset: Ruleset; party: Character[]; onExit: () => void
  onApply: (party: Character[]) => void; onDesc: (node: React.ReactNode) => void
}) {
  const casterIdxs = party.map((c, i) => ({ c, i }))
    .filter(({ c }) => c.alive && c.knownSpells.some(id => ruleset.spells.find(s => s.id === id)?.outOfCombat))
  const [mode, setMode] = useState<'caster' | 'spell' | 'action' | 'target'>('caster')
  const [cCur, setCCur, cStep] = useCursor(casterIdxs.length)
  const caster = casterIdxs[cCur]?.c
  const casterIdx = casterIdxs[cCur]?.i ?? -1
  const schoolOrder = (id: string) => { const i = (ruleset.spellSchools ?? []).findIndex(s => s.id === id); return i < 0 ? 999 : i }
  const spells = (caster?.knownSpells ?? []).map(id => ruleset.spells.find(s => s.id === id))
    .filter((s): s is SpellDef => !!s && s.outOfCombat)
    .sort((a, b) => schoolOrder(a.school) - schoolOrder(b.school))
  const [sCur, setSCur, sStep] = useCursor(spells.length)
  const [tCur, , tStep] = useCursor(party.length)
  const [aCur, , aStep] = useCursor(1)   // just "Cast" for now (room for Skills later)
  const spell = spells[sCur]

  // Description bar follows the focused spell (once past caster select).
  useEffect(() => { onDesc(mode === 'caster' ? null : describeSpell(spell, ruleset)) }, [mode, spell, ruleset, onDesc])

  const cast = (targetIdx: number) => {
    if (!spell || !caster) return
    if (caster.mp < spell.mpCost) { notify('Not enough MP.'); return }
    let p = party.map((c, i) => (i === casterIdx ? { ...c, mp: c.mp - spell.mpCost } : c))
    const messages: string[] = [`${caster.name} casts ${spell.name}.`]
    for (const eff of spell.effects as Effect[]) { const r = applyEffectToChar(eff, targetIdx, p, [], ruleset); p = r.party; messages.push(...r.messages) }
    notify(messages)
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
      if (e.key === 'Enter' || e.key === ' ') { if (spell) setMode('action'); return true }
      if (e.key === 'Escape') { setMode('caster'); return true }
    } else if (mode === 'action') {
      if (aStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (spell && caster && caster.mp >= spell.mpCost) setMode('target'); else notify('Not enough MP.'); return true }
      if (e.key === 'Escape') { setMode('spell'); return true }
    } else {
      if (tStep(e)) return true
      if (e.key === 'Enter' || e.key === ' ') { if (party[tCur]?.alive) cast(tCur); return true }
      if (e.key === 'Escape') { setMode('action'); return true }
    }
    return false
  })

  if (casterIdxs.length === 0) return <ScreenEmpty onExit={onExit}>No one knows a field spell.</ScreenEmpty>

  return (
    <div className="flex gap-3">
      <div className="flex-1 min-w-0 space-y-0.5">
        <Heading>{mode === 'caster' ? 'Choose caster' : `${caster?.name} — Magic`}</Heading>
        {mode === 'caster' ? (
          casterIdxs.map(({ c }, i) => (
            <Row key={c.id} sel={i === cCur} onHover={() => setCCur(i)} onClick={() => { setCCur(i); setMode('spell') }}>
              <Avatar char={c} size={20} /><span className="flex-1 truncate">{c.name}</span>
              <span className="text-sky-300 font-mono text-xs">{c.mp}/{c.maxMp} MP</span>
            </Row>
          ))
        ) : (
          <>
            {spells.length === 0 && <div className="text-sm text-white/30 italic">No field spells.</div>}
            {spells.map((s, i) => {
              const sc = ruleset.spellSchools?.find(x => x.id === s.school)
              return (
                <Row key={s.id} sel={i === sCur} disabled={(caster?.mp ?? 0) < s.mpCost}
                  onHover={() => mode === 'spell' && setSCur(i)}
                  onClick={() => { setSCur(i); setMode('action') }}>
                  <span>{s.icon ?? '✨'}</span><span className="flex-1">{s.name}</span>
                  {sc && <span className="text-[10px] px-1 rounded" style={{ color: sc.color ?? '#aaa', background: `${sc.color ?? '#888'}22` }}>{sc.icon} {sc.name}</span>}
                  <span className="text-xs text-sky-300 font-mono">{s.mpCost} MP</span>
                </Row>
              )
            })}
          </>
        )}
      </div>

      <div className="w-52 flex-shrink-0">
        {mode === 'action' && (
          <div className="space-y-0.5">
            <Heading>{spell?.name}</Heading>
            <Row sel={aCur === 0} onClick={() => setMode('target')}><span className="flex-1">Cast</span></Row>
            <Hint>↑/↓ · Enter · Esc</Hint>
          </div>
        )}
        {mode === 'target' && (
          <div className="space-y-0.5">
            <Heading>Cast on…</Heading>
            {party.map((c, i) => (
              <Row key={c.id} sel={i === tCur} disabled={!c.alive} onClick={() => cast(i)}>
                <Avatar char={c} size={18} /><span className="flex-1 truncate">{c.name}</span><HpMp char={c} />
              </Row>
            ))}
            <Hint>↑/↓ · Enter · Esc</Hint>
          </div>
        )}
        {(mode === 'caster' || mode === 'spell') && <div className="text-[11px] text-white/35 pt-6">↑/↓ select · Enter · Esc back</div>}
      </div>
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

// ── Level-up point allocation (Status screen) ──────────────────────────────────

/** Spend banked level-up points (+1 per click, clamped to each attribute's
 *  max). HP/MP maxima re-derive immediately so END/INT/SPI spends feel real. */
function PointSpend({ char, ruleset, onChange }: {
  char: Character; ruleset: Ruleset; onChange: (c: Character) => void
}) {
  const points = char.unspentPoints ?? 0
  if (points <= 0) return null
  const cls = ruleset.classes.find(c => c.id === char.classId)

  const spend = (attrId: string) => {
    const attr = ruleset.attributes.find(a => a.id === attrId)
    if (!attr || points <= 0) return
    const short = attr.id.replace('attr.', '')
    const key = char.attributes[attr.id] !== undefined ? attr.id
      : char.attributes[short] !== undefined ? short : attr.id
    const cur = char.attributes[key] ?? attr.default
    if (cur >= attr.max) return
    const attributes = { ...char.attributes, [key]: cur + 1 }
    let next: Character = { ...char, attributes, unspentPoints: points - 1 }
    if (cls) {
      // Raise maxima in place; current HP/MP grows by the same delta.
      const newMaxHp = deriveMaxHp({ level: next.level, attributes }, cls)
      const newMaxMp = deriveMaxMp({ level: next.level, attributes }, cls)
      next = {
        ...next,
        hp: next.hp + Math.max(0, newMaxHp - next.maxHp), maxHp: newMaxHp,
        mp: next.mp + Math.max(0, newMaxMp - next.maxMp), maxMp: newMaxMp,
      }
    }
    onChange(next)
  }

  return (
    <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2.5 space-y-1.5">
      <div className="text-xs font-bold text-amber-200">
        ✦ {points} attribute point{points === 1 ? '' : 's'} to allocate
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {ruleset.attributes.map(attr => {
          const short = attr.id.replace('attr.', '')
          const val = char.attributes[attr.id] ?? char.attributes[short] ?? attr.default
          const capped = val >= attr.max
          return (
            <div key={attr.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 text-white/75">{attr.name}</span>
              <span className="tabular-nums text-white/90 w-8 text-right">{val}<span className="text-white/30">/{attr.max}</span></span>
              <button onClick={() => spend(attr.id)} disabled={capped}
                title={capped ? `${attr.name} is at its cap` : `Raise ${attr.name}`}
                className={cn('w-5 h-5 grid place-items-center rounded text-sm font-bold',
                  capped ? 'bg-zinc-800 text-white/20 cursor-not-allowed' : 'bg-amber-500/25 text-amber-200 hover:bg-amber-500/40')}>
                +
              </button>
            </div>
          )
        })}
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
  const bench = (idx: number) => {
    const c = party[idx]
    if (!c) return
    if (c.isMc) { notify('The hero must lead the party.'); return }
    if (party.length <= 1) { notify('At least one member must stay in the field.'); return }
    onRosterChange(party.filter((_, i) => i !== idx), remap(formation, idx), [...reserve, c])
  }
  const field = (rIdx: number) => {
    const c = reserve[rIdx]; if (!c) return
    if (party.length >= cap) { notify('The party is full.'); return }
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
            {c.isMc
              ? <span className="text-[10px] text-amber-300/70">👑 leader</span>
              : party.length > 1
                ? <span className="text-[10px] text-sky-300/70">bench ⏎</span>
                : <span className="text-[10px] text-white/25">—</span>}
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
  const lore = (ruleset.npcs ?? []).map(npc => {
    const dlg = npc.dialogue ? (ruleset.dialogues ?? []).find(d => d.id === npc.dialogue) : undefined
    return { npc, heard: dlg ? dlg.nodes.filter(n => flags[dialogueSeenFlagKey(dlg.id, n.id)]) : [] }
  }).filter(x => x.heard.length > 0)

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
  const [volume, setVolume] = useState(() => music.getVolume())
  const [muted, setMuted] = useState(() => music.isMuted())
  const [sfxVolume, setSfxVol] = useState(() => music.getSfxVolume())
  const [sfxMuted, setSfxMuted] = useState(() => music.isSfxMuted())
  const applyVol = (v: number) => {
    const nv = Math.min(1, Math.max(0, Math.round(v * 20) / 20))
    music.unlock(); music.setVolume(nv); setVolume(nv)
  }
  const applySfxVol = (v: number) => {
    const nv = Math.min(1, Math.max(0, Math.round(v * 20) / 20))
    music.unlock(); music.setSfxVolume(nv); setSfxVol(nv); music.sfx('blip')
  }
  const toggleMute = () => { const m = !music.isMuted(); music.setMuted(m); setMuted(m) }
  const toggleSfxMute = () => { const m = !music.isSfxMuted(); music.setSfxMuted(m); setSfxMuted(m) }
  useKeydown((e) => {
    if (e.key === 'Escape') { onExit(); return true }
    if (e.key === 'ArrowLeft')  { applyVol(music.getVolume() - 0.1); return true }
    if (e.key === 'ArrowRight') { applyVol(music.getVolume() + 0.1); return true }
    if (e.key === 'm' || e.key === 'M') { toggleMute(); return true }
    return false
  })
  return (
    <div className="space-y-2 text-sm text-white/70 max-w-sm">
      <Heading>Audio</Heading>
      <div className="flex items-center gap-3 border-b border-white/5 py-2">
        <span className="w-16">Music</span>
        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} disabled={muted}
          onChange={e => applyVol(parseFloat(e.target.value))}
          className="flex-1 accent-amber-500 disabled:opacity-40" />
        <span className="w-10 text-right font-mono text-white/85">{Math.round((muted ? 0 : volume) * 100)}%</span>
      </div>
      <button onClick={toggleMute}
        className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-white/80">
        {muted ? '🔇 Music muted — click to unmute' : '🔊 Mute music'}
      </button>
      <div className="flex items-center gap-3 border-b border-white/5 py-2">
        <span className="w-16">Sounds</span>
        <input type="range" min={0} max={1} step={0.05} value={sfxMuted ? 0 : sfxVolume} disabled={sfxMuted}
          onChange={e => applySfxVol(parseFloat(e.target.value))}
          className="flex-1 accent-amber-500 disabled:opacity-40" />
        <span className="w-10 text-right font-mono text-white/85">{Math.round((sfxMuted ? 0 : sfxVolume) * 100)}%</span>
      </div>
      <button onClick={toggleSfxMute}
        className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-white/80">
        {sfxMuted ? '🔇 Sounds muted — click to unmute' : '🔊 Mute sounds'}
      </button>
      <Heading>Controls</Heading>
      {[['Move / turn', 'WASD or arrows'], ['Interact', 'E'], ['Menu', 'Tab'], ['Toggle map', 'M']].map(([k, v]) => (
        <div key={k} className="flex justify-between border-b border-white/5 py-1"><span>{k}</span><span className="font-mono text-white/85">{v}</span></div>
      ))}
      <Hint>Esc back · ←/→ volume · M mute</Hint>
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
