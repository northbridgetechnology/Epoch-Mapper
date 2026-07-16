'use client'

import { useEffect, useState } from 'react'

/**
 * Buy Me a Coffee support button (bottom-left, in the tool-palette column, just
 * right of the activity bar and inline with its GitHub link). While the Play
 * workspace is mounted it hides itself entirely — Play renders an inline coffee
 * chip in the party HUD next to the Steps counter instead (see PlayWorkspace).
 *
 * We try the official vendor widget first: it reads its config from its own
 * <script> data-* attributes and injects a floating button. Next.js can't run a
 * raw <script src> placed in JSX, so we append the tag on mount, and — because
 * the widget bootstraps on `DOMContentLoaded` (already fired by then) — we
 * re-dispatch that event once it loads.
 *
 * Content/ad blockers (Safari, uBlock, Brave…) frequently block the vendor
 * script. When that happens the fancy widget never mounts, so we fall back to a
 * plain, self-hosted link that depends on nothing external. The fallback only
 * shows when the vendor button is absent, so non-blocked visitors don't see two.
 */

const WIDGET_SRC = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js'
export const PROFILE_URL = 'https://www.buymeacoffee.com/northbridgetechnology'
const BMC_COLOR = '#5F7FFF'

const DATA: Record<string, string> = {
  'data-name': 'BMC-Widget',
  'data-cfasync': 'false',
  'data-id': 'northbridgetechnology',
  'data-description': 'Support me on Buy me a coffee!',
  'data-message': 'Thank you for visiting!',
  'data-color': BMC_COLOR,
  // Bottom-left, sitting in the same column as the editor's tool palette
  // (Terrain / Overlays / Edges), just right of the 48px activity bar.
  'data-position': 'Left',
  'data-x_margin': '56',
  'data-y_margin': '10',
}

export function BuyMeACoffee() {
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (!document.querySelector('script[data-name="BMC-Widget"]')) {
      const script = document.createElement('script')
      script.src = WIDGET_SRC
      script.async = true
      for (const [key, value] of Object.entries(DATA)) script.setAttribute(key, value)
      // The widget bootstraps on the document's already-fired DOMContentLoaded —
      // re-dispatch it on load so the floating button actually mounts.
      script.addEventListener('load', () => {
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: true }))
      })
      // Blocked outright → show our own link.
      script.addEventListener('error', () => setShowFallback(true))
      document.body.appendChild(script)
    }

    // Safari content blockers don't always fire `error`; if the vendor button
    // hasn't appeared shortly, show the plain fallback link instead.
    const timer = window.setTimeout(() => {
      if (!document.getElementById('bmc-wbtn')) setShowFallback(true)
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [])

  if (!showFallback) return null

  return (
    <a
      id="bmc-fallback"
      href={PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Buy me a coffee"
      className="fixed bottom-[10px] left-[56px] z-[9998] inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105"
      style={{ backgroundColor: BMC_COLOR }}
    >
      <span aria-hidden>☕</span>
      <span>Buy me a coffee</span>
    </a>
  )
}
