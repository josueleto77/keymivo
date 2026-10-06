import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { BuyerChoice, OfferAnalysis } from '@/features/offers'
import type { Insert } from '@/lib/types'

// ── Buyer side (all reads/writes go through SECURITY DEFINER RPCs) ──
export interface PortalRating {
  member_id: string
  overall: number | null
  kitchen: number | null
  location: number | null
  bedrooms: number | null
  condition: number | null
  backyard: number | null
  value: number | null
  decision: 'love' | 'like' | 'maybe' | 'pass' | 'discuss_offer' | null
  comment: string | null
  updated_at: string
}
export interface PortalProperty {
  id: string
  address_line1: string
  city: string
  state: string
  zip_code: string | null
  listing_price: number | null
  beds: number | null
  baths: number | null
  square_feet: number | null
  year_built: number | null
  property_tax: number | null
  hoa_fee: number | null
  lot_size: string | null
  property_type: string | null
  primary_photo: string | null
  status: string
  is_demo: boolean
  shared_note: string | null
  toured: boolean
  match_score: number | null
  ratings: PortalRating[]
}
export interface PortalData {
  me: { member_id: string; first_name: string }
  client: { id: string; name: string; budget_min: number | null; budget_max: number | null; down_payment: number | null; target_areas: string[]; is_demo: boolean }
  members: { id: string; first_name: string; joined: boolean }[]
  agent: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; brokerage: string | null }
  properties: PortalProperty[]
  tours: { id: string; name: string; tour_date: string; status: string; stops: { property_id: string; scheduled_time: string | null; sequence_number: number; status: string }[] }[]
  messages: { id: string; content: string; sender: 'agent' | 'buyer'; created_at: string }[]
  offers: PortalOffer[]
}
/** A shared offer strategy: a snapshot of the analysis the Realtor approved (no internal notes). */
export interface PortalOffer {
  id: string
  property_id: string
  status: string
  shared_at: string
  note: string | null
  address_line1: string
  city: string
  state: string
  listing_price: number | null
  primary_photo: string | null
  analysis: Omit<OfferAnalysis, 'data_gaps'>
  responses: { member_id: string; choice: BuyerChoice; comment: string | null; updated_at: string }[]
}

export function usePortalData() {
  return useQuery({
    queryKey: ['portal'],
    queryFn: async () => unwrap(await supabase.rpc('portal_data')) as unknown as PortalData,
  })
}

export const RATING_KEYS = ['overall', 'kitchen', 'location', 'bedrooms', 'condition', 'backyard', 'value'] as const
export type RatingKey = (typeof RATING_KEYS)[number]
export const RATING_LABELS: Record<RatingKey, string> = {
  overall: 'Overall', kitchen: 'Kitchen', location: 'Location', bedrooms: 'Bedrooms', condition: 'Condition', backyard: 'Backyard', value: 'Value',
}
export const DECISIONS = [
  { value: 'love', label: 'Love It', emoji: '😍' },
  { value: 'like', label: 'Like It', emoji: '👍' },
  { value: 'maybe', label: 'Maybe', emoji: '🤔' },
  { value: 'pass', label: 'Pass', emoji: '👋' },
  { value: 'discuss_offer', label: 'Discuss Offer', emoji: '✍️' },
] as const

export function useRateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { propertyId: string; ratings: Partial<Record<RatingKey, number>>; decision: string | null; comment: string }) =>
      unwrap(
        await supabase.rpc('portal_rate_property', {
          p_property_id: v.propertyId,
          p_ratings: v.ratings,
          p_decision: v.decision as string,
          p_comment: v.comment,
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal'] }),
  })
}

export function useSendPortalMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) => unwrap(await supabase.rpc('portal_send_message', { p_content: content })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal'] }),
  })
}

export function useRespondOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { offerId: string; choice: BuyerChoice; comment: string }) =>
      unwrap(await supabase.rpc('portal_respond_offer', { p_offer: v.offerId, p_choice: v.choice, p_comment: v.comment })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal'] }),
  })
}

// ── Realtor side ─────────────────────────────────────────────────────
export function useCreateInvite() {
  return useMutation({
    mutationFn: async (memberId: string) => unwrap(await supabase.rpc('create_buyer_invite', { p_member_id: memberId })) as string,
  })
}

export function inviteUrl(token: string) {
  return `${window.location.origin}/portal/join?token=${token}`
}

export function usePortalShares(clientId: string) {
  return useQuery({
    queryKey: ['portal-shares', clientId],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('portal_shares')
          .select('*, properties(id, address_line1, city)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useSharePropertyMutations(clientId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['portal-shares', clientId] })
  const share = useMutation({
    mutationFn: async (v: { propertyId: string; note: string }) =>
      unwrap(
        await supabase
          .from('portal_shares')
          .upsert({ client_id: clientId, property_id: v.propertyId, note: v.note || null } as Insert<'portal_shares'>, { onConflict: 'client_id,property_id' }),
      ),
    onSuccess: invalidate,
  })
  const unshare = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('portal_shares').delete().eq('id', id)),
    onSuccess: invalidate,
  })
  return { share, unshare }
}

export function usePropertyRatings(propertyId: string | undefined, clientId?: string) {
  return useQuery({
    queryKey: ['property-ratings', propertyId, clientId],
    enabled: !!propertyId,
    queryFn: async () => {
      let q = supabase.from('buyer_ratings').select('*, client_members(id, first_name)').eq('property_id', propertyId!)
      if (clientId) q = q.eq('client_id', clientId)
      return unwrap(await q)
    },
  })
}
