import { CalendarPlus, GitCompareArrows, Home, Plus, Search } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PropertyImage } from '@/components/PropertyImage'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { ScorePill } from '@/components/ui/score-ring'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { bestScore, useProperties } from '@/features/properties'
import { PROPERTY_STATUSES, labelFor } from '@/lib/constants'
import { formatNumber, formatPrice } from '@/lib/utils'

export function PropertiesPage() {
  const { data, isLoading, error, refetch } = useProperties()
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const filtered = (data ?? []).filter((p) =>
    `${p.address_line1} ${p.city} ${p.zip_code ?? ''} ${p.mls_number ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()),
  )

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={data ? `${data.length} home${data.length === 1 ? '' : 's'}` : undefined}
        actions={<Button onClick={() => navigate('/properties/new')}><Plus /> Add Property</Button>}
      />
      {data && data.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address, city, ZIP, MLS #" className="pl-9" aria-label="Search properties" />
        </div>
      )}
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton />
      ) : !data?.length ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Add the homes your buyers are considering. Manual entry for now — MLS and public-record providers plug in later."
          action={<Button onClick={() => navigate('/properties/new')}>Add Property</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const best = bestScore(p)
            return (
              <div key={p.id} className="overflow-hidden rounded-2xl border bg-card shadow-card transition hover:shadow-lift">
                <Link to={`/properties/${p.id}`}>
                  <PropertyImage path={p.primary_photo} seed={p.id} className="aspect-[16/10]">
                    <ScorePill score={best?.overall_score} className="absolute right-3 top-3" />
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      {p.is_demo && <DemoBadge />}
                      {p.status !== 'active' && <Badge variant="dark">{labelFor(PROPERTY_STATUSES, p.status)}</Badge>}
                    </div>
                  </PropertyImage>
                </Link>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/properties/${p.id}`} className="min-w-0">
                      <h3 className="truncate font-semibold">{p.address_line1}</h3>
                      <p className="text-sm text-muted">{p.city}, {p.state}</p>
                    </Link>
                    <div className="font-display text-lg font-bold">{formatPrice(p.listing_price)}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {p.beds ?? '—'} BD · {p.baths ?? '—'} BA · {formatNumber(p.square_feet)} SQ FT
                  </p>
                  {best?.clients && (
                    <p className="mt-1 text-xs text-muted">
                      Buyer score for {best.clients.first_name}: <b>{best.overall_score}/100</b>
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button size="sm" variant="outline" asChild><Link to={`/properties/${p.id}`}>View</Link></Button>
                    <Button size="sm" variant="outline" asChild><Link to={`/tours/new?property=${p.id}`}><CalendarPlus /> Tour</Link></Button>
                    <Button size="sm" variant="outline" asChild><Link to={best?.client_id ? `/compare?client=${best.client_id}` : `/compare?p=${p.id}`}><GitCompareArrows /> Compare</Link></Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
