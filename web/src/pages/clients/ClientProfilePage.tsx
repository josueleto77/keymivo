import { format, formatDistanceToNow } from 'date-fns'
import { ArrowLeft, CalendarPlus, GitCompareArrows, Handshake, Pencil, Play, Plus, Trash2, X } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BuyerIntelligencePanel } from '@/components/BuyerIntelligencePanel'
import { MortgageCalculator } from '@/components/MortgageCalculator'
import { PortalInviteButton, PortalSharesCard } from '@/components/PortalAccess'
import { PreferenceManager } from '@/components/PreferenceManager'
import { PropertyImage } from '@/components/PropertyImage'
import { StartShowingDialog } from '@/components/StartShowingDialog'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { ScorePill } from '@/components/ui/score-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useAddMember, useClient, useClientActivity, useClientScores, useClientShowings, useDeleteClient, useRemoveMember,
  useUpdateClient,
} from '@/features/clients'
import { useClientIntelligence } from '@/features/intelligence'
import { useTours } from '@/features/tours'
import { CLIENT_STATUSES, LOAN_TYPES, PREAPPROVAL_STATUSES, REACTIONS, labelFor } from '@/lib/constants'
import { groupPreferences } from '@/lib/preferences'
import { cn, formatBudget, formatPrice, fullName, parseDateOnly } from '@/lib/utils'

export function ClientProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: client, isLoading, error, refetch } = useClient(id)
  const scores = useClientScores(id)
  const showings = useClientShowings(id)
  const update = useUpdateClient(id ?? '')
  const del = useDeleteClient()
  const [startOpen, setStartOpen] = React.useState(false)

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (error || !client) return <ErrorState message={(error as Error)?.message ?? 'Client not found'} onRetry={() => refetch()} />

  const completed = (showings.data ?? []).filter((s) => s.status === 'completed')
  const homesToured = new Set(completed.map((s) => s.property_id)).size
  const ranked = scores.data ?? []
  const prefs = groupPreferences(client.client_preferences)

  async function onDelete() {
    if (!confirm(`Delete ${fullName(client)} and all their tours, showings and notes? This cannot be undone.`)) return
    try {
      await del.mutateAsync(client!.id)
      toast.success('Client deleted')
      navigate('/clients')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Clients
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <InitialsAvatar name={fullName(client)} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{fullName(client)}</h1>
            {client.is_demo && <DemoBadge />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              Status:
              <NativeSelect
                aria-label="Status"
                value={client.status}
                onChange={(e) => update.mutate({ status: e.target.value })}
                className="h-7 w-auto rounded-lg py-0 pl-2 pr-7 text-xs font-semibold"
              >
                {CLIENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect>
            </span>
            <span>Budget: <b className="text-foreground">{formatBudget(client.target_price_min, client.target_price_max)}</b></span>
            {client.target_areas.length > 0 && <span>Target: <b className="text-foreground">{client.target_areas.join(', ')}</b></span>}
            {client.preapproval_amount != null && <span>Preapproval: <b className="text-foreground">{formatPrice(client.preapproval_amount)}</b></span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={() => setStartOpen(true)}><Play className="fill-current" /> Start Showing</Button>
          <Button variant="outline" size="icon" asChild aria-label="Edit"><Link to={`/clients/${client.id}/edit`}><Pencil /></Link></Button>
          <Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete"><Trash2 /></Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          {['Overview', 'Intelligence', 'Preferences', 'Properties', 'Tours', 'Compare', 'Finances', 'Offers', 'Activity'].map((t) => (
            <TabsTrigger key={t} value={t.toLowerCase()}>{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Buyer journey</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Homes toured" value={homesToured} />
                  <Stat label="Offer readiness" value={client.offer_readiness.toUpperCase()} />
                  <Stat label="Favorite" value={ranked[0] ? `${ranked[0].overall_score}/100` : '—'} sub={ranked[0]?.properties?.address_line1} />
                  <Stat label="Runner-up" value={ranked[1] ? `${ranked[1].overall_score}/100` : '—'} sub={ranked[1]?.properties?.address_line1} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ChipList title="Strongest priorities" items={prefs.mustHave.slice(0, 5).map((p) => p.value)} tone="success" />
                  <ChipList title="Biggest concerns" items={[...prefs.dealBreakers, ...prefs.dislikes].slice(0, 5).map((p) => p.value)} tone="warning" />
                </div>
                <LearnedSnippet clientId={client.id} />
              </CardContent>
            </Card>
            <HouseholdCard clientId={client.id} members={client.client_members} />
          </div>
        </TabsContent>

        <TabsContent value="intelligence">
          <BuyerIntelligencePanel clientId={client.id} preferences={client.client_preferences} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferenceManager clientId={client.id} preferences={client.client_preferences} />
        </TabsContent>

        <TabsContent value="properties" className="space-y-6">
          <PortalSharesCard clientId={client.id} />
          {ranked.length === 0 ? (
            <EmptyState icon={Plus} title="No scored properties yet" description="Properties get a Buyer Match score for this client once they're toured." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ranked.map((s, i) =>
                s.properties ? (
                  <Link key={s.id} to={`/properties/${s.properties.id}`} className="overflow-hidden rounded-2xl border bg-card shadow-card transition hover:shadow-lift">
                    <PropertyImage path={s.properties.primary_photo} seed={s.properties.id} className="h-36">
                      <ScorePill score={s.overall_score} className="absolute right-3 top-3" />
                      <span className="absolute left-3 top-3 rounded-full bg-primary/85 px-2 py-0.5 text-xs font-bold text-white">#{i + 1}</span>
                    </PropertyImage>
                    <div className="p-4">
                      <div className="font-semibold">{s.properties.address_line1}</div>
                      <div className="text-sm text-muted">{s.properties.city}, {s.properties.state} · {formatPrice(s.properties.listing_price)}</div>
                    </div>
                  </Link>
                ) : null,
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tours">
          <ClientTours clientId={client.id} />
        </TabsContent>

        <TabsContent value="compare">
          <EmptyState
            icon={GitCompareArrows}
            title="Compare this buyer's homes"
            description="Side-by-side Buyer Score, monthly cost, must-haves and reactions — with Best Match, Best Value and Lowest Monthly Cost highlighted."
            action={<Button asChild><Link to={`/compare?client=${client.id}`}>Open comparison</Link></Button>}
          />
        </TabsContent>

        <TabsContent value="finances">
          <Card>
            <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Budget" value={formatBudget(client.target_price_min, client.target_price_max)} />
              <Info label="Preapproval" value={formatPrice(client.preapproval_amount)} />
              <Info label="Preapproval status" value={labelFor(PREAPPROVAL_STATUSES, client.preapproval_status)} />
              <Info label="Lender" value={client.lender_name ?? '—'} />
              <Info label="Loan type" value={labelFor(LOAN_TYPES, client.loan_type)} />
              <Info label="Down payment" value={formatPrice(client.down_payment_amount)} />
              <Info label="Monthly payment comfort" value={formatPrice(client.preferred_monthly_payment)} />
              <Info label="Timeline" value={client.buying_timeline ?? '—'} />
            </CardContent>
          </Card>
          <div className="mt-6">
            <MortgageCalculator
              price={client.target_price_max ?? client.preapproval_amount}
              downPayment={client.down_payment_amount}
              clientId={client.id}
            />
          </div>
        </TabsContent>

        <TabsContent value="offers">
          <EmptyState icon={Handshake} title="No offer analyses yet" description="Offer analysis (Conservative / Competitive / Strong scenarios) arrives in a later build phase." />
        </TabsContent>

        <TabsContent value="activity">
          <ClientActivity clientId={client.id} showings={showings.data ?? []} />
        </TabsContent>
      </Tabs>

      <StartShowingDialog open={startOpen} onOpenChange={setStartOpen} defaultClientId={client.id} />
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-display text-xl font-bold">{value}</div>
      {sub && <div className="truncate text-xs text-muted">{sub}</div>}
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

function ChipList({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'warning' }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => <Badge key={i} variant={tone}>{i}</Badge>)}
        </div>
      ) : (
        <p className="text-sm text-muted">—</p>
      )}
    </div>
  )
}

function HouseholdCard({ clientId, members }: { clientId: string; members: { id: string; first_name: string; last_name: string | null; email: string | null; user_id: string | null }[] }) {
  const add = useAddMember(clientId)
  const remove = useRemoveMember(clientId)
  const [name, setName] = React.useState('')
  return (
    <Card>
      <CardHeader><CardTitle>Household</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {members.length === 0 && <p className="text-sm text-muted">Add each buyer to track individual reactions.</p>}
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <InitialsAvatar name={fullName(m)} className="size-9 text-xs" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{fullName(m)}</div>
              {m.email && <div className="truncate text-xs text-muted">{m.email}</div>}
            </div>
            <PortalInviteButton member={m} />
            <button onClick={() => remove.mutate(m.id)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-subtle" aria-label={`Remove ${m.first_name}`}>
              <X className="size-4" />
            </button>
          </div>
        ))}
        <form
          className="flex gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault()
            const [first, ...rest] = name.trim().split(/\s+/)
            if (!first) return
            add.mutate({ first_name: first, last_name: rest.join(' ') || null }, { onSuccess: () => setName('') })
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add buyer name" aria-label="Buyer name" className="h-9" />
          <Button size="sm" variant="outline" type="submit" className="h-9" loading={add.isPending}>Add</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ClientTours({ clientId }: { clientId: string }) {
  const tours = useTours()
  const navigate = useNavigate()
  const mine = (tours.data ?? []).filter((t) => t.client_id === clientId)
  if (tours.isLoading) return <Skeleton className="h-32 w-full" />
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate(`/tours/new?client=${clientId}`)}><CalendarPlus /> Create Tour</Button>
      </div>
      {mine.length === 0 ? (
        <EmptyState icon={CalendarPlus} title="No tours yet" description="Plan a tour to line up homes for this buyer." />
      ) : (
        mine.map((t) => (
          <Link key={t.id} to={`/tours/${t.id}`} className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-card hover:shadow-lift">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-muted">{format(parseDateOnly(t.tour_date), 'EEEE, MMMM d')} · {t.tour_properties.length} homes</div>
            </div>
            <Badge variant={t.status === 'completed' ? 'success' : 'accent'}>{t.status}</Badge>
          </Link>
        ))
      )}
    </div>
  )
}

function ClientActivity({ clientId, showings }: { clientId: string; showings: ReturnType<typeof useClientShowings>['data'] & {} }) {
  const reactions = useClientActivity(clientId)
  const events = [
    ...showings.map((s) => ({
      id: s.id,
      at: s.started_at,
      text: `${s.status === 'completed' ? 'Toured' : s.status === 'active' ? 'Showing in progress at' : 'Showing'} ${s.properties?.address_line1 ?? ''}`,
      link: s.status === 'active' ? `/showings/${s.id}` : `/showings/${s.id}/complete`,
    })),
    ...(reactions.data ?? []).map((r) => ({
      id: r.id,
      at: r.created_at,
      text: `${REACTIONS.find((x) => x.value === r.reaction)?.emoji ?? ''} ${labelFor(REACTIONS, r.reaction)} — ${r.feature} at ${r.properties?.address_line1 ?? ''}`,
      link: null as string | null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  if (!events.length) return <p className="text-sm text-muted">No activity yet.</p>
  return (
    <Card>
      <CardContent>
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-4 text-sm">
              {e.link ? <Link to={e.link} className={cn('font-medium hover:underline')}>{e.text}</Link> : <span>{e.text}</span>}
              <span className="shrink-0 text-xs text-muted">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function LearnedSnippet({ clientId }: { clientId: string }) {
  const { data } = useClientIntelligence(clientId)
  if (!data?.learning) {
    return (
      <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-slate-600">
        Keymivo will summarize what it learns about this buyer after their first analyzed showing.
      </p>
    )
  }
  return (
    <div className="rounded-xl bg-blue-50/60 px-4 py-3 text-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">What we've learned</div>
      {data.learning.content}
      {data.suggestions.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-secondary">
          {data.suggestions.length} preference suggestion{data.suggestions.length === 1 ? '' : 's'} to review in the Intelligence tab.
        </p>
      )}
    </div>
  )
}
