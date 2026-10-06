import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Check, Handshake, Info, Star } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PropertyImage } from '@/components/PropertyImage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { SCENARIO_LABEL, type BuyerChoice, type Scenario } from '@/features/offers'
import { useRespondOffer, type PortalOffer } from '@/features/portal'
import { cn, formatPrice } from '@/lib/utils'
import { usePortal } from './PortalPages'

const DISCLAIMER = 'AI-generated analysis is informational and does not guarantee seller acceptance or substitute for professional real estate judgment. Payments are estimates, not a lending quote.'
const FIT = {
  within: { label: 'Within your budget', variant: 'success' },
  stretch: { label: 'A stretch', variant: 'warning' },
  over: { label: 'Above your preapproval', variant: 'danger' },
} as const
const OTHER: { value: BuyerChoice; label: string }[] = [
  { value: 'discuss', label: "Let's talk first" },
  { value: 'not_ready', label: "We're not ready to offer" },
]
const choiceText = (c: BuyerChoice) => (c in SCENARIO_LABEL ? `${SCENARIO_LABEL[c as keyof typeof SCENARIO_LABEL]} offer` : OTHER.find((o) => o.value === c)?.label ?? c)

export function PortalOffers() {
  const data = usePortal()
  if (!data.offers.length) {
    return <EmptyState icon={Handshake} title="No offer strategies yet" description="When you're ready to make an offer, your agent will share the options here." />
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Offer strategies</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.offers.map((o) => {
          const mine = o.responses.find((r) => r.member_id === data.me.member_id)
          return (
            <Link key={o.id} to={`/portal/offers/${o.id}`} className="overflow-hidden rounded-2xl border bg-card shadow-card transition hover:shadow-lift">
              <PropertyImage path={o.primary_photo} seed={o.property_id} className="h-28" />
              <div className="space-y-1 p-4">
                <div className="font-semibold">{o.address_line1}</div>
                <div className="text-sm text-muted">{o.city}, {o.state} · Asking {formatPrice(o.listing_price)}</div>
                <div className="pt-1">{mine ? <Badge variant="success">You chose: {choiceText(mine.choice)}</Badge> : <Badge variant="accent">Waiting for your input</Badge>}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function PortalOfferPage() {
  const { id } = useParams()
  const data = usePortal()
  const offer = data.offers.find((o) => o.id === id)
  if (!offer) return <EmptyState icon={Handshake} title="Offer strategy not available" description="Your agent may have updated or removed it." action={<Button asChild variant="outline"><Link to="/portal/offers">Back</Link></Button>} />
  return <OfferView offer={offer} />
}

function OfferView({ offer }: { offer: PortalOffer }) {
  const data = usePortal()
  const respond = useRespondOffer()
  const a = offer.analysis
  const mine = offer.responses.find((r) => r.member_id === data.me.member_id)
  const others = offer.responses.filter((r) => r.member_id !== data.me.member_id)
  const [comment, setComment] = React.useState(mine?.comment ?? '')
  const agent = data.agent.first_name ?? 'your agent'
  const memberName = (id: string) => data.members.find((m) => m.id === id)?.first_name ?? 'Someone'

  function pick(choice: BuyerChoice) {
    respond.mutate({ offerId: offer.id, choice, comment }, {
      onSuccess: () => toast.success(`Sent to ${agent}`),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/portal/offers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" /> Offers</Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">{offer.address_line1}</h1>
        <p className="text-sm text-muted">
          {offer.city}, {offer.state} · Asking {formatPrice(offer.listing_price)} · shared {formatDistanceToNow(new Date(offer.shared_at), { addSuffix: true })}
        </p>
      </div>

      {offer.note && (
        <Card className="border-blue-200 bg-blue-50/50"><CardContent className="text-sm"><b>{agent}:</b> {offer.note}</CardContent></Card>
      )}

      <Card>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>{a.summary}</p>
          <p className="rounded-xl bg-blue-50 px-4 py-3"><b>Suggested starting point: {SCENARIO_LABEL[a.recommended.scenario]}.</b> {a.recommended.reason}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {a.scenarios.map((s) => (
          <ScenarioOption
            key={s.key} s={s}
            suggested={a.recommended.scenario === s.key}
            mine={mine?.choice === s.key}
            othersPicked={others.filter((r) => r.choice === s.key).map((r) => memberName(r.member_id))}
            onPick={() => pick(s.key)} busy={respond.isPending}
          />
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="font-semibold">Anything to tell {agent}?</div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Questions, concerns, or how you feel about the price…" className="min-h-20" />
          <div className="flex flex-wrap gap-2">
            {OTHER.map((o) => (
              <Button key={o.value} variant={mine?.choice === o.value ? 'default' : 'outline'} disabled={respond.isPending} onClick={() => pick(o.value)}>
                {mine?.choice === o.value && <Check />} {o.label}
              </Button>
            ))}
            {mine && mine.choice in SCENARIO_LABEL && comment !== (mine.comment ?? '') && (
              <Button variant="outline" disabled={respond.isPending} onClick={() => pick(mine.choice)}>Update comment</Button>
            )}
          </div>
          {mine && <p className="text-xs text-muted">You told {agent}: {choiceText(mine.choice)} · {formatDistanceToNow(new Date(mine.updated_at), { addSuffix: true })}. You can change it anytime.</p>}
          {others.filter((r) => !(r.choice in SCENARIO_LABEL)).map((r) => (
            <p key={r.member_id} className="text-xs text-muted">{memberName(r.member_id)}: {choiceText(r.choice)}{r.comment ? ` — “${r.comment}”` : ''}</p>
          ))}
        </CardContent>
      </Card>

      {a.questions_to_verify?.length > 0 && (
        <Card>
          <CardContent>
            <div className="mb-2 font-semibold">Things to think about</div>
            <ul className="list-disc space-y-1 pl-5 text-sm">{a.questions_to_verify.map((q) => <li key={q}>{q}</li>)}</ul>
          </CardContent>
        </Card>
      )}

      <p className="flex gap-2 rounded-xl bg-subtle px-4 py-3 text-xs text-muted"><Info className="size-4 shrink-0" /> {DISCLAIMER}</p>
    </div>
  )
}

function ScenarioOption({ s, suggested, mine, othersPicked, onPick, busy }: {
  s: Scenario; suggested: boolean; mine: boolean; othersPicked: string[]; onPick: () => void; busy: boolean
}) {
  const fit = FIT[s.fit]
  return (
    <Card className={cn('flex flex-col', mine && 'ring-2 ring-accent')}>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">{SCENARIO_LABEL[s.key]}</div>
          {suggested && <Badge variant="accent"><Star className="size-3" /> Suggested</Badge>}
        </div>
        <div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{formatPrice(s.price)}</div>
          <div className="text-sm text-muted">
            {s.diff_from_asking == null ? '' : s.diff_from_asking === 0 ? 'At asking' : `${formatPrice(Math.abs(s.diff_from_asking))} ${s.diff_from_asking > 0 ? 'above' : 'below'} asking`}
          </div>
        </div>
        <Badge variant={fit.variant} className="self-start">{fit.label}</Badge>
        <dl className="grid grid-cols-2 gap-y-1 rounded-xl bg-subtle p-3 text-sm">
          <dt className="text-muted">Monthly (est.)</dt><dd className="text-right font-semibold tabular-nums">{formatPrice(s.monthly.total)}</dd>
          <dt className="text-muted">Down payment</dt><dd className="text-right tabular-nums">{formatPrice(s.down_payment)}</dd>
          <dt className="text-muted">Cash to close</dt><dd className="text-right tabular-nums">~{formatPrice(s.cash_to_close_est)}</dd>
        </dl>
        <p className="text-sm text-slate-700">{s.explanation}</p>
        <Mini title="Pros" items={s.advantages} tone="text-green-700" />
        <Mini title="Cons" items={s.risks} tone="text-red-700" />
        <div className="mt-auto space-y-1 pt-2">
          {othersPicked.length > 0 && <p className="text-xs text-muted">{othersPicked.join(' & ')} picked this</p>}
          <Button className="w-full" variant={mine ? 'default' : 'outline'} disabled={busy || mine} onClick={onPick}>
            {mine ? <><Check /> Your choice</> : 'I prefer this one'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Mini({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items?.length) return null
  return (
    <div>
      <div className={cn('text-xs font-semibold uppercase tracking-wide', tone)}>{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  )
}
