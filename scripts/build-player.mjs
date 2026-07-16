#!/usr/bin/env node
/**
 * Build the standalone player template.
 *
 * Produces `dist-player/player.html` — a single self-contained HTML file with
 * the engine (bundled by esbuild) and Tailwind CSS inlined, plus an empty game
 * placeholder (`window.__EPOCH_GAME__ = "__EPOCH_GAME_DATA__"`).
 *
 *   • A (single-file game):   bake a `.epochmap` into a copy via bake-game.mjs.
 *   • B (hosted build):       serve player.html (rename to index.html) and drop
 *                             a `game.epochmap` beside it, or use `?game=<url>`.
 *   • C (desktop):            Tauri wraps the same folder — see DISTRIBUTION.md.
 *
 * Uses only esbuild + the Tailwind CLI (both already in devDependencies).
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist-player')
const PLACEHOLDER = '__EPOCH_GAME_DATA__'

function log(msg) { process.stdout.write(`[build-player] ${msg}\n`) }

function missingDeps(err) {
  process.stderr.write(
    `\n[build-player] Build tools are not installed.\n${err ? `  (${err.message})\n` : ''}` +
    `\nesbuild and tailwindcss are devDependencies. Install them with:\n\n` +
    `    npm install            # or: bun install\n` +
    `    npm install --include=dev   # if NODE_ENV=production skips devDependencies\n\n` +
    `Then re-run:  npm run build:player\n` +
    `(No host install needed if you only use the editor's "Export Standalone HTML" button.)\n`,
  )
  process.exit(1)
}

// esbuild + the Tailwind CLI are devDependencies; fail with a clear message
// rather than a raw ERR_MODULE_NOT_FOUND when they are absent.
let build
try { ({ build } = await import('esbuild')) } catch (err) { missingDeps(err) }
const tailwindBin = path.join(root, 'node_modules/.bin/tailwindcss')
if (!existsSync(tailwindBin)) missingDeps()

// ── 1. Bundle the player entry into one IIFE ──────────────────────────────────
log('bundling engine (esbuild)…')
const result = await build({
  entryPoints: [path.join(root, 'src/player/entry.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  jsx: 'automatic',
  legalComments: 'none',
  write: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    // The player has no PDF export; swap the module for a tiny stub so the
    // jsPDF/html2canvas/canvg/dompurify toolchain (~658 KB, ~40% of the bundle)
    // is never pulled in. The editor's Next.js build is unaffected.
    '@/lib/dungeon-export': path.join(root, 'src/player/pdf-stub.ts'),
    '@': path.join(root, 'src'),
  },
  loader: { '.png': 'dataurl', '.svg': 'dataurl' },
})
const js = result.outputFiles[0].text
log(`  bundle: ${(js.length / 1024).toFixed(0)} KB`)

// ── 2. Generate the Tailwind CSS ──────────────────────────────────────────────
log('generating CSS (tailwind)…')
const tmp = mkdtempSync(path.join(tmpdir(), 'epoch-css-'))
const cssOut = path.join(tmp, 'out.css')
execFileSync(tailwindBin, ['-i', path.join(root, 'src/app/globals.css'), '-o', cssOut, '--minify'], {
  cwd: root, stdio: ['ignore', 'ignore', 'inherit'],
})
const css = readFileSync(cssOut, 'utf8')
rmSync(tmp, { recursive: true, force: true })
log(`  css: ${(css.length / 1024).toFixed(0)} KB`)

// ── 3. Assemble the single-file HTML template ────────────────────────────────
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Epoch Game</title>
<style>${css}
html,body,#root{height:100%;margin:0}#root{overflow:hidden}</style>
</head>
<body>
<div id="root"></div>
<script>window.__EPOCH_GAME__=${JSON.stringify(PLACEHOLDER)};</script>
<script>${js}</script>
</body>
</html>
`

mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'player.html'), html)
log(`wrote dist-player/player.html (${(html.length / 1024).toFixed(0)} KB total)`)

// Also serve the template from public/ so the editor's "Export Standalone
// HTML" can fetch it, and drop an index.html (Option B) that loads a sidecar
// ./game.epochmap (or ?game=<url>) — host this folder + your game file.
mkdirSync(path.join(root, 'public'), { recursive: true })
writeFileSync(path.join(root, 'public/player-template.html'), html)
const webDir = path.join(outDir, 'web')
mkdirSync(webDir, { recursive: true })
writeFileSync(path.join(webDir, 'index.html'), html)
log('wrote public/player-template.html and dist-player/web/index.html')
log('done. Bake a game:  node scripts/bake-game.mjs <game.epochmap> [out.html]')
