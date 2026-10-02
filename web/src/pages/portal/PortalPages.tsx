import { format, isPast, isToday } from 'date-fns'
import { CalendarDays, Heart, Mail, Phone, Search, Send } from 'lucide-react'
import * as React from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import { PrivacyCard } from '@/components/PrivacyCard'
import { PropertyImage } from '@/components/PropertyImage'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { DECISIONS, useSendPortalMessage, type PortalData, type PortalProperty } from '@/features/portal'
import { memberScore } from '@/lib/household'
import { estimateMonthly } from '@/lib/mortgage'
import { cn, formatBudget, formatNumber, formatPrice, formatTime, parseDateOnly, scoreTone } from '@/lib/utils'

export const usePortal = () => useOutletContext<PortalData>()

export function myRating(p: PortalProperty, data: PortalData) {
  return p.ratings.find((r) => r.member_id === data.me.member_id)
}

export function monthlyFor(p: PortalProperty, data: PortalData) {
  return estimateMonthly(p, { down_payment_amount: data.client.down_payment })?.total ?? null
}

function decisionLabel(d: string | null | undefined) {
  const x = DECISIONS.find((v) => v.value === d)
  return x ? `${x.emoji} ${x.label}` : null
}

// ── Home ─────────────────────────────────────────────────────────────
export function PortalHome() {
  const data = usePortal()
  const upcoming = data.tours.filter((t) => t.status !== 'completed' && (isToday(parseDateOnly(t.tour_date)) || !isPast(parseDateOnly(t.tour_date))))
  const favorites = data.properties.filter((p) => ['love', 'discuss_offer'].includes(myRating(p, data)?.decision ?? ''))
  const toRate = data.properties.filter((p) => p.toured && !myRating(p, data))
  const agentName = [data.agent.first_name, data.agent.last_name].filter(Boolean).join(' ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Hi {data.me.first_name} 👋</h1>
        <p className="mt-1 text-muted">
          {data.client.name} · {formatBudget(data.client.budget_min, data.client.budget_max)} {data.client.is_demo && <DemoBadge />}
        </p>
      </div>

      {toRate.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Heart className="size-5 shrink-0 text-accent" />
            <p className="flex-1 text-sm">
              <b>Rate the homes you toured.</b> Your ratings help {data.agent.first_name ?? 'your agent'} find the right fit.
            </p>
            <Button asChild size="sm"><Link to={`/portal/properties/${toRate[0]!.id}`}>Rate {toRate[0]!.address_line1}</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Homes shared" value={data.properties.length} to="/portal/properties" />
        <Stat label="Toured" value={data.properties.filter((p) => p.toured).length} to="/portal/properties" />
        <Stat label="Favorites" value={favorites.length} to="/portal/compare" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Upcoming showings</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? <p className="text-sm text-muted">No showings scheduled yet.</p> : (
              <div className="space-y-4">
                {upcoming.map((t) => <TourBlock key={t.id} tour={t} data={data} />)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Your agent</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-semibold">{agentName || 'Your agent'}</div>
            {data.agent.brokerage && <div className="text-muted">{data.agent.brokerage}</div>}
            {data.agent.phone && <a href={`tel:${data.agent.phone}`} className="flex items-center gap-2 text-accent"><Phone className="size-4" /> {data.agent.phone}</a>}
            {data.agent.email && <a href={`mailto:${data.agent.email}`} className="flex items-center gap-2 text-accent"><Mail className="size-4" /> {data.agent.email}</a>}
            <Button asChild variant="outline" size="sm" className="mt-2"><Link to="/portal/messages">Send a message</Link></Button>
          </CardContent>
        </Card>
      </div>

      {favorites.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Your favorites</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((p) => <PropertyCard key={p.id} p={p} data={data} />)}</div>
        </section>
      )}

      <PrivacyCard buyer />
    </div>
  )
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border bg-card p-4 shadow-card hover:shadow-lift">
      <div className="text-sm text-muted">{label}</div>
      <div className="font-display text-3xl font-bold">{value}</div>
    </Link>
  )
}

function TourBlock({ tour, data }: { tour: PortalData['tours'][number]; data: PortalData }) {
  return (
    <div>
      <div className="font-semibold">{tour.name}</div>
      <div className="text-xs text-muted">{format(parseDateOnly(tour.tour_date), 'EEEE, MMMM d')} · {tour.stops.length} homes</div>
      <ul className="mt-2 space-y-1.5">
        {tour.stops.map((s) => {
          const p = data.properties.find((x) => x.id === s.property_id)
          return (
            <li key={s.property_id} className="flex gap-3 text-sm">
              <span className="w-16 shrink-0 tabular-nums text-muted">{formatTime(s.scheduled_time) || `#${s.sequence_number}`}</span>
              {p ? <Link to={`/portal/properties/${p.id}`} className={cn('hover:underline', s.status === 'completed' && 'text-muted line-through')}>{p.address_line1}</Link> : <span>Home</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function PropertyCard({ p, data }: { p: PortalProperty; data: PortalData }) {
  const mine = myRating(p, data)
  const monthly = monthlyFor(p, data)
  return (
    <Link to={`/portal/properties/${p.id}`} className="overflow-hidden rounded-2xl border bg-card shadow-card transition hover:shadow-lift">
      <PropertyImage path={p.primary_photo} seed={p.id} className="aspect-[16/10]">
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.toured && <Badge variant="dark">Toured</Badge>}
          {p.is_demo && <DemoBadge />}
        </div>
      </PropertyImage>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{p.address_line1}</div>
            <div className="text-sm text-muted">{p.city}, {p.state}</div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold">{formatPrice(p.listing_price)}</div>
            {monthly && <div className="text-xs text-muted">≈ {formatPrice(monthly)}/mo</div>}
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-600">{p.beds ?? '—'} bd · {p.baths ?? '—'} ba · {formatNumber(p.square_feet)} sq ft</div>
        <div className="mt-2 text-xs font-medium">{decisionLabel(mine?.decision) ?? (p.toured ? <span className="text-accent">Tap to rate</span> : null)}</div>
      </div>
    </Link>
  )
}

// ── Properties ───────────────────────────────────────────────────────
export function PortalProperties() {
  const data = usePortal()
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Properties</h1>
      {data.properties.length === 0 ? (
        <EmptyState icon={Search} title="No homes shared yet" description="Homes your agent shares with you, and homes on your tours, will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.properties.map((p) => <PropertyCard key={p.id} p={p} data={data} />)}</div>
      )}
    </div>
  )
}

// ── Tours ────────────────────────────────────────────────────────────
export function PortalTours() {
  const data = usePortal()
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Tours</h1>
      {data.tours.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No tours yet" description="When your agent schedules showings, they'll appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...data.tours].reverse().map((t) => (
            <Card key={t.id}><CardContent><TourBlock tour={t} data={data} /></CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Compare ──────────────────────────────────────────────────────────
export function PortalCompare() {
  const data = usePortal()
  const rows = data.properties
    .map((p) => ({ p, mine: myRating(p, data), monthly: monthlyFor(p, data) }))
    .sort((a, b) => (memberScoreOf(b.mine) ?? -1) - (memberScoreOf(a.mine) ?? -1) || (b.p.match_score ?? 0) - (a.p.match_score ?? 0))
  if (rows.length < 2) {
    return <EmptyState icon={Search} title="Not enough homes to compare" description="Once you have two or more homes, you can compare them here." />
  }
  const nameOf = (id: string) => data.members.find((m) => m.id === id)?.first_name ?? 'Buyer'
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold">Compare</h1>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {rows.map(({ p, monthly }) => (
          <Link key={p.id} to={`/portal/properties/${p.id}`} className="w-[80%] shrink-0 snap-center rounded-2xl border bg-card p-3 shadow-card md:w-auto">
            <PropertyImage path={p.primary_photo} seed={p.id} className="aspect-[16/10] rounded-xl" />
            <div className="mt-2 font-semibold">{p.address_line1}</div>
            <dl className="mt-2 divide-y text-sm">
              <Row label="Price" value={formatPrice(p.listing_price)} />
              <Row label="Est. monthly" value={monthly ? `${formatPrice(monthly)}/mo` : '—'} />
              <Row label="Beds / Baths" value={`${p.beds ?? '—'} / ${p.baths ?? '—'}`} />
              <Row label="Sq Ft" value={formatNumber(p.square_feet)} />
              {p.match_score != null && <Row label="Match" value={<span className={cn('font-bold', scoreTone(p.match_score))}>{p.match_score}</span>} />}
              {p.ratings.map((r) => (
                <Row key={r.member_id} label={nameOf(r.member_id)} value={`${memberScoreOf(r) ?? '—'}${r.decision ? ` · ${decisionLabel(r.decision)}` : ''}`} />
              ))}
            </dl>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Monthly estimates include taxes, insurance and HOA. Estimate only. Not a lending quote.</p>
    </div>
  )
}

function memberScoreOf(r: PortalProperty['ratings'][number] | undefined) {
  return r ? memberScore({ name: '', ...r }) : null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

// ── Messages ─────────────────────────────────────────────────────────
export function PortalMessages() {
  const data = usePortal()
  const send = useSendPortalMessage()
  const [text, setText] = React.useState('')
  const end = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => end.current?.scrollIntoView(), [data.messages.length])

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-2xl font-bold">Messages</h1>
      <div className="space-y-3">
        {data.messages.length === 0 && <p className="text-sm text-muted">No messages yet. Ask your agent anything.</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm', m.sender === 'buyer' ? 'ml-auto bg-primary text-white' : 'bg-card shadow-card')}>
            <p className="whitespace-pre-line">{m.content.replace(/^Subject:.*\n\n/, '')}</p>
            <p className={cn('mt-1 text-[11px]', m.sender === 'buyer' ? 'text-slate-400' : 'text-muted')}>{format(new Date(m.created_at), 'MMM d, h:mm a')}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="sticky bottom-20 mt-6 flex gap-2 rounded-2xl border bg-card p-2 shadow-lift md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          send.mutate(text, { onSuccess: () => setText(''), onError: (err) => toast.error(err.message) })
        }}
      >
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" className="min-h-[44px] flex-1 border-0 focus:ring-0" aria-label="Message" />
        <Button type="submit" size="icon" loading={send.isPending} aria-label="Send"><Send /></Button>
      </form>
    </div>
  )
}
