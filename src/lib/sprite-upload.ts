/**
 * Creator sprite uploads: turn an image file into a small PNG data URI that can
 * live directly on an EnemyDef/NpcDef `sprite` field (and thus inside saved
 * rulesets, localStorage drafts, and .epochmap exports) without blowing up
 * storage quotas.
 */

/** Longest edge after downscale, in pixels. Billboards render small, so 64 is plenty. */
export const SPRITE_MAX_DIM = 64
/** Cap on the encoded data-URI length (~48KB of raw PNG once base64 overhead is counted). */
export const SPRITE_MAX_BYTES = 64 * 1024

/**
 * Decode `file`, downscale it to at most SPRITE_MAX_DIM on its longest edge
 * (nearest-neighbour, preserving pixel art), and return a PNG data URI.
 * Rejects with a user-presentable Error when the image cannot be decoded or
 * is still too large after downscaling.
 */
export async function fileToSpriteDataUri(
  file: File,
  maxDim: number = SPRITE_MAX_DIM,
  maxBytes: number = SPRITE_MAX_BYTES,
): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not read that file as an image.'))
      i.src = url
    })
    if (!img.width || !img.height) throw new Error('Image has no pixels.')

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable in this browser.')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, w, h)

    const uri = canvas.toDataURL('image/png')
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
