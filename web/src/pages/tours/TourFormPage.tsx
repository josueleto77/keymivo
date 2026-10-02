import { addDays, format, nextSaturday } from 'date-fns'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, X } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useClients } from '@/features/clients'
import { useProperties } from '@/features/properties'
import { useCreateTour } from '@/features/tours'
import { formatPrice, fullName } from '@/lib/utils'

interface Stop { property_id: string; scheduled_time: string }

/** 10:00 → 10:45 → 11:30 … */
function nextSlot(prev: string | undefined) {
  if (!prev) return '10:00'
  const [h, m] = prev.split(':').map(Number)
  const total = (h ?? 10) * 60 + (m ?? 0) + 45
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function TourFormPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const clients = useClients()
  const properties = useProperties()
  const create = useCreateTour()

  const defaultDate = format(new Date().getDay() === 6 ? addDays(new Date(), 7) : nextSaturday(new Date()), 'yyyy-MM-dd')
  const [clientId, setClientId] = React.useState(params.get('client') ?? '')
  const [name, setName] = React.useState('Saturday Home Tour')
  const [date, setDate] = React.useState(defaultDate)
  const [notes, setNotes] = React.useState('')
  const [stops, setStops] = React.useState<Stop[]>(() => {
    const p = params.get('property')
    return p ? [{ property_id: p, scheduled_time: '10:00' }] : []
  })
  const [touched, setTouched] = React.useState(false)

  const available = (properties.data ?? []).filter((p) => !stops.some((s) => s.property_id === p.id))
  const errors = {
    client: !clientId ? 'Choose a buyer' : undefined,
    name: !name.trim() ? 'Required' : undefined,
    date: !date ? 'Required' : undefined,
  }

  function move(i: number, d: -1 | 1) {
    setStops((prev) => {
      const next = [...prev]
      const j = i + d
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (errors.client || errors.name || errors.date) return
    try {
      const tour = await create.mutateAsync({
        tour: { client_id: clientId, name: name.trim(), tour_date: date, notes: notes || null },
        stops: stops.map((s) => ({ property_id: s.property_id, scheduled_time: s.scheduled_time || null })),
      })
      toast.success('Tour created')
      navigate(`/tours/${tour.id}`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/tours" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Tours
      </Link>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">Create tour</h1>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer" htmlFor="client" error={touched ? errors.client : undefined} className="sm:col-span-2">
              <NativeSelect id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select a buyer…</option>
                {clients.data?.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Tour name" htmlFor="name" error={touched ? errors.name : undefined}>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Date" htmlFor="date" error={touched ? errors.date : undefined}>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Homes ({stops.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stops.map((s, i) => {
              const p = properties.data?.find((x) => x.id === s.property_id)
              return (
                <div key={s.property_id} className="flex items-center gap-2 rounded-xl border p-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                  <Input
                    type="time"
                    value={s.scheduled_time}
                    onChange={(e) => setStops((prev) => prev.map((x, j) => (j === i ? { ...x, scheduled_time: e.target.value } : x)))}
                    className="h-9 w-[120px] shrink-0"
                    aria-label="Time"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p?.address_line1}</div>
                    <div className="truncate text-xs text-muted">{p?.city} · {formatPrice(p?.listing_price)}</div>
                  </div>
                  <div className="flex">
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setStops((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove"><X /></Button>
                  </div>
                </div>
              )
            })}
            {properties.data?.length === 0 ? (
              <p className="text-sm text-muted">No properties yet. <Link to="/properties/new" className="font-semibold text-accent">Add one</Link></p>
            ) : available.length > 0 ? (
              <NativeSelect
                aria-label="Add a home"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  setStops((prev) => [...prev, { property_id: e.target.value, scheduled_time: nextSlot(prev.at(-1)?.scheduled_time) }])
                }}
              >
                <option value="">+ Add a home…</option>
                {available.map((p) => <option key={p.id} value={p.id}>{p.address_line1}, {p.city}</option>)}
              </NativeSelect>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent><Textarea aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" size="lg" loading={create.isPending}><Plus /> Create tour</Button>
        </div>
      </form>
    </div>
  )
}
