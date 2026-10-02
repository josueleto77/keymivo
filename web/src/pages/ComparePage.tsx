import { format } from 'date-fns'
import { GitCompareArrows, Save, Trash2, X } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PropertyImage } from '@/components/PropertyImage'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/features/clients'
import { useCompareData, useDeleteComparison, useSaveComparison, type CompareData } from '@/features/compare'
import { useProperties, type PropertyListItem } from '@/features/properties'
import { DEFAULT_ASSUMPTIONS, estimateMonthly } from '@/lib/mortgage'
import { cn, formatNumber, formatPrice, fullName, scoreTone } from '@/lib/utils'

const MAX = 6
type Highlight = 'CURRENT FAVORITE' | 'BEST MATCH' | 'BEST VALUE' | 'LOWEST MONTHLY COST'

interface Column {
  p: PropertyListItem
  score: CompareData['scores'][number] | undefined
  monthly: number | null
  reactions: { love: number; like: number; negative: number }
  strength: string | null
  concern: string | null
  concernCount: number
  highlights: Highlight[]
}

export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const clients = useClients()
  const properties = useProperties()
  const clientId = params.get('client') ?? clients.data?.[0]?.id ?? ''
  const selected = (params.get('p') ?? '').split(',').filter(Boolean)
  const data = useCompareData(clientId || undefined)
  const save = useSaveComparison(clientId)
  const del = useDeleteComparison(clientId)
  const [rate, setRate] = React.useState(String(DEFAULT_ASSUMPTIONS.interestRate))

  const update = (next: { client?: string; p?: string[] }) => {
    const sp = new URLSearchParams(params)
    if (next.client !== undefined) sp.set('client', next.client)
    if (next.p !== undefined) sp.set('p', next.p.join(','))
    setParams(sp, { replace: true })
  }

  // Default selection: the client's top-scored homes.
  React.useEffect(() => {
    if (!data.data || params.get('p')) return
    const top = [...data.data.scores].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0)).slice(0, 4).map((s) => s.property_id)
    if (top.length >= 2) update({ p: top })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.data])

  const columns = React.useMemo<Column[]>(() => {
    if (!data.data || !properties.data) return []
    const d = data.data
    const cols: Column[] = selected
      .map((id) => properties.data.find((x) => x.id === id))
      .filter((p): p is PropertyListItem => !!p)
      .map((p) => {
        const score = d.scores.find((s) => s.property_id === p.id)
        const showings = d.showings.filter((s) => s.property_id === p.id)
        const rx = showings.flatMap((s) => s.buyer_reactions)
        const analysis = showings.find((s) => s.ai_analysis)?.ai_analysis as
          | { positives?: { feature: string; detail: string }[]; concerns?: { title: string }[] }
          | undefined
        const count = (v: string[]) => rx.filter((r) => v.includes(r.reaction)).length
        const topFeature = (vals: string[]) => {
          const m = new Map<string, number>()
          rx.filter((r) => vals.includes(r.reaction)).forEach((r) => m.set(r.feature, (m.get(r.feature) ?? 0) + 1))
          return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        }
        return {
          p,
          score,
          monthly: estimateMonthly(p, d.client, { interestRate: Number(rate) || DEFAULT_ASSUMPTIONS.interestRate })?.total ?? null,
          reactions: { love: count(['love']), like: count(['like']), negative: count(['dislike', 'deal_breaker']) },
          strength: analysis?.positives?.[0]?.feature ?? topFeature(['love', 'like']),
          concern: analysis?.concerns?.[0]?.title ?? topFeature(['dislike', 'deal_breaker']),
          concernCount: analysis?.concerns?.length ?? count(['dislike', 'deal_breaker']),
          highlights: [],
        }
      })
    const best = <T,>(pick: (c: Column) => T | null | undefined, cmp: (a: T, b: T) => boolean) => {
      let winner: Column | null = null
      for (const c of cols) {
        const v = pick(c)
        if (v == null) continue
        const w = winner ? pick(winner) : null
        if (w == null || cmp(v, w)) winner = c
      }
      return winner
    }
    if (cols.length >= 2) {
      // Buyer favorite = strongest buyer reaction (emotional score), tie → overall.
      best((c) => (c.score?.emotional_score ?? null) == null ? null : (c.score!.emotional_score! * 1000 + (c.score!.overall_score ?? 0)), (a, b) => a > b)?.highlights.push('CURRENT FAVORITE')
      best((c) => c.score?.overall_score, (a, b) => a > b)?.highlights.push('BEST MATCH')
      best((c) => (c.score?.overall_score && c.p.listing_price ? c.score.overall_score / (c.p.listing_price / 100000) : null), (a, b) => a > b)?.highlights.push('BEST VALUE')
      best((c) => c.monthly, (a, b) => a < b)?.highlights.push('LOWEST MONTHLY COST')
    }
    return cols
  }, [data.data, properties.data, selected, rate])

  const available = (properties.data ?? []).filter((p) => !selected.includes(p.id))
  const scoreOf = (id: string) => data.data?.scores.find((s) => s.property_id === id)?.overall_score

  const ROWS: { label: string; render: (c: Column) => React.ReactNode }[] = [
    { label: 'Buyer Score', render: (c) => <span className={cn('font-display text-xl font-bold', scoreTone(c.score?.overall_score))}>{c.score?.overall_score ?? '—'}</span> },
    { label: 'Price', render: (c) => formatPrice(c.p.listing_price) },
    { label: 'Monthly Cost', render: (c) => (c.monthly ? `${formatPrice(c.monthly)}/mo` : '—') },
    { label: 'Beds', render: (c) => c.p.beds ?? '—' },
    { label: 'Baths', render: (c) => c.p.baths ?? '—' },
    { label: 'Sq Ft', render: (c) => formatNumber(c.p.square_feet) },
    { label: 'Taxes', render: (c) => (c.p.property_tax ? `${formatPrice(c.p.property_tax)}/yr` : '—') },
    { label: 'HOA', render: (c) => (c.p.hoa_fee ? `${formatPrice(c.p.hoa_fee)}/mo` : 'None') },
    { label: 'Year', render: (c) => c.p.year_built ?? '—' },
    { label: 'Days on Market', render: (c) => c.p.days_on_market ?? '—' },
    { label: 'Estimated Repairs', render: (c) => <span className="text-muted">Not estimated{c.concernCount ? ` · ${c.concernCount} to verify` : ''}</span> },
    { label: 'Must-Have Match', render: (c) => (c.score?.must_have_score != null ? `${c.score.must_have_score}%` : '—') },
    {
      label: 'Buyer Reaction',
      render: (c) =>
        c.reactions.love + c.reactions.like + c.reactions.negative === 0 ? (
          <span className="text-muted">Not toured</span>
        ) : (
          <span className="whitespace-nowrap">😍 {c.reactions.love} · 👍 {c.reactions.like} · ⚠️ {c.reactions.negative}</span>
        ),
    },
    { label: 'Primary Strength', render: (c) => c.strength ?? <span className="text-muted">—</span> },
    { label: 'Primary Concern', render: (c) => c.concern ?? <span className="text-muted">—</span> },
  ]

  if (clients.isLoading || properties.isLoading) return <Skeleton className="h-96 w-full" />
  if (!clients.data?.length) {
    return (
      <div>
        <PageHeader title="Compare" />
        <EmptyState icon={GitCompareArrows} title="Add a buyer first" description="Comparisons are built around a buyer's preferences and reactions." action={<Button asChild><Link to="/clients/new">Add Buyer</Link></Button>} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Compare"
        subtitle="2–6 homes side by side, scored against this buyer."
        actions={
          columns.length >= 2 ? (
            <Button
              variant="outline"
              loading={save.isPending}
              onClick={() =>
                save.mutate(
                  { name: `${columns.length} homes · ${format(new Date(), 'MMM d')}`, propertyIds: [...columns].sort((a, b) => (b.score?.overall_score ?? 0) - (a.score?.overall_score ?? 0)).map((c) => c.p.id) },
                  { onSuccess: () => toast.success('Comparison saved'), onError: (e) => toast.error(e.message) },
                )
              }
            >
              <Save /> Save comparison
            </Button>
          ) : null
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_1.5fr_140px]">
          <NativeSelect aria-label="Buyer" value={clientId} onChange={(e) => update({ client: e.target.value, p: [] })}>
            {clients.data.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
          </NativeSelect>
          <NativeSelect
            aria-label="Add a home"
            value=""
            disabled={selected.length >= MAX}
            onChange={(e) => e.target.value && update({ p: [...selected, e.target.value] })}
          >
            <option value="">{selected.length >= MAX ? 'Maximum 6 homes' : '+ Add a home to compare…'}</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address_line1}, {p.city}{scoreOf(p.id) != null ? ` · Match ${scoreOf(p.id)}` : ''}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-2 text-sm text-muted">
            Rate
            <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="h-10" aria-label="Interest rate" />%
          </label>
        </CardContent>
      </Card>

      {data.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : columns.length < 2 ? (
        <EmptyState icon={GitCompareArrows} title="Pick at least two homes" description="Add homes above. Toured homes include Buyer Score, reactions and AI-identified strengths and concerns." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card shadow-card md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="w-44 bg-subtle/40" />
                  {columns.map((c) => (
                    <th key={c.p.id} className="p-3 text-left align-top font-normal">
                      <ColumnHeader c={c} onRemove={() => update({ p: selected.filter((x) => x !== c.p.id) })} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th className="bg-subtle/40 px-4 py-3 text-left text-xs font-medium text-muted">{row.label}</th>
                    {columns.map((c) => (
                      <td key={c.p.id} className={cn('px-3 py-3', c.highlights.includes('BEST MATCH') && 'bg-blue-50/40')}>{row.render(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile swipe cards */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:hidden [scrollbar-width:none]">
            {columns.map((c) => (
              <div key={c.p.id} className="w-[85%] shrink-0 snap-center rounded-2xl border bg-card p-3 shadow-card">
                <ColumnHeader c={c} onRemove={() => update({ p: selected.filter((x) => x !== c.p.id) })} />
                <dl className="mt-3 divide-y text-sm">
                  {ROWS.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                      <dt className="text-xs text-muted">{row.label}</dt>
                      <dd className="text-right">{row.render(c)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Monthly cost is an estimate ({rate}% · {DEFAULT_ASSUMPTIONS.loanTermYears} yr · buyer's down payment or 20%, incl. taxes, insurance, HOA, PMI). Not a lending quote.
          </p>
        </>
      )}

      {!!data.data?.comparisons.length && (
        <Card className="mt-8">
          <CardHeader><CardTitle>Saved comparisons</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {data.data.comparisons.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <button
                  className="flex-1 text-left font-medium hover:underline"
                  onClick={() => update({ p: [...c.comparison_properties].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((x) => x.property_id) })}
                >
                  {c.name}
                </button>
                <span className="text-xs text-muted">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                <button onClick={() => del.mutate(c.id)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-subtle" aria-label="Delete comparison">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const HIGHLIGHT_STYLE: Record<Highlight, string> = {
  'CURRENT FAVORITE': 'bg-rose-50 text-rose-700',
  'BEST MATCH': 'bg-blue-50 text-secondary',
  'BEST VALUE': 'bg-green-50 text-green-700',
  'LOWEST MONTHLY COST': 'bg-amber-50 text-amber-700',
}

function ColumnHeader({ c, onRemove }: { c: Column; onRemove: () => void }) {
  return (
    <div className="min-w-[160px]">
      <div className="relative">
        <PropertyImage path={c.p.primary_photo} seed={c.p.id} className="aspect-[16/10] rounded-xl" />
        <button onClick={onRemove} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-slate-600 shadow" aria-label="Remove from comparison">
          <X className="size-4" />
        </button>
      </div>
      <Link to={`/properties/${c.p.id}`} className="mt-2 block truncate font-semibold hover:underline">{c.p.address_line1}</Link>
      <div className="flex items-center gap-1.5 text-xs text-muted">{c.p.city} {c.p.is_demo && <DemoBadge />}</div>
      <div className="mt-2 flex min-h-5 flex-wrap gap-1">
        {c.highlights.map((h) => <Badge key={h} className={HIGHLIGHT_STYLE[h]}>{h}</Badge>)}
      </div>
    </div>
  )
}
