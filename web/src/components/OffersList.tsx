import { formatDistanceToNow } from 'date-fns'
import { Handshake, Plus, Sparkles } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PropertyImage } from '@/components/PropertyImage'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useClients } from '@/features/clients'
import { SCENARIO_LABEL, useCreateOffer, type OfferListItem, type ScenarioKey } from '@/features/offers'
import { useProperties } from '@/features/properties'
import { OFFER_STATUSES } from '@/lib/constants'
import { formatPrice, fullName } from '@/lib/utils'

export function OfferStatusBadge({ status }: { status: string }) {
  const s = OFFER_STATUSES.find((x) => x.value === status)
  return <Badge variant={s?.tone ?? 'default'}>{s?.label ?? status}</Badge>
}

/** Offer analyses as cards. `show` hides the column that is implied by the page (client or property). */
export function OffersList({ offers, show = 'both' }: { offers: OfferListItem[]; show?: 'both' | 'client' | 'property' }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((o) => (
        <Link key={o.id} to={`/offers/${o.id}`} className="overflow-hidden rounded-2xl border bg-card shadow-card transition hover:shadow-lift">
          {show !== 'client' && (
            <PropertyImage path={o.properties?.primary_photo} seed={o.property_id} className="h-28">
              <div className="absolute left-3 top-3 flex gap-1.5">
                <OfferStatusBadge status={o.status} />
                {o.properties?.is_demo && <DemoBadge />}
              </div>
            </PropertyImage>
          )}
          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {show !== 'client' ? (
                  <>
                    <div className="truncate font-semibold">{o.properties?.address_line1}</div>
                    <div className="truncate text-sm text-muted">{o.properties?.city}, {o.properties?.state}{show === 'both' ? ` · ${fullName(o.clients)}` : ''}</div>
                  </>
                ) : (
                  <div className="font-semibold">{fullName(o.clients)}</div>
                )}
              </div>
              {show === 'client' && <OfferStatusBadge status={o.status} />}
            </div>
            <div className="flex items-end justify-between gap-2 border-t pt-2 text-sm">
              <div>
                <div className="text-xs text-muted">Potential price</div>
                <div className="font-semibold tabular-nums">{formatPrice(o.potential_price)}</div>
              </div>
              <div className="text-right text-xs text-muted">
                {o.selected_scenario ? <div className="font-medium text-slate-700">{SCENARIO_LABEL[o.selected_scenario as ScenarioKey]}</div> : <div>Not analyzed</div>}
                <div>Asking {formatPrice(o.properties?.listing_price)}</div>
              </div>
            </div>
            <div className="text-xs text-muted">Updated {formatDistanceToNow(new Date(o.updated_at), { addSuffix: true })}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

/** "Create Offer Analysis" — pick buyer + home (either can be fixed by the page). Reuses an open analysis for the same pair. */
export function NewOfferButton({ clientId, propertyId, label = 'Create Offer Analysis', variant }: {
  clientId?: string; propertyId?: string; label?: string; variant?: 'outline' | 'default'
}) {
  const [open, setOpen] = React.useState(false)
  const [client, setClient] = React.useState(clientId ?? '')
  const [property, setProperty] = React.useState(propertyId ?? '')
  const clients = useClients()
  const properties = useProperties()
  const create = useCreateOffer()
  const navigate = useNavigate()

  function start() {
    if (clientId && propertyId) return submit(clientId, propertyId)
    setClient(clientId ?? '')
    setProperty(propertyId ?? '')
    setOpen(true)
  }
  function submit(c: string, p: string) {
    create.mutate({ client_id: c, property_id: p }, {
      onSuccess: (o) => { setOpen(false); navigate(`/offers/${o.id}`) },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <>
      <Button variant={variant} onClick={start} loading={create.isPending && !open}><Plus /> {label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New offer analysis" description="Prepare Conservative, Competitive and Strong scenarios for one buyer and one home.">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (client && property) submit(client, property) }}>
            {!clientId && (
              <Field label="Buyer" htmlFor="offer-client">
                <NativeSelect id="offer-client" value={client} onChange={(e) => setClient(e.target.value)}>
                  <option value="">Select a buyer…</option>
                  {(clients.data ?? []).filter((c) => !['closed', 'paused'].includes(c.status)).map((c) => (
                    <option key={c.id} value={c.id}>{fullName(c)}</option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {!propertyId && (
              <Field label="Home" htmlFor="offer-property">
                <NativeSelect id="offer-property" value={property} onChange={(e) => setProperty(e.target.value)}>
                  <option value="">Select a home…</option>
                  {(properties.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.address_line1}, {p.city} · {formatPrice(p.listing_price)}</option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Button type="submit" className="w-full" loading={create.isPending} disabled={!client || !property}>
              <Sparkles /> Start analysis
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function OffersEmpty({ clientId, propertyId }: { clientId?: string; propertyId?: string }) {
  return (
    <EmptyState
      icon={Handshake}
      title="No offer analyses yet"
      description="When a buyer is ready, compare Conservative, Competitive and Strong offers — with payments, cash to close and risks. Informational only, never a contract."
      action={<NewOfferButton clientId={clientId} propertyId={propertyId} />}
    />
  )
}
