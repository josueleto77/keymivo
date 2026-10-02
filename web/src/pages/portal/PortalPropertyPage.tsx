import { ArrowLeft, Star } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { HouseholdOpinions } from '@/components/HouseholdOpinions'
import { PropertyImage } from '@/components/PropertyImage'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/input'
import { DECISIONS, RATING_KEYS, RATING_LABELS, useRateProperty, type RatingKey } from '@/features/portal'
import { cn, formatNumber, formatPrice } from '@/lib/utils'
import { monthlyFor, myRating, usePortal } from './PortalPages'

export function PortalPropertyPage() {
  const { id } = useParams()
  const data = usePortal()
  const p = data.properties.find((x) => x.id === id)
  const rate = useRateProperty()
  const mine = p ? myRating(p, data) : undefined
  const [stars, setStars] = React.useState<Partial<Record<RatingKey, number>>>({})
  const [decision, setDecision] = React.useState<string | null>(null)
  const [comment, setComment] = React.useState('')

  React.useEffect(() => {
    if (!mine) return
    setStars(Object.fromEntries(RATING_KEYS.map((k) => [k, mine[k] ?? 0])))
    setDecision(mine.decision)
    setComment(mine.comment ?? '')
  }, [mine])

  if (!p) return <EmptyState icon={Star} title="Home not found" description="This home isn't shared with you." />
  const monthly = monthlyFor(p, data)
  const nameOf = (mid: string) => data.members.find((m) => m.id === mid)?.first_name ?? 'Buyer'

  function save() {
    rate.mutate(
      { propertyId: p!.id, ratings: stars, decision, comment },
      { onSuccess: () => toast.success('Thanks! Your agent can see your rating.'), onError: (e) => toast.error(e.message) },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/portal/properties" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Properties
      </Link>
      <PropertyImage path={p.primary_photo} seed={p.id} className="-mx-4 aspect-[16/9] sm:mx-0 sm:rounded-3xl">
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 pt-16 text-white">
          <div className="flex gap-1.5">{p.toured && <Badge variant="dark" className="bg-white/20">Toured</Badge>}{p.is_demo && <DemoBadge />}</div>
          <h1 className="mt-1 font-display text-3xl font-bold">{p.address_line1}</h1>
          <p className="text-white/85">{p.city}, {p.state} {p.zip_code}</p>
        </div>
      </PropertyImage>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Info label="Price" value={formatPrice(p.listing_price)} />
          <Info label="Est. monthly" value={monthly ? `${formatPrice(monthly)}/mo` : '—'} />
          <Info label="Beds / Baths" value={`${p.beds ?? '—'} / ${p.baths ?? '—'}`} />
          <Info label="Sq Ft" value={formatNumber(p.square_feet)} />
          <Info label="Year built" value={p.year_built?.toString() ?? '—'} />
          <Info label="Taxes" value={p.property_tax ? `${formatPrice(p.property_tax)}/yr` : '—'} />
          <Info label="HOA" value={p.hoa_fee ? `${formatPrice(p.hoa_fee)}/mo` : 'None'} />
          <Info label="Lot" value={p.lot_size ?? '—'} />
          <p className="col-span-full text-[11px] text-muted">Monthly estimate includes taxes, insurance, HOA and PMI if applicable. Estimate only. Not a lending quote.</p>
        </CardContent>
      </Card>

      {p.shared_note && (
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">Note from {data.agent.first_name ?? 'your agent'}</div>
            <p className="whitespace-pre-line text-sm">{p.shared_note}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Your rating</CardTitle>
            <p className="mt-1 text-xs text-muted">Only your household and your agent see this.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {RATING_KEYS.map((k) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className={cn('text-sm', k === 'overall' && 'font-semibold')}>{RATING_LABELS[k]}</span>
                <StarInput value={stars[k] ?? 0} onChange={(v) => setStars({ ...stars, [k]: v })} label={RATING_LABELS[k]} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDecision(decision === d.value ? null : d.value)}
                className={cn('rounded-full border px-3.5 py-2 text-sm font-medium transition', decision === d.value ? 'border-primary bg-primary text-white' : 'bg-card hover:bg-subtle')}
              >
                {d.emoji} {d.label}
              </button>
            ))}
          </div>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything you want your agent to know?" className="min-h-[72px]" aria-label="Comment" />
          <Button size="lg" className="w-full sm:w-auto" onClick={save} loading={rate.isPending}>Save rating</Button>
        </CardContent>
      </Card>

      <HouseholdOpinions
        title="Your household"
        ratings={p.ratings.map((r) => ({ ...r, name: nameOf(r.member_id) }))}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? 0 : n)}
          className="grid size-8 place-items-center"
        >
          <Star className={cn('size-6 transition', n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
        </button>
      ))}
    </div>
  )
}
