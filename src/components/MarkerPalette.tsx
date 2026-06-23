'use client'

import { useState } from 'react'
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BASE_TYPES, EDGE_TYPES, OVERLAY_TYPES, BASE_PALETTE, OVERLAY_PALETTE, EDGE_PALETTE,
  MAX_MARKER_LABEL_LEN,
} from '@/lib/constants'
import type { CustomMarker } from '@/lib/types'

interface MarkerPaletteProps {
  markers: CustomMarker[]
  initialSelectedId?: number
  onAdd: (kind?: 'base' | 'overlay') => number
  onUpdate: (id: number, patch: Partial<Omit<CustomMarker, 'id'>>) => void
  onDelete: (id: number) => void
  usageCount: (marker: CustomMarker) => number
  onClose: () => void
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function MarkerPalette({ markers, initialSelectedId, onAdd, onUpdate, onDelete, usageCount, onClose }: MarkerPaletteProps) {
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId ?? markers[0]?.id ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const selected = markers.find((m) => m.id === selectedId) ?? null

  function handleAdd() {
    const id = onAdd()
    setSelectedId(id)
    setConfirmDelete(false)
  }

  function handleDelete() {
    if (!selected) return
    const count = usageCount(selected)
    if (count > 0 && !confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete(selected.id)
    setConfirmDelete(false)
    setSelectedId(markers.find((m) => m.id !== selected.id)?.id ?? null)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl h-[80vh] rounded-2xl border border-amber-500/20 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Marker Palette</h2>
            <p className="text-xs text-white/40">Define custom cell types and overlay icons. They travel inside every .epochmap file.</p>
          </div>
          <button onClick={onClose} className="grid place-items-center h-8 w-8 rounded-md text-white/50 hover:text-white hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Left: marker list */}
          <div className="w-72 shrink-0 border-r border-white/10 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Custom markers */}
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Custom markers</p>
                {markers.length === 0 ? (
                  <p className="text-xs text-white/30 italic px-1 py-2">None yet. Add one below.</p>
                ) : (
                  <div className="space-y-1">
                    {markers.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id)
                          setConfirmDelete(false)
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition',
                          m.id === selectedId ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30' : 'text-white/65 hover:bg-white/5',
                        )}
                      >
                        <span className="grid place-items-center h-5 w-5 rounded shrink-0 text-xs" style={{ background: m.color }}>
                          {m.icon}
                        </span>
                        <span className="flex-1 truncate">{m.label || `Marker ${m.id}`}</span>
                        <span className="text-[10px] text-white/30">{m.kind === 'base' ? 'base' : 'overlay'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Built-in reference (read-only) */}
              <ReadOnlyGroup title="Built-in base" ids={BASE_PALETTE} table={BASE_TYPES} />
              <ReadOnlyGroup title="Built-in overlays" ids={OVERLAY_PALETTE} table={OVERLAY_TYPES} />
              <ReadOnlyGroup title="Built-in edges" ids={EDGE_PALETTE} table={EDGE_TYPES} stripe />
            </div>

            <div className="p-3 border-t border-white/10 shrink-0">
              <button onClick={handleAdd} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium">
                <Plus className="h-4 w-4" /> Add Custom Marker
              </button>
            </div>
          </div>

          {/* Right: editor */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {!selected ? (
              <div className="h-full grid place-items-center text-center text-white/35 text-sm">
                <p>Select a custom marker to edit, or add a new one.</p>
              </div>
            ) : (
              <div className="max-w-md space-y-5">
                {/* Preview */}
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center h-12 w-12 rounded-lg text-2xl shrink-0" style={{ background: selected.color }}>
                    {selected.icon}
                  </span>
                  <div>
                    <p className="text-white font-semibold">{selected.label || 'Untitled'}</p>
                    <p className="text-xs text-white/40">
                      ID {selected.id} · {selected.kind} · used in {usageCount(selected)} cell{usageCount(selected) === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {/* Label */}
                <Field label={`Label (max ${MAX_MARKER_LABEL_LEN})`}>
                  <input
                    value={selected.label}
                    maxLength={MAX_MARKER_LABEL_LEN}
                    onChange={(e) => onUpdate(selected.id, { label: e.target.value })}
                    className="w-full h-9 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30"
                    placeholder="e.g. Dragon Lair"
                  />
                </Field>

                {/* Kind */}
                <Field label="Kind">
                  <div className="inline-flex rounded-md border border-white/15 overflow-hidden">
                    {(['base', 'overlay'] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => onUpdate(selected.id, { kind: k })}
                        className={cn(
                          'px-4 py-1.5 text-sm capitalize transition',
                          selected.kind === k ? 'bg-amber-500/25 text-amber-200' : 'text-white/55 hover:bg-white/5',
                        )}
                      >
                        {k === 'base' ? 'Base type' : 'Overlay'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/35 mt-1">
                    {selected.kind === 'base' ? 'Fills the whole cell with this color.' : 'Stacks an icon on top of a cell.'}
                  </p>
                </Field>

                {/* Icon */}
                <Field label="Icon (single emoji or character)">
                  <div className="flex items-center gap-3">
                    <input
                      value={selected.icon}
                      onChange={(e) => onUpdate(selected.id, { icon: [...e.target.value].slice(0, 2).join('') })}
                      className="w-20 h-9 rounded-md border border-white/15 bg-transparent px-3 text-center text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30"
                      placeholder="🐉"
                    />
                    <span className="grid place-items-center h-9 w-9 rounded-md text-xl" style={{ background: selected.color }}>
                      {selected.icon}
                    </span>
                  </div>
                </Field>

                {/* Color */}
                <Field label="Color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={HEX_RE.test(selected.color) ? selected.color : '#f59e0b'}
                      onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
                      className="h-9 w-12 rounded-md border border-white/15 bg-transparent cursor-pointer"
                    />
                    <input
                      value={selected.color}
                      onChange={(e) => {
                        const v = e.target.value
                        if (HEX_RE.test(v) || v.startsWith('#')) onUpdate(selected.id, { color: v })
                      }}
                      className={cn(
                        'w-32 h-9 rounded-md border bg-transparent px-3 text-sm text-white outline-none focus:ring-2 focus:ring-amber-500/30 font-mono',
                        HEX_RE.test(selected.color) ? 'border-white/15' : 'border-rose-500/50',
                      )}
                      placeholder="#RRGGBB"
                    />
                  </div>
                </Field>

                {/* Delete */}
                <div className="pt-2 border-t border-white/10">
                  {confirmDelete ? (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
                      <div className="flex items-start gap-2 text-sm text-rose-200">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          This marker is used in <strong>{usageCount(selected)}</strong> cell
                          {usageCount(selected) === 1 ? '' : 's'}. Deleting it reverts those cells to{' '}
                          {selected.kind === 'base' ? 'Empty' : 'no overlay'}.
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleDelete} className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium">
                          Delete anyway
                        </button>
                        <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-md text-sm text-white/60 hover:bg-white/10">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-sm">
                      <Trash2 className="h-4 w-4" /> Delete marker
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ReadOnlyGroup({
  title,
  ids,
  table,
  stripe,
}: {
  title: string
  ids: number[]
  table: Record<number, { label: string; color: string; icon?: string }>
  stripe?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="space-y-0.5">
        {ids.map((id) => {
          const def = table[id]
          if (!def) return null
          return (
            <div key={id} className="flex items-center gap-2 px-2 py-1 text-xs text-white/45">
              {stripe ? (
                <span className="h-1.5 w-5 rounded-sm shrink-0" style={{ background: def.color }} />
              ) : (
                <span className="grid place-items-center h-5 w-5 rounded shrink-0 text-[10px]" style={{ background: def.color }}>
                  {def.icon ?? ''}
                </span>
              )}
              <span className="truncate">{def.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
