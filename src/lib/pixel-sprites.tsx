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

  // ── Creatures (battle + playfield) ──────────────────────────────────────────

  cr_skeleton: {
    w: 16, h: 16,
    palette: { '0': O, B: '#ddd6c2', b: '#a89f88', e: '#1a1410' },
    frames: [[
      '......0000......',
      '.....0BBBB0.....',
      '.....0BeBe0.....',
      '.....0BBBB0.....',
      '......0bb0......',
      '....000BB000....',
      '...0BbBBBBbB0...',
      '...0B0BbbB0B0...',
      '...0B00BB00B0...',
      '...0B.0BB0.B0...',
      '......0bb0......',
      '.....0BBBB0.....',
      '....0BB00BB0....',
      '....0B0..0B0....',
      '....0B0..0B0....',
      '...000....000...',
    ]],
  },

  cr_zombie: {
    w: 16, h: 15,
    palette: { '0': O, G: '#6c8a4f', g: '#4d6338', e: '#c73e3e', R: '#5a4a3a' },
    frames: [[
      '.....00000......',
      '....0GGGGG0.....',
      '....0GeGeG0.....',
      '....0GGgGG0.....',
      '.....0GGG0......',
      '...000RRR000....',
      '..0GGRRRRRGG0...',
      '..0G0RRRRR0G0...',
      '.0GG0RRRRR0GG0..',
      '.0g0.0RRR0.0g0..',
      '.....0RRR0......',
      '....0RR0RR0.....',
      '....0R0.0R0.....',
      '...0RR0.0RR0....',
      '...000...000....',
    ]],
  },

  cr_slime: {
    w: 16, h: 10,
    palette: { '0': O, S: '#4f9e6b', s: '#356e49', e: '#14100a', h: '#8fd4a8' },
    frames: [
      [
        '................',
        '.....000000.....',
        '...00SShSSS00...',
        '..0SShSSSSSSS0..',
        '..0SeSSSSSeSS0..',
        '.0SSSSSSSSSSSS0.',
        '.0SsSSSSSSSsSS0.',
        '0SSSSSSSSSSSSSS0',
        '0ssSSSSSSSSSsss0',
        '.00000000000000.',
      ],
      [
        '................',
        '................',
        '....000000000...',
        '..00SShSSSSSS0..',
        '.0SeSSSSSSeSSS0.',
        '0SSSSSSSSSSSSSS0',
        '0SsSSSSSSSSsSSS0',
        '0SSSSSSSSSSSSSS0',
        '0sssSSSSSSSssss0',
        '.00000000000000.',
      ],
    ],
  },

  cr_ghost: {
    w: 16, h: 14,
    palette: { W: 'rgba(207,227,232,0.85)', w: 'rgba(160,190,200,0.6)', e: '#26323a' },
    frames: [
      [
        '.....00000......'.replace(/0/g, 'w'),
        '....wWWWWWw.....',
        '...wWWWWWWWw....',
        '...wWeWWeWWw....',
        '...wWWWWWWWw....',
        '...wWWwwWWWw....',
        '...wWWWWWWWw....',
        '...wWWWWWWWw....',
        '...wWwWWWwWw....',
        '...wW.wWw.Ww....',
        '....w..W..w.....',
        '................',
        '................',
        '................',
      ],
      [
        '................',
        '.....wwwww......',
        '....wWWWWWw.....',
        '...wWWWWWWWw....',
        '...wWeWWeWWw....',
        '...wWWWWWWWw....',
        '...wWWwwWWWw....',
        '...wWWWWWWWw....',
        '...wWWWWWWWw....',
        '...wWwWWWwWw....',
        '...wW.wWw.Ww....',
        '....w..W..w.....',
        '................',
        '................',
      ],
    ],
  },

  cr_imp: {
    w: 16, h: 12,
    palette: { '0': O, P: '#b06ad4', p: '#7d4a99', I: '#8a4ab0', e: '#ffd23e' },
    frames: [
      [
        '.0.0........0.0.',
        '0PP0........0PP0',
        '0PPP00....00PPP0',
        '.0PPPP0000PPPP0.',
        '..0p0IIIIII0p0..',
        '.....0IeeI0.....',
        '....0IIIIII0....',
        '....0IIIIII0....',
        '.....0I00I0.....',
        '.....0I..I0.....',
        '....00....00....',
        '................',
      ],
      [
        '................',
        '.0.0........0.0.',
        '0PPP0......0PPP0',
        '.0PPP000000PPP0.',
        '..0p0IIIIII0p0..',
        '.....0IeeI0.....',
        '....0IIIIII0....',
        '....0IIIIII0....',
        '.....0I00I0.....',
        '.....0I..I0.....',
        '....00....00....',
        '................',
      ],
    ],
  },

  cr_demon: {
    w: 16, h: 16,
    palette: { '0': O, H: '#ddd6c2', R: '#a1352c', r: '#6e211b', e: '#ffd23e' },
    frames: [[
      '.0H0........0H0.',
      '.0HH0......0HH0.',
      '..0HH0....0HH0..',
      '...00RRRRRR00...',
      '....0ReRReR0....',
      '....0RRRRRR0....',
      '.....0rRRr0.....',
      '...00RRRRRR00...',
      '..0RRRRRRRRRR0..',
      '..0R0RRrrRR0R0..',
      '..0R00RRRR00R0..',
      '.....0RRRR0.....',
      '....0RR00RR0....',
      '....0R0..0R0....',
      '...0RR0..0RR0...',
      '...000....000...',
    ]],
  },

  cr_brute: {
    w: 16, h: 15,
    palette: { '0': O, K: '#7c8058', k: '#5a5e3e', e: '#c73e3e' },
    frames: [[
      '.....000000.....',
      '....0KKKKKK0....',
      '....0KeKKeK0....',
      '....0KKkkKK0....',
      '..000KKKKKK000..',
      '.0KKKKKKKKKKKK0.',
      '.0KK0KKKKKK0KK0.',
      '0KK00KkkkkK00KK0',
      '0K0.0KKKKKK0.0K0',
      '....0KKKKKK0....',
      '....0KK00KK0....',
      '...0KK0..0KK0...',
      '...0K0....0K0...',
      '..0KK0....0KK0..',
      '..000......000..',
    ]],
  },

  cr_beast: {
    w: 16, h: 10,
    palette: { '0': O, G: '#6e5f4e', g: '#4d4136', e: '#e8b93b', T: '#3d332a' },
    frames: [
      [
        '.00.......0.....',
        '0GG0000..0G0....',
        '0GeeGGG000GG0...',
        '.0GGGGGGGGGGG0..',
        '..0GGGGGGGGGGG0.',
        '...0GGg0GGg0GG0.',
        '...0GG0.0GG00T0.',
        '...0g0...0g0.0..',
        '...00.....00....',
        '................',
      ],
      [
        '.00.......0.....',
        '0GG0000..0G0....',
        '0GeeGGG000GG0...',
        '.0GGGGGGGGGGG0..',
        '..0GGGGGGGGGG0T.',
        '...0Gg0GGG0GG00.',
        '...0G0..0GG0....',
        '...0g0...0g0....',
        '...00.....00....',
        '................',
      ],
    ],
  },

  cr_serpent: {
    w: 16, h: 14,
    palette: { '0': O, S: '#4f8a6a', s: '#376349', e: '#ffd23e', b: '#c9b98a' },
    frames: [[
      '.....00000......',
      '....0SSSSS0.....',
      '....0SeSeS0.....',
      '....0SbbbS0.....',
      '.....0SSS0......',
      '.....0SSS0......',
      '....0SbSbS0.....',
      '...0SSS0SSS0....',
      '..0SS0..0SS0....',
      '..0SS0..0SS0....',
      '...0SSS0SS0.....',
      '....0SSSS0......',
      '..00SSSS0.......',
      '..000000........',
    ]],
  },

  cr_frost: {
    w: 16, h: 13,
    palette: { '0': O, W: '#eef4f6', b: '#5aa8d6', e: '#26323a' },
    frames: [[
      '.....0bbb0......',
      '....0bbbbb0.....',
      '...0bbbbbbb0....',
      '...0WWWWWWW0....',
      '...0WeWWWeW0....',
      '...0WWW0WWW0....',
      '....0WWWWW0.....',
      '..00WWWWWWW00...',
      '.0WWWWWWWWWWW0..',
      '.0W0WWWWWWW0W0..',
      '....0WW0WW0.....',
      '...0WW0.0WW0....',
      '...000...000....',
    ]],
  },

  cr_pumpkin: {
    w: 16, h: 14,
    palette: { '0': O, P: '#e07b1f', p: '#a8571a', F: '#ffd23e', c: '#2d3a5c', s: '#4f7a3a' },
    frames: [
      [
        '......0ss.......',
        '....00PPPP00....',
        '...0PPPPPPPP0...',
        '..0PPFPPPPFPP0..',
        '..0PPPPPPPPPP0..',
        '..0PPF0FF0FPP0..',
        '...0PpPPPPpP0...',
        '....00PPPP00....',
        '....0cccccc0....',
        '...0cccccccc0...',
        '...0cc0cc0cc0...',
        '....0cccccc0....',
        '.....0c00c0.....',
        '.....00..00.....',
      ],
      [
        '......0ss.......',
        '....00PPPP00....',
        '...0PPPPPPPP0...',
        '..0PPFPPPPFPP0..',
        '..0PPPPPPPPPP0..',
        '..0PP0FFFF0PP0..',
        '...0PpPPPPpP0...',
        '....00PPPP00....',
        '....0cccccc0....',
        '...0cccccccc0...',
        '...0cc0cc0cc0...',
        '....0cccccc0....',
        '.....0c00c0.....',
        '.....00..00.....',
      ],
    ],
  },

  cr_angel: {
    w: 16, h: 15,
    palette: { '0': O, W: '#eef4f6', Y: '#ffd23e', A: '#e8c49a', L: '#d6dde6', l: '#aab4c2' },
    frames: [[
      '.......0Y0......',
      '......0AAA0.....',
      '0W0...0AAA0..0W0',
      '0WW0...0A0..0WW0',
      '0WWW0.0LLL0.0WW0',
      '.0WW00LLLLL00W0.',
      '..0W0LLLLLLL0W0.',
      '..0W0LlLLlLL0W0.',
      '...00LLLLLLL00..',
      '.....0LLLLL0....',
      '.....0LLLLL0....',
      '.....0LlLlL0....',
      '.....0LLLLL0....',
      '......0LLL0.....',
      '.......000......',
    ]],
  },

  cr_hermit: {
    w: 16, h: 15,
    palette: { '0': O, R: '#6e5f4e', r: '#4d4136', A: '#e8c49a', B: '#ddd6c2', T: '#7a5024', e: '#26323a' },
    frames: [[
      '..T.....000.....',
      '..T....0RRR0....',
      '..T....0AeA0....',
      '..T....0BBB0....',
      '..T...0RRRRR0...',
      '..T..0RRRRRRR0..',
      '..T..0RrRRrRR0..',
      '..TT0R0RRRRR0...',
      '..T.0RRRRRRR0...',
      '..T.0RRRRRRR0...',
      '..T.0RrRRRrR0...',
      '..T.0RR0RRR0....',
      '..T.0R0.0RR0....',
      '..T.00...00.....',
      '..T.............',
    ]],
  },

  cr_hooded: {
    w: 16, h: 14,
    palette: { '0': O, H: '#5c6e5a', h: '#42513f', e: '#ffd23e' },
    frames: [[
      '.....00000......',
      '....0HHHHH0.....',
      '...0HHHHHHH0....',
      '...0H00000H0....',
      '...0H0e0e0H0....',
      '...0HH000HH0....',
      '...0HHHHHHH0....',
      '..0HHhHHHhHH0...',
      '..0HH0HHH0HH0...',
      '..0H00HhH00H0...',
      '.....0HHH0......',
      '....0HH0HH0.....',
      '....0H0.0H0.....',
      '....00...00.....',
    ]],
  },

  cr_guard: {
    w: 16, h: 15,
    palette: { '0': O, M: '#8a95a3', m: '#59636e', e: '#26323a', R: '#8c1f28' },
    frames: [[
      '.....00000......',
      '....0MMMMM0.....',
      '....0M0e0M0.....',
      '....0MMMMM0.....',
      '...00MmmmM00....',
      '..0MMMRRRMMM0...',
      '..0M0MRRRM0M0...',
      '.0MM0MRRRM0MM0..',
      '.0M00MMMMM00M0..',
      '....0MmmmM0.....',
      '....0MM0MM0.....',
      '....0M0.0M0.....',
      '...0MM0.0MM0....',
      '...000...000....',
      '................',
    ]],
  },
}

// ── Precomputed rect runs ─────────────────────────────────────────────────────

interface Run { x: number; y: number; len: number; color: string }

const RUNS: Record<string, Run[][]> = {}
for (const [kind, def] of Object.entries(SPRITES)) {
  RUNS[kind] = def.frames.map(rows => {
    const runs: Run[] = []
    rows.forEach((rawRow, y) => {
      const row = rawRow.padEnd(def.w, '.')
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

// ── Creature sprite resolution ────────────────────────────────────────────────
// Explicit `sprite` (a built-in kind name, or a creator upload in phase 3)
// wins; otherwise the id/name is keyword-matched to an archetype.

const CREATURE_KEYWORDS: [RegExp, string][] = [
  // FF-flavoured bestiary — distinctive names first, before the generic rules
  // (e.g. "Zombie Dragon" must hit the dragon rule, not /zomb/).
  [/dragon|drake|wyvern/, 'cr_serpent'],
  [/tonberry/, 'cr_hooded'],
  [/behemoth/, 'cr_demon'],
  [/goblin|kobold/, 'cr_imp'],
  [/cactuar|cactus/, 'cr_imp'],
  [/sahagin|merman|fish/, 'cr_serpent'],
  [/\bbomb\b|grenade/, 'cr_pumpkin'],
  [/coeurl|panther|\bcat\b/, 'cr_beast'],
  [/ochu|malboro|morbol|vine|plant/, 'cr_slime'],
  [/chimera|manticore/, 'cr_beast'],
  [/adamant|tortoise|turtle/, 'cr_beast'],
  [/ahriman|floating eye/, 'bat'],
  [/\bzu\b|vulture|\broc\b|bird/, 'bat'],
  [/omega|automaton|machina|robot/, 'cr_guard'],
  [/skelet|lich|bone/, 'cr_skeleton'],
  [/zomb|ghoul|fallen|corpse|dead/, 'cr_zombie'],
  [/slime|ooze|blob|obariyon/, 'cr_slime'],
  [/ghost|wraith|spirit|phantom|specter|mokoi/, 'cr_ghost'],
  [/pixie|fairy|fae|imp\b|lilim|incub|succub|apsaras/, 'cr_imp'],
  [/baphomet|minotaur|\boni\b|bicorn|demon|devil|fiend/, 'cr_demon'],
  [/ogre|troll|giant|brute|golem/, 'cr_brute'],
  [/wolf|garou|hound|beast|dog/, 'cr_beast'],
  [/naga|medusa|snake|serpent|lamia/, 'cr_serpent'],
  [/frost|\bice\b|snow/, 'cr_frost'],
  [/pyro|pumpkin|jack.?o|lantern/, 'cr_pumpkin'],
  [/angel|seraph|deva/, 'cr_angel'],
  [/hermit|elder|sage|crone|witch/, 'cr_hermit'],
  [/guard|knight|soldier|warden/, 'cr_guard'],
  [/wander|travel|stranger|rogue|hood/, 'cr_hooded'],
  [/\brat\b|rodent/, 'rat'],
  [/\bbat\b/, 'bat'],
  [/spider|arachn/, 'spider'],
]

export function resolveCreatureSprite(hint: { sprite?: string; id?: string; name?: string }): string | null {
  if (hint.sprite && hint.sprite in SPRITES) return hint.sprite
  const key = `${hint.id ?? ''} ${hint.name ?? ''}`.toLowerCase()
  for (const [re, kind] of CREATURE_KEYWORDS) {
    if (re.test(key)) return kind
  }
  return null
}

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

/** True when a sprite value is a creator-uploaded bitmap (data URI) rather than a built-in kind. */
export function isBitmapSprite(sprite: string | undefined | null): sprite is string {
  return typeof sprite === 'string' && sprite.startsWith('data:image/')
}

/** Split a stored bitmap sprite into its frames (animated uploads join two data URIs with '|'). */
export function bitmapFrames(sprite: string): string[] {
  return sprite.split('|').filter(f => f.startsWith('data:image/'))
}

/** All built-in sprite kind names (for pickers / datalists). */
export function spriteKinds(): string[] {
  return Object.keys(SPRITES)
}

/**
 * Center-anchored bitmap billboard for creator-uploaded sprites.
 * The image keeps its own aspect inside a `size`×`size` box, feet on the box bottom,
 * and renders with nearest-neighbour scaling for the EotB pixel look.
 */
export function bitmapSprite(
  dataUri: string,
  cx: number,
  cy: number,
  size: number,
  key: string,
  opacity = 1,
): React.ReactElement | null {
  const frames = bitmapFrames(dataUri)
  if (frames.length === 0) return null
  const img = (href: string) => (
    <image
      href={href}
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMax meet"
      style={{ imageRendering: 'pixelated' }}
    />
  )
  if (frames.length === 1) {
    return <g key={key} opacity={opacity} pointerEvents="none">{img(frames[0])}</g>
  }
  // Two-frame upload: same discrete opacity flip as the built-in library
  return (
    <g key={key} opacity={opacity} pointerEvents="none">
      <g>
        {img(frames[0])}
        <animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="0.9s" repeatCount="indefinite" />
      </g>
      <g opacity={0}>
        {img(frames[1])}
        <animate attributeName="opacity" values="0;1" keyTimes="0;0.5" calcMode="discrete" dur="0.9s" repeatCount="indefinite" />
      </g>
    </g>
  )
}

/**
 * One-stop creature billboard: creator bitmap wins, then the built-in library
 * (explicit kind or keyword match on id/name), else null so callers can fall
 * back to an emoji glyph.
 */
export function creatureSprite(
  hint: { sprite?: string; id?: string; name?: string },
  cx: number,
  cy: number,
  size: number,
  key: string,
  opacity = 1,
): React.ReactElement | null {
  if (isBitmapSprite(hint.sprite)) return bitmapSprite(hint.sprite, cx, cy, size, key, opacity)
  const kind = resolveCreatureSprite(hint)
  return kind ? pixelSprite(kind, cx, cy, size, key, opacity) : null
}

/** Raw grid access for validation tests and the PNG template exporter. */
export function _spriteDefs(): Record<string, { w: number; h: number; palette: Record<string, string>; frames: string[][] }> {
  return SPRITES
}
