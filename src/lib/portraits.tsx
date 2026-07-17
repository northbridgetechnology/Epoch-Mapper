/**
 * Built-in character portraits — small pixel-art busts authored as grids and
 * rendered as SVG rect runs (crisp at any size, no image assets), matching the
 * creature sprite library's approach. Players may instead upload a portrait
 * (data-URI); `Portrait` renders either.
 *
 * Grid legend: '.' transparent, other letters index the portrait's palette.
 * Every grid is 12×12 with a shared head/shoulders body so archetypes differ
 * only by headgear and colour.
 */

import React from 'react'
import { isBitmapSprite } from './pixel-sprites'

interface PortraitDef {
  label: string
  /** Class/role keywords used to auto-suggest a portrait in the builder. */
  hint: string[]
  palette: Record<string, string>
  grid: string[]
}

const W = 12
const H = 12

// Shared skin/eye/outline palette; archetypes add H (hair/gear), M/w (metal),
// and G/g (garb) on top.
const SKIN = { O: '#181320', k: '#eab58a', s: '#c98a5f', e: '#241d30' }

// Shared lower body (rows 7–11): neck, chin, shoulders/garb.
const BODY = [
  '.OkkkkkkkkO.',
  '.OkkksskkkO.',
  '..OkkkkkkO..',
  'OGGGGGGGGGGO',
  'OGgGGGGGGgGO',
]

const PORTRAITS: Record<string, PortraitDef> = {
  fighter: {
    label: 'Fighter', hint: ['fighter', 'warrior', 'soldier', 'knight'],
    palette: { ...SKIN, M: '#9aa3b2', w: '#4a515c', G: '#7d4a2e', g: '#59331d' },
    grid: [
      '............',
      '...MMMMMM...',
      '..MMMMMMMM..',
      '.MMMMMMMMMM.',
      '.MMwwwwwwMM.',
      '.MkkkkkkkkM.',
      '.MkeekkeekM.',
      ...BODY,
    ],
  },
  knight: {
    label: 'Knight', hint: ['knight', 'paladin', 'guard', 'templar'],
    palette: { ...SKIN, M: '#b8c0cc', w: '#363c44', G: '#8a929e', g: '#5c636e' },
    grid: [
      '...MMMMMM...',
      '..MMMMMMMM..',
      '.MMMMMMMMMM.',
      '.MMMMMMMMMM.',
      '.MMwwwwwwMM.',
      '.MMMMMMMMMM.',
      '.MMMMMMMMMM.',
      '.MMMMMMMMMM.',
      '.OMMMMMMMMO.',
      '..OkkkkkkO..',
      'OGGGGGGGGGGO',
      'OGgGGGGGGgGO',
    ],
  },
  mage: {
    label: 'Mage', hint: ['mage', 'wizard', 'sorcerer', 'warlock', 'arcane'],
    palette: { ...SKIN, H: '#6a49c0', G: '#4a3390', g: '#31215f' },
    grid: [
      '.....HH.....',
      '....HHHH....',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.HHHHHHHHHH.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
  cleric: {
    label: 'Cleric', hint: ['cleric', 'priest', 'healer', 'monk'],
    palette: { ...SKIN, H: '#e8e3d4', w: '#e8c15a', G: '#d8d2c2', g: '#a59f8d' },
    grid: [
      '............',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.HHkkkkkkHH.',
      '.HkwwwwwwkH.',
      '.HkkkkkkkkH.',
      '.HkeekkeekH.',
      ...BODY,
    ],
  },
  rogue: {
    label: 'Rogue', hint: ['rogue', 'thief', 'assassin', 'ninja'],
    palette: { ...SKIN, H: '#2b2636', e: '#79e6c2', s: '#b07c55', G: '#242030', g: '#141119' },
    grid: [
      '............',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.HHHHHHHHHH.',
      '.HHkkkkkkHH.',
      '.HksssssskH.',
      '.HkeesseekH.',
      '.OksssssskO.',
      '.OkkksskkkO.',
      '..OkkkkkkO..',
      'OGGGGGGGGGGO',
      'OGgGGGGGGgGO',
    ],
  },
  ranger: {
    label: 'Ranger', hint: ['ranger', 'hunter', 'archer', 'scout', 'druid'],
    palette: { ...SKIN, H: '#6b4a2a', G: '#3f6b3a', g: '#294d27' },
    grid: [
      '............',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.OHHHHHHHHO.',
      '.OHkkkkkkHO.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
  noble: {
    label: 'Noble', hint: ['noble', 'bard', 'royal', 'prince', 'princess'],
    palette: { ...SKIN, H: '#b8933a', w: '#f2d777', G: '#7a1f3d', g: '#4f1327' },
    grid: [
      '...wwwwww...',
      '..wHHHHHHw..',
      '..HHHHHHHH..',
      '.OHHHHHHHHO.',
      '.OHkkkkkkHO.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
  witch: {
    label: 'Witch', hint: ['witch', 'shaman', 'occult', 'necromancer'],
    palette: { ...SKIN, H: '#3b2a52', w: '#7de0a0', k: '#d8d0c0', s: '#b0a892', G: '#241a33', g: '#150f1f' },
    grid: [
      '....HH......',
      '...HHHH.....',
      '..HHHHHH....',
      '.HHHHHHHH...',
      'HHHHHHHHHH..',
      '.OkkkkkkkkO.',
      '.OkwwkkwwkO.',
      ...BODY,
    ],
  },
  barbarian: {
    label: 'Barbarian', hint: ['barbarian', 'berserker', 'brute'],
    palette: { ...SKIN, H: '#6e4523', G: '#8a5a2e', g: '#5e3c1d' },
    grid: [
      '..H......H..',
      '.HHHHHHHHHH.',
      'HHHHHHHHHHHH',
      '.HHkkkkkkHH.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      '.OkHHHHHHkO.',
      ...BODY,
    ],
  },
  paladin: {
    label: 'Paladin', hint: ['paladin', 'crusader', 'holy'],
    palette: { ...SKIN, M: '#c9d2de', w: '#e8c15a', G: '#c9d2de', g: '#7f8794' },
    grid: [
      '....wwww....',
      '...MMMMMM...',
      '..MMMMMMMM..',
      '.MMMMMMMMMM.',
      '.MMwwwwwwMM.',
      '.MkkkkkkkkM.',
      '.MkeekkeekM.',
      ...BODY,
    ],
  },
  druid: {
    label: 'Druid', hint: ['druid', 'shaman', 'nature'],
    palette: { ...SKIN, H: '#3f7a3a', G: '#4a5e2e', g: '#33421f' },
    grid: [
      '............',
      '..HHHHHHHH..',
      '.HHHHHHHHHH.',
      '.HHkkkkkkHH.',
      '.HkkkkkkkkH.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
  bard: {
    label: 'Bard', hint: ['bard', 'minstrel', 'jester'],
    palette: { ...SKIN, H: '#b5462e', w: '#f2d777', G: '#2f7a5a', g: '#1f4f3a' },
    grid: [
      '.....ww.....',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.OHHHHHHHHO.',
      '.OHkkkkkkHO.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
  monk: {
    label: 'Monk', hint: ['monk', 'martial', 'ascetic', 'brawler'],
    palette: { ...SKIN, G: '#c67a3a', g: '#8a5424' },
    grid: [
      '............',
      '....kkkk....',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '.OkkkkkkkkO.',
      '.OkkkkkkkkO.',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
  necromancer: {
    label: 'Necromancer', hint: ['necromancer', 'lich', 'death'],
    palette: { ...SKIN, k: '#c9c4b8', s: '#9a9484', H: '#1e1a26', e: '#8be0c0', G: '#241f30', g: '#141019' },
    grid: [
      '............',
      '..HHHHHHHH..',
      '.HHHHHHHHHH.',
      '.HHHHHHHHHH.',
      '.HHkkkkkkHH.',
      '.HksssssskH.',
      '.HkeesseekH.',
      ...BODY,
    ],
  },
  dwarf: {
    label: 'Dwarf', hint: ['dwarf', 'smith', 'miner'],
    palette: { ...SKIN, H: '#8a5a2e', G: '#7d4a2e', g: '#59331d' },
    grid: [
      '............',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.OHkkkkkkHO.',
      '.OkeekkeekO.',
      '.OHHHHHHHHO.',
      '.HHHHHHHHHH.',
      '.HHHHHHHHHH.',
      '..HHHHHHHH..',
      '...HHHHHH...',
      'OGGGGGGGGGGO',
      'OGgGGGGGGgGO',
    ],
  },
  elf: {
    label: 'Elf', hint: ['elf', 'sylvan', 'fae'],
    palette: { ...SKIN, k: '#f0d0a8', H: '#d8c070', G: '#3f6b5a', g: '#294d3e' },
    grid: [
      '............',
      '...HHHHHH...',
      '..HHHHHHHH..',
      '.HHHHHHHHHH.',
      '.HHkkkkkkHH.',
      'kHkkkkkkkkHk',
      '.OkeekkeekO.',
      ...BODY,
    ],
  },
}

const DEFAULT_PORTRAIT = 'fighter'

/** All built-in portrait ids (for the picker). */
export function portraitIds(): string[] {
  return Object.keys(PORTRAITS)
}

export function portraitLabel(id: string): string {
  return PORTRAITS[id]?.label ?? id
}

/** True when `value` names a built-in portrait (not an uploaded data-URI). */
export function isBuiltinPortrait(value: string | undefined | null): boolean {
  return !!value && value in PORTRAITS
}

/** Suggest a built-in portrait id from a class/role name, else the default. */
export function suggestPortrait(name: string | undefined): string {
  const n = (name ?? '').toLowerCase()
  for (const [id, def] of Object.entries(PORTRAITS)) {
    if (def.hint.some(h => n.includes(h))) return id
  }
  return DEFAULT_PORTRAIT
}

function gridRects(def: PortraitDef): React.ReactElement[] {
  const rects: React.ReactElement[] = []
  for (let y = 0; y < def.grid.length; y++) {
    const row = def.grid[y]
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.' || !def.palette[ch]) { x++; continue }
      let run = 1
      while (x + run < row.length && row[x + run] === ch) run++
      rects.push(<rect key={`${x}_${y}`} x={x} y={y} width={run} height={1} fill={def.palette[ch]} />)
      x += run
    }
  }
  return rects
}

/**
 * Render a character portrait — an uploaded data-URI or a built-in bust. Falls
 * back to the default portrait for an unknown id, so it always draws something.
 */
export function Portrait({
  value, size = 48, rounded = true, className,
}: {
  value?: string | null
  size?: number
  rounded?: boolean
  className?: string
}) {
  const radius = rounded ? Math.round(size * 0.16) : 0
  if (isBitmapSprite(value)) {
    return (
      <img
        src={value}
        width={size}
        height={size}
        alt=""
        className={className}
        style={{ imageRendering: 'pixelated', borderRadius: radius, objectFit: 'cover', display: 'block' }}
      />
    )
  }
  const def = (value && PORTRAITS[value]) || PORTRAITS[DEFAULT_PORTRAIT]
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      shapeRendering="crispEdges"
      style={{ display: 'block', borderRadius: radius }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#0e0b14" rx={rounded ? 1.6 : 0} />
      {gridRects(def)}
    </svg>
  )
}

/** Test/authoring hook: the raw grid dimensions and definition. */
export function portraitGrid(id: string): { w: number; h: number; grid: string[] } | null {
  const def = PORTRAITS[id]
  return def ? { w: W, h: H, grid: def.grid } : null
}

/** Raw grid access for validation tests and the SVG template exporter. */
export function _portraitDefs(): Record<string, { w: number; h: number; label: string; palette: Record<string, string>; grid: string[] }> {
  return Object.fromEntries(Object.entries(PORTRAITS).map(([id, d]) => [id, { w: W, h: H, label: d.label, palette: d.palette, grid: d.grid }]))
}
