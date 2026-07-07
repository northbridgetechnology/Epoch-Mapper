/**
 * Creator sprite uploads: turn an image file into small PNG data URIs that can
 * live directly on an EnemyDef/NpcDef `sprite` field (and thus inside saved
 * rulesets, localStorage drafts, and .epochmap exports) without blowing up
 * storage quotas.
 *
 * Accepted input (enforced):
 *   - PNG, GIF, or WebP — formats with an alpha channel. JPEG is rejected
 *     because a no-transparency sprite always renders as a solid rectangle.
 *   - An image exactly twice as wide as it is tall is treated as a two-frame
 *     animation sheet (left = frame A, right = frame B) and stored as two
 *     data URIs joined with '|'.
 *   - Everything is downscaled to SPRITE_MAX_DIM on the longest edge with
 *     nearest-neighbour sampling; the encoded result is capped at
 *     SPRITE_MAX_BYTES.
 */

import { _spriteDefs, spriteKinds } from './pixel-sprites'

/** Longest edge of a stored frame, in pixels. Billboards render small, so 64 is plenty. */
export const SPRITE_MAX_DIM = 64
/** Cap on the total encoded data-URI length (both frames for animated uploads). */
export const SPRITE_MAX_BYTES = 64 * 1024
/** MIME types the uploader accepts — alpha-capable formats only. */
export const SPRITE_ACCEPT_TYPES = ['image/png', 'image/gif', 'image/webp'] as const
/** `accept` attribute value for the file input. */
export const SPRITE_ACCEPT_ATTR = SPRITE_ACCEPT_TYPES.join(',')

function makeCanvas(w: number, h: number, smooth = false): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')
  ctx.imageSmoothingEnabled = smooth
  return [canvas, ctx]
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not read that file as an image.'))
    i.src = url
  })
}

// ── Full-size image uploads (opening story splashes, etc.) ────────────────────────

/** Photographic image formats accepted for full-size art (JPEG is fine — no alpha needed). */
export const IMAGE_ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const IMAGE_ACCEPT_ATTR = IMAGE_ACCEPT_TYPES.join(',')

/**
 * Decode a full-size image (a splash/illustration, not a sprite) and return a
 * compact data URI: downscaled with smoothing to `maxDim` on the longest edge,
 * kept as PNG when small enough, otherwise re-encoded as JPEG at descending
 * quality until it fits `maxBytes`. No frame-splitting; JPEG allowed.
 */
export async function fileToImageDataUri(
  file: File,
  { maxDim = 960, maxBytes = 1_500_000 }: { maxDim?: number; maxBytes?: number } = {},
): Promise<string> {
  if (!(IMAGE_ACCEPT_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Use a PNG, JPEG, WebP, or GIF image.')
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    if (!img.width || !img.height) throw new Error('Image has no pixels.')
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const [canvas, ctx] = makeCanvas(w, h, true)
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h)

    let uri = canvas.toDataURL('image/png')
    if (uri.length > maxBytes) {
      for (const q of [0.85, 0.7, 0.55, 0.4]) {
        uri = canvas.toDataURL('image/jpeg', q)
        if (uri.length <= maxBytes) break
      }
    }
    if (uri.length > maxBytes) {
      throw new Error(`Image is still ${Math.ceil(uri.length / 1024)}KB after compression (limit ${Math.floor(maxBytes / 1024)}KB) — try a smaller image.`)
    }
    return uri
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Downscale a region of `img` to at most `maxDim` on its longest edge and encode as a PNG data URI. */
function encodeRegion(img: HTMLImageElement, sx: number, sw: number, sh: number, maxDim: number): string {
  const scale = Math.min(1, maxDim / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const [canvas, ctx] = makeCanvas(w, h)
  ctx.drawImage(img, sx, 0, sw, sh, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

/**
 * Decode `file` and return the string to store on a def's `sprite` field:
 * a single PNG data URI, or two joined with '|' when the upload is a
 * two-frame sheet (width exactly 2× height).
 * Rejects with a user-presentable Error on a bad format, undecodable image,
 * or a result still over the size cap after downscaling.
 */
export async function fileToSpriteDataUri(
  file: File,
  maxDim: number = SPRITE_MAX_DIM,
  maxBytes: number = SPRITE_MAX_BYTES,
): Promise<string> {
  if (!(SPRITE_ACCEPT_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Use a PNG, GIF, or WebP with transparency — JPEG has no alpha channel.')
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not read that file as an image.'))
      i.src = url
    })
    if (!img.width || !img.height) throw new Error('Image has no pixels.')

    // Exactly 2:1 → two-frame animation sheet, split down the middle.
    const isSheet = img.height >= 2 && img.width === img.height * 2
    const uri = isSheet
      ? `${encodeRegion(img, 0, img.height, img.height, maxDim)}|${encodeRegion(img, img.height, img.height, img.height, maxDim)}`
      : encodeRegion(img, 0, img.width, img.height, maxDim)

    if (uri.length > maxBytes) {
      throw new Error(
        `Sprite is still ${Math.ceil(uri.length / 1024)}KB after downscaling (limit ${Math.floor(maxBytes / 1024)}KB) — try a simpler image.`,
      )
    }
    return uri
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Render a built-in sprite to a PNG data URI at `scale` screen pixels per
 * sprite pixel. Two-frame sprites come out as a 2:1 sheet (frame A left,
 * frame B right) — exactly the layout the uploader reads back in, so any
 * built-in doubles as an editable template.
 */
export function builtinSpritePng(kind: string, scale = 8): string | null {
  const def = _spriteDefs()[kind]
  if (!def) return null
  const frames = def.frames.length > 1 ? 2 : 1
  const [canvas, ctx] = makeCanvas(def.w * scale * frames, def.h * scale)
  for (let f = 0; f < frames; f++) {
    const offX = f * def.w * scale
    def.frames[f].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = def.palette[row[x]]
        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(offX + x * scale, y * scale, scale, scale)
      }
    })
  }
  return canvas.toDataURL('image/png')
}

/** Trigger a browser download of a built-in sprite as an editable PNG template. */
export function downloadSpriteTemplate(kind?: string, scale = 8): void {
  const chosen = kind && _spriteDefs()[kind] ? kind : spriteKinds().find(k => k.startsWith('cr_')) ?? spriteKinds()[0]
  const uri = builtinSpritePng(chosen, scale)
  if (!uri) return
  const a = document.createElement('a')
  a.href = uri
  a.download = `sprite-template-${chosen}.png`
  a.click()
}
