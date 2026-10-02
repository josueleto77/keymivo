import { formatDistanceToNow } from 'date-fns'
import { Brain, Heart, Minus, RefreshCw, ShieldAlert, Sparkles, ThumbsDown, TrendingDown, TrendingUp } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { SuggestionRow } from '@/components/SuggestionRow'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalyzePreferences, useClientIntelligence } from '@/features/intelligence'
import { PREFERENCE_TYPES, labelFor } from '@/lib/constants'
import { confidenceProfile, consistently, featureStats, rankingGaps } from '@/lib/intelligence'
import { sourceLabel } from '@/lib/preferences'
import type { ClientPreference } from '@/lib/types'
import { cn, scoreTone } from '@/lib/utils'

export function BuyerIntelligencePanel({ clientId, preferences }: { clientId: string; preferences: ClientPreference[] }) {
  const { data, isLoading } = useClientIntelligence(clientId)
  const analyze = useAnalyzePreferences(clientId)
  const autoRan = React.useRef(false)

  // Refresh "What We've Learned" automatically when a newer analyzed showing exists.
  const lastShowingAt = data?.completedShowings.find((s) => s.ai_status === 'completed')?.ended_at
  const stale = !!data && !!lastShowingAt && (!data.learning || data.learning.created_at < lastShowingAt)
  React.useEffect(() => {
    if (stale && !autoRan.current && !analyze.isPending) {
      autoRan.current = true
      analyze.mutate()
    }
  }, [stale, analyze])

  const derived = React.useMemo(() => {
    if (!data) return null
    const stats = featureStats(data.reactions)
    return { stats, ...consistently(stats), profile: confidenceProfile(preferences, data.reactions) }
  }, [data, preferences])

  if (isLoading || !data || !derived) return <Skeleton className="h-96 w-full" />

  if (data.completedShowings.length === 0) {
    return (
      <EmptyState
        icon={Brain}
        title="Keymivo learns after every showing"
        description="Once this buyer tours homes, you'll see what they consistently love and reject, how confident each preference is, and how their behavior compares with what they said they wanted."
      />
    )
  }

  const learningData = data.learning?.structured_data as { showings_analyzed?: number; consistently_love?: string[]; consistently_reject?: string[] } | null
  const stated = preferences.filter((p) => p.status === 'active' && p.source !== 'showing_ai')
  const dealBreakers = [
    ...preferences.filter((p) => p.status === 'active' && p.preference_type === 'deal_breaker').map((p) => p.value),
    ...derived.stats.filter((s) => data.reactions.some((r) => r.reaction === 'deal_breaker' && r.feature.toLowerCase() === s.key)).map((s) => `${s.label} (flagged at a showing)`),
  ]
  const loveList = unique([...derived.love.map((s) => s.label), ...(learningData?.consistently_love ?? [])])
  const rejectList = unique([...derived.reject.map((s) => s.label), ...(learningData?.consistently_reject ?? [])])

  return (
    <div className="space-y-6">
      {/* What We've Learned */}
      <Card className="overflow-hidden border-primary bg-primary text-white">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-200">
              <Sparkles className="size-4" /> What We've Learned
            </div>
            <button
              onClick={() => analyze.mutate(undefined, { onError: (e) => toast.error(e.message) })}
              disabled={analyze.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3', analyze.isPending && 'animate-spin')} /> {analyze.isPending ? 'Updating…' : 'Refresh'}
            </button>
          </div>
          {analyze.isPending && !data.learning ? (
            <p className="text-slate-300">Reviewing every showing for patterns…</p>
          ) : data.learning ? (
            <>
              <p className="text-lg leading-relaxed">{data.learning.content}</p>
              <p className="text-xs text-slate-400">
                Based on {learningData?.showings_analyzed ?? data.completedShowings.length} showing{(learningData?.showings_analyzed ?? 0) === 1 ? '' : 's'} ·
                updated {formatDistanceToNow(new Date(data.learning.created_at), { addSuffix: true })}
              </p>
            </>
          ) : analyze.isError ? (
            <p className="text-sm text-slate-300">Couldn't generate insights right now: {(analyze.error as Error).message}</p>
          ) : (
            <p className="text-slate-300">Insights will appear after a showing is analyzed.</p>
          )}
        </CardContent>
      </Card>

      {/* Emerging preferences (need Realtor review) */}
      {data.suggestions.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-accent" /> Emerging Preferences</CardTitle>
              <p className="mt-1 text-xs text-muted">Inferred from behavior. Nothing changes until you accept.</p>
            </div>
            <Badge variant="accent">{data.suggestions.length} to review</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.suggestions.map((i) => <SuggestionRow key={i.id} insight={i} clientId={clientId} />)}
          </CardContent>
        </Card>
      )}

      {/* Buyer Confidence Profile */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Buyer Confidence Profile</CardTitle>
            <p className="mt-1 text-xs text-muted">How strongly the buyer holds each preference — stated importance blended with real reactions.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3.5">
          {derived.profile.length === 0 ? (
            <p className="text-sm text-muted">Add preferences to build the profile.</p>
          ) : (
            derived.profile.map((row) => (
              <div key={row.pref.id} title={row.explanation}>
                <div className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm font-medium sm:w-48">{row.pref.value}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full bg-current transition-all', scoreTone(row.pct))} style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">{row.pct}%</span>
                  <TrendIcon trend={row.trend} />
                </div>
                <p className="ml-0 mt-0.5 text-[11px] text-muted sm:ml-[13rem]">{row.explanation}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Say vs do */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>What They Say They Want</CardTitle></CardHeader>
          <CardContent>
            {stated.length === 0 ? <p className="text-sm text-muted">No stated preferences.</p> : (
              <ul className="space-y-2">
                {stated.sort((a, b) => b.weight - a.weight).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{p.value}</span>
                    <span className="shrink-0 text-xs text-muted">{labelFor(PREFERENCE_TYPES, p.preference_type)} · {sourceLabel(p)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>What Their Behavior Suggests</CardTitle></CardHeader>
          <CardContent>
            {derived.stats.length === 0 ? <p className="text-sm text-muted">No reactions recorded yet.</p> : (
              <ul className="space-y-2">
                {derived.stats.slice(0, 10).map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                    <span>{s.label}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      {s.positive > 0 && <span className="text-success">+{s.positive}</span>}
                      {s.negative > 0 && <span className="text-danger">−{s.negative}</span>}
                      <span className="text-muted">· {s.homes} home{s.homes === 1 ? '' : 's'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Consistently Love" icon={Heart} tone="success" items={loveList} empty="Needs the same positive reaction at 2+ homes." />
        <ListCard title="Consistently Reject" icon={ThumbsDown} tone="warning" items={rejectList} empty="Needs the same negative reaction at 2+ homes." />
        <ListCard title="Deal Breakers" icon={ShieldAlert} tone="danger" items={unique(dealBreakers)} empty="None recorded." />
      </div>

      {/* Explainable ranking */}
      {data.scores.length > 1 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Why Homes Rank The Way They Do</CardTitle>
              <p className="mt-1 text-xs text-muted">Biggest weighted differences versus the current favorite.</p>
            </div>
          </CardHeader>
          <CardContent className="divide-y">
            {data.scores.map((s, i) => {
              const gaps = i === 0 ? [] : rankingGaps(data.scores[0]!, s)
              return (
                <div key={s.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                  <span className="w-6 font-display font-bold text-muted">#{i + 1}</span>
                  <Link to={`/properties/${s.properties?.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{s.properties?.address_line1}</Link>
                  <span className={cn('w-14 font-display font-bold', scoreTone(s.overall_score))}>{s.overall_score}</span>
                  <span className="text-xs text-muted sm:w-80">
                    {i === 0 ? 'Current favorite' : gaps.length ? gaps.map((g) => `${g.label} −${g.diff}`).join(' · ') : 'Close to the favorite on every factor'}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted">
        Keymivo uses only objective property criteria (features, price, condition, commute, taxes). It never uses protected
        Fair Housing characteristics.
      </p>
    </div>
  )
}

function TrendIcon({ trend }: { trend: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <TrendingUp className="size-4 shrink-0 text-success" aria-label="Rising" />
  if (trend === 'falling') return <TrendingDown className="size-4 shrink-0 text-warning" aria-label="Falling" />
  return <Minus className="size-4 shrink-0 text-slate-300" aria-label="Stable" />
}

function ListCard({ title, icon: Icon, tone, items, empty }: { title: string; icon: typeof Heart; tone: 'success' | 'warning' | 'danger'; items: string[]; empty: string }) {
  const color = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[tone]
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className={cn('size-4', color)} /> {title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-xs text-muted">{empty}</p> : (
          <div className="flex flex-wrap gap-1.5">{items.map((i) => <Badge key={i} variant={tone}>{i}</Badge>)}</div>
        )}
      </CardContent>
    </Card>
  )
}

function unique(list: string[]) {
  const seen = new Set<string>()
  return list.filter((x) => {
    const k = x.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
