/**
 * Built-in pixel sprite library — EotB/SMT-style billboarded art, authored
 * as pixel grids and rendered as SVG rect runs (crisp at any scale, no
 * image assets). Two-frame sprites animate via SMIL.
 *
 * Resolution order at draw sites: creator bitmap (phase 3) → these built-ins
 * → emoji fallback. Grid legend: '.' = transparent, letters index palette.
 */

import React from 'react'

interface SpriteDef {
  w: number
  h: number
  palette: Record<string, string>
  frames: string[][]
}

// ── Sprite grids ──────────────────────────────────────────────────────────────

const O = '#14100a' // near-black outline shared by most sprites

const SPRITES: Record<string, SpriteDef> = {
  torch: {
    w: 8, h: 14,
    palette: { '0': O, Y: '#ffd23e', F: '#ff8c1a', f: '#d94510', M: '#5b6570', W: '#7a5024', w: '#573a1c' },
    frames: [
      [
        '........',
        '...ff...',
        '..fFFf..',
        '..FYYF..',
        '..fYYf..',
        '...FF...',
        '..0MM0..',
        '..0WW0..',
        '...Ww...',
        '...Ww...',
        '...Ww...',
        '...Ww...',
        '..0Ww0..',
        '...ww...',
      ],
      [
        '...f....',
        '..fFf...',
        '..FYFf..',
        '..fYYF..',
        '...YF...',
        '...FF...',
        '..0MM0..',
        '..0WW0..',
        '...Ww...',
        '...Ww...',
        '...Ww...',
        '...Ww...',
        '..0Ww0..',
        '...ww...',
      ],
    ],
  },

  sconce: {
    w: 8, h: 10,
    palette: { '0': O, Y: '#ffd23e', F: '#ff8c1a', f: '#d94510', M: '#6b7684', m: '#454e59' },
    frames: [
      [
        '...ff...',
        '..fFFf..',
        '..FYYF..',
        '...FF...',
        '.0MMMM0.',
        '..0MM0..',
        '...mm...',
        '...mm...',
        '..0mm0..',
        '...00...',
      ],
      [
        '..ff....',
        '..fFF...',
        '..FYYf..',
        '...FF...',
        '.0MMMM0.',
        '..0MM0..',
        '...mm...',
        '...mm...',
        '..0mm0..',
        '...00...',
      ],
    ],
  },

  chandelier: {
    w: 16, h: 10,
    palette: { '0': O, Y: '#ffd23e', F: '#ff8c1a', C: '#6b7684', W: '#e8e0c8', M: '#8a6b2f', m: '#5c4720' },
    frames: [
      [
        '.......CC.......',
        '.......CC.......',
        '..F.....F....F..',
        '..Y....FY....Y..',
        '..W....WW....W..',
        '..W....WW....W..',
        '.0MMMMMMMMMMMM0.',
        '..0m........m0..',
        '...0mmmmmmmm0...',
        '................',
      ],
      [
        '.......CC.......',
        '.......CC.......',
        '..Y.....F....F..',
        '..F....YF....Y..',
        '..W....WW....W..',
        '..W....WW....W..',
        '.0MMMMMMMMMMMM0.',
        '..0m........m0..',
        '...0mmmmmmmm0...',
        '................',
      ],
    ],
  },

  banner: {
    w: 10, h: 14,
    palette: { '0': O, M: '#6b7684', R: '#8c1f28', r: '#6b1219', Y: '#e0b03a' },
    frames: [[
      '0MMMMMMMM0',
      '.0RRRRRR0.',
      '.RRRRRRRR.',
      '.RRRYYRRR.',
      '.RRYYYYRR.',
      '.RRYrrYRR.',
      '.RRYYYYRR.',
      '.RRRYYRRR.',
      '.RRRRRRRR.',
      '.RRRRRRRR.',
      '.RrRRRRrR.',
      '.Rr.RR.rR.',
      '..r.rr.r..',
      '....r.....',
    ]],
  },

  chains: {
    w: 8, h: 16,
    palette: { '0': O, M: '#8a95a3', m: '#59636e' },
    frames: [[
      '.M....m.',
      '0M0..0m0',
      'M.M..m.m',
      '0M0..0m0',
      '.M....m.',
      '0M0..0m0',
      'M.M..m.m',
      '0M0..0m0',
      '.M....m.',
      '0M0..0m0',
      'M.M..m.m',
      '0M0..0m0',
      '.M....m.',
      '0M0..0m0',
      'M.M..m.m',
      '.0....0.',
    ]],
  },

  cobweb: {
    w: 12, h: 12,
    palette: { S: 'rgba(226,232,240,0.55)', s: 'rgba(226,232,240,0.28)' },
    frames: [[
      'SSSSSSSSSs..',
      'S...S...s...',
      'S..S...s....',
      'S.S..Ss.....',
      'SS.S.s......',
      'S.Ss........',
      'SSs.S.......',
      'Ss...S......',
      's.....s.....',
      's...........',
      '............',
      '............',
    ]],
  },

  barrel: {
    w: 12, h: 12,
    palette: { '0': O, W: '#7a5024', w: '#573a1c', M: '#59636e', m: '#454e59' },
    frames: [[
      '..00000000..',
      '.0wwwwwwww0.',
      '0MMMMMMMMMM0',
      '0WWwWWWWwWW0',
      '0WWwWWWWwWW0',
      '0MMMMMMMMmM0',
      '0WWwWWWWwWW0',
      '0WWwWWWWwWW0',
      '0WWwWWWWwWW0',
      '0MMMMMMMMmM0',
      '.0wwwwwwww0.',
      '..00000000..',
    ]],
  },

  crate: {
    w: 12, h: 12,
    palette: { '0': O, W: '#8a6134', w: '#5c3f20', n: '#3d2a15' },
    frames: [[
      '000000000000',
      '0WWWWWWWWWW0',
      '0WnwwwwwwnW0',
      '0WwWWWWWwWW0',
      '0WwWWWWwWWW0',
      '0WwWWWwWWWW0',
      '0WwWWwWWWWW0',
      '0WwWwWWWWWW0',
      '0WwwWWWWWWW0',
      '0WnwwwwwwnW0',
      '0WWWWWWWWWW0',
      '000000000000',
    ]],
  },

  pillar: {
    w: 10, h: 20,
    palette: { '0': O, S: '#8d8676', s: '#6a6455', d: '#4d4a3e' },
    frames: [[
      '0SSSSSSSS0',
      '.0SSSSSs0.',
      '..0SSSs0..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSsSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSsSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..SSSSsd..',
      '..0SSSs0..',
      '.0SSSSSs0.',
      '0SSSSSSSS0',
      '0ssssssss0',
    ]],
  },

  altar: {
    w: 14, h: 11,
    palette: { '0': O, S: '#8d8676', s: '#6a6455', Y: '#7fd4ff', y: '#2f8fbf' },
    frames: [
      [
        '.000000000000.',
        '0SSSSSSSSSSSS0',
        '0SsSSSSSSSSsS0',
        '.000000000000.',
        '..0s......s0..',
        '..0s..yy..s0..',
        '..0s.yYYy.s0..',
        '..0s..yy..s0..',
        '..0s......s0..',
        '.0SSSSSSSSSS0.',
        '.000000000000.',
      ],
      [
        '.000000000000.',
        '0SSSSSSSSSSSS0',
        '0SsSSSSSSSSsS0',
        '.000000000000.',
        '..0s......s0..',
        '..0s..Yy..s0..',
        '..0s.yYYY.s0..',
        '..0s..yY..s0..',
        '..0s......s0..',
        '.0SSSSSSSSSS0.',
        '.000000000000.',
      ],
    ],
  },

  bones: {
    w: 14, h: 8,
    palette: { '0': O, B: '#ddd6c2', b: '#a89f88' },
    frames: [[
      '....00.....b..',
      '...0BB0...b.b.',
      '...0BBB0...b..',
      '...0B0B0......',
      '....0B0..bb...',
      '.bBBB0..b..b..',
      'b....b...bb...',
      '..............',
    ]],
  },

  stalactite: {
    w: 10, h: 13,
    palette: { '0': O, S: '#7d8591', s: '#59616c' },
    frames: [[
      '0000000000',
      '0SSSSSSSs0',
      '.0SSSSSs0.',
      '.0SSSSs0..',
      '..0SSSs0..',
      '..0SSs0...',
      '...0Ss0...',
      '...0Ss....',
      '...0s0....',
      '....s0....',
      '....s.....',
      '....0.....',
      '..........',
    ]],
  },

  bat: {
    w: 14, h: 8,
    palette: { '0': O, B: '#4a3d5c', b: '#332a40', e: '#ff4040' },
    frames: [
      [
        '0.....00.....0',
        '00...0BB0...00',
        '.b0.0BBBB0.0b.',
        '..b00BBBB00b..',
        '...0BeBBeB0...',
        '....0BBBB0....',
        '.....0BB0.....',
        '......00......',
      ],
      [
        '..............',
        '..0...00...0..',
        '.0b0.0BB0.0b0.',
        '.b0b0BBBB0b0b.',
        '..b0BeBBeB0b..',
        '....0BBBB0....',
        '.....0BB0.....',
        '......00......',
      ],
    ],
  },

  rat: {
    w: 14, h: 7,
    palette: { '0': O, G: '#7d7468', g: '#5a544b', e: '#ff4040', T: '#b08d7a' },
    frames: [
      [
        '.....00.......',
        '....0GG0......',
        '.000GGGG0..T..',
        '0GGGGGGGG0T...',
        '0eGGGGGGG0....',
        '.00gG00gG0....',
        '...g....g.....',
      ],
      [
        '.....00.......',
        '....0GG0......',
        '.000GGGG0.....',
        '0GGGGGGGG00T..',
        '0eGGGGGGG0..T.',
        '.0g00gG00.....',
        '..g...g.......',
      ],
    ],
  },

  spider: {
    w: 12, h: 10,
    palette: { '0': O, B: '#3b3244', b: '#292332', e: '#ff4040' },
    frames: [
      [
        '0...0..0...0',
        '.0..0..0..0.',
        '..0.0000.0..',
        '...0BBBB0...',
        '..0BeBBeB0..',
        '...0BBBB0...',
        '..0.0bb0.0..',
        '.0..0..0..0.',
        '0...0..0...0',
        '............',
      ],
      [
        '.0...0..0..0',
        '.0..0..0..0.',
        '..0.0000.0..',
        '...0BBBB0...',
        '..0BeBBeB0..',
        '...0BBBB0...',
        '..0.0bb0.0..',
        '.0..0..0.0..',
        '0...0..0...0',
        '............',
      ],
    ],
  },

  chest: {
    w: 16, h: 12,
    palette: { '0': O, W: '#8a6134', w: '#5c3f20', M: '#59636e', Y: '#e8b93b' },
    frames: [[
      '..000000000000..',
      '.0wwwwwwwwwwww0.',
      '0WWWWWWWWWWWWWW0',
      '0MMMMMMMMMMMMMM0',
      '0WWWWWWWWWWWWWW0',
      '0WWWWWW00WWWWWW0',
      '0WWWWW0YY0WWWWW0',
      '0WWWWWW00WWWWWW0',
      '0MMMMMMMMMMMMMM0',
      '0WWWWWWWWWWWWWW0',
      '.0wwwwwwwwwwww0.',
      '..000000000000..',
    ]],
  },

  chest_open: {
    w: 16, h: 13,
    palette: { '0': O, W: '#8a6134', w: '#5c3f20', M: '#59636e', Y: '#e8b93b', y: '#b58a1f', I: '#241a10' },
    frames: [[
      '..000000000000..',
      '.0wwwwwwwwwwww0.',
      '0wIIIIIIIIIIIIw0',
      '0wIIIIIIIIIIIIw0',
      '0wIYyIIYYIIyYIw0',
      '0wYYYyYYYYyYYYw0',
      '0000000000000000',
      '0WWWWWWWWWWWWWW0',
      '0MMMMMMMMMMMMMM0',
      '0WWWWWWWWWWWWWW0',
      '0WWWWWWWWWWWWWW0',
      '.0wwwwwwwwwwww0.',
      '..000000000000..',
    ]],
  },

  lever_off: {
    w: 10, h: 13,
    palette: { '0': O, M: '#6b7684', m: '#454e59', L: '#7a5024', K: '#c23434', P: '#e8b93b' },
    frames: [[
      '.KK.......',
      '.KK.......',
      '..0L......',
      '...0L.....',
      '....0L....',
      '.00000000.',
      '.0MMMMMM0.',
      '.0MmmmmM0.',
      '.0Mm0PmM0.',
      '.0MmmmmM0.',
      '.0MMMMMM0.',
      '.00000000.',
      '..........',
    ]],
  },

  lever_on: {
    w: 10, h: 13,
    palette: { '0': O, M: '#6b7684', m: '#454e59', L: '#7a5024', K: '#3fae5c', P: '#e8b93b' },
    frames: [[
      '..........',
      '.00000000.',
      '.0MMMMMM0.',
      '.0MmmmmM0.',
      '.0Mm0PmM0.',
      '.0MmmmmM0.',
      '.0MMMMMM0.',
      '.00000000.',
      '....0L....',
      '.....0L...',
      '......0L..',
      '.......KK.',
      '.......KK.',
    ]],
  },

  door_panel: {
    w: 12, h: 16,
    palette: { W: '#7a5024', w: '#5c3f20', n: '#3d2a15', M: '#59636e' },
    frames: [[
      'WWnWWWnWWWnW',
      'WWnWWWnWWWnW',
      'MWnWWWnWWWnM',
      'WWnWWWnWWWnW',
      'WWnWwWnWWWnW',
      'WWnWWWnWwWnW',
      'WWnWWWnWWWnW',
      'wwwwwwwwwwww',
      'WWnWWWnWWWnW',
      'WwnWWWnWWWnW',
      'WWnWWWnWWWnW',
      'WWnWWWnWwWnW',
      'WWnWwWnWWWnW',
      'MWnWWWnWWWnM',
      'WWnWWWnWWWnW',
      'WWnWWWnWWWnW',
    ]],
  },
}

// ── Precomputed rect runs ─────────────────────────────────────────────────────

interface Run { x: number; y: number; len: number; color: string }

const RUNS: Record<string, Run[][]> = {}
for (const [kind, def] of Object.entries(SPRITES)) {
  RUNS[kind] = def.frames.map(rows => {
    const runs: Run[] = []
    rows.forEach((row, y) => {
      let x = 0
      while (x < row.length) {
        const ch = row[x]
        if (ch === '.') { x++; continue }
        let len = 1
        while (x + len < row.length && row[x + len] === ch) len++
        const color = def.palette[ch]
        if (color) runs.push({ x, y, len, color })
        x += len
      }
    })
    return runs
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export function hasPixelSprite(kind: string): boolean {
  return kind in SPRITES
}

export function spriteAspect(kind: string): number | null {
  const def = SPRITES[kind]
  return def ? def.h / def.w : null
}

function frameGroup(kind: string, frame: number, px: number, py: number): React.ReactNode[] {
  return RUNS[kind][frame].map((r, i) => (
    <rect key={i} x={r.x * px} y={r.y * py} width={r.len * px + 0.02} height={py + 0.02} fill={r.color} />
  ))
}

/**
 * Sprite stretched into an arbitrary box (used for door-panel texture and
 * bottom-anchored placements where the caller computes the box).
 */
export function pixelSpriteRect(
  kind: string,
  x: number,
  y: number,
  w: number,
  h: number,
  key: string,
  opacity = 1,
  animate = true,
): React.ReactElement | null {
  const def = SPRITES[kind]
  if (!def) return null
  const px = w / def.w
  const py = h / def.h
  const twoFrames = animate && def.frames.length > 1
  return (
    <g key={key} transform={`translate(${x}, ${y})`} opacity={opacity} pointerEvents="none">
      <g>
        {frameGroup(kind, 0, px, py)}
        {twoFrames && (
          <animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="0.9s" repeatCount="indefinite" />
        )}
      </g>
      {twoFrames && (
        <g opacity={0}>
          {frameGroup(kind, 1, px, py)}
          <animate attributeName="opacity" values="0;1" keyTimes="0;0.5" calcMode="discrete" dur="0.9s" repeatCount="indefinite" />
        </g>
      )}
    </g>
  )
}

/**
 * Sprite centred on (cx, cy), `size` wide, height following the sprite's
 * aspect ratio — the drop-in replacement for centred emoji <text>.
 */
export function pixelSprite(
  kind: string,
  cx: number,
  cy: number,
  size: number,
  key: string,
  opacity = 1,
): React.ReactElement | null {
  const def = SPRITES[kind]
  if (!def) return null
  const h = size * (def.h / def.w)
  return pixelSpriteRect(kind, cx - size / 2, cy - h / 2, size, h, key, opacity)
}

/** Exposed for validation tests. */
export function _spriteDefs(): Record<string, { w: number; h: number; palette: Record<string, string>; frames: string[][] }> {
  return SPRITES
}
