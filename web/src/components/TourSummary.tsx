import { useQuery } from '@tanstack/react-query'
import { Award, MapPin, PiggyBank, Sparkles, TriangleAlert, Trophy, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { estimateMonthly } from '@/lib/mortgage'
import { supabase, unwrap } from '@/lib/supabase'
import { cn, formatPrice, scoreTone } from '@/lib/utils'

/** "Today's Tour" — ranking + highlights once homes on a tour have been shown. Deterministic, from saved scores. */
export function TourSummary({ tourId, clientId, propertyIds }: { tourId: string; clientId: string; propertyIds: string[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tour-summary', tourId, propertyIds.join(',')],
    enabled: propertyIds.length > 0,
    queryFn: async () => {
      const [scores, showings, client] = await Promise.all([
        supabase.from('property_scores').select('*, properties(id, address_line1, listing_price, property_tax, hoa_fee)').eq('client_id', clientId).in('property_id', propertyIds),
        supabase.from('showings').select('property_id, ai_analysis, ended_at').eq('tour_id', tourId).eq('status', 'completed').order('ended_at', { ascending: false }),
        supabase.from('clients').select('down_payment_amount').eq('id', clientId).single(),
      ])
      return { scores: unwrap(scores), showings: unwrap(showings), client: unwrap(client) }
    },
  })

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (!data) return null
  const shown = new Set(data.showings.map((s) => s.property_id))
  const rows = data.scores
    .filter((s) => shown.has(s.property_id) && s.properties)
    .map((s) => ({ s, p: s.properties!, monthly: estimateMonthly(s.properties!, data.client)?.total ?? null }))
    .sort((a, b) => (b.s.overall_score ?? 0) - (a.s.overall_score ?? 0))
  if (rows.length === 0) return null

  const best = <T,>(pick: (r: (typeof rows)[number]) => T | null | undefined, better: (a: T, b: T) => boolean) =>
    rows.reduce<(typeof rows)[number] | null>((w, r) => {
      const v = pick(r)
      if (v == null) return w
      const wv = w ? pick(w) : null
      return wv == null || better(v, wv) ? r : w
    }, null)
  const highlights = [
    { label: 'Best Overall Match', icon: Trophy, r: rows[0] },
    { label: 'Best Value', icon: Award, r: best((r) => (r.s.overall_score && r.p.listing_price ? r.s.overall_score / r.p.listing_price : null), (a, b) => a > b) },
    { label: 'Best Location', icon: MapPin, r: best((r) => r.s.location_score, (a, b) => a > b) },
    { label: 'Lowest Monthly Cost', icon: PiggyBank, r: best((r) => r.monthly, (a, b) => a < b), extra: (r: (typeof rows)[number]) => (r.monthly ? `${formatPrice(r.monthly)}/mo` : '') },
    { label: 'Buyer Favorite', icon: Heart, r: best((r) => r.s.emotional_score, (a, b) => a > b) },
  ]

  // Concerns that came up across the tour (from AI showing analyses), most frequent first.
  const concernCount = new Map<string, number>()
  for (const s of data.showings) {
    const concerns = (s.ai_analysis as { concerns?: { title: string }[] } | null)?.concerns ?? []
    for (const c of concerns) {
      const k = c.title.trim()
      concernCount.set(k, (concernCount.get(k) ?? 0) + 1)
    }
  }
  const concerns = [...concernCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const topAnalysis = data.showings.find((s) => s.property_id === rows[0]!.p.id)?.ai_analysis as { recommended_next_action?: string } | null
  const nextAction = topAnalysis?.recommended_next_action

  return (
    <Card className="mb-6 border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Tour Summary</CardTitle>
        <span className="text-xs text-muted">{rows.length} of {propertyIds.length} homes shown</span>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.p.id} className="flex items-center gap-3">
              <span className="w-6 font-display font-bold text-muted">{i + 1}.</span>
              <Link to={`/properties/${r.p.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{r.p.address_line1}</Link>
              <span className={cn('font-display text-lg font-bold tabular-nums', scoreTone(r.s.overall_score))}>{r.s.overall_score}</span>
              <span className="text-xs text-muted">/ 100</span>
            </li>
          ))}
        </ol>

        {rows.length > 1 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {highlights.map((h) =>
              h.r ? (
                <div key={h.label} className="rounded-xl bg-subtle px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><h.icon className="size-3.5" /> {h.label}</div>
                  <div className="mt-1 truncate text-sm font-semibold">{h.r.p.address_line1}</div>
                  {h.extra && <div className="text-xs text-muted">{h.extra(h.r)}</div>}
                </div>
              ) : null,
            )}
          </div>
        )}

        {concerns.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><TriangleAlert className="size-3.5 text-warning" /> Main concerns across properties</div>
            <ul className="space-y-1 text-sm">
              {concerns.map(([c, n]) => <li key={c}>{c}{n > 1 && <span className="text-muted"> · {n} homes</span>}</li>)}
            </ul>
          </div>
        )}

        {nextAction && (
          <div className="rounded-xl bg-primary px-4 py-3 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Recommended next action</div>
            <p className="mt-1 text-sm">{nextAction}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
