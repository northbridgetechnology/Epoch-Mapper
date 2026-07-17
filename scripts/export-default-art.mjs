#!/usr/bin/env node
/**
 * Export the engine's built-in placeholder art as standalone SVG files so the
 * default sprites/portraits can be reviewed and redesigned outside the editor.
 *
 * The art has no image assets — sprites and portraits are authored as pixel
 * grids (letters index a palette, '.' = transparent) and drawn live as SVG
 * rects. This mirrors that exact rendering into one self-contained .svg per
 * piece: rects run-length-merged per row, viewBox in grid units, crisp edges.
 * Two-frame sprites keep the engine's discrete opacity-flip animation, so the
 * file plays both frames; single-frame pieces are static.
 *
 * Output (filenames = the exact engine key you'd swap in the editor):
 *   docs/default-art/creatures/<key>.svg
 *   docs/default-art/props/<key>.svg
 *   docs/default-art/portraits/<id>.svg
 *   docs/default-art/index.html   ← contact sheet of everything, labeled
 *
 * Run: node scripts/export-default-art.mjs
 */
// Run with the tsx loader so the project's .tsx sources import directly:
//   node --import tsx scripts/export-default-art.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'default-art')

const { _spriteDefs } = await import('../src/lib/pixel-sprites.tsx')
const { _portraitDefs } = await import('../src/lib/portraits.tsx')

// Creatures use the cr_ prefix; everything else in the sprite lib is dungeon
// dressing / props / critters.
const CREATURE = (key) => key.startsWith('cr_')

/** Run-length-merged <rect> runs for one grid, in grid coordinate units. */
function gridRects(grid, palette) {
  const rects = []
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.' || !palette[ch]) { x++; continue }
      let run = 1
      while (x + run < row.length && row[x + run] === ch) run++
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[ch]}"/>`)
      x += run
    }
  }
  return rects.join('')
}

/** Standalone SVG for a sprite def (animates when it has two frames). */
function spriteSvg(def, box = 256) {
  const { w, h, palette, frames } = def
  const aspect = h / w
  const width = box
  const height = Math.round(box * aspect)
  const two = frames.length > 1
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`
  if (!two) {
    return `${head}${gridRects(frames[0], palette)}</svg>\n`
  }
  // Two discrete frames, matching the engine's 0.9s opacity flip.
  const anim0 = `<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" calcMode="discrete" dur="0.9s" repeatCount="indefinite"/>`
  const anim1 = `<animate attributeName="opacity" values="0;1" keyTimes="0;0.5" calcMode="discrete" dur="0.9s" repeatCount="indefinite"/>`
  return `${head}<g opacity="1">${gridRects(frames[0], palette)}${anim0}</g>` +
         `<g opacity="0">${gridRects(frames[1], palette)}${anim1}</g></svg>\n`
}

/** Standalone SVG for a portrait def (always single-frame, on a dark tile). */
function portraitSvg(def, box = 256) {
  const { w, h, palette, grid } = def
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
         `<rect x="0" y="0" width="${w}" height="${h}" fill="#0e0b14"/>${gridRects(grid, palette)}</svg>\n`
}

// ── Emit files ────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true })
for (const d of ['creatures', 'props', 'portraits']) mkdirSync(join(OUT, d), { recursive: true })

const sprites = _spriteDefs()
const portraits = _portraitDefs()
const manifest = { creatures: [], props: [], portraits: [] }

for (const [key, def] of Object.entries(sprites)) {
  const cat = CREATURE(key) ? 'creatures' : 'props'
  writeFileSync(join(OUT, cat, `${key}.svg`), spriteSvg(def))
  manifest[cat].push({ key, frames: def.frames.length })
}
for (const [id, def] of Object.entries(portraits)) {
  writeFileSync(join(OUT, 'portraits', `${id}.svg`), portraitSvg(def))
  manifest.portraits.push({ key: id, label: def.label, frames: 1 })
}

// ── Contact sheet ───────────────────────────────────────────────────────────
const section = (title, dir, items) => `
  <h2>${title} <span>(${items.length})</span></h2>
  <div class="grid">
    ${items.map(it => `<figure>
      <div class="cell"><img src="${dir}/${it.key}.svg" alt="${it.key}"></div>
      <figcaption>${it.key}${it.frames > 1 ? ' <em>· animated</em>' : ''}</figcaption>
    </figure>`).join('')}
  </div>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Epoch — default art</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 2rem clamp(1rem,4vw,3rem); background:#0b0910; color:#e7e2f0;
    font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  h1 { font-size:1.4rem; margin:0 0 .25rem; }
  p.note { color:#9a93ad; margin:.25rem 0 2rem; max-width:60ch; }
  h2 { font-size:1rem; letter-spacing:.02em; margin:2.5rem 0 1rem; color:#c9b8ff; }
  h2 span { color:#6f6788; font-weight:400; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:1rem; }
  figure { margin:0; text-align:center; }
  .cell { aspect-ratio:1; display:grid; place-items:center; padding:14px;
    background:#151020; border:1px solid #251d38; border-radius:10px;
    background-image:linear-gradient(45deg,#181228 25%,transparent 25%,transparent 75%,#181228 75%),
      linear-gradient(45deg,#181228 25%,transparent 25%,transparent 75%,#181228 75%);
    background-size:16px 16px; background-position:0 0,8px 8px; }
  .cell img { width:100%; height:100%; object-fit:contain; image-rendering:pixelated; }
  figcaption { margin-top:.5rem; font-family:ui-monospace,monospace; font-size:12px; color:#b7aed0; word-break:break-all; }
  figcaption em { color:#7f76a0; font-style:normal; }
</style></head>
<body>
  <h1>Epoch — built-in placeholder art</h1>
  <p class="note">Every default sprite and portrait, rendered from its pixel grid. Filenames match the
  engine key you'd swap when replacing a default. Animated sprites play both frames here.</p>
  ${section('Creatures', 'creatures', manifest.creatures)}
  ${section('Props &amp; environment', 'props', manifest.props)}
  ${section('Portraits', 'portraits', manifest.portraits)}
</body></html>\n`
writeFileSync(join(OUT, 'index.html'), html)

const total = manifest.creatures.length + manifest.props.length + manifest.portraits.length
console.log(`exported ${total} svgs → docs/default-art/`)
console.log(`  creatures: ${manifest.creatures.length}, props: ${manifest.props.length}, portraits: ${manifest.portraits.length}`)
