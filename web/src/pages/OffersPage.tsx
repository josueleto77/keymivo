import * as React from 'react'
import { NewOfferButton, OffersEmpty, OffersList } from '@/components/OffersList'
import { ErrorState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { useOffers } from '@/features/offers'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: 'open', label: 'In progress', statuses: ['considering', 'preparing', 'submitted'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { key: 'closed', label: 'Rejected / Withdrawn', statuses: ['rejected', 'withdrawn'] },
  { key: 'all', label: 'All', statuses: null },
] as const

export function OffersPage() {
  const { data, isLoading, error, refetch } = useOffers()
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]['key']>('open')
  const f = FILTERS.find((x) => x.key === filter)!
  const rows = (data ?? []).filter((o) => !f.statuses || (f.statuses as readonly string[]).includes(o.status))

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="Offer analysis preparation — informational only, never a legally binding contract."
        actions={<NewOfferButton />}
      />
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardGridSkeleton count={3} />
      ) : !data?.length ? (
        <OffersEmpty />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((x) => {
              const n = (data ?? []).filter((o) => !x.statuses || (x.statuses as readonly string[]).includes(o.status)).length
              return (
                <button
                  key={x.key}
                  onClick={() => setFilter(x.key)}
                  className={cn('rounded-full border px-3 py-1.5 text-sm transition', filter === x.key ? 'border-primary bg-primary text-white' : 'bg-card hover:bg-subtle')}
                >
                  {x.label} ({n})
                </button>
              )
            })}
          </div>
          {rows.length ? <OffersList offers={rows} /> : <p className="text-sm text-muted">Nothing here.</p>}
        </div>
      )}
    </div>
  )
}
