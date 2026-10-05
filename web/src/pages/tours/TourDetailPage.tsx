import { format } from 'date-fns'
import { ArrowDown, ArrowLeft, ArrowUp, CalendarPlus, CheckCircle2, FileText, Play, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { GoogleTourSync } from '@/components/GoogleTourSync'
import { PropertyImage } from '@/components/PropertyImage'
import { TourMap } from '@/components/TourMap'
import { TourSummary } from '@/components/TourSummary'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useProperties } from '@/features/properties'
import { useStartShowing } from '@/features/showings'
import { sortedStops, useAddTourStop, useDeleteTour, useRemoveTourStop, useTour, useUpdateTour, useUpdateTourStop } from '@/features/tours'
import { TOUR_STATUSES } from '@/lib/constants'
import { formatNumber, formatPrice, fullName, parseDateOnly } from '@/lib/utils'

export function TourDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: tour, isLoading, error, refetch } = useTour(id)
  const properties = useProperties()
  const update = useUpdateTour(id ?? '')
  const del = useDeleteTour()
  const addStop = useAddTourStop(id ?? '')
  const updateStop = useUpdateTourStop(id ?? '')
  const removeStop = useRemoveTourStop(id ?? '')
  const start = useStartShowing()

  if (isLoading) return <Skeleton className="h-80 w-full" />
  if (error || !tour) return <ErrorState message={(error as Error)?.message ?? 'Tour not found'} onRetry={() => refetch()} />

  const stops = sortedStops(tour)
  const available = (properties.data ?? []).filter((p) => !stops.some((s) => s.property_id === p.id))
  const showingFor = (propertyId: string) =>
    tour.showings.find((s) => s.property_id === propertyId && s.status === 'active') ??
    tour.showings.find((s) => s.property_id === propertyId && s.status === 'completed')

  async function startStop(propertyId: string) {
    try {
      const s = await start.mutateAsync({ client_id: tour!.client_id, property_id: propertyId, tour_id: tour!.id })
      navigate(`/showings/${s.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function swap(i: number, d: -1 | 1) {
    const a = stops[i]
    const b = stops[i + d]
    if (!a || !b) return
    await Promise.all([
      updateStop.mutateAsync({ id: a.id, sequence_number: b.sequence_number, scheduled_time: b.scheduled_time }),
      updateStop.mutateAsync({ id: b.id, sequence_number: a.sequence_number, scheduled_time: a.scheduled_time }),
    ])
  }

  async function onDelete() {
    if (!confirm('Delete this tour? Showings already recorded are kept.')) return
    await del.mutateAsync(tour!.id)
    toast.success('Tour deleted')
    navigate('/tours')
  }

  return (
    <div>
      <Link to="/tours" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Tours
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{tour.name}</h1>
          <p className="mt-1 text-muted">
            <Link to={`/clients/${tour.client_id}`} className="font-medium text-foreground hover:underline">{fullName(tour.clients)}</Link>
            {' · '}{format(parseDateOnly(tour.tour_date), 'EEEE, MMMM d')} · {stops.length} Homes
          </p>
        </div>
        <div className="flex gap-2">
          <NativeSelect aria-label="Tour status" value={tour.status} onChange={(e) => update.mutate({ status: e.target.value })} className="w-auto">
            {TOUR_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </NativeSelect>
          <GoogleTourSync tourId={tour.id} stopIds={stops.map((s) => s.id)} />
          <Button variant="outline" asChild>
            <a href={googleCalendarUrl(tour.name, fullName(tour.clients), tour.tour_date, stops)} target="_blank" rel="noreferrer"><CalendarPlus /> Add to calendar</a>
          </Button>
          <Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete tour"><Trash2 /></Button>
        </div>
      </div>

      <TourMap
        stops={stops}
        onReorder={async (ids) => {
          // Times stay with their slot; homes move between slots.
          const slots = stops.map((s) => s.scheduled_time)
          await Promise.all(ids.map((id, i) => updateStop.mutateAsync({ id, sequence_number: i + 1, scheduled_time: slots[i] ?? null })))
        }}
      />

      {stops.some((s) => s.status === 'completed') && (
        <TourSummary tourId={tour.id} clientId={tour.client_id} propertyIds={stops.map((s) => s.property_id)} />
      )}

      <div className="space-y-3">
        {stops.map((s, i) => {
          const showing = showingFor(s.property_id)
          const p = s.properties
          return (
            <Card key={s.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <PropertyImage path={p?.primary_photo} seed={s.property_id} className="h-32 sm:h-auto sm:w-48 sm:shrink-0">
                  <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                </PropertyImage>
                <CardContent className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Input
                        key={`${s.id}-${s.scheduled_time}`}
                        type="time"
                        defaultValue={s.scheduled_time?.slice(0, 5) ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value || null
                          if (v !== (s.scheduled_time?.slice(0, 5) ?? null)) updateStop.mutate({ id: s.id, scheduled_time: v })
                        }}
                        className="h-8 w-[110px] text-xs"
                        aria-label="Scheduled time"
                      />
                      {s.status === 'completed' && <Badge variant="success"><CheckCircle2 className="size-3" /> Toured</Badge>}
                      {s.status === 'showing' && <Badge variant="warning">In progress</Badge>}
                      {p?.is_demo && <DemoBadge />}
                    </div>
                    <Link to={`/properties/${s.property_id}`} className="mt-2 block text-lg font-semibold hover:underline">{p?.address_line1}</Link>
                    <p className="text-sm text-muted">
                      {p?.city}, {p?.state} · {formatPrice(p?.listing_price)} · {p?.beds ?? '—'} bd · {p?.baths ?? '—'} ba · {formatNumber(p?.square_feet)} sqft
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => swap(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp /></Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => swap(i, 1)} disabled={i === stops.length - 1} aria-label="Move down"><ArrowDown /></Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => removeStop.mutate(s.id)} aria-label="Remove from tour"><X /></Button>
                    </div>
                    {s.status === 'completed' && showing ? (
                      <Button variant="outline" asChild><Link to={`/showings/${showing.id}/complete`}><FileText /> Summary</Link></Button>
                    ) : (
                      <Button variant="accent" onClick={() => startStop(s.property_id)} loading={start.isPending && start.variables?.property_id === s.property_id}>
                        <Play className="fill-current" /> {s.status === 'showing' ? 'Resume' : 'Start Showing'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          )
        })}

        {available.length > 0 && (
          <NativeSelect
            aria-label="Add a home to this tour"
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              addStop.mutate(
                { property_id: e.target.value, scheduled_time: null, sequence_number: (stops.at(-1)?.sequence_number ?? 0) + 1 },
                { onError: (err) => toast.error(err.message) },
              )
            }}
          >
            <option value="">+ Add a home to this tour…</option>
            {available.map((p) => <option key={p.id} value={p.id}>{p.address_line1}, {p.city}</option>)}
          </NativeSelect>
        )}
      </div>
    </div>
  )
}

/** Google Calendar "create event" link spanning the tour (first stop → last stop + 45 min). */
function googleCalendarUrl(
  name: string,
  buyer: string,
  date: string,
  stops: { scheduled_time: string | null; properties: { address_line1: string; city: string } | null }[],
) {
  const d = date.replace(/-/g, '')
  const times = stops.map((s) => s.scheduled_time).filter((t): t is string => !!t).sort()
  const hhmm = (t: string, add = 0) => {
    const [h, m] = t.split(':').map(Number)
    const total = h! * 60 + m! + add
    return `${String(Math.floor(total / 60)).padStart(2, '0')}${String(total % 60).padStart(2, '0')}00`
  }
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + 1)
  const dates = times.length
    ? `${d}T${hhmm(times[0]!)}/${d}T${hhmm(times.at(-1)!, 45)}`
    : `${d}/${next.toISOString().slice(0, 10).replace(/-/g, '')}`
  const details = stops.map((s, i) => `${i + 1}. ${s.scheduled_time ? s.scheduled_time.slice(0, 5) + ' ' : ''}${s.properties?.address_line1 ?? ''}, ${s.properties?.city ?? ''}`).join('\n')
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${name} · ${buyer}`, dates, details, ctz: 'America/New_York' })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
