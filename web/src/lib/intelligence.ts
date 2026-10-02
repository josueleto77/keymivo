import { inferCategory } from './preferences'
import type { ClientPreference } from './types'

/** Reaction → 0-100 "how much they liked it". */
export const REACTION_VALUE: Record<string, number> = { love: 100, like: 80, neutral: 50, dislike: 20, deal_breaker: 0 }
const NEGATIVE_TYPES = new Set(['dislike', 'strong_dislike', 'deal_breaker'])

export interface ReactionEvidence {
  feature: string
  reaction: string
  property_id: string
  showing_id: string | null
  source: string
  address?: string | null
}

export interface FeatureStat {
  key: string
  label: string
  positive: number
  negative: number
  neutral: number
  homes: number
  avg: number
}

/** Per-feature behavior across every showing. */
export function featureStats(reactions: ReactionEvidence[]): FeatureStat[] {
  const map = new Map<string, { label: string; values: number[]; homes: Set<string> }>()
  for (const r of reactions) {
    const key = r.feature.trim().toLowerCase()
    if (!key) continue
    const e = map.get(key) ?? { label: r.feature.trim(), values: [], homes: new Set() }
    e.values.push(REACTION_VALUE[r.reaction] ?? 50)
    e.homes.add(r.property_id)
    map.set(key, e)
  }
  return [...map.entries()]
    .map(([key, e]) => ({
      key,
      label: e.label,
      positive: e.values.filter((v) => v >= 80).length,
      negative: e.values.filter((v) => v <= 20).length,
      neutral: e.values.filter((v) => v > 20 && v < 80).length,
      homes: e.homes.size,
      avg: Math.round(e.values.reduce((a, b) => a + b, 0) / e.values.length),
    }))
    .sort((a, b) => b.positive + b.negative - (a.positive + a.negative))
}

export function consistently(stats: FeatureStat[]) {
  return {
    love: stats.filter((s) => s.homes >= 2 && s.positive >= 2 && s.positive > s.negative * 2),
    reject: stats.filter((s) => s.homes >= 2 && s.negative >= 2 && s.negative > s.positive * 2),
  }
}

export interface ConfidenceRow {
  pref: ClientPreference
  pct: number
  stated: number
  observed: number | null
  evidence: number
  trend: 'rising' | 'falling' | 'stable'
  explanation: string
}

/**
 * Buyer Confidence Profile — how strongly the buyer actually holds each preference.
 * Blend of the stated importance and observed reactions to matching features; the more evidence,
 * the more weight behavior gets (up to 70%). Fully explainable, no AI involved.
 */
export function confidenceProfile(prefs: ClientPreference[], reactions: ReactionEvidence[]): ConfidenceRow[] {
  return prefs
    .filter((p) => p.status === 'active' && p.preference_type !== 'neutral')
    .map((p) => {
      const words = p.value.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
      const related = reactions.filter((r) => {
        const f = r.feature.toLowerCase()
        return (p.category !== 'other' && inferCategory(r.feature) === p.category) || words.some((w) => f.includes(w))
      })
      const negativePref = NEGATIVE_TYPES.has(p.preference_type)
      const values = related.map((r) => {
        const v = REACTION_VALUE[r.reaction] ?? 50
        // For dislikes, a negative reaction *confirms* the preference.
        return negativePref ? 100 - v : v
      })
      const observed = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
      const alpha = Math.min(0.7, values.length * 0.15)
      const pct = observed == null ? p.weight : Math.round(p.weight * (1 - alpha) + observed * alpha)
      const trend = observed == null ? 'stable' : observed - p.weight > 10 ? 'rising' : p.weight - observed > 10 ? 'falling' : 'stable'
      const explanation =
        observed == null
          ? `Stated importance ${p.weight}%. No showing reactions yet.`
          : `Stated ${p.weight}% · ${values.length} related reaction${values.length === 1 ? '' : 's'} averaging ${observed}% → ${Math.round(alpha * 100)}% weight on behavior.`
      return { pref: p, pct, stated: p.weight, observed, evidence: values.length, trend, explanation } as ConfidenceRow
    })
    .sort((a, b) => b.pct - a.pct)
}

const COMPONENTS = [
  ['must_have_score', 'Must-haves', 0.3],
  ['price_score', 'Price', 0.2],
  ['location_score', 'Location', 0.15],
  ['size_score', 'Size', 0.1],
  ['condition_score', 'Condition', 0.1],
  ['financial_score', 'Financial', 0.1],
  ['emotional_score', 'Buyer reaction', 0.05],
] as const

type ScoreLike = Partial<Record<(typeof COMPONENTS)[number][0], number | null>> & { overall_score: number | null }

/** Why does property B rank below the leader? Returns the largest weighted gaps. */
export function rankingGaps(leader: ScoreLike, other: ScoreLike) {
  return COMPONENTS.map(([key, label, w]) => {
    const a = leader[key] ?? 0
    const b = other[key] ?? 0
    return { label, diff: a - b, weighted: (a - b) * w }
  })
    .filter((g) => g.weighted > 0.5)
    .sort((x, y) => y.weighted - x.weighted)
    .slice(0, 3)
}
