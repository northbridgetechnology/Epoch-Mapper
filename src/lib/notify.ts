/**
 * Player-facing notifications with a swappable presentation.
 *
 * By default `notify()` falls back to a corner toast (sonner) — the right fit
 * for the editor workspaces. When a full-screen game UI is mounted (the Tab
 * menu), it registers a sink here and every message becomes a front-and-center
 * Final Fantasy-style alert window instead. Multi-line messages stay together
 * as one alert.
 */

import { toast } from 'sonner'

export type NotifyKind = 'info' | 'success' | 'error'
export type NotifySink = (lines: string[], kind: NotifyKind) => void

let sink: NotifySink | null = null

/** Register a presentation sink; returns an unregister function. A newer sink
 *  wins, and unregistering only clears the sink it registered. */
export function setNotifySink(fn: NotifySink): () => void {
  sink = fn
  return () => { if (sink === fn) sink = null }
}

export function notify(message: string | string[], kind: NotifyKind = 'info') {
  const lines = (Array.isArray(message) ? message : [message]).filter(Boolean)
  if (lines.length === 0) return
  if (sink) { sink(lines, kind); return }
  const fn = kind === 'error' ? toast.error : kind === 'success' ? toast.success : toast
  if (lines.length === 1) fn(lines[0])
  else fn(lines[0], { description: lines.slice(1).join('\n') })
}
