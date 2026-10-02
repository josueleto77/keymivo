import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatPrice(value: number | null | undefined) {
  return value == null ? '—' : usd0.format(value)
}

/** $650k, $1.2M */
export function formatPriceShort(value: number | null | undefined) {
  if (value == null) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return usd0.format(value)
}

export function formatBudget(min: number | null, max: number | null) {
  if (min == null && max == null) return 'Budget not set'
  if (min != null && max != null) return `${formatPriceShort(min)}–${formatPriceShort(max)}`
  return max != null ? `Up to ${formatPriceShort(max)}` : `From ${formatPriceShort(min)}`
}

export function formatNumber(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('en-US')
}

export function fullName(p: { first_name: string | null; last_name: string | null } | null | undefined) {
  if (!p) return ''
  return [p.first_name, p.last_name].filter(Boolean).join(' ')
}

export function initials(name: string) {
  const parts = name.replace(/&/g, ' ').split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

export function pricePerSqft(price: number | null, sqft: number | null) {
  if (!price || !sqft) return null
  return Math.round(price / sqft)
}

/** "10:00:00" → "10:00 AM" */
export function formatTime(t: string | null | undefined) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Parse a YYYY-MM-DD date column as a local date (avoids UTC off-by-one). */
export function parseDateOnly(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function toNumberOrNull(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function scoreTone(score: number | null | undefined) {
  if (score == null) return 'text-muted'
  if (score >= 85) return 'text-success'
  if (score >= 70) return 'text-accent'
  if (score >= 55) return 'text-warning'
  return 'text-danger'
}

export function scoreLabel(score: number) {
  if (score >= 90) return 'Excellent Match'
  if (score >= 80) return 'Strong Match'
  if (score >= 70) return 'Good Match'
  if (score >= 55) return 'Fair Match'
  return 'Weak Match'
}
