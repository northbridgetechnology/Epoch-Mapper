/**
 * First-person surface textures — Tier 2 of per-map theming.
 *
 * A texture is *relief*, not colour: builtins are procedural SVG tiles rendered
 * mostly in grayscale so the map's THEME still supplies the palette. In the
 * renderer each tile is composited over the themed geometry with `soft-light`
 * blending, so a Stone-Brick wall reads blue in an Ice Cave and red in a Lava
 * Fortress from the very same texture definition.
 *
 * Builtins cost zero file bytes (they are code). Custom textures are user
 * uploads referenced as `custom:<hash>` and carried in `MapData.textureAssets`
 * / deduped into `EpochmapFile.textureBlobs` by the codec.
 */

export type TexSurface = 'wall' | 'floor' | 'ceiling'

export interface TexColors {
  hue: number
  sat: number
  light: number   // base lightness the theme uses for this surface
}

export interface TextureDef {
  id: string
  name: string
  icon: string
  surfaces: TexSurface[]
  /** Inner SVG markup for a 100×100 tile (no <svg>/<pattern> wrapper). */
  render: (c: TexColors) => string
}

// ── procedural helpers ──────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Grayscale relief colour — soft-light over the themed base gives depth. */
function g(l: number): string { return `hsl(0 0% ${clamp(l, 3, 97)}%)` }
/** Warm relief (wood, dirt) — a little hue so organic materials feel warmer. */
function warm(l: number): string { return `hsl(30 22% ${clamp(l, 3, 97)}%)` }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }
function r(n: number) { return Math.round(n * 100) / 100 }

// ── builtins ────────────────────────────────────────────────────────────────────

export const BUILTIN_TEXTURES: TextureDef[] = [
  {
    id: 'stone_brick', name: 'Stone Brick', icon: '🧱', surfaces: ['wall'],
    render: () => {
      const rows = 5, mortar = g(26)
      let s = `<rect width="100" height="100" fill="${g(52)}"/>`
      const rh = 100 / rows
      const rnd = mulberry32(11)
      for (let ry = 0; ry < rows; ry++) {
        const off = ry % 2 === 0 ? 0 : -16
        for (let bx = -1; bx < 4; bx++) {
          const x = bx * 32 + off, y = ry * rh
          const l = 46 + rnd() * 14
          s += `<rect x="${r(x + 1.5)}" y="${r(y + 1.5)}" width="29" height="${r(rh - 3)}" rx="1.5" fill="${g(l)}"/>`
          s += `<rect x="${r(x + 1.5)}" y="${r(y + 1.5)}" width="29" height="3" fill="${g(l + 12)}" opacity="0.5"/>`
        }
      }
      return `<rect width="100" height="100" fill="${mortar}"/>` + s
    },
  },
  {
    id: 'cut_block', name: 'Ashlar Blocks', icon: '⬛', surfaces: ['wall'],
    render: () => {
      const mortar = g(24)
      let s = `<rect width="100" height="100" fill="${mortar}"/>`
      const rnd = mulberry32(7)
      const cells = [[0, 0, 50], [50, 0, 50], [0, 50, 34], [34, 50, 66], [0, 25, 100], [0, 75, 100]]
      // two big courses split differently
      const draw = (x: number, y: number, w: number, h: number) => {
        const l = 44 + rnd() * 16
        s += `<rect x="${r(x + 1.5)}" y="${r(y + 1.5)}" width="${r(w - 3)}" height="${r(h - 3)}" fill="${g(l)}"/>`
        s += `<rect x="${r(x + 1.5)}" y="${r(y + 1.5)}" width="${r(w - 3)}" height="4" fill="${g(l + 14)}" opacity="0.4"/>`
        s += `<rect x="${r(x + 1.5)}" y="${r(y + h - 5.5)}" width="${r(w - 3)}" height="4" fill="${g(l - 16)}" opacity="0.4"/>`
      }
      draw(0, 0, 62, 50); draw(62, 0, 38, 50)
      draw(0, 50, 38, 50); draw(38, 50, 62, 50)
      void cells
      return s
    },
  },
  {
    id: 'cobblestone', name: 'Cobblestone', icon: '🪨', surfaces: ['wall', 'floor'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(30)}"/>`
      const rnd = mulberry32(23)
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          const cx = gx * 20 + 4 + rnd() * 12
          const cy = gy * 20 + 4 + rnd() * 12
          const rx = 7 + rnd() * 4, ry = 6 + rnd() * 4
          const l = 42 + rnd() * 20
          s += `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${g(l)}"/>`
          s += `<ellipse cx="${r(cx - 1.2)}" cy="${r(cy - 1.2)}" rx="${r(rx * 0.6)}" ry="${r(ry * 0.6)}" fill="${g(l + 12)}" opacity="0.5"/>`
        }
      }
      return s
    },
  },
  {
    id: 'rough_hewn', name: 'Rough Hewn', icon: '⛰️', surfaces: ['wall', 'ceiling'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(46)}"/>`
      const rnd = mulberry32(41)
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 100, y = rnd() * 100
        const w = 4 + rnd() * 22, h = 2 + rnd() * 7
        const l = 30 + rnd() * 38
        s += `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${g(l)}" opacity="0.55"/>`
      }
      return s
    },
  },
  {
    id: 'cave_rock', name: 'Cave Rock', icon: '🕳️', surfaces: ['wall', 'ceiling'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(40)}"/>`
      const rnd = mulberry32(59)
      for (let i = 0; i < 26; i++) {
        const cx = rnd() * 100, cy = rnd() * 100, rr = 6 + rnd() * 18
        const l = 28 + rnd() * 34
        s += `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}" fill="${g(l)}" opacity="0.5"/>`
      }
      return s
    },
  },
  {
    id: 'wood_plank', name: 'Wood Planks', icon: '🪵', surfaces: ['wall', 'floor', 'ceiling'],
    render: () => {
      const cols = 4
      let s = `<rect width="100" height="100" fill="${warm(30)}"/>`
      const cw = 100 / cols
      const rnd = mulberry32(13)
      for (let c = 0; c < cols; c++) {
        const x = c * cw
        const l = 40 + rnd() * 12
        s += `<rect x="${r(x + 0.8)}" y="0" width="${r(cw - 1.6)}" height="100" fill="${warm(l)}"/>`
        // grain streaks
        for (let k = 0; k < 5; k++) {
          const gx = x + 2 + rnd() * (cw - 4)
          s += `<rect x="${r(gx)}" y="0" width="0.8" height="100" fill="${warm(l - 10)}" opacity="0.45"/>`
        }
        // knot
        if (rnd() > 0.5) {
          const ky = 12 + rnd() * 76
          s += `<ellipse cx="${r(x + cw / 2)}" cy="${r(ky)}" rx="3" ry="4.5" fill="${warm(l - 16)}" opacity="0.6"/>`
        }
      }
      return s
    },
  },
  {
    id: 'wood_beams', name: 'Timber Beams', icon: '🏚️', surfaces: ['ceiling', 'wall'],
    render: () => {
      const rows = 4
      let s = `<rect width="100" height="100" fill="${warm(22)}"/>`
      const rh = 100 / rows
      const rnd = mulberry32(29)
      for (let i = 0; i < rows; i++) {
        const y = i * rh
        const l = 38 + rnd() * 10
        s += `<rect x="0" y="${r(y + 1)}" width="100" height="${r(rh - 2)}" fill="${warm(l)}"/>`
        s += `<rect x="0" y="${r(y + 1)}" width="100" height="2.5" fill="${warm(l + 12)}" opacity="0.5"/>`
        s += `<rect x="0" y="${r(y + rh - 3)}" width="100" height="2" fill="${warm(l - 16)}" opacity="0.5"/>`
      }
      return s
    },
  },
  {
    id: 'flagstone', name: 'Flagstone', icon: '▦', surfaces: ['floor'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(22)}"/>`
      const rnd = mulberry32(37)
      const slab = (x: number, y: number, w: number, h: number) => {
        const l = 40 + rnd() * 16
        s += `<rect x="${r(x + 2)}" y="${r(y + 2)}" width="${r(w - 4)}" height="${r(h - 4)}" rx="2" fill="${g(l)}"/>`
      }
      slab(0, 0, 46, 46); slab(46, 0, 54, 60)
      slab(0, 46, 34, 54); slab(34, 60, 66, 40); slab(46, 0, 0, 0)
      slab(0, 46, 60, 30); slab(60, 60, 40, 40)
      return s
    },
  },
  {
    id: 'tile_checker', name: 'Checker Tile', icon: '🏁', surfaces: ['floor'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(58)}"/>`
      const n = 4, t = 100 / n
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++)
          if ((x + y) % 2 === 0)
            s += `<rect x="${r(x * t)}" y="${r(y * t)}" width="${r(t)}" height="${r(t)}" fill="${g(30)}"/>`
      s += `<rect width="100" height="100" fill="none" stroke="${g(18)}" stroke-width="1"/>`
      return s
    },
  },
  {
    id: 'dirt', name: 'Packed Dirt', icon: '🟫', surfaces: ['floor'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${warm(34)}"/>`
      const rnd = mulberry32(83)
      for (let i = 0; i < 120; i++) {
        const x = rnd() * 100, y = rnd() * 100, rr = 0.6 + rnd() * 2.4
        const l = 24 + rnd() * 30
        s += `<circle cx="${r(x)}" cy="${r(y)}" r="${r(rr)}" fill="${warm(l)}" opacity="0.5"/>`
      }
      return s
    },
  },
  {
    id: 'metal_panel', name: 'Riveted Metal', icon: '⚙️', surfaces: ['wall', 'floor'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(44)}"/>`
      s += `<rect x="2" y="2" width="96" height="96" fill="none" stroke="${g(60)}" stroke-width="1.2" opacity="0.6"/>`
      s += `<rect x="0" y="49" width="100" height="2" fill="${g(24)}"/>`
      s += `<rect x="49" y="0" width="2" height="100" fill="${g(24)}"/>`
      const rivet = (x: number, y: number) => {
        s += `<circle cx="${x}" cy="${y}" r="2.4" fill="${g(30)}"/>`
        s += `<circle cx="${r(x - 0.6)}" cy="${r(y - 0.6)}" r="1.1" fill="${g(66)}"/>`
      }
      for (const x of [8, 92]) for (const y of [8, 42, 58, 92]) rivet(x, y)
      for (const y of [8, 92]) for (const x of [42, 58]) rivet(x, y)
      return s
    },
  },
  {
    id: 'cracked_plaster', name: 'Cracked Plaster', icon: '🩹', surfaces: ['wall', 'ceiling'],
    render: () => {
      let s = `<rect width="100" height="100" fill="${g(64)}"/>`
      const rnd = mulberry32(97)
      // subtle mottling
      for (let i = 0; i < 40; i++) {
        const x = rnd() * 100, y = rnd() * 100, rr = 3 + rnd() * 10
        s += `<circle cx="${r(x)}" cy="${r(y)}" r="${r(rr)}" fill="${g(54 + rnd() * 12)}" opacity="0.3"/>`
      }
      // cracks
      for (let c = 0; c < 4; c++) {
        let x = rnd() * 100, y = rnd() * 100
        let d = `M ${r(x)} ${r(y)}`
        for (let k = 0; k < 8; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; d += ` L ${r(clamp(x, 0, 100))} ${r(clamp(y, 0, 100))}` }
        s += `<path d="${d}" fill="none" stroke="${g(30)}" stroke-width="${r(0.6 + rnd())}" opacity="0.55"/>`
      }
      return s
    },
  },
]

// ── lookup / resolution ─────────────────────────────────────────────────────────

const BY_ID = new Map(BUILTIN_TEXTURES.map(t => [t.id, t]))

export function getBuiltinTexture(id: string): TextureDef | undefined {
  return BY_ID.get(id)
}

export function texturesForSurface(surface: TexSurface): TextureDef[] {
  return BUILTIN_TEXTURES.filter(t => t.surfaces.includes(surface))
}

export function isCustomRef(ref: string | undefined): ref is string {
  return typeof ref === 'string' && ref.startsWith('custom:')
}

export function customHash(ref: string): string {
  return ref.slice('custom:'.length)
}

/** Wrap procedural tile markup in a standalone, URL-encoded SVG data URI. */
export function tileToDataUri(inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/**
 * Resolve a texture ref to an image `href` usable directly inside an SVG
 * `<pattern>`, or null when the ref is empty/unknown. Builtins become an
 * encoded SVG data URI (theme-tinted); customs return their uploaded data URI.
 */
export function textureImageHref(
  ref: string | undefined,
  colors: TexColors,
  assets?: Record<string, string>,
): string | null {
  if (!ref) return null
  if (isCustomRef(ref)) {
    return assets?.[customHash(ref)] ?? null
  }
  const def = BY_ID.get(ref)
  return def ? tileToDataUri(def.render(colors)) : null
}

/** Preview data URI for a builtin, using neutral stone colours (for the picker UI). */
export function texturePreviewUri(def: TextureDef): string {
  return tileToDataUri(def.render({ hue: 220, sat: 8, light: 50 }))
}
