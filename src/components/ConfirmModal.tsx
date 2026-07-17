'use client'

/**
 * Minimal confirmation dialog — a title, a message, and Cancel / Confirm.
 * Used for actions that discard or replace something the user built, where a
 * silent change would be surprising.
 */

import { cn } from '@/lib/utils'

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', onConfirm, onClose }: {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-900 border border-white/12 rounded-xl shadow-2xl w-[24rem] flex flex-col overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white/90">{title}</h2>
        </div>
        <div className="px-5 py-4 text-sm text-white/70 leading-relaxed">{message}</div>
        <div className="flex gap-2 px-5 py-3 border-t border-white/8">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors',
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
