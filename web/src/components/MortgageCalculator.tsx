import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Save, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { DEFAULT_ASSUMPTIONS, calculateMortgage } from '@/lib/mortgage'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert } from '@/lib/types'
import { formatPrice } from '@/lib/utils'

interface Props {
  price?: number | null
  downPayment?: number | null
  taxesAnnual?: number | null
  hoaMonthly?: number | null
  clientId?: string | null
  propertyId?: string | null
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/** Functional mortgage calculator. Estimate only — not a lending quote. */
export function MortgageCalculator({ price, downPayment, taxesAnnual, hoaMonthly, clientId, propertyId }: Props) {
  const qc = useQueryClient()
  const initialPrice = price ?? 650000
  const [v, setV] = React.useState({
    price: String(initialPrice),
    down: String(downPayment ?? Math.round(initialPrice * 0.2)),
    rate: String(DEFAULT_ASSUMPTIONS.interestRate),
    term: String(DEFAULT_ASSUMPTIONS.loanTermYears),
    taxes: String(taxesAnnual ?? Math.round(initialPrice * 0.012)),
    insurance: String(Math.round((initialPrice * DEFAULT_ASSUMPTIONS.insuranceRatePct) / 100)),
    hoa: String(hoaMonthly ?? 0),
    pmi: String(DEFAULT_ASSUMPTIONS.pmiRate),
  })
  const n = (s: string) => Number(s.replace(/[$,\s]/g, '')) || 0
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })

  const r = calculateMortgage({
    purchasePrice: n(v.price),
    downPayment: Math.min(n(v.down), n(v.price)),
    interestRate: n(v.rate),
    loanTermYears: n(v.term) || 30,
    taxesAnnual: n(v.taxes),
    insuranceAnnual: n(v.insurance),
    hoaMonthly: n(v.hoa),
    pmiRate: n(v.pmi),
  })

  const scenarios = useQuery({
    queryKey: ['mortgage-scenarios', clientId, propertyId],
    enabled: !!(clientId || propertyId),
    queryFn: async () => {
      let q = supabase.from('mortgage_scenarios').select('*').order('created_at', { ascending: false }).limit(10)
      if (clientId) q = q.eq('client_id', clientId)
      if (propertyId) q = q.eq('property_id', propertyId)
      return unwrap(await q)
    },
  })

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.from('mortgage_scenarios').insert({
          client_id: clientId ?? null,
          property_id: propertyId ?? null,
          purchase_price: n(v.price),
          down_payment: Math.min(n(v.down), n(v.price)),
          loan_amount: r.loanAmount,
          interest_rate: n(v.rate),
          loan_term_years: n(v.term) || 30,
          taxes_monthly: r.taxes,
          insurance_monthly: r.insurance,
          hoa_monthly: r.hoa,
          pmi_monthly: r.pmi,
          principal_interest: r.principalInterest,
          total_monthly_payment: r.total,
        } as Insert<'mortgage_scenarios'>),
      ),
    onSuccess: () => {
      toast.success('Scenario saved')
      qc.invalidateQueries({ queryKey: ['mortgage-scenarios'] })
    },
    onError: (e) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('mortgage_scenarios').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mortgage-scenarios'] }),
  })

  const rows = [
    ['Principal & Interest', r.principalInterest],
    ['Property Taxes', r.taxes],
    ['Insurance', r.insurance],
    ['HOA', r.hoa],
    ['PMI', r.pmi],
  ] as const

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader><CardTitle>Mortgage calculator</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Purchase price" htmlFor="mc-price"><Input id="mc-price" inputMode="numeric" value={v.price} onChange={set('price')} /></Field>
          <Field label={`Down payment · ${r.downPaymentPct.toFixed(1)}%`} htmlFor="mc-down"><Input id="mc-down" inputMode="numeric" value={v.down} onChange={set('down')} /></Field>
          <Field label="Interest rate (%)" htmlFor="mc-rate"><Input id="mc-rate" inputMode="decimal" value={v.rate} onChange={set('rate')} /></Field>
          <Field label="Loan term (years)" htmlFor="mc-term"><Input id="mc-term" inputMode="numeric" value={v.term} onChange={set('term')} /></Field>
          <Field label="Property taxes (annual)" htmlFor="mc-tax"><Input id="mc-tax" inputMode="numeric" value={v.taxes} onChange={set('taxes')} /></Field>
          <Field label="Insurance (annual)" htmlFor="mc-ins"><Input id="mc-ins" inputMode="numeric" value={v.insurance} onChange={set('insurance')} /></Field>
          <Field label="HOA (monthly)" htmlFor="mc-hoa"><Input id="mc-hoa" inputMode="numeric" value={v.hoa} onChange={set('hoa')} /></Field>
          <Field label="PMI (% of loan / yr)" htmlFor="mc-pmi" hint="Applied when down payment is under 20%">
            <Input id="mc-pmi" inputMode="decimal" value={v.pmi} onChange={set('pmi')} />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <Card className="border-primary bg-primary text-white">
          <CardContent>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total monthly payment</div>
            <div className="mt-1 font-display text-4xl font-bold">{money(r.total)}</div>
            <div className="mt-1 text-sm text-slate-400">Loan amount {formatPrice(r.loanAmount)}</div>
            <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
              {rows.map(([label, val]) => (
                <li key={label} className="flex justify-between">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-semibold tabular-nums">{money(val)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-slate-400">Estimate only. Not a lending quote.</p>
          </CardContent>
        </Card>
        {(clientId || propertyId) && (
          <Card>
            <CardHeader>
              <CardTitle>Saved scenarios</CardTitle>
              <Button size="sm" variant="outline" onClick={() => save.mutate()} loading={save.isPending}><Save /> Save</Button>
            </CardHeader>
            <CardContent>
              {!scenarios.data?.length ? (
                <p className="text-sm text-muted">Save a scenario to compare later.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {scenarios.data.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 py-2">
                      <div className="flex-1">
                        <div className="font-semibold">{money(s.total_monthly_payment)}/mo</div>
                        <div className="text-xs text-muted">
                          {formatPrice(s.purchase_price)} · {formatPrice(s.down_payment)} down · {s.interest_rate}% · {s.loan_term_years}y · {format(new Date(s.created_at), 'MMM d')}
                        </div>
                      </div>
                      <button onClick={() => del.mutate(s.id)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-subtle" aria-label="Delete scenario">
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
