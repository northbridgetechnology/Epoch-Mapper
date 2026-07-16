/**
 * Standalone player entry point — the root of a bundled / hosted / desktop
 * build. esbuild compiles this into a single IIFE; `scripts/build-player.mjs`
 * wraps it (plus Tailwind CSS) into `dist-player/player.html`.
 *
 * Game source resolution, in order:
 *   1. `window.__EPOCH_GAME__` — base64 `.epochmap` baked into the HTML
 *      (the single-file standalone; the template ships an empty placeholder).
 *   2. `?game=<url>` — an explicit game URL (hosted multi-game sites).
 *   3. `./game.epochmap` — a sidecar file beside index.html (hosted single game).
 */

import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { GamePlayer } from '@/components/GamePlayer'

declare global {
  interface Window { __EPOCH_GAME__?: string }
}

const PLACEHOLDER = '__EPOCH_GAME_DATA__'
const baked = window.__EPOCH_GAME__ && window.__EPOCH_GAME__ !== PLACEHOLDER ? window.__EPOCH_GAME__ : undefined
const param = new URLSearchParams(location.search).get('game') ?? undefined
const url = baked ? undefined : (param ?? './game.epochmap')

const el = document.getElementById('root')
if (el) {
  createRoot(el).render(
    <>
      <GamePlayer base64={baked} url={url} />
      <Toaster theme="dark" position="bottom-right" richColors />
    </>,
  )
}
