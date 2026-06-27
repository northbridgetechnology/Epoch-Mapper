'use client'

import { cn } from '@/lib/utils'
import type { FieldSchema, FieldType } from '@/lib/engine-types'

interface SchemaFormProps {
  schema: FieldSchema[]
  value: Record<string, unknown>
  onChange: (updated: Record<string, unknown>) => void
  className?: string
  compact?: boolean
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

function FieldRenderer({
  field, value, onChange, compact,
}: {
  field: FieldSchema
  value: unknown
  onChange: (v: unknown) => void
  compact?: boolean
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
  if (typeof t === 'object' && t.kind === 'enum') {
    return <EnumField field={field} type={t} value={value} onChange={onChange} compact={compact} />
  }
  // 'ref', 'list', 'effects', 'modifiers' — rendered as JSON stubs for Phase E1
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
export function SchemaForm({ schema, value, onChange, className, compact }: SchemaFormProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {schema.map(field => (
        <div key={field.key}>
          {field.type === 'boolean' ? null : compact ? null : null}
          <FieldRenderer
            field={field}
            value={value[field.key]}
            onChange={v => onChange(set(value, field.key, v))}
            compact={compact}
          />
        </div>
      ))}
    </div>
  )
}
