import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { ListingImport, type ExtractedListing } from '@/components/ListingImport'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateProperty, useProperty, useUpdateProperty } from '@/features/properties'
import { PROPERTY_STATUSES, PROPERTY_TYPES, US_STATES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import type { Insert, Property } from '@/lib/types'
import { toNumberOrNull } from '@/lib/utils'
import { useSession } from '@/providers/AuthProvider'

const num = z.string().optional().refine((v) => !v || toNumberOrNull(v) != null, 'Enter a number')
const schema = z.object({
  address_line1: z.string().trim().min(1, 'Required'),
  city: z.string().trim().min(1, 'Required'),
  state: z.string().length(2),
  zip_code: z.string().trim().optional().refine((v) => !v || /^\d{5}(-\d{4})?$/.test(v), 'Invalid ZIP'),
  listing_price: num,
  beds: num,
  baths: num,
  square_feet: num,
  lot_size: z.string().optional(),
  year_built: z.string().optional().refine((v) => !v || (/^\d{4}$/.test(v) && +v >= 1700 && +v <= new Date().getFullYear() + 2), 'Invalid year'),
  property_type: z.string().optional(),
  property_tax: num,
  hoa_fee: num,
  days_on_market: num,
  mls_number: z.string().optional(),
  listing_agent_name: z.string().optional(),
  listing_brokerage: z.string().optional(),
  status: z.string(),
})
type Values = z.infer<typeof schema>
const s = (n: number | null | undefined) => (n == null ? '' : String(n))

export function PropertyFormPage() {
  const { id } = useParams()
  const existing = useProperty(id)
  if (id && existing.isLoading) return <Skeleton className="h-96 w-full" />
  if (id && existing.error) return <ErrorState message={(existing.error as Error).message} />
  return <PropertyForm property={existing.data ?? undefined} />
}

function PropertyForm({ property }: { property?: Property }) {
  const navigate = useNavigate()
  const { organization } = useSession()
  const create = useCreateProperty()
  const update = useUpdateProperty(property?.id ?? '')
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      address_line1: property?.address_line1 ?? '',
      city: property?.city ?? '',
      state: property?.state ?? organization.state_code,
      zip_code: property?.zip_code ?? '',
      listing_price: s(property?.listing_price),
      beds: s(property?.beds),
      baths: s(property?.baths),
      square_feet: s(property?.square_feet),
      lot_size: property?.lot_size ?? '',
      year_built: s(property?.year_built),
      property_type: property?.property_type ?? 'single_family',
      property_tax: s(property?.property_tax),
      hoa_fee: s(property?.hoa_fee),
      days_on_market: s(property?.days_on_market),
      mls_number: property?.mls_number ?? '',
      listing_agent_name: property?.listing_agent_name ?? '',
      listing_brokerage: property?.listing_brokerage ?? '',
      status: property?.status ?? 'active',
    },
  })
  const e = form.formState.errors

  const [highlights, setHighlights] = React.useState<string[]>([])
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null)
  function applyListing(l: ExtractedListing) {
    const cur = form.getValues()
    const pick = (v: string | number | null | undefined, fallback: string) => (v == null || v === '' ? fallback : String(v))
    form.reset({
      ...cur,
      address_line1: pick(l.address_line1, cur.address_line1),
      city: pick(l.city, cur.city),
      state: l.state && (US_STATES as readonly string[]).includes(l.state) ? l.state : cur.state,
      zip_code: pick(l.zip_code, cur.zip_code ?? ''),
      listing_price: pick(l.listing_price, cur.listing_price ?? ''),
      beds: pick(l.beds, cur.beds ?? ''),
      baths: pick(l.baths, cur.baths ?? ''),
      square_feet: pick(l.square_feet, cur.square_feet ?? ''),
      lot_size: pick(l.lot_size, cur.lot_size ?? ''),
      year_built: pick(l.year_built, cur.year_built ?? ''),
      property_type: pick(l.property_type, cur.property_type ?? 'single_family'),
      property_tax: pick(l.property_tax, cur.property_tax ?? ''),
      hoa_fee: pick(l.hoa_fee, cur.hoa_fee ?? ''),
      days_on_market: pick(l.days_on_market, cur.days_on_market ?? ''),
      mls_number: pick(l.mls_number, cur.mls_number ?? ''),
      listing_agent_name: pick(l.listing_agent_name, cur.listing_agent_name ?? ''),
      listing_brokerage: pick(l.listing_brokerage, cur.listing_brokerage ?? ''),
      status: pick(l.status, cur.status),
    })
    setHighlights(l.highlights ?? [])
  }

  async function onSubmit(v: Values) {
    const payload = {
      address_line1: v.address_line1,
      city: v.city,
      state: v.state,
      zip_code: v.zip_code || null,
      listing_price: toNumberOrNull(v.listing_price),
      beds: toNumberOrNull(v.beds),
      baths: toNumberOrNull(v.baths),
      square_feet: toNumberOrNull(v.square_feet),
      lot_size: v.lot_size || null,
      year_built: toNumberOrNull(v.year_built),
      property_type: v.property_type || null,
      property_tax: toNumberOrNull(v.property_tax),
      hoa_fee: toNumberOrNull(v.hoa_fee),
      days_on_market: toNumberOrNull(v.days_on_market),
      mls_number: v.mls_number || null,
      listing_agent_name: v.listing_agent_name || null,
      listing_brokerage: v.listing_brokerage || null,
      status: v.status,
      // New coordinates when the address was picked from Google; cleared when typed by hand (re-geocoded on view).
      ...(coords ? { latitude: coords.lat, longitude: coords.lng } : property && property.address_line1 !== v.address_line1 ? { latitude: null, longitude: null } : {}),
    }
    try {
      const saved = property ? await update.mutateAsync(payload) : await create.mutateAsync(payload)
      if (!property && highlights.length) {
        // Listing features become sourced Property Intel ("from listing sheet"), not facts we verified.
        await supabase.from('property_intelligence').insert(
          highlights.map((h) => ({ property_id: saved.id, category: 'listing', title: h, value: 'From listing sheet', source: 'agent_note' }) as Insert<'property_intelligence'>),
        )
      }
      toast.success(property ? 'Property updated' : 'Property added')
      navigate(`/properties/${saved.id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={property ? `/properties/${property.id}` : '/properties'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">{property ? 'Edit property' : 'Add property'}</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {!property && <ListingImport onExtracted={applyListing} />}
        {highlights.length > 0 && (
          <p className="text-xs text-muted">Listing highlights saved to Property Intel: {highlights.join(' · ')}</p>
        )}
        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-6">
            <Field label="Street address" htmlFor="address_line1" error={e.address_line1?.message} className="sm:col-span-6">
              <AddressAutocomplete
                id="address_line1"
                placeholder="Start typing an address…"
                {...form.register('address_line1', { onChange: () => setCoords(null) })}
                onResolved={(a) => {
                  form.setValue('address_line1', a.address_line1 || form.getValues('address_line1'), { shouldValidate: true })
                  if (a.city) form.setValue('city', a.city, { shouldValidate: true })
                  if (a.state && (US_STATES as readonly string[]).includes(a.state)) form.setValue('state', a.state)
                  if (a.zip_code) form.setValue('zip_code', a.zip_code, { shouldValidate: true })
                  setCoords(a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng } : null)
                }}
              />
            </Field>
            <Field label="City" htmlFor="city" error={e.city?.message} className="sm:col-span-3">
              <Input id="city" {...form.register('city')} />
            </Field>
            <Field label="State" htmlFor="state" className="sm:col-span-1">
              <NativeSelect id="state" {...form.register('state')}>
                {US_STATES.map((st) => <option key={st}>{st}</option>)}
              </NativeSelect>
            </Field>
            <Field label="ZIP" htmlFor="zip_code" error={e.zip_code?.message} className="sm:col-span-2">
              <Input id="zip_code" inputMode="numeric" {...form.register('zip_code')} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Listing details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="List price" htmlFor="listing_price" error={e.listing_price?.message}><Input id="listing_price" inputMode="numeric" {...form.register('listing_price')} /></Field>
            <Field label="Beds" htmlFor="beds" error={e.beds?.message}><Input id="beds" inputMode="decimal" {...form.register('beds')} /></Field>
            <Field label="Baths" htmlFor="baths" error={e.baths?.message}><Input id="baths" inputMode="decimal" {...form.register('baths')} /></Field>
            <Field label="Square feet" htmlFor="square_feet" error={e.square_feet?.message}><Input id="square_feet" inputMode="numeric" {...form.register('square_feet')} /></Field>
            <Field label="Lot size" htmlFor="lot_size"><Input id="lot_size" placeholder="0.25 acres" {...form.register('lot_size')} /></Field>
            <Field label="Year built" htmlFor="year_built" error={e.year_built?.message}><Input id="year_built" inputMode="numeric" {...form.register('year_built')} /></Field>
            <Field label="Property type" htmlFor="property_type">
              <NativeSelect id="property_type" {...form.register('property_type')}>
                {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Annual property tax" htmlFor="property_tax" error={e.property_tax?.message}><Input id="property_tax" inputMode="numeric" {...form.register('property_tax')} /></Field>
            <Field label="HOA (monthly)" htmlFor="hoa_fee" error={e.hoa_fee?.message}><Input id="hoa_fee" inputMode="numeric" {...form.register('hoa_fee')} /></Field>
            <Field label="Days on market" htmlFor="days_on_market" error={e.days_on_market?.message}><Input id="days_on_market" inputMode="numeric" {...form.register('days_on_market')} /></Field>
            <Field label="Status" htmlFor="status">
              <NativeSelect id="status" {...form.register('status')}>
                {PROPERTY_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="MLS #" htmlFor="mls_number"><Input id="mls_number" {...form.register('mls_number')} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Listing agent</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Agent name" htmlFor="listing_agent_name"><Input id="listing_agent_name" {...form.register('listing_agent_name')} /></Field>
            <Field label="Brokerage" htmlFor="listing_brokerage"><Input id="listing_brokerage" {...form.register('listing_brokerage')} /></Field>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>{property ? 'Save changes' : 'Add property'}</Button>
        </div>
      </form>
    </div>
  )
}
