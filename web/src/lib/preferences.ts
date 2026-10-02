import type { ClientPreference } from './types'

const RULES: [RegExp, string][] = [
  [/bed(room)?s?\b|\bbd\b/i, 'bedrooms'],
  [/bath/i, 'bathrooms'],
  [/garage/i, 'garage'],
  [/yard|garden/i, 'yard'],
  [/kitchen/i, 'kitchen'],
  [/basement/i, 'basement'],
  [/commute|minute|drive|train|transit/i, 'commute'],
  [/tax/i, 'taxes'],
  [/\bhoa\b|condo fee/i, 'hoa'],
  [/\$|price|budget|under|\d+k\b/i, 'price'],
  [/sq\.?\s?ft|square|size|space/i, 'size'],
  [/renovat|condition|updated|move-in|fixer/i, 'condition'],
  [/road|street|traffic|noise|quiet|location|neighborhood|walk/i, 'location'],
  [/parking|driveway/i, 'parking'],
  [/deck|patio|porch|pool/i, 'outdoor'],
  [/layout|open concept|floor plan/i, 'layout'],
]

export function inferCategory(text: string) {
  return RULES.find(([re]) => re.test(text))?.[1] ?? 'other'
}

export const DEFAULT_WEIGHT: Record<string, number> = {
  must_have: 90, strong_preference: 75, prefer: 60, neutral: 30, dislike: 60, strong_dislike: 75, deal_breaker: 95,
}

export function groupPreferences(prefs: ClientPreference[]) {
  const active = prefs.filter((p) => p.status !== 'rejected')
  const by = (types: string[]) =>
    active.filter((p) => types.includes(p.preference_type)).sort((a, b) => b.weight - a.weight)
  return {
    mustHave: by(['must_have']),
    prefers: by(['strong_preference', 'prefer']),
    dislikes: by(['dislike', 'strong_dislike']),
    dealBreakers: by(['deal_breaker']),
    neutral: by(['neutral']),
  }
}

export function sourceLabel(p: Pick<ClientPreference, 'source' | 'evidence_count'>) {
  switch (p.source) {
    case 'showing_ai':
      return `${p.evidence_count} showing reaction${p.evidence_count === 1 ? '' : 's'}`
    case 'buyer':
      return 'Buyer input'
    case 'onboarding':
      return 'Buyer onboarding'
    case 'demo':
      return 'Demo data'
    default:
      return 'Realtor entered'
  }
}
