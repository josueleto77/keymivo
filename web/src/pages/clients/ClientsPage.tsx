import { formatDistanceToNow } from 'date-fns'
import { LayoutGrid, List, Plus, Search, UserPlus } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { clientMetrics, useClients, type ClientListItem } from '@/features/clients'
import { CLIENT_STATUSES, labelFor } from '@/lib/constants'
import { cn, formatBudget, fullName } from '@/lib/utils'

const READINESS = { high: 'success', medium: 'warning', low: 'default' } as const

function readViewPref(): 'grid' | 'list' {
  try {
    return localStorage.getItem('clients-view') === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function ClientsPage() {
  const { data, isLoading, error, refetch } = useClients()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState<string>('all')
  const [view, setView] = React.useState<'grid' | 'list'>(readViewPref)

  React.useEffect(() => {
    try { localStorage.setItem('clients-view', view) } catch { /* storage unavailable */ }
  }, [view])

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (!term) return true
      return [fullName(c), c.email, c.phone, ...c.target_areas, ...c.client_members.map((m) => m.first_name)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(term))
    })
  }, [data, q, status])

  const counts = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of data ?? []) m[c.status] = (m[c.status] ?? 0) + 1
    return m
  }, [data])

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={data ? `${data.length} buyer${data.length === 1 ? '' : 's'}` : undefined}
        actions={<Button onClick={() => navigate('/clients/new')}><Plus /> Add Buyer</Button>}
      />

      {data && data.length > 0 && (
        <>
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, area…" className="pl-9" aria-label="Search clients" />
            </div>
            <div className="hidden rounded-xl border bg-card p-1 sm:flex">
              {(['grid', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('grid size-8 place-items-center rounded-lg text-muted', view === v && 'bg-subtle text-foreground')}
                  aria-label={`${v} view`}
                >
                  {v === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
            {[{ value: 'all', label: 'All' }, ...CLIENT_STATUSES].map((s) => {
              const n = s.value === 'all' ? data.length : counts[s.value] ?? 0
              return (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    status === s.value ? 'border-primary bg-primary text-white' : 'bg-card text-slate-600 hover:bg-subtle',
                  )}
                >
                  {s.label} <span className="opacity-60">{n}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton />
      ) : !data?.length ? (
        <EmptyState
          icon={UserPlus}
          title="No clients yet"
          description="Add your first buyer and Keymivo will start learning what they're looking for."
          action={<Button onClick={() => navigate('/clients/new')}>Add Buyer</Button>}
        />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No clients match your filters.</p>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => <ClientCard key={c.id} c={c} />)}
        </div>
      ) : (
        <ClientTable clients={filtered} />
      )}
    </div>
  )
}

function ClientCard({ c }: { c: ClientListItem }) {
  const m = clientMetrics(c)
  return (
    <Link to={`/clients/${c.id}`} className="group rounded-2xl border bg-card p-5 shadow-card transition hover:shadow-lift">
      <div className="flex items-start gap-3">
        <InitialsAvatar name={fullName(c)} className="size-12" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{fullName(c)}</h3>
          <p className="text-sm text-muted">{formatBudget(c.target_price_min, c.target_price_max)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge variant="accent">{labelFor(CLIENT_STATUSES, c.status)}</Badge>
            {c.is_demo && <DemoBadge />}
          </div>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Target area</dt>
          <dd className="truncate font-medium">{c.target_areas[0] ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Homes toured</dt>
          <dd className="font-medium">{m.homesToured}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Current favorite</dt>
          <dd className="truncate font-medium">{m.favorite?.address ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Offer readiness</dt>
          <dd><Badge variant={READINESS[c.offer_readiness as keyof typeof READINESS]}>{c.offer_readiness.toUpperCase()}</Badge></dd>
        </div>
      </dl>
      <p className="mt-4 border-t pt-3 text-xs text-muted">
        Last activity {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
      </p>
    </Link>
  )
}

function ClientTable({ clients }: { clients: ClientListItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-subtle/50 text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Buyer</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Budget</th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">Toured</th>
            <th className="hidden px-4 py-3 font-medium lg:table-cell">Favorite</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Readiness</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clients.map((c) => {
            const m = clientMetrics(c)
            return (
              <tr key={c.id} className="hover:bg-subtle/40">
                <td className="px-4 py-3">
                  <Link to={`/clients/${c.id}`} className="flex items-center gap-3 font-semibold">
                    <InitialsAvatar name={fullName(c)} className="size-8 text-xs" />
                    {fullName(c)} {c.is_demo && <DemoBadge />}
                  </Link>
                </td>
                <td className="px-4 py-3"><Badge variant="accent">{labelFor(CLIENT_STATUSES, c.status)}</Badge></td>
                <td className="hidden px-4 py-3 md:table-cell">{formatBudget(c.target_price_min, c.target_price_max)}</td>
                <td className="hidden px-4 py-3 lg:table-cell">{m.homesToured}</td>
                <td className="hidden px-4 py-3 lg:table-cell">{m.favorite?.address ?? '—'}</td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <Badge variant={READINESS[c.offer_readiness as keyof typeof READINESS]}>{c.offer_readiness.toUpperCase()}</Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
