'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AttributeDef, Character, ClassDef, Formation, RaceDef, Ruleset } from '@/lib/engine-types'
import { deriveMaxHp, deriveMaxMp, xpToNextLevel } from '@/lib/engine-types'
import { newCharacter } from '@/lib/save-state'
import { SchemaForm } from '../forms/SchemaForm'

interface PartyWorkspaceProps {
  ruleset: Ruleset
  party: Character[]
  formation: Formation
  onPartyChange: (party: Character[], formation: Formation) => void
}

function attrShort(id: string) {
  return id.replace('attr.', '')
}

function classOf(ruleset: Ruleset, id: string): ClassDef | undefined {
  return ruleset.classes.find(c => c.id === id)
}

function raceOf(ruleset: Ruleset, id: string): RaceDef | undefined {
  return ruleset.races.find(r => r.id === id)
}

function recomputeHpMp(char: Character, cls: ClassDef): Character {
  const attrShortMap: Record<string, number> = {}
  for (const [k, v] of Object.entries(char.attributes)) {
    attrShortMap[attrShort(k)] = v
  }
  const maxHp = deriveMaxHp({ level: char.level, attributes: attrShortMap }, cls)
  const maxMp = deriveMaxMp({ level: char.level, attributes: attrShortMap }, cls)
  return { ...char, maxHp, hp: Math.min(char.hp, maxHp), maxMp, mp: Math.min(char.mp, maxMp) }
}

// ── Character card (compact row) ───────────────────────────────────────────────

function CharacterCard({
  char, ruleset, selected, onSelect, onRemove,
}: {
  char: Character
  ruleset: Ruleset
  selected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const cls = classOf(ruleset, char.classId)
  const race = raceOf(ruleset, char.raceId)

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer select-none border transition-colors',
        selected
          ? 'border-amber-500/50 bg-amber-950/30'
          : 'border-white/10 bg-zinc-900 hover:bg-zinc-800',
      )}
      onClick={onSelect}
    >
      <div
        className="w-8 h-8 grid place-items-center rounded-full text-base flex-shrink-0"
        style={{ backgroundColor: cls?.color ?? '#555', opacity: char.alive ? 1 : 0.4 }}
      >
        {cls?.icon ?? <User className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white/90 truncate">{char.name}</div>
        <div className="text-xs text-white/50">
          Lv.{char.level} {race?.name} {cls?.name}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-red-400">{char.hp}/{char.maxHp} HP</div>
        {char.maxMp > 0 && (
          <div className="text-xs text-blue-400">{char.mp}/{char.maxMp} MP</div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/10"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Formation widget ───────────────────────────────────────────────────────────

function FormationWidget({
  party, formation, onFormationChange,
}: {
  party: Character[]
  formation: Formation
  onFormationChange: (f: Formation) => void
}) {
  function toggleRow(idx: number, row: 'front' | 'back') {
    const other = row === 'front' ? 'back' : 'front'
    const newF = { ...formation }
    if (newF[row].includes(idx)) {
      newF[row] = newF[row].filter(i => i !== idx)
    } else {
      newF[other] = newF[other].filter(i => i !== idx)
      newF[row] = [...newF[row], idx]
    }
    onFormationChange(newF)
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Formation</div>
      <div className="grid grid-cols-2 gap-2">
        {(['front', 'back'] as const).map(row => (
          <div key={row} className="rounded-lg border border-white/10 bg-zinc-900 p-2">
            <div className="text-xs text-white/50 mb-1 capitalize">{row} Row</div>
            <div className="flex flex-wrap gap-1 min-h-[2rem]">
              {formation[row].map(idx => {
                const ch = party[idx]
                if (!ch) return null
                return (
                  <button
                    key={idx}
                    onClick={() => toggleRow(idx, row)}
                    className="text-xs px-1.5 py-0.5 rounded bg-amber-600/30 border border-amber-500/30 text-amber-200"
                  >
                    {ch.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {party.map((ch, idx) => {
          const inFront = formation.front.includes(idx)
          const inBack = formation.back.includes(idx)
          const unassigned = !inFront && !inBack
          if (!unassigned) return null
          return (
            <div key={idx} className="flex items-center gap-1">
              <span className="text-xs text-white/50">{ch.name}:</span>
              <button onClick={() => toggleRow(idx, 'front')} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 hover:border-amber-500/30 text-white/60 hover:text-amber-200">Front</button>
              <button onClick={() => toggleRow(idx, 'back')} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 hover:border-amber-500/30 text-white/60 hover:text-amber-200">Back</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Character sheet (detail panel) ────────────────────────────────────────────

function CharacterSheet({
  char, ruleset, onChange,
}: {
  char: Character
  ruleset: Ruleset
  onChange: (c: Character) => void
}) {
  const cls = classOf(ruleset, char.classId)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ attrs: true })

  function toggle(key: string) {
    setExpanded(p => ({ ...p, [key]: !p[key] }))
  }

  function handleAttrChange(attrId: string, val: number) {
    const attr = ruleset.attributes.find(a => a.id === attrId)
    if (!attr) return
    const clamped = Math.min(attr.max, Math.max(attr.min, val))
    const updated = { ...char, attributes: { ...char.attributes, [attrId]: clamped } }
    onChange(cls ? recomputeHpMp(updated, cls) : updated)
  }

  function handleClassChange(classId: string) {
    const newCls = classOf(ruleset, classId)
    if (!newCls) return
    const updated = recomputeHpMp({ ...char, classId }, newCls)
    onChange(updated)
  }

  function handleRaceChange(raceId: string) {
    onChange({ ...char, raceId })
  }

  return (
    <div className="space-y-3 text-sm">
      {/* Identity */}
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-white/50 mb-0.5">Name</label>
          <input
            type="text"
            value={char.name}
            onChange={e => onChange({ ...char, name: e.target.value })}
            className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/50 mb-0.5">Class</label>
            <select
              value={char.classId}
              onChange={e => handleClassChange(e.target.value)}
              className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            >
              {ruleset.classes.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-0.5">Race</label>
            <select
              value={char.raceId}
              onChange={e => handleRaceChange(e.target.value)}
              className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            >
              {ruleset.races.map(r => (
                <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/50 mb-0.5">Level</label>
            <input
              type="number" min={1} max={99}
              value={char.level}
              onChange={e => {
                const lv = Math.max(1, Math.min(99, e.target.valueAsNumber || 1))
                const updated = { ...char, level: lv }
                onChange(cls ? recomputeHpMp(updated, cls) : updated)
              }}
              className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-0.5">XP / Next</label>
            <div className="px-2 py-1 text-sm text-white/70">
              {char.xp} / {xpToNextLevel(char.level)}
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-red-950/30 border border-red-900/30 p-2">
          <div className="text-xs text-red-300 font-medium mb-1">HP</div>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} max={char.maxHp}
              value={char.hp}
              onChange={e => onChange({ ...char, hp: Math.max(0, Math.min(char.maxHp, e.target.valueAsNumber || 0)) })}
              className="w-14 px-1 py-0.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
            />
            <span className="text-white/40 text-xs">/ {char.maxHp}</span>
          </div>
        </div>
        {char.maxMp > 0 && (
          <div className="rounded-lg bg-blue-950/30 border border-blue-900/30 p-2">
            <div className="text-xs text-blue-300 font-medium mb-1">MP</div>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={char.maxMp}
                value={char.mp}
                onChange={e => onChange({ ...char, mp: Math.max(0, Math.min(char.maxMp, e.target.valueAsNumber || 0)) })}
                className="w-14 px-1 py-0.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
              />
              <span className="text-white/40 text-xs">/ {char.maxMp}</span>
            </div>
          </div>
        )}
      </div>

      {/* Attributes */}
      <div>
        <button
          onClick={() => toggle('attrs')}
          className="flex items-center gap-1 text-xs font-medium text-white/50 uppercase tracking-wide mb-1"
        >
          {expanded.attrs ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          Attributes
        </button>
        {expanded.attrs && (
          <div className="grid grid-cols-3 gap-1.5">
            {ruleset.attributes.map((attr: AttributeDef) => (
              <div key={attr.id} className="rounded bg-zinc-800 border border-white/10 p-1.5">
                <div className="text-xs text-white/40 font-mono">{attr.abbr}</div>
                <input
                  type="number"
                  min={attr.min} max={attr.max}
                  value={char.attributes[attr.id] ?? attr.default}
                  onChange={e => handleAttrChange(attr.id, e.target.valueAsNumber)}
                  className="w-full bg-transparent text-base font-bold text-amber-200 focus:outline-none text-center"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Class description */}
      {cls?.description && (
        <div className="text-xs text-white/40 italic">{cls.description}</div>
      )}
    </div>
  )
}

// ── New character modal ────────────────────────────────────────────────────────

function NewCharacterModal({
  ruleset, onAdd, onClose,
}: {
  ruleset: Ruleset
  onAdd: (c: Character) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [classId, setClassId] = useState(ruleset.classes[0]?.id ?? '')
  const [raceId, setRaceId] = useState(ruleset.races[0]?.id ?? '')

  function handleAdd() {
    if (!name.trim()) return
    onAdd(newCharacter(name.trim(), classId, raceId, ruleset))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-amber-500/20 bg-zinc-950 shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white">Add Party Member</h3>
        <div>
          <label className="block text-xs text-white/50 mb-0.5">Name</label>
          <input
            autoFocus
            type="text"
            placeholder="Character name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-white/50 mb-0.5">Class</label>
            <select value={classId} onChange={e => setClassId(e.target.value)}
              className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50">
              {ruleset.classes.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-0.5">Race</label>
            <select value={raceId} onChange={e => setRaceId(e.target.value)}
              className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50">
              {ruleset.races.map(r => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-zinc-800 text-sm text-white/60 hover:text-white">Cancel</button>
          <button onClick={handleAdd} disabled={!name.trim()} className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main party workspace ───────────────────────────────────────────────────────

export function PartyWorkspace({ ruleset, party, formation, onPartyChange }: PartyWorkspaceProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(party.length > 0 ? 0 : null)
  const [showAdd, setShowAdd] = useState(false)

  const maxParty = ruleset.meta.partySize

  function updateParty(newParty: Character[], newFormation?: Formation) {
    onPartyChange(newParty, newFormation ?? formation)
  }

  function addChar(c: Character) {
    const np = [...party, c]
    const nf = { ...formation }
    if (np.length <= Math.ceil(maxParty / 2)) {
      nf.front = [...nf.front, np.length - 1]
    } else {
      nf.back = [...nf.back, np.length - 1]
    }
    updateParty(np, nf)
    setSelectedIdx(np.length - 1)
  }

  function removeChar(idx: number) {
    const np = party.filter((_, i) => i !== idx)
    const remap = (arr: number[]) =>
      arr.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i))
    const nf = { front: remap(formation.front), back: remap(formation.back) }
    updateParty(np, nf)
    setSelectedIdx(np.length > 0 ? Math.min(idx, np.length - 1) : null)
  }

  function updateChar(idx: number, c: Character) {
    const np = [...party]
    np[idx] = c
    updateParty(np)
  }

  const selectedChar = selectedIdx !== null ? party[selectedIdx] : null

  return (
    <div className="flex h-full min-h-0">
      {/* Left: roster + formation */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-white/10 min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="text-sm font-semibold text-white/80">
            Party ({party.length}/{maxParty})
          </div>
          <button
            onClick={() => setShowAdd(true)}
            disabled={party.length >= maxParty}
            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-medium"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
          {party.length === 0 && (
            <div className="text-center text-white/30 text-sm py-8">
              No party members yet.<br />Click Add to create your first character.
            </div>
          )}
          {party.map((char, idx) => (
            <CharacterCard
              key={char.id}
              char={char}
              ruleset={ruleset}
              selected={selectedIdx === idx}
              onSelect={() => setSelectedIdx(idx)}
              onRemove={() => removeChar(idx)}
            />
          ))}
        </div>

        {party.length > 0 && (
          <div className="border-t border-white/10 p-3">
            <FormationWidget
              party={party}
              formation={formation}
              onFormationChange={nf => updateParty(party, nf)}
            />
          </div>
        )}
      </div>

      {/* Right: character sheet */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {selectedChar && selectedIdx !== null ? (
          <>
            <div className="text-sm font-semibold text-white/60 mb-3">Character Sheet</div>
            <CharacterSheet
              char={selectedChar}
              ruleset={ruleset}
              onChange={c => updateChar(selectedIdx, c)}
            />
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-white/20 text-sm">
            Select a character to edit their sheet
          </div>
        )}
      </div>

      {showAdd && (
        <NewCharacterModal
          ruleset={ruleset}
          onAdd={addChar}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
