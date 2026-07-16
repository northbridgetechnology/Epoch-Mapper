'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SIZE_DIM, EOTB_DIM, type LayoutStyle, type MapSize, type NewMapConfig } from '@/lib/map-generator'

interface NewMapModalProps {
  defaultName?: string
  onConfirm: (config: NewMapConfig) => void
  onClose: () => void
}

function sizeOptions(style: LayoutStyle, generate: boolean): { label: string; value: MapSize; tag: string }[] {
  const dims = generate && style === 'eotb' ? EOTB_DIM : SIZE_DIM
  return [
    { label: 'Small',  value: 'small',  tag: `${dims.small}×${dims.small}`   },
    { label: 'Medium', value: 'medium', tag: `${dims.medium}×${dims.medium}` },
    { label: 'Large',  value: 'large',  tag: `${dims.large}×${dims.large}`   },
  ]
}

const STYLES: { label: string; value: LayoutStyle; desc: string }[] = [
  { label: 'Rooms',  value: 'rooms', desc: 'BSP rooms joined by winding corridors — spacious, organic' },
  { label: 'EotB',   value: 'eotb',  desc: 'Dense thin-wall maze on a tight grid — chambers, doors, illusory walls, a secret passage' },
  { label: 'SMT',    value: 'smt',   desc: 'Long arterial corridors on a lattice with room blocks behind doors — structured, urban' },
]

function randomSeed() {
  return Math.floor(Math.random() * 999_999_999) + 1
}

export function NewMapModal({ defaultName = 'New Map', onConfirm, onClose }: NewMapModalProps) {
  const [name,     setName]     = useState(defaultName)
  const [size,     setSize]     = useState<MapSize>('small')
  const [seed,     setSeed]     = useState(() => randomSeed())
  const [generate, setGenerate] = useState(false)
  const [style,    setStyle]    = useState<LayoutStyle>('rooms')

  function confirm() {
    onConfirm({ name: name.trim() || defaultName, size, seed, generate, style })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-900 border border-white/12 rounded-xl shadow-2xl w-[22rem] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white/90">New Map</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/40">Map Name</label>
            <input
              className="bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-white/30"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Map Name"
              maxLength={64}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && confirm()}
            />
          </div>

          {/* Size picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/40">Size</label>
            <div className="grid grid-cols-3 gap-2">
              {sizeOptions(style, generate).map(s => (
                <button
                  key={s.value}
                  onClick={() => setSize(s.value)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border py-2.5 text-sm transition-colors',
                    size === s.value
                      ? 'border-amber-500/60 bg-amber-950/30 text-amber-200'
                      : 'border-white/10 bg-zinc-800 text-white/50 hover:border-white/20 hover:text-white/70',
                  )}
                >
                  <span className="font-semibold">{s.label}</span>
                  <span className="text-[10px] opacity-55">{s.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Seed */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-white/40">Seed</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="flex-1 min-w-0 bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/90 focus:outline-none focus:border-white/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={seed}
                min={1}
                max={999_999_999}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) setSeed(Math.max(1, Math.min(999_999_999, v)))
                }}
              />
              <button
                onClick={() => setSeed(randomSeed())}
                title="Random seed"
                className="flex-shrink-0 w-9 rounded-lg border border-white/10 bg-zinc-800 text-base text-white/50 hover:text-white hover:border-white/25 transition-colors"
              >
                🎲
              </button>
            </div>
          </div>

          {/* Generate & Populate */}
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={generate}
                onChange={e => setGenerate(e.target.checked)}
              />
              <div className={cn(
                'w-4 h-4 rounded border transition-colors',
                generate ? 'border-amber-500 bg-amber-500' : 'border-white/25 bg-zinc-800 group-hover:border-white/40',
              )} />
              {generate && (
                <svg className="absolute inset-0 w-4 h-4 pointer-events-none" viewBox="0 0 16 16">
                  <polyline points="3,8.5 6.5,12 13,4.5" fill="none" stroke="#1c1917"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={cn('text-sm transition-colors', generate ? 'text-white/90' : 'text-white/60 group-hover:text-white/80')}>
                Randomly Generate &amp; Populate
              </span>
              <span className="text-[11px] text-white/30 leading-snug">
                Two linked levels showcasing every system — quests, shops, a recruit, traps,
                teleporters, a mini-boss, hazards, a boss, and the dark Depths
              </span>
            </div>
          </label>

          {/* Layout style */}
          {generate && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/40">Layout Style</label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg border py-2 text-sm transition-colors',
                      style === s.value
                        ? 'border-amber-500/60 bg-amber-950/30 text-amber-200'
                        : 'border-white/10 bg-zinc-800 text-white/50 hover:border-white/20 hover:text-white/70',
                    )}
                  >
                    <span className="font-semibold">{s.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/30 leading-snug min-h-[2rem]">
                {STYLES.find(s => s.value === style)?.desc}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-white/8">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white/80 hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-sm font-semibold text-white transition-colors"
          >
            Create Map
          </button>
        </div>

      </div>
    </div>
  )
}
