import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, CalendarPlus, Camera, Handshake, MapPin, Pencil, Play, Star, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { HouseholdOpinions } from '@/components/HouseholdOpinions'
import { MortgageCalculator } from '@/components/MortgageCalculator'
import { PropertyMap } from '@/components/PropertyMap'
import { PropertyImage, useSignedUrl } from '@/components/PropertyImage'
import { StartShowingDialog } from '@/components/StartShowingDialog'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { ScoreRing } from '@/components/ui/score-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePropertyRatings } from '@/features/portal'
import { splitPhotoUrl, uploadPropertyPhoto, useDeleteProperty, useProperty, usePropertyShowings, useUpdateProperty } from '@/features/properties'
import { PROPERTY_STATUSES, PROPERTY_TYPES, REACTIONS, labelFor } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert, PropertyPhoto } from '@/lib/types'
import { cn, formatNumber, formatPrice, fullName, pricePerSqft, scoreLabel, scoreTone } from '@/lib/utils'
import { useSession } from '@/providers/AuthProvider'

type PropertyDetail = NonNullable<ReturnType<typeof useProperty>['data']>

export function PropertyProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: p, isLoading, error, refetch } = useProperty(id)
  const del = useDeleteProperty()
  const [startOpen, setStartOpen] = React.useState(false)
  const [scoreClientId, setScoreClientId] = React.useState<string | null>(null)

  if (isLoading) return <Skeleton className="h-80 w-full" />
  if (error || !p) return <ErrorState message={(error as Error)?.message ?? 'Property not found'} onRetry={() => refetch()} />

  const scores = [...p.property_scores].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
  const score = scores.find((s) => s.client_id === scoreClientId) ?? scores[0]

  async function onDelete() {
    if (!confirm(`Delete ${p!.address_line1}? Showings and notes for this home will also be deleted.`)) return
    try {
      await del.mutateAsync(p!.id)
      toast.success('Property deleted')
      navigate('/properties')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div>
      <Link to="/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Properties
      </Link>

      <PropertyImage path={p.primary_photo} seed={p.id} className="-mx-4 aspect-[16/9] max-h-[420px] w-[calc(100%+2rem)] sm:mx-0 sm:w-full sm:rounded-3xl">
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5 pt-16 text-white sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            {p.is_demo && <DemoBadge />}
            <Badge variant="dark" className="bg-white/20 backdrop-blur">{labelFor(PROPERTY_STATUSES, p.status)}</Badge>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{p.address_line1}</h1>
          <p className="text-white/85">{p.city}, {p.state} {p.zip_code}</p>
        </div>
      </PropertyImage>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="font-display text-3xl font-bold">{formatPrice(p.listing_price)}</span>
          <span className="text-slate-600">{p.beds ?? '—'} beds · {p.baths ?? '—'} baths · {formatNumber(p.square_feet)} sq ft</span>
          {score?.overall_score != null && (
            <span className={cn('font-semibold', scoreTone(score.overall_score))}>Match: {score.overall_score}/100</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="accent" onClick={() => setStartOpen(true)}><Play className="fill-current" /> Start Showing</Button>
          <Button variant="outline" asChild><Link to={`/tours/new?property=${p.id}`}><CalendarPlus /> Add to Tour</Link></Button>
          <Button variant="outline" size="icon" asChild aria-label="Edit"><Link to={`/properties/${p.id}/edit`}><Pencil /></Link></Button>
          <Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete"><Trash2 /></Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          {['Overview', 'Buyer Match', 'Tour Notes', 'Financials', 'Property Intel', 'Photos', 'Offers'].map((t) => (
            <TabsTrigger key={t} value={t.toLowerCase().replace(' ', '-')}>{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                <Info label="Listing price" value={formatPrice(p.listing_price)} />
                <Info label="Price / sq ft" value={pricePerSqft(p.listing_price, p.square_feet) ? `$${pricePerSqft(p.listing_price, p.square_feet)}` : '—'} />
                <Info label="Annual taxes" value={formatPrice(p.property_tax)} />
                <Info label="HOA" value={p.hoa_fee ? `${formatPrice(p.hoa_fee)}/mo` : 'None'} />
                <Info label="Year built" value={p.year_built?.toString() ?? '—'} />
                <Info label="Lot size" value={p.lot_size ?? '—'} />
                <Info label="Square footage" value={formatNumber(p.square_feet)} />
                <Info label="Property type" value={labelFor(PROPERTY_TYPES, p.property_type)} />
                <Info label="Days on market" value={p.days_on_market?.toString() ?? '—'} />
                <Info label="Listing agent" value={p.listing_agent_name ?? '—'} />
                <Info label="Listing brokerage" value={p.listing_brokerage ?? '—'} />
                <Info label="MLS #" value={p.mls_number ?? '—'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-4" /> Location</CardTitle></CardHeader>
              <CardContent>
                <PropertyMap p={p} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="buyer-match">
          {!score ? (
            <EmptyState icon={Star} title="No Buyer Match yet" description="A Buyer Match score is generated for each client after they tour this home and Keymivo analyzes the showing." />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col items-center py-8 text-center">
                  {scores.length > 1 && (
                    <NativeSelect aria-label="Buyer" value={score.client_id} onChange={(e) => setScoreClientId(e.target.value)} className="mb-5 w-auto">
                      {scores.map((s) => <option key={s.client_id} value={s.client_id}>{fullName(s.clients)}</option>)}
                    </NativeSelect>
                  )}
                  <ScoreRing score={score.overall_score ?? 0} size={150} />
                  <div className={cn('mt-3 font-display text-lg font-bold', scoreTone(score.overall_score))}>{scoreLabel(score.overall_score ?? 0)}</div>
                  <div className="text-sm text-muted">for {fullName(score.clients)}</div>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Score breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {([
                    ['Price', score.price_score], ['Location', score.location_score], ['Size', score.size_score],
                    ['Condition', score.condition_score], ['Financial', score.financial_score],
                    ['Must-Haves', score.must_have_score], ['Buyer Reaction', score.emotional_score],
                  ] as const).map(([label, v]) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm text-slate-600">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn('h-full rounded-full bg-current', scoreTone(v))} style={{ width: `${v ?? 0}%` }} />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold tabular-nums">{v ?? '—'}</span>
                    </div>
                  ))}
                  {score.ai_reasoning && (
                    <div className="mt-4 whitespace-pre-line rounded-xl bg-subtle p-4 text-sm">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">AI Summary</div>
                      {score.ai_reasoning}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
          <div className="mt-6"><PropertyHousehold propertyId={p.id} clientId={score?.client_id} /></div>
        </TabsContent>

        <TabsContent value="tour-notes"><TourNotes propertyId={p.id} /></TabsContent>
        <TabsContent value="financials"><Financials p={p} /></TabsContent>
        <TabsContent value="property-intel"><PropertyIntel propertyId={p.id} /></TabsContent>
        <TabsContent value="photos"><Photos p={p} /></TabsContent>
        <TabsContent value="offers">
          <EmptyState icon={Handshake} title="No offers yet" description="Offer analysis arrives in a later build phase." />
        </TabsContent>
      </Tabs>

      <StartShowingDialog open={startOpen} onOpenChange={setStartOpen} defaultPropertyId={p.id} />
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  )
}

function TourNotes({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = usePropertyShowings(propertyId)
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!data?.length) return <p className="text-sm text-muted">No showings recorded at this home yet.</p>
  return (
    <div className="space-y-4">
      {data.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <div>
              <CardTitle>{fullName(s.clients)}</CardTitle>
              <p className="text-xs text-muted">{format(new Date(s.started_at), 'EEE, MMM d · h:mm a')}</p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={s.status === 'active' ? `/showings/${s.id}` : `/showings/${s.id}/complete`}>{s.status === 'active' ? 'Resume' : 'Summary'}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.buyer_reactions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.buyer_reactions.map((r) => (
                  <Badge key={r.id} variant={r.sentiment === 'positive' ? 'success' : r.sentiment === 'negative' ? 'warning' : 'default'}>
                    {REACTIONS.find((x) => x.value === r.reaction)?.emoji} {r.feature}
                  </Badge>
                ))}
              </div>
            )}
            {s.showing_notes.length === 0 && s.buyer_reactions.length === 0 && <p className="text-sm text-muted">No notes.</p>}
            <ul className="space-y-2">
              {s.showing_notes.map((n) => <li key={n.id} className="text-sm">“{n.content}”</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Financials({ p }: { p: PropertyDetail }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
          <Info label="Listing price" value={formatPrice(p.listing_price)} />
          <Info label="Taxes (monthly)" value={p.property_tax ? formatPrice(p.property_tax / 12) : '—'} />
          <Info label="HOA (monthly)" value={p.hoa_fee ? formatPrice(p.hoa_fee) : 'None'} />
          <Info label="Price / sq ft" value={pricePerSqft(p.listing_price, p.square_feet) ? `$${pricePerSqft(p.listing_price, p.square_feet)}` : '—'} />
        </CardContent>
      </Card>
      <MortgageCalculator price={p.listing_price} taxesAnnual={p.property_tax} hoaMonthly={p.hoa_fee} propertyId={p.id} />
    </div>
  )
}

const SOURCE_BADGE: Record<string, { label: string; variant: 'success' | 'accent' | 'default' | 'warning' | 'dark' }> = {
  verified: { label: 'VERIFIED', variant: 'success' },
  public_record: { label: 'PUBLIC RECORD', variant: 'accent' },
  mls: { label: 'MLS', variant: 'accent' },
  agent_note: { label: 'AGENT NOTE', variant: 'default' },
  ai_estimate: { label: 'AI ESTIMATE', variant: 'warning' },
  buyer_input: { label: 'BUYER INPUT', variant: 'dark' },
  demo: { label: 'DEMO', variant: 'warning' },
}

function PropertyIntel({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['property-intel', propertyId],
    queryFn: async () =>
      unwrap(await supabase.from('property_intelligence').select('*').eq('property_id', propertyId).order('created_at', { ascending: false })),
  })
  const [title, setTitle] = React.useState('')
  const [value, setValue] = React.useState('')
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.from('property_intelligence').insert({
          property_id: propertyId, category: 'note', title: title.trim(), value: value.trim() || null, source: 'agent_note',
        } as Insert<'property_intelligence'>),
      ),
    onSuccess: () => {
      setTitle('')
      setValue('')
      qc.invalidateQueries({ queryKey: ['property-intel', propertyId] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <form className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add.mutate() }}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item (e.g. Roof age)" aria-label="Item" />
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Detail (e.g. Seller says 2011)" aria-label="Detail" />
            <Button type="submit" loading={add.isPending} disabled={!title.trim()}>Add note</Button>
          </form>
          <p className="mt-2 text-xs text-muted">Public records, permits and FEMA data plug in later through the property data provider layer. Every item shows its source.</p>
        </CardContent>
      </Card>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !data?.length ? (
        <p className="text-sm text-muted">No property intelligence yet.</p>
      ) : (
        <div className="divide-y rounded-2xl border bg-card">
          {data.map((i) => {
            const b = SOURCE_BADGE[i.source] ?? SOURCE_BADGE.agent_note!
            return (
              <div key={i.id} className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="font-medium">{i.title}</div>
                  {i.value && <div className="text-sm text-slate-600">{i.value}</div>}
                  {i.confidence && <div className="mt-1 text-xs text-muted">Confidence: {i.confidence}</div>}
                </div>
                <Badge variant={b.variant}>{b.label}</Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Photos({ p }: { p: PropertyDetail }) {
  const { organization } = useSession()
  const qc = useQueryClient()
  const update = useUpdateProperty(p.id)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadPropertyPhoto({ orgId: organization.id, propertyId: p.id, file })
        if (!p.primary_photo) await update.mutateAsync({ primary_photo: splitPhotoUrl(photo.photo_url).path })
      }
      qc.invalidateQueries({ queryKey: ['property', p.id] })
      toast.success('Photos uploaded')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}><Camera /> Upload photos</Button>
      </div>
      {p.property_photos.length === 0 ? (
        <EmptyState icon={Camera} title="No photos yet" description="Upload listing photos or capture them during a showing. Photos are stored privately." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {p.property_photos.map((ph) => (
            <PhotoTile
              key={ph.id}
              photo={ph}
              isPrimary={splitPhotoUrl(ph.photo_url).path === p.primary_photo}
              onMakePrimary={() =>
                update.mutate(
                  { primary_photo: splitPhotoUrl(ph.photo_url).path },
                  { onSuccess: () => toast.success('Cover photo updated') },
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoTile({ photo, isPrimary, onMakePrimary }: { photo: PropertyPhoto; isPrimary: boolean; onMakePrimary: () => void }) {
  const { bucket, path } = splitPhotoUrl(photo.photo_url)
  const { data: url } = useSignedUrl(bucket, path)
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-subtle">
      {url && <img src={url} alt={photo.room_type ?? ''} className="size-full object-cover" loading="lazy" />}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 text-xs text-white">
        <span>{photo.room_type ?? ''}</span>
        {bucket === 'property-photos' &&
          (isPrimary ? (
            <span className="rounded-full bg-white/25 px-2 py-0.5 font-semibold">Cover</span>
          ) : (
            <button onClick={onMakePrimary} className="rounded-full bg-white/25 px-2 py-0.5 font-semibold opacity-0 transition group-hover:opacity-100">
              Make cover
            </button>
          ))}
      </div>
    </div>
  )
}

function PropertyHousehold({ propertyId, clientId }: { propertyId: string; clientId?: string }) {
  const { data } = usePropertyRatings(propertyId, clientId)
  if (!data?.length) return null
  return (
    <HouseholdOpinions
      title="Buyer portal ratings"
      ratings={data.map((r) => ({ ...r, name: r.client_members?.first_name ?? 'Buyer' }))}
    />
  )
}
