'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Effect, FieldSchema, FieldType, Ruleset, StatModifier } from '@/lib/engine-types'
import { pixelSprite, hasPixelSprite, isBitmapSprite, bitmapFrames, spriteKinds } from '@/lib/pixel-sprites'
import { fileToSpriteDataUri, downloadSpriteTemplate, SPRITE_ACCEPT_ATTR } from '@/lib/sprite-upload'
import { EffectBuilder } from './EffectBuilder'

interface SchemaFormProps {
  schema: FieldSchema[]
  value: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  className?: string
  compact?: boolean
  /** Needed to render `ref` dropdowns and `effects` builders. */
  ruleset?: Ruleset
}

function set(obj: Record<string, unknown>, key: string, val: unknown): Record<string, unknown> {
  return { ...obj, [key]: val }
}

function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <label className="block text-xs font-medium text-white/60 mb-0.5">
      {label}
      {optional && <span className="ml-1 text-white/30">(optional)</span>}
    </label>
  )
}

function TextField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      {field.type === 'textarea' ? (
        <textarea
          rows={3}
          placeholder={field.placeholder ?? field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-amber-500/50"
        />
      ) : (
        <input
          type="text"
          placeholder={field.placeholder ?? field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
        />
      )}
    </div>
  )
}

function NumberField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: number) => void; compact?: boolean }) {
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <input
        type="number"
        min={field.min}
        max={field.max}
        placeholder={field.placeholder ?? field.label}
        value={typeof value === 'number' ? value : ''}
        onChange={e => onChange(e.target.valueAsNumber)}
        className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
      />
    </div>
  )
}

function ColorField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: string) => void; compact?: boolean }) {
  const color = typeof value === 'string' ? value : '#888888'
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={e => onChange(e.target.value)}
          className="h-7 w-10 rounded cursor-pointer bg-zinc-800 border border-white/10"
        />
        <input
          type="text"
          value={color}
          onChange={e => onChange(e.target.value)}
          maxLength={7}
          className="w-24 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 font-mono focus:outline-none focus:border-amber-500/50"
        />
      </div>
    </div>
  )
}

function IconField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 grid place-items-center rounded bg-zinc-700 text-lg">
          {typeof value === 'string' ? value : '?'}
        </div>
        <input
          type="text"
          maxLength={4}
          placeholder="emoji or char"
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="w-32 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
        />
      </div>
    </div>
  )
}

function BooleanField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: boolean) => void; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={`sf-${field.key}`}
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded accent-amber-500"
      />
      {!compact && (
        <label htmlFor={`sf-${field.key}`} className="text-sm text-white/80">
          {field.label}
          {field.optional && <span className="ml-1 text-white/30">(optional)</span>}
        </label>
      )}
    </div>
  )
}

function EnumField({
  field, type, value, onChange, compact,
}: { field: FieldSchema; type: Extract<FieldType, { kind: 'enum' }>; value: unknown; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 focus:outline-none focus:border-amber-500/50"
      >
        {type.options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function DiceField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: string | number) => void; compact?: boolean }) {
  const str = typeof value === 'number' ? String(value) : (typeof value === 'string' ? value : '')
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <input
        type="text"
        placeholder="e.g. 8, 2d6, 1d8+2"
        value={str}
        onChange={e => {
          const v = e.target.value
          const n = Number(v)
          onChange(isNaN(n) || v.trim() === '' ? v : n)
        }}
        className="w-full px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 font-mono placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
      />
    </div>
  )
}

function SpriteField({
  field, value, onChange, compact,
}: { field: FieldSchema; value: unknown; onChange: (v: string | undefined) => void; compact?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSpec, setShowSpec] = useState(false)
  const sprite = typeof value === 'string' ? value : ''
  const isBitmap = isBitmapSprite(sprite)
  const frames = isBitmap ? bitmapFrames(sprite) : []
  const isBuiltin = !isBitmap && sprite !== '' && hasPixelSprite(sprite)

  async function onPickFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      onChange(await fileToSpriteDataUri(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    }
  }

  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <div className="flex items-center gap-2">
        <div className="relative w-10 h-10 shrink-0 grid place-items-center rounded bg-zinc-700/70 border border-white/10 overflow-hidden">
          {isBitmap ? (
            <>
              {/* data-URI preview — next/image cannot optimize inline images */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frames[0]} alt="sprite" className="max-w-full max-h-full" style={{ imageRendering: 'pixelated' }} />
              {frames.length === 2 && (
                <span className="absolute bottom-0 right-0 px-0.5 rounded-tl bg-black/70 text-[8px] text-amber-300 leading-tight">2f</span>
              )}
            </>
          ) : isBuiltin ? (
            <svg viewBox="0 0 40 40" className="w-full h-full">{pixelSprite(sprite, 20, 20, 34, 'pv')}</svg>
          ) : (
            <span className="text-[9px] text-white/35 leading-tight text-center">auto</span>
          )}
        </div>
        <input
          type="text"
          list={`sf-sprites-${field.key}`}
          placeholder={field.placeholder ?? 'built-in kind'}
          value={isBitmap ? '(uploaded image)' : sprite}
          readOnly={isBitmap}
          onChange={e => { setError(null); onChange(e.target.value || undefined) }}
          className="min-w-0 flex-1 px-2 py-1 rounded bg-zinc-800 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
        />
        <datalist id={`sf-sprites-${field.key}`}>
          {spriteKinds().map(k => <option key={k} value={k} />)}
        </datalist>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 border border-white/10 text-xs text-white/80"
        >
          Upload
        </button>
        <button
          type="button"
          title="Download a built-in sprite as an editable PNG template"
          onClick={() => downloadSpriteTemplate(isBuiltin ? sprite : undefined)}
          className="shrink-0 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-white/60"
        >
          Template
        </button>
        {sprite !== '' && (
          <button
            type="button"
            onClick={() => { setError(null); onChange(undefined) }}
            className="shrink-0 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-white/50"
          >
            Clear
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={SPRITE_ACCEPT_ATTR}
          className="hidden"
          onChange={e => { void onPickFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!compact && (
        <p className="mt-1 text-[10px] text-white/30">
          Empty = match by name · Template downloads an editable example{' '}
          <button
            type="button"
            onClick={() => setShowSpec(s => !s)}
            className="underline decoration-dotted text-white/45 hover:text-white/70"
          >
            {showSpec ? 'hide requirements' : 'requirements'}
          </button>
        </p>
      )}
      {!compact && showSpec && (
        <ul className="mt-1 space-y-0.5 rounded bg-zinc-800/60 border border-white/10 p-2 text-[10px] text-white/50 list-disc list-inside">
          <li><span className="text-white/70">Format:</span> PNG, GIF, or WebP with a transparent background. JPEG is rejected (no alpha).</li>
          <li><span className="text-white/70">Size:</span> downscaled to 64px on the longest edge (nearest-neighbour — pixel art stays crisp; never upscaled). Author at 32–64px. Max 64KB stored.</li>
          <li><span className="text-white/70">Composition:</span> bottom-anchored in a square box — feet touch the bottom edge. Taller-than-wide reads best.</li>
          <li><span className="text-white/70">Animation:</span> an image exactly twice as wide as tall is read as a two-frame sheet (left, then right) and idle-animates in game.</li>
        </ul>
      )}
    </div>
  )
}

/** `{kind:'ref', table}` → a dropdown of that ruleset table's entries. */
function RefField({ field, table, value, onChange, ruleset, compact }: {
  field: FieldSchema; table: keyof Ruleset; value: unknown
  onChange: (v: unknown) => void; ruleset: Ruleset; compact?: boolean
}) {
  const entries = (ruleset[table] as unknown as { id: string; name: string }[] | undefined) ?? []
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={e => onChange(e.target.value || undefined)}
        className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-sm text-white/85 focus:outline-none focus:border-amber-500/50"
      >
        <option value="">{field.optional ? '— none —' : '— select —'}</option>
        {entries.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
      </select>
    </div>
  )
}

/** `'effects'` → the shared visual EffectBuilder. */
function EffectsField({ field, value, onChange, ruleset }: {
  field: FieldSchema; value: unknown; onChange: (v: unknown) => void; ruleset: Ruleset
}) {
  const effects = (Array.isArray(value) ? value : []) as Effect[]
  return (
    <EffectBuilder
      label={field.label}
      effects={effects}
      ruleset={ruleset}
      onChange={next => onChange(next.length ? next : undefined)}
    />
  )
}

/** `'modifiers'` → editable rows of StatModifier (target/key/op/amount). */
function ModifiersField({ field, value, onChange, compact }: {
  field: FieldSchema; value: unknown; onChange: (v: unknown) => void; compact?: boolean
}) {
  const mods = (Array.isArray(value) ? value : []) as StatModifier[]
  const set = (next: StatModifier[]) => onChange(next.length ? next : undefined)
  const update = (i: number, patch: Partial<StatModifier>) => set(mods.map((m, j) => j === i ? { ...m, ...patch } : m))
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <div className="space-y-1">
        {mods.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <select value={m.target} onChange={e => update(i, { target: e.target.value as StatModifier['target'] })}
              className="px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80">
              <option value="attribute">attribute</option>
              <option value="derived">derived</option>
            </select>
            <input value={m.key} placeholder="key" onChange={e => update(i, { key: e.target.value })}
              className="w-24 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80" />
            <select value={m.op} onChange={e => update(i, { op: e.target.value as StatModifier['op'] })}
              className="px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80">
              <option value="add">add</option>
              <option value="mul">mul</option>
            </select>
            <input type="number" value={m.amount} onChange={e => update(i, { amount: parseFloat(e.target.value) || 0 })}
              className="w-16 px-1.5 py-1 rounded bg-zinc-800 border border-white/10 text-xs text-white/80" />
            <button type="button" onClick={() => set(mods.filter((_, j) => j !== i))}
              className="px-1.5 text-white/30 hover:text-red-400">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set([...mods, { target: 'attribute', key: '', op: 'add', amount: 0 }])}
          className="text-xs text-amber-300/80 hover:text-amber-200">+ modifier</button>
      </div>
    </div>
  )
}

/** `{kind:'list', itemSchema}` → repeatable nested sub-forms. */
function ListField({ field, itemSchema, value, onChange, ruleset }: {
  field: FieldSchema; itemSchema: FieldSchema[]; value: unknown
  onChange: (v: unknown) => void; ruleset?: Ruleset
}) {
  const items = (Array.isArray(value) ? value : []) as Record<string, unknown>[]
  const set = (next: Record<string, unknown>[]) => onChange(next.length ? next : undefined)
  return (
    <div>
      <FieldLabel label={field.label} optional={field.optional} />
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded border border-white/10 bg-zinc-900/60 p-2">
            <div className="flex justify-end mb-1">
              <button type="button" onClick={() => set(items.filter((_, j) => j !== i))}
                className="text-[11px] text-white/30 hover:text-red-400">Remove</button>
            </div>
            <SchemaForm schema={itemSchema} value={item} ruleset={ruleset}
              onChange={updated => set(items.map((x, j) => j === i ? updated : x))} />
          </div>
        ))}
        <button type="button" onClick={() => set([...items, {}])}
          className="text-xs text-amber-300/80 hover:text-amber-200">+ add</button>
      </div>
    </div>
  )
}

function FieldRenderer({
  field, value, onChange, compact, ruleset,
}: {
  field: FieldSchema
  value: unknown
  onChange: (v: unknown) => void
  compact?: boolean
  ruleset?: Ruleset
}) {
  const t = field.type

  if (t === 'text' || t === 'textarea') {
    return <TextField field={field} value={value} onChange={onChange} compact={compact} />
  }
  if (t === 'number') {
    return <NumberField field={field} value={value} onChange={v => onChange(v)} compact={compact} />
  }
  if (t === 'color') {
    return <ColorField field={field} value={value} onChange={onChange} compact={compact} />
  }
  if (t === 'icon') {
    return <IconField field={field} value={value} onChange={onChange} compact={compact} />
  }
  if (t === 'boolean') {
    return <BooleanField field={field} value={value} onChange={v => onChange(v)} compact={compact} />
  }
  if (t === 'dice') {
    return <DiceField field={field} value={value} onChange={onChange} compact={compact} />
  }
  if (t === 'sprite') {
    return <SpriteField field={field} value={value} onChange={v => onChange(v)} compact={compact} />
  }
  if (typeof t === 'object' && t.kind === 'enum') {
    return <EnumField field={field} type={t} value={value} onChange={onChange} compact={compact} />
  }
  if (typeof t === 'object' && t.kind === 'ref' && ruleset) {
    return <RefField field={field} table={t.table} value={value} onChange={onChange} ruleset={ruleset} compact={compact} />
  }
  if (t === 'effects' && ruleset) {
    return <EffectsField field={field} value={value} onChange={onChange} ruleset={ruleset} />
  }
  if (t === 'modifiers') {
    return <ModifiersField field={field} value={value} onChange={onChange} compact={compact} />
  }
  if (typeof t === 'object' && t.kind === 'list') {
    return <ListField field={field} itemSchema={t.itemSchema} value={value} onChange={onChange} ruleset={ruleset} />
  }
  // Last-resort JSON editor (e.g. a ref/effects field without a ruleset in scope)
  return (
    <div>
      {!compact && <FieldLabel label={field.label} optional={field.optional} />}
      <textarea
        rows={2}
        value={typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2)}
        onChange={e => {
          try { onChange(JSON.parse(e.target.value)) } catch { onChange(e.target.value) }
        }}
        className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-white/10 text-xs text-white/70 font-mono resize-none focus:outline-none focus:border-amber-500/50"
      />
    </div>
  )
}

/**
 * Renders a typed editor form from a FieldSchema array.
 * `value` is a plain object; `onChange` receives the full updated object.
 */
export function SchemaForm({ schema, value, onChange, className, compact, ruleset }: SchemaFormProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {schema.map(field => (
        <div key={field.key}>
          <FieldRenderer
            field={field}
            value={value[field.key]}
            onChange={v => onChange(set(value, field.key, v))}
            compact={compact}
            ruleset={ruleset}
          />
        </div>
      ))}
    </div>
  )
}
