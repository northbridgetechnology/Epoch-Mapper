'use client'

/**
 * Reusable portrait picker — the built-in pixel busts plus upload-your-own,
 * shared by the player Character Builder and the NPC editor. `allowEmoji` adds
 * a small emoji field for NPCs that prefer a glyph over a portrait.
 */

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Portrait, portraitIds, isBuiltinPortrait } from '@/lib/portraits'
import { fileToSpriteDataUri, SPRITE_ACCEPT_ATTR } from '@/lib/sprite-upload'
import { isBitmapSprite } from '@/lib/pixel-sprites'

export function PortraitPicker({ value, onChange, allowEmoji = false, columns = 6 }: {
  value?: string
  onChange: (portrait: string) => void
  allowEmoji?: boolean
  columns?: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<string[]>(value && isBitmapSprite(value) ? [value] : [])
  const [err, setErr] = useState<string | null>(null)

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const uri = await fileToSpriteDataUri(file)
      setUploads(u => (u.includes(uri) ? u : [...u, uri]))
      onChange(uri)
      setErr(null)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not read that image.')
    }
  }

  const emojiValue = value && !isBuiltinPortrait(value) && !isBitmapSprite(value) ? value : ''

  return (
    <div className="space-y-1.5">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {portraitIds().map(id => (
          <button key={id} type="button" onClick={() => onChange(id)} title={id}
            className={`rounded-md overflow-hidden border ${value === id ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-white/10 hover:border-white/30'}`}>
            <Portrait value={id} size={40} rounded={false} />
          </button>
        ))}
        {uploads.map((uri, n) => (
          <button key={`u${n}`} type="button" onClick={() => onChange(uri)}
            className={`rounded-md overflow-hidden border ${value === uri ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-white/10 hover:border-white/30'}`}>
            <Portrait value={uri} size={40} rounded={false} />
          </button>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} title="Upload portrait"
          className="grid place-items-center h-10 rounded-md border border-dashed border-white/20 text-white/40 hover:text-white hover:border-white/40">
          <Upload className="w-4 h-4" />
        </button>
      </div>
      <input ref={fileRef} type="file" accept={SPRITE_ACCEPT_ATTR} className="hidden" onChange={onUpload} />
      {allowEmoji && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/35 uppercase tracking-wide">or emoji</span>
          <input type="text" value={emojiValue} maxLength={4} placeholder="🧙"
            onChange={e => onChange(e.target.value)}
            className="w-14 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-center text-sm focus:outline-none focus:border-amber-500/50" />
        </div>
      )}
      {err && <div className="text-[11px] text-red-400">{err}</div>}
    </div>
  )
}
