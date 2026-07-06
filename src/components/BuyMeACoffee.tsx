'use client'

import { useEffect } from 'react'

/**
 * Buy Me a Coffee floating widget (bottom-right). The vendor script reads its
 * configuration from its own <script> tag's data-* attributes and injects a
 * floating button. Next.js can't run a raw <script src> placed in JSX, so we
 * append the exact tag to <body> on mount, guarding against React's dev-mode
 * double-invoke. The widget persists for the session, so there's nothing to
 * tear down.
 */

const WIDGET_SRC = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js'

const DATA: Record<string, string> = {
  'data-name': 'BMC-Widget',
  'data-cfasync': 'false',
  'data-id': 'northbridgetechnology',
  'data-description': 'Support me on Buy me a coffee!',
  'data-message': 'Thank you for visiting!',
  'data-color': '#5F7FFF',
  'data-position': 'Right',
  'data-x_margin': '18',
  'data-y_margin': '18',
}

export function BuyMeACoffee() {
  useEffect(() => {
    if (document.querySelector('script[data-name="BMC-Widget"]')) return
    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    for (const [key, value] of Object.entries(DATA)) script.setAttribute(key, value)
    document.body.appendChild(script)
  }, [])
  return null
}
