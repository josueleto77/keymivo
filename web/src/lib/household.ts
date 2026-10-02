/** Household disagreement: compare each buyer's star ratings for one home. Pure + explainable. */
export const CATEGORY_KEYS = ['kitchen', 'location', 'bedrooms', 'condition', 'backyard', 'value'] as const
export const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  kitchen: 'Kitchen', location: 'Location', bedrooms: 'Bedroom size', condition: 'Condition', backyard: 'Backyard', value: 'Value',
}

export interface MemberRating {
  name: string
  overall: number | null
  kitchen: number | null
  location: number | null
  bedrooms: number | null
  condition: number | null
  backyard: number | null
  value: number | null
  decision: string | null
}

/** 1-5 stars → 0-100, using overall when given, else the category average. */
export function memberScore(r: MemberRating) {
  if (r.overall) return r.overall * 20
  const vals = CATEGORY_KEYS.map((k) => r[k]).filter((v): v is number => v != null)
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 20) : null
}

export function household(ratings: MemberRating[]) {
  const scores = ratings.map((r) => ({ name: r.name, score: memberScore(r), decision: r.decision }))
  const agree: string[] = []
  const differ: { label: string; detail: string }[] = []
  if (ratings.length >= 2) {
    for (const k of CATEGORY_KEYS) {
      const vals = ratings.map((r) => ({ name: r.name, v: r[k] })).filter((x): x is { name: string; v: number } => x.v != null)
      if (vals.length < 2) continue
      const max = Math.max(...vals.map((x) => x.v))
      const min = Math.min(...vals.map((x) => x.v))
      if (max - min >= 2) differ.push({ label: CATEGORY_LABELS[k], detail: vals.map((x) => `${x.name} ${x.v}★`).join(' · ') })
      else if (min >= 4) agree.push(CATEGORY_LABELS[k])
    }
  }
  return { scores, agree, differ }
}
