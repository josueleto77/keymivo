import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

/** Type and press Enter (or comma) to add chips. */
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
  tone = 'default',
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  id?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const [draft, setDraft] = React.useState('')
  const add = () => {
    const v = draft.trim().replace(/,$/, '')
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }
  const toneClass = {
    default: 'bg-subtle text-slate-700',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-red-50 text-red-800',
  }[tone]
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-card px-2 py-1.5 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
      {value.map((t) => (
        <span key={t} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium', toneClass)}>
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted/70"
      />
    </div>
  )
}
