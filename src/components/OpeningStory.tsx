'use client'

/**
 * Opening story shown once when starting a new game (Title → here → Character
 * Builder → play). Paced slides with optional splash art; click/Enter/Space
 * advances, Esc skips when the story allows it. {mc}/pronoun tokens resolve
 * against the Main Character if one already exists (usually none yet).
 */

import { useEffect, useState } from 'react'
import type { OpeningStory } from '@/lib/engine-types'
import { resolveText, type TextActor } from '@/lib/text-tokens'

export function OpeningStoryOverlay({ story, mc, onDone }: {
  story: OpeningStory
  mc?: TextActor | null
  onDone: () => void
}) {
  const [i, setI] = useState(0)
  const slides = story.slides.length > 0 ? story.slides : [{ text: '' }]
  const skippable = story.skippable !== false
  const last = i >= slides.length - 1

  const advance = () => (last ? onDone() : setI(n => n + 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); advance() }
      else if (e.key === 'Escape' && skippable) { e.preventDefault(); e.stopPropagation(); onDone() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [last, skippable])

  const slide = slides[i]

  return (
    <div
      className="fixed inset-0 z-[72] bg-black grid place-items-center cursor-pointer select-none"
      onClick={advance}
    >
      <div className="w-[34rem] max-w-[92vw] px-8 text-center space-y-6">
        {slide.image && (
          <img
            src={slide.image}
            alt=""
            className="mx-auto max-h-[46vh] rounded-lg border border-white/10 shadow-2xl"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
        <p className="text-[15px] leading-relaxed text-amber-50/85 whitespace-pre-wrap"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.6)' }}>
          {resolveText(slide.text, mc)}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <div className="flex gap-1.5">
            {slides.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-amber-400/80' : 'w-1.5 bg-white/25'}`} />
            ))}
          </div>
        </div>
        <div className="text-[11px] text-white/35 animate-pulse">
          {last ? 'Enter — begin' : 'Enter — continue ▸'}{skippable ? '   ·   Esc — skip' : ''}
        </div>
      </div>
    </div>
  )
}
