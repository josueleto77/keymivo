import { format, isPast, isToday } from 'date-fns'
import { CalendarDays, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { sortedStops, useTours, type TourWithStops } from '@/features/tours'
import { formatTime, fullName, parseDateOnly } from '@/lib/utils'

const STATUS_VARIANT = { planned: 'accent', active: 'warning', completed: 'success', cancelled: 'default' } as const

export function ToursPage() {
  const { data, isLoading, error, refetch } = useTours()
  const navigate = useNavigate()
  const upcoming = (data ?? []).filter((t) => {
    const d = parseDateOnly(t.tour_date)
    return t.status !== 'completed' && t.status !== 'cancelled' && (isToday(d) || !isPast(d))
  })
  const past = (data ?? []).filter((t) => !upcoming.includes(t)).reverse()

  return (
    <div>
      <PageHeader title="Tours" actions={<Button onClick={() => navigate('/tours/new')}><Plus /> Create Tour</Button>} />
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton count={3} />
      ) : !data?.length ? (
        <EmptyState
          icon={CalendarDays}
          title="No tours yet"
          description="Line up homes for a buyer, set times, and start each showing from the tour."
          action={<Button onClick={() => navigate('/tours/new')}>Create Tour</Button>}
        />
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming"><TourGrid tours={upcoming} empty="No upcoming tours." /></TabsContent>
          <TabsContent value="past"><TourGrid tours={past} empty="No past tours." /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function TourGrid({ tours, empty }: { tours: TourWithStops[]; empty: string }) {
  if (!tours.length) return <p className="text-sm text-muted">{empty}</p>
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tours.map((t) => {
        const stops = sortedStops(t)
        const d = parseDateOnly(t.tour_date)
        return (
          <Link key={t.id} to={`/tours/${t.id}`} className="rounded-2xl border bg-card p-5 shadow-card transition hover:shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="text-sm text-muted">
                  {fullName(t.clients)} · {isToday(d) ? 'Today' : format(d, 'MMMM d')} · {stops.length} Home{stops.length === 1 ? '' : 's'}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[t.status as keyof typeof STATUS_VARIANT]}>{t.status}</Badge>
            </div>
            <ul className="mt-4 space-y-2 border-t pt-4">
              {stops.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 font-medium tabular-nums text-slate-600">{formatTime(s.scheduled_time) || `#${s.sequence_number}`}</span>
                  <span className={s.status === 'completed' ? 'text-muted line-through' : ''}>{s.properties?.address_line1}</span>
                </li>
              ))}
            </ul>
          </Link>
        )
      })}
    </div>
  )
}
