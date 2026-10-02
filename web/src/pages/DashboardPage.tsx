import { CalendarClock, CheckSquare, Flame, Handshake, Play, Sparkles, UserPlus, Users } from 'lucide-react'
import { format } from 'date-fns'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { ActivityFeed } from '@/components/ActivityFeed'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { clientMetrics } from '@/features/clients'
import { useDashboard } from '@/features/dashboard'
import { useStartShowing } from '@/features/showings'
import { supabase } from '@/lib/supabase'
import { cn, formatTime, fullName } from '@/lib/utils'
import { useSession } from '@/providers/AuthProvider'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const READINESS_TONE = { high: 'success', medium: 'warning', low: 'default' } as const

export function DashboardPage() {
  const { profile } = useSession()
  const { data, isLoading, error, refetch } = useDashboard()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const start = useStartShowing()
  const [seeding, setSeeding] = React.useState(false)

  const todayISO = format(new Date(), 'yyyy-MM-dd')
  const schedule = React.useMemo(
    () =>
      (data?.todaysTours ?? [])
        .flatMap((t) => t.tour_properties.map((tp) => ({ ...tp, tour: t })))
        .sort((a, b) => (a.scheduled_time ?? '99').localeCompare(b.scheduled_time ?? '99')),
    [data],
  )
  const hotBuyers = React.useMemo(
    () =>
      (data?.clients ?? [])
        .map((c) => ({ c, m: clientMetrics(c) }))
        .filter(({ c, m }) => c.offer_readiness !== 'low' || (m.favorite?.score ?? 0) >= 85)
        .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.c.offer_readiness as 'high'] - ({ high: 0, medium: 1, low: 2 })[b.c.offer_readiness as 'high'])
        .slice(0, 4),
    [data],
  )

  async function loadDemo() {
    setSeeding(true)
    const { error } = await supabase.rpc('seed_demo_data')
    setSeeding(false)
    if (error) return toast.error(error.message)
    toast.success('Demo workspace loaded')
    qc.invalidateQueries()
  }

  async function startStop(clientId: string, propertyId: string, tourId: string) {
    try {
      const s = await start.mutateAsync({ client_id: clientId, property_id: propertyId, tour_id: tourId })
      navigate(`/showings/${s.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const stats = [
    { label: 'Active Buyers', value: data?.clients.length, icon: Users, to: '/clients' },
    { label: "Today's Showings", value: schedule.length, icon: CalendarClock, to: '/tours' },
    { label: 'Offers in Progress', value: data?.offersInProgress, icon: Handshake, to: '/offers' },
    {
      label: 'Tasks Due',
      value: data?.tasks.filter((t) => !t.due_date || t.due_date <= todayISO).length,
      icon: CheckSquare,
      to: '/tasks',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {greeting()}, {profile.first_name}.
        </h1>
        <p className="mt-1.5 text-muted">Here's what needs your attention today.</p>
      </div>

      {error && <ErrorState message={(error as Error).message} onRetry={() => refetch()} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="rounded-2xl border bg-card p-4 shadow-card transition hover:shadow-lift sm:p-5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-xs font-medium sm:text-sm">{s.label}</span>
              <s.icon className="size-4" />
            </div>
            {isLoading ? <Skeleton className="mt-3 h-8 w-12" /> : <div className="mt-2 font-display text-3xl font-bold">{s.value ?? 0}</div>}
          </Link>
        ))}
      </div>

      {!isLoading && data && data.clients.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={UserPlus}
            title="No clients yet"
            description="Add your first buyer and Keymivo will start learning what they're looking for."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate('/clients/new')}>Add Buyer</Button>
                <Button variant="outline" onClick={loadDemo} loading={seeding}><Sparkles /> Load demo workspace</Button>
              </div>
            }
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <Link to="/tours" className="text-xs font-semibold text-accent">All tours</Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={3} />
              ) : schedule.length === 0 ? (
                <p className="text-sm text-muted">No showings scheduled for today. <Link to="/tours/new" className="font-semibold text-accent">Plan a tour</Link></p>
              ) : (
                <ul className="divide-y">
                  {schedule.map((s) => (
                    <li key={s.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                      <div className="w-20 shrink-0 font-display text-sm font-semibold">{formatTime(s.scheduled_time) || '—'}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{s.properties?.address_line1}</div>
                        <div className="truncate text-sm text-muted">{fullName(s.tour.clients)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild><Link to={`/properties/${s.property_id}`}>View Property</Link></Button>
                        {s.status === 'completed' ? (
                          <Badge variant="success">Completed</Badge>
                        ) : (
                          <Button size="sm" variant="accent" onClick={() => startStop(s.tour.client_id, s.property_id, s.tour.id)}>
                            <Play className="fill-current" /> {s.status === 'showing' ? 'Resume' : 'Start Showing'}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Flame className="size-4 text-warning" /> Hot Buyers</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={2} />
              ) : hotBuyers.length === 0 ? (
                <p className="text-sm text-muted">Buyers who look ready to make an offer will show up here as you tour homes.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {hotBuyers.map(({ c, m }) => (
                    <Link key={c.id} to={`/clients/${c.id}`} className="rounded-xl border p-4 transition hover:bg-subtle/60">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={fullName(c)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 truncate font-semibold">{c.first_name} {c.is_demo && <DemoBadge />}</div>
                          <div className="text-xs text-muted">Homes toured: {m.homesToured}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted">Offer readiness</span>
                        <Badge variant={READINESS_TONE[c.offer_readiness as keyof typeof READINESS_TONE]}>{c.offer_readiness.toUpperCase()}</Badge>
                      </div>
                      {m.favorite && (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-muted">Current favorite</span>
                          <span className="truncate pl-2 font-medium">{m.favorite.address}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <Link to="/tasks" className="text-xs font-semibold text-accent">View all</Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton rows={3} />
              ) : !data?.tasks.length ? (
                <p className="text-sm text-muted">You're all caught up.</p>
              ) : (
                <ul className="space-y-3">
                  {data.tasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-start gap-3">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', t.priority === 'high' || t.priority === 'urgent' ? 'bg-danger' : t.priority === 'medium' ? 'bg-warning' : 'bg-slate-300')} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="truncate text-xs text-muted">
                          {[t.properties?.address_line1, t.clients ? fullName(t.clients) : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <ListSkeleton rows={4} /> : <ActivityFeed logs={data?.activity ?? []} reactions={data?.reactions ?? []} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
