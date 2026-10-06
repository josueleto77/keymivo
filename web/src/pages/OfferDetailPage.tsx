import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, ArrowLeft, Check, CircleHelp, Info, Sparkles, Star, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PropertyImage } from '@/components/PropertyImage'
import { ReportButton } from '@/components/ReportButton'
import { ShareOfferCard } from '@/components/ShareOfferCard'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SCENARIO_LABEL, useAnalyzeOffer, useDeleteOffer, useOffer, useUpdateOffer,
  type OfferAnalysis, type OfferDetail, type OfferInputs, type Scenario, type ScenarioKey,
} from '@/features/offers'
import type { Json } from '@/lib/database.types'
import { OFFER_STATUSES } from '@/lib/constants'
import { cn, formatNumber, formatPrice, fullName } from '@/lib/utils'

const DISCLAIMER = 'AI-generated analysis is informational and does not guarantee seller acceptance or substitute for professional real estate judgment.'
const PROGRESS = ['Pricing the three scenarios…', 'Estimating payments and cash to close…', 'Weighing buyer feedback…', 'Writing advantages and risks…']
const FIT = {
  within: { label: 'Within budget', variant: 'success' },
  stretch: { label: 'Stretch', variant: 'warning' },
  over: { label: 'Over preapproval', variant: 'danger' },
} as const
const MARKET = [
  { value: 'slow', label: 'Slow', hint: 'Few buyers, price drops' },
  { value: 'balanced', label: 'Balanced', hint: 'Normal activity' },
  { value: 'hot', label: 'Hot', hint: 'Multiple offers common' },
] as const

const signed = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatPrice(Math.abs(n))}`)
const toNum = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return s.trim() && Number.isFinite(n) ? n : null
}
const toStr = (n: number | null | undefined) => (n == null ? '' : String(n))

export function OfferDetailPage() {
  const { id } = useParams()
  const { data: offer, isLoading, error, refetch } = useOffer(id)
  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (error || !offer) return <ErrorState message={(error as Error)?.message ?? 'Offer not found'} onRetry={() => refetch()} />
  return <OfferDetail offer={offer} />
}

function OfferDetail({ offer }: { offer: OfferDetail }) {
  const navigate = useNavigate()
  const update = useUpdateOffer(offer.id)
  const analyze = useAnalyzeOffer(offer.id)
  const del = useDeleteOffer()
  const p = offer.properties
  const c = offer.clients
  const analysis = offer.analysis as unknown as OfferAnalysis | null
  const saved = (offer.inputs ?? {}) as OfferInputs

  const [form, setForm] = React.useState(() => ({
    comps_low: toStr(saved.comps_low), comps_high: toStr(saved.comps_high), days_on_market: toStr(saved.days_on_market ?? p?.days_on_market),
    repairs: toStr(saved.repairs), market: saved.market ?? 'balanced', multiple_offers: !!saved.multiple_offers,
    interest_rate: toStr(saved.interest_rate), down_payment: toStr(saved.down_payment), notes: offer.notes ?? '',
  }))
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const inputs: OfferInputs = {
    comps_low: toNum(form.comps_low), comps_high: toNum(form.comps_high), days_on_market: toNum(form.days_on_market),
    repairs: toNum(form.repairs), market: form.market, multiple_offers: form.multiple_offers,
    interest_rate: toNum(form.interest_rate), down_payment: toNum(form.down_payment),
  }
  const compsError = inputs.comps_low != null && inputs.comps_high != null && inputs.comps_high < inputs.comps_low
    ? 'High must be at or above low' : (inputs.comps_low == null) !== (inputs.comps_high == null) ? 'Enter both ends of the range' : undefined
  const dirty = JSON.stringify(inputs) !== JSON.stringify({ ...emptyInputs, ...saved }) || form.notes !== (offer.notes ?? '')
  // The analysis reflects older inputs when any pricing input changed after it ran.
  const stale = !!analysis && (dirty || inputsChangedSince(analysis, saved))

  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    if (!analyze.isPending) return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 2500)
    return () => clearInterval(t)
  }, [analyze.isPending])

  async function run() {
    if (compsError) return toast.error(compsError)
    try {
      await update.mutateAsync({ inputs: inputs as Json, notes: form.notes.trim() || null })
      await analyze.mutateAsync()
      toast.success('Offer analysis ready')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  function choose(s: Scenario) {
    update.mutate({ selected_scenario: s.key, potential_price: s.price }, {
      onSuccess: () => toast.success(`${SCENARIO_LABEL[s.key]} selected · ${formatPrice(s.price)}`),
      onError: (e) => toast.error(e.message),
    })
  }

  function onDelete() {
    if (!confirm('Delete this offer analysis?')) return
    del.mutate(offer.id, { onSuccess: () => navigate('/offers'), onError: (e) => toast.error(e.message) })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/offers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-slate-900"><ArrowLeft className="size-4" /> Offers</Link>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <PropertyImage path={p?.primary_photo} seed={offer.property_id} className="size-20 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{p?.address_line1}</h1>
              {(p?.is_demo || c?.is_demo) && <DemoBadge />}
            </div>
            <p className="text-sm text-muted">
              {p?.city}, {p?.state} · Asking {formatPrice(p?.listing_price)} · for{' '}
              <Link to={`/clients/${offer.client_id}`} className="font-medium text-slate-700 hover:underline">{fullName(c)}</Link>
            </p>
            <p className="mt-1 text-xs text-muted">
              Preapproval {formatPrice(c?.preapproval_amount)} · Target {formatPrice(c?.target_price_min)}–{formatPrice(c?.target_price_max)}
              {c?.preferred_monthly_payment ? ` · Comfortable at ${formatPrice(c.preferred_monthly_payment)}/mo` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NativeSelect
              aria-label="Offer status"
              value={offer.status}
              onChange={(e) => update.mutate({ status: e.target.value }, { onSuccess: () => toast.success('Status updated'), onError: (err) => toast.error(err.message) })}
              className="w-40"
            >
              {OFFER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </NativeSelect>
            {analysis && <ReportButton kind="offer" id={offer.id} />}
            <Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete offer analysis"><Trash2 /></Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        {/* ── Inputs ── */}
        <Card className="h-fit">
          <CardHeader><CardTitle>Market inputs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Comps low" htmlFor="comps-low" error={compsError}>
                <Input id="comps-low" inputMode="numeric" placeholder="$" value={form.comps_low} onChange={set('comps_low')} />
              </Field>
              <Field label="Comps high" htmlFor="comps-high">
                <Input id="comps-high" inputMode="numeric" placeholder="$" value={form.comps_high} onChange={set('comps_high')} />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-muted">Value range from recent comparable sales. Without it, scenarios are anchored on the asking price.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Days on market" htmlFor="dom"><Input id="dom" inputMode="numeric" value={form.days_on_market} onChange={set('days_on_market')} /></Field>
              <Field label="Est. repairs" htmlFor="repairs"><Input id="repairs" inputMode="numeric" placeholder="$0" value={form.repairs} onChange={set('repairs')} /></Field>
            </div>
            <div>
              <div className="mb-1.5 text-sm font-medium">Market activity</div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1">
                {MARKET.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    title={m.hint}
                    onClick={() => setForm((f) => ({ ...f, market: m.value }))}
                    className={cn('rounded-lg py-1.5 text-sm transition', form.market === m.value ? 'bg-card font-medium shadow-card' : 'text-muted hover:text-slate-900')}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.multiple_offers} onCheckedChange={(v) => setForm((f) => ({ ...f, multiple_offers: v === true }))} />
              Listing agent expects multiple offers
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rate %" htmlFor="rate"><Input id="rate" inputMode="decimal" placeholder="6.75" value={form.interest_rate} onChange={set('interest_rate')} /></Field>
              <Field label="Down payment" htmlFor="down">
                <Input id="down" inputMode="numeric" placeholder={c?.down_payment_amount ? formatNumber(c.down_payment_amount) : '20%'} value={form.down_payment} onChange={set('down_payment')} />
              </Field>
            </div>
            <Field label="Notes for the analysis" htmlFor="offer-notes">
              <Textarea id="offer-notes" placeholder="e.g. Seller wants a quick close; roof is 22 years old." value={form.notes} onChange={set('notes')} className="min-h-20" />
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={run} loading={analyze.isPending || update.isPending} disabled={!!compsError}>
                <Sparkles /> {analysis ? 'Re-run analysis' : 'Run analysis'}
              </Button>
              {dirty && !analyze.isPending && (
                <Button variant="outline" onClick={() => update.mutate({ inputs: inputs as Json, notes: form.notes.trim() || null }, { onSuccess: () => toast.success('Inputs saved') })}>Save</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Analysis ── */}
        <div className="space-y-6">
          {analyze.isPending ? (
            <Card>
              <CardContent className="space-y-3 py-10 text-center">
                <Sparkles className="mx-auto size-8 animate-pulse text-accent" />
                <p className="font-medium">{PROGRESS[step]}</p>
                <p className="text-xs text-muted">Prices and payments are calculated exactly; AI only explains them.</p>
              </CardContent>
            </Card>
          ) : !analysis ? (
            <Card>
              <CardContent className="space-y-2 py-10 text-center">
                <Sparkles className="mx-auto size-8 text-accent" />
                <p className="font-medium">Add what you know about this market, then run the analysis.</p>
                <p className="mx-auto max-w-md text-sm text-muted">
                  You'll get Conservative, Competitive and Strong prices with monthly payment, cash to close, appraisal-gap exposure,
                  fit with {c?.first_name ?? 'the buyer'}'s budget, advantages and risks.
                </p>
                {offer.ai_status === 'failed' && <p className="text-sm text-danger">The last run failed. Try again.</p>}
              </CardContent>
            </Card>
          ) : (
            <>
              <ShareOfferCard offer={offer} />
              <AnalysisView analysis={analysis} offer={offer} stale={stale} onChoose={choose} choosing={update.isPending} />
            </>
          )}
          <p className="flex gap-2 rounded-xl bg-subtle px-4 py-3 text-xs text-muted"><Info className="size-4 shrink-0" /> {DISCLAIMER}</p>
        </div>
      </div>
    </div>
  )
}

const emptyInputs: OfferInputs = {
  comps_low: null, comps_high: null, days_on_market: null, repairs: null, market: 'balanced', multiple_offers: false, interest_rate: null, down_payment: null,
}
function inputsChangedSince(a: OfferAnalysis, saved: OfferInputs) {
  const b = a.basis
  return (saved.comps_low ?? null) !== b.comps_low || (saved.comps_high ?? null) !== b.comps_high || (saved.repairs ?? 0) !== b.repairs
    || (saved.market ?? 'balanced') !== b.market || !!saved.multiple_offers !== b.multiple_offers || (saved.interest_rate ?? 6.75) !== b.interest_rate
}

function AnalysisView({ analysis, offer, stale, onChoose, choosing }: {
  analysis: OfferAnalysis; offer: OfferDetail; stale: boolean; onChoose: (s: Scenario) => void; choosing: boolean
}) {
  const b = analysis.basis
  return (
    <>
      {stale && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" /> Inputs changed since this analysis ran. Re-run it to update the scenarios.
        </p>
      )}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-accent" /> Offer strategy</div>
            <span className="text-xs text-muted">Analyzed {formatDistanceToNow(new Date(analysis.generated_at), { addSuffix: true })}</span>
          </div>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
          <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-slate-800">
            <span className="font-semibold">Suggested starting point: {SCENARIO_LABEL[analysis.recommended.scenario]}.</span> {analysis.recommended.reason}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {analysis.scenarios.map((s) => (
          <ScenarioCard
            key={s.key}
            s={s}
            selected={offer.selected_scenario === s.key}
            recommended={analysis.recommended.scenario === s.key}
            onChoose={() => onChoose(s)}
            choosing={choosing}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {analysis.questions_to_verify.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleHelp className="size-4" /> Verify before writing the offer</CardTitle></CardHeader>
            <CardContent><ul className="list-disc space-y-1 pl-5 text-sm">{analysis.questions_to_verify.map((q) => <li key={q}>{q}</li>)}</ul></CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">How these prices were set</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm text-slate-700">
            <p>
              Anchor <span className="font-medium">{formatPrice(b.anchor)}</span>{' '}
              {b.anchor_source === 'comps_midpoint' ? `(midpoint of comps ${formatPrice(b.comps_low)}–${formatPrice(b.comps_high)})` : '(asking price — no comps entered)'}.
            </p>
            <p>Market: {b.market}{b.multiple_offers ? ', multiple offers expected (+1%)' : ''}{b.dom_adjustment_pct ? `; ${b.days_on_market} days on market (${b.dom_adjustment_pct > 0 ? '+' : ''}${b.dom_adjustment_pct}%)` : ''}.</p>
            {b.repairs > 0 && <p>Repairs {formatPrice(b.repairs)}: Conservative deducts all, Competitive half, Strong none.</p>}
            <p className="text-xs text-muted">
              Payments: 30-yr fixed at {b.interest_rate}%, {b.down_payment_source === 'buyer' ? "buyer's down payment" : '20% down (assumed)'}, insurance {b.insurance_pct}%/yr,
              PMI under 20% down. Cash to close adds ~{b.closing_cost_pct}% closing costs. Estimates only — not a lending quote.
            </p>
            {analysis.data_gaps.length > 0 && (
              <div className="pt-1">
                <div className="text-xs font-medium text-muted">Would make this more reliable</div>
                <ul className="list-disc pl-5 text-xs text-muted">{analysis.data_gaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ScenarioCard({ s, selected, recommended, onChoose, choosing }: {
  s: Scenario; selected: boolean; recommended: boolean; onChoose: () => void; choosing: boolean
}) {
  const fit = FIT[s.fit]
  return (
    <Card className={cn('flex flex-col', selected && 'ring-2 ring-accent')}>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">{SCENARIO_LABEL[s.key as ScenarioKey]}</div>
          {recommended && <Badge variant="accent"><Star className="size-3" /> Suggested</Badge>}
        </div>
        <div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{formatPrice(s.price)}</div>
          <div className="text-sm text-muted">{signed(s.diff_from_asking)} vs asking{s.diff_pct != null ? ` (${s.diff_pct > 0 ? '+' : ''}${s.diff_pct}%)` : ''}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={fit.variant}>{fit.label}</Badge>
          {s.appraisal_gap > 0 && <Badge variant="warning">Appraisal gap {formatPrice(s.appraisal_gap)}</Badge>}
        </div>
        {s.fit_notes.length > 0 && <ul className="space-y-0.5 text-xs text-muted">{s.fit_notes.map((n) => <li key={n}>• {n}</li>)}</ul>}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-subtle p-3 text-sm">
          <dt className="text-muted">Monthly</dt><dd className="text-right font-semibold tabular-nums">{formatPrice(s.monthly.total)}</dd>
          <dt className="text-xs text-muted">P&amp;I</dt><dd className="text-right text-xs tabular-nums">{formatPrice(s.monthly.principal_interest)}</dd>
          <dt className="text-xs text-muted">Taxes · Ins.</dt><dd className="text-right text-xs tabular-nums">{formatPrice(s.monthly.taxes)} · {formatPrice(s.monthly.insurance)}</dd>
          {(s.monthly.hoa > 0 || s.monthly.pmi > 0) && (
            <><dt className="text-xs text-muted">HOA · PMI</dt><dd className="text-right text-xs tabular-nums">{formatPrice(s.monthly.hoa)} · {formatPrice(s.monthly.pmi)}</dd></>
          )}
          <dt className="text-muted">Down ({s.down_payment_pct}%)</dt><dd className="text-right tabular-nums">{formatPrice(s.down_payment)}</dd>
          <dt className="text-muted">Cash to close</dt><dd className="text-right tabular-nums">~{formatPrice(s.cash_to_close_est)}</dd>
        </dl>

        <p className="text-sm leading-relaxed text-slate-700">{s.explanation}</p>
        <List title="Advantages" items={s.advantages} tone="text-green-700" />
        <List title="Risks" items={s.risks} tone="text-red-700" />
        <List title="Terms to discuss" items={s.terms_to_discuss} tone="text-slate-700" />

        <div className="mt-auto pt-2">
          <Button className="w-full" variant={selected ? 'default' : 'outline'} disabled={selected || choosing} onClick={onChoose}>
            {selected ? <><Check /> Selected</> : 'Use this scenario'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items?.length) return null
  return (
    <div>
      <div className={cn('text-xs font-semibold uppercase tracking-wide', tone)}>{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  )
}
