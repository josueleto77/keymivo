import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Json } from '@/lib/database.types'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert, Update } from '@/lib/types'

export type ScenarioKey = 'conservative' | 'competitive' | 'strong'
export const SCENARIO_LABEL: Record<ScenarioKey, string> = { conservative: 'Conservative', competitive: 'Competitive', strong: 'Strong' }

export interface OfferInputs {
  comps_low?: number | null
  comps_high?: number | null
  days_on_market?: number | null
  repairs?: number | null
  market?: 'hot' | 'balanced' | 'slow' | null
  multiple_offers?: boolean | null
  interest_rate?: number | null
  down_payment?: number | null
}

export interface Scenario {
  key: ScenarioKey
  price: number
  diff_from_asking: number | null
  diff_pct: number | null
  down_payment: number
  down_payment_pct: number
  loan_amount: number
  monthly: { principal_interest: number; taxes: number; insurance: number; hoa: number; pmi: number; total: number }
  cash_to_close_est: number
  appraisal_gap: number
  fit: 'within' | 'stretch' | 'over'
  fit_notes: string[]
  advantages: string[]
  risks: string[]
  terms_to_discuss: string[]
  explanation: string
}

export interface OfferAnalysis {
  version: 1
  generated_at: string
  basis: {
    asking: number | null; anchor: number; anchor_source: 'comps_midpoint' | 'asking_price'; comps_low: number | null; comps_high: number | null
    market: 'hot' | 'balanced' | 'slow'; days_on_market: number | null; dom_adjustment_pct: number; multiple_offers: boolean
    repairs: number; interest_rate: number; closing_cost_pct: number; insurance_pct: number; down_payment_source: 'buyer' | 'assumed_20_pct'
  }
  scenarios: Scenario[]
  summary: string
  recommended: { scenario: ScenarioKey; reason: string }
  questions_to_verify: string[]
  data_gaps: string[]
}

const LIST_SELECT = 'id, status, potential_price, selected_scenario, ai_status, analyzed_at, updated_at, client_id, property_id, clients(id, first_name, last_name, is_demo), properties(id, address_line1, city, state, listing_price, primary_photo, is_demo)'

export function useOffers(filter?: { clientId?: string; propertyId?: string }) {
  return useQuery({
    queryKey: ['offers', filter?.clientId ?? null, filter?.propertyId ?? null],
    queryFn: async () => {
      let q = supabase.from('offers').select(LIST_SELECT).order('updated_at', { ascending: false })
      if (filter?.clientId) q = q.eq('client_id', filter.clientId)
      if (filter?.propertyId) q = q.eq('property_id', filter.propertyId)
      return unwrap(await q)
    },
  })
}
export type OfferListItem = NonNullable<ReturnType<typeof useOffers>['data']>[number]

export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: ['offer', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('offers')
          .select('*, clients(id, first_name, last_name, preapproval_amount, target_price_min, target_price_max, preferred_monthly_payment, down_payment_amount, is_demo), properties(id, address_line1, city, state, zip_code, listing_price, property_tax, hoa_fee, days_on_market, beds, baths, square_feet, primary_photo, is_demo)')
          .eq('id', id!)
          .single(),
      ),
  })
}
export type OfferDetail = NonNullable<ReturnType<typeof useOffer>['data']>

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['offers'] })
  if (id) qc.invalidateQueries({ queryKey: ['offer', id] })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['clients'] })
  qc.invalidateQueries({ queryKey: ['client'] })
}

/** Opens the existing open analysis for this buyer + home, or creates one (pre-filled with the listing's DOM). */
export function useCreateOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { client_id: string; property_id: string }) => {
      const existing = unwrap(
        await supabase.from('offers').select('id').eq('client_id', v.client_id).eq('property_id', v.property_id)
          .in('status', ['considering', 'preparing']).limit(1).maybeSingle(),
      )
      if (existing) return existing
      const p = unwrap(await supabase.from('properties').select('days_on_market').eq('id', v.property_id).single())
      return unwrap(
        await supabase.from('offers')
          .insert({ ...v, inputs: { market: 'balanced', days_on_market: p.days_on_market } as Json } as Insert<'offers'>)
          .select('id').single(),
      )
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateOffer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Update<'offers'>) => unwrap(await supabase.from('offers').update(patch).eq('id', id).select('id').single()),
    onSuccess: () => invalidate(qc, id),
  })
}

export function useDeleteOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('offers').delete().eq('id', id)),
    onSuccess: () => invalidate(qc),
  })
}

export function useAnalyzeOffer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-offer', { body: { offer_id: id } })
      if (error) {
        let message = error.message
        if (error instanceof FunctionsHttpError) {
          const b = await error.context.json().catch(() => null)
          if (b?.error) message = b.error
        }
        throw new Error(message)
      }
      return data as OfferAnalysis
    },
    onSettled: () => invalidate(qc, id),
  })
}
