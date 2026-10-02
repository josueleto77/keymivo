import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Plus, X } from 'lucide-react'
import * as React from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { TagInput } from '@/components/TagInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useClient, useCreateClient, useUpdateClient } from '@/features/clients'
import { CLIENT_STATUSES, LOAN_TYPES, PREAPPROVAL_STATUSES, PROPERTY_TYPES } from '@/lib/constants'
import { DEFAULT_WEIGHT, inferCategory } from '@/lib/preferences'
import type { Client } from '@/lib/types'
import { toNumberOrNull } from '@/lib/utils'

const money = z.string().optional().refine((v) => !v || toNumberOrNull(v) != null, 'Enter a number')

const schema = z
  .object({
    first_name: z.string().trim().min(1, 'Required'),
    last_name: z.string().trim().optional(),
    email: z.union([z.literal(''), z.email('Enter a valid email')]).optional(),
    phone: z.string().trim().optional(),
    status: z.string(),
    members: z.array(z.object({ first_name: z.string().trim().min(1, 'Required'), last_name: z.string().optional(), email: z.string().optional() })),
    target_price_min: money,
    target_price_max: money,
    preapproval_amount: money,
    preapproval_status: z.string().optional(),
    lender_name: z.string().optional(),
    min_beds: money,
    min_baths: money,
    property_type: z.string().optional(),
    buying_timeline: z.string().optional(),
    down_payment_amount: money,
    loan_type: z.string().optional(),
    preferred_monthly_payment: money,
    notes: z.string().optional(),
  })
  .refine(
    (v) => {
      const a = toNumberOrNull(v.target_price_min)
      const b = toNumberOrNull(v.target_price_max)
      return a == null || b == null || a <= b
    },
    { message: 'Max must be greater than min', path: ['target_price_max'] },
  )
type Values = z.infer<typeof schema>

const str = (n: number | null | undefined) => (n == null ? '' : String(n))

function toDefaults(c?: Client): Values {
  return {
    first_name: c?.first_name ?? '',
    last_name: c?.last_name ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    status: c?.status ?? 'new',
    members: [],
    target_price_min: str(c?.target_price_min),
    target_price_max: str(c?.target_price_max),
    preapproval_amount: str(c?.preapproval_amount),
    preapproval_status: c?.preapproval_status ?? '',
    lender_name: c?.lender_name ?? '',
    min_beds: str(c?.min_beds),
    min_baths: str(c?.min_baths),
    property_type: c?.property_types?.[0] ?? '',
    buying_timeline: c?.buying_timeline ?? '',
    down_payment_amount: str(c?.down_payment_amount),
    loan_type: c?.loan_type ?? '',
    preferred_monthly_payment: str(c?.preferred_monthly_payment),
    notes: c?.notes ?? '',
  }
}

export function ClientFormPage() {
  const { id } = useParams()
  const editing = !!id
  const existing = useClient(id)
  if (editing && existing.isLoading) return <Skeleton className="h-96 w-full" />
  if (editing && existing.error) return <ErrorState message={(existing.error as Error).message} />
  return <ClientForm client={existing.data ?? undefined} />
}

function ClientForm({ client }: { client?: Client }) {
  const navigate = useNavigate()
  const create = useCreateClient()
  const update = useUpdateClient(client?.id ?? '')
  const [areas, setAreas] = React.useState<string[]>(client?.target_areas ?? [])
  const [mustHaves, setMustHaves] = React.useState<string[]>([])
  const [prefers, setPrefers] = React.useState<string[]>([])
  const [dislikes, setDislikes] = React.useState<string[]>([])
  const [dealBreakers, setDealBreakers] = React.useState<string[]>([])

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toDefaults(client) })
  const members = useFieldArray({ control: form.control, name: 'members' })
  const err = form.formState.errors

  async function onSubmit(v: Values) {
    const payload = {
      first_name: v.first_name,
      last_name: v.last_name || null,
      email: v.email || null,
      phone: v.phone || null,
      status: v.status,
      target_price_min: toNumberOrNull(v.target_price_min),
      target_price_max: toNumberOrNull(v.target_price_max),
      preapproval_amount: toNumberOrNull(v.preapproval_amount),
      preapproval_status: v.preapproval_status || null,
      lender_name: v.lender_name || null,
      min_beds: toNumberOrNull(v.min_beds),
      min_baths: toNumberOrNull(v.min_baths),
      property_types: v.property_type ? [v.property_type] : [],
      target_areas: areas,
      buying_timeline: v.buying_timeline || null,
      down_payment_amount: toNumberOrNull(v.down_payment_amount),
      loan_type: v.loan_type || null,
      preferred_monthly_payment: toNumberOrNull(v.preferred_monthly_payment),
      notes: v.notes || null,
    }
    try {
      if (client) {
        await update.mutateAsync(payload)
        toast.success('Client updated')
        navigate(`/clients/${client.id}`)
      } else {
        const prefs = [
          ...mustHaves.map((value) => ({ preference_type: 'must_have', value })),
          ...prefers.map((value) => ({ preference_type: 'prefer', value })),
          ...dislikes.map((value) => ({ preference_type: 'dislike', value })),
          ...dealBreakers.map((value) => ({ preference_type: 'deal_breaker', value })),
        ].map((p) => ({ ...p, category: inferCategory(p.value), weight: DEFAULT_WEIGHT[p.preference_type]! }))
        const created = await create.mutateAsync({
          client: payload,
          members: v.members.map((m) => ({ first_name: m.first_name, last_name: m.last_name || null, email: m.email || null })),
          preferences: prefs,
        })
        toast.success('Buyer created')
        navigate(`/clients/${created.id}`)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={client ? `/clients/${client.id}` : '/clients'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">{client ? 'Edit client' : 'New buyer'}</h1>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name(s)" htmlFor="first_name" error={err.first_name?.message} hint="e.g. Mike & Sarah">
              <Input id="first_name" {...form.register('first_name')} />
            </Field>
            <Field label="Last name" htmlFor="last_name">
              <Input id="last_name" {...form.register('last_name')} />
            </Field>
            <Field label="Email" htmlFor="email" error={err.email?.message}>
              <Input id="email" type="email" {...form.register('email')} />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" type="tel" {...form.register('phone')} />
            </Field>
            {client && (
              <Field label="Status" htmlFor="status">
                <NativeSelect id="status" {...form.register('status')}>
                  {CLIENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </NativeSelect>
              </Field>
            )}
          </CardContent>
          {!client && (
            <CardContent className="border-t pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Household buyers</p>
                  <p className="text-xs text-muted">Add each decision-maker so Keymivo can track individual reactions.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => members.append({ first_name: '', last_name: '', email: '' })}>
                  <Plus /> Add buyer
                </Button>
              </div>
              <div className="space-y-3">
                {members.fields.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                    <Input placeholder="First name" aria-label="First name" {...form.register(`members.${i}.first_name`)} aria-invalid={!!err.members?.[i]?.first_name} />
                    <Input placeholder="Last name" aria-label="Last name" {...form.register(`members.${i}.last_name`)} />
                    <Input placeholder="Email" aria-label="Email" className="col-span-2 sm:col-span-1" {...form.register(`members.${i}.email`)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => members.remove(i)} aria-label="Remove" className="row-start-1 col-start-3 sm:col-start-4">
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Search criteria</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget min" htmlFor="target_price_min" error={err.target_price_min?.message}>
              <Input id="target_price_min" inputMode="numeric" placeholder="650,000" {...form.register('target_price_min')} />
            </Field>
            <Field label="Budget max" htmlFor="target_price_max" error={err.target_price_max?.message}>
              <Input id="target_price_max" inputMode="numeric" placeholder="725,000" {...form.register('target_price_max')} />
            </Field>
            <Field label="Target areas" htmlFor="areas" className="sm:col-span-2" hint="Press Enter after each area">
              <TagInput id="areas" value={areas} onChange={setAreas} placeholder="Woburn, Reading, North Shore…" />
            </Field>
            <Field label="Min beds" htmlFor="min_beds" error={err.min_beds?.message}>
              <Input id="min_beds" inputMode="decimal" {...form.register('min_beds')} />
            </Field>
            <Field label="Min baths" htmlFor="min_baths" error={err.min_baths?.message}>
              <Input id="min_baths" inputMode="decimal" {...form.register('min_baths')} />
            </Field>
            <Field label="Property type" htmlFor="property_type">
              <NativeSelect id="property_type" {...form.register('property_type')}>
                <option value="">Any</option>
                {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Move-in timeline" htmlFor="buying_timeline">
              <Input id="buying_timeline" placeholder="60-90 days" {...form.register('buying_timeline')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financing</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Preapproval amount" htmlFor="preapproval_amount" error={err.preapproval_amount?.message}>
              <Input id="preapproval_amount" inputMode="numeric" {...form.register('preapproval_amount')} />
            </Field>
            <Field label="Preapproval status" htmlFor="preapproval_status">
              <NativeSelect id="preapproval_status" {...form.register('preapproval_status')}>
                <option value="">—</option>
                {PREAPPROVAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Lender" htmlFor="lender_name">
              <Input id="lender_name" {...form.register('lender_name')} />
            </Field>
            <Field label="Loan type" htmlFor="loan_type">
              <NativeSelect id="loan_type" {...form.register('loan_type')}>
                <option value="">—</option>
                {LOAN_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Down payment" htmlFor="down_payment_amount" error={err.down_payment_amount?.message}>
              <Input id="down_payment_amount" inputMode="numeric" {...form.register('down_payment_amount')} />
            </Field>
            <Field label="Monthly payment comfort" htmlFor="preferred_monthly_payment" error={err.preferred_monthly_payment?.message}>
              <Input id="preferred_monthly_payment" inputMode="numeric" placeholder="4,500" {...form.register('preferred_monthly_payment')} />
            </Field>
          </CardContent>
        </Card>

        {!client && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>What this buyer wants</CardTitle>
                <p className="mt-1 text-xs text-muted">Use objective property criteria only — features, price, commute, condition.</p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Must haves" htmlFor="must"><TagInput id="must" tone="success" value={mustHaves} onChange={setMustHaves} placeholder="3+ bedrooms, Backyard…" /></Field>
              <Field label="Preferences" htmlFor="pref"><TagInput id="pref" value={prefers} onChange={setPrefers} placeholder="Garage, Modern kitchen…" /></Field>
              <Field label="Dislikes" htmlFor="dis"><TagInput id="dis" tone="warning" value={dislikes} onChange={setDislikes} placeholder="Busy road, High taxes…" /></Field>
              <Field label="Deal breakers" htmlFor="db"><TagInput id="db" tone="danger" value={dealBreakers} onChange={setDealBreakers} placeholder="Major renovation…" /></Field>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea aria-label="Notes" {...form.register('notes')} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>{client ? 'Save changes' : 'Create buyer'}</Button>
        </div>
      </form>
    </div>
  )
}
