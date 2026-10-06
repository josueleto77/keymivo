/** Data loaders for PDF reports. Everything goes through the user's session, so RLS scopes it to their org. */
import type { OfferAnalysis } from '@/features/offers'
import { estimateMonthly } from '@/lib/mortgage'
import { supabase, unwrap } from '@/lib/supabase'
import type { Organization, Profile } from '@/lib/types'

export interface Agent {
  name: string
  email: string | null
  phone: string | null
  brokerage: string | null
  license: string | null
}

export function agentFrom(profile: Profile, organization: Organization | null): Agent {
  return {
    name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your agent',
    email: profile.email,
    phone: profile.phone,
    brokerage: profile.brokerage_name || organization?.name || null,
    license: profile.license_number ? `${profile.license_state ?? ''} Lic. #${profile.license_number}`.trim() : null,
  }
}

/** Fetches a private property photo as a data URI (react-pdf can't send auth headers; failures just skip the image). */
async function photo(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  try {
    const { data } = await supabase.storage.from('property-photos').createSignedUrl(path, 300)
    if (!data?.signedUrl) return null
    const blob = await (await fetch(data.signedUrl)).blob()
    if (!/^image\/(jpeg|png)$/.test(blob.type)) return null // react-pdf supports JPEG/PNG only
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

interface AiAnalysis {
  summary?: string
  positives?: { feature: string; detail?: string }[]
  concerns?: { title: string; detail?: string }[]
  questions?: string[]
  recommended_next_action?: string
}

// ── Offer strategy ──────────────────────────────────────────────────
export async function loadOfferReport(offerId: string) {
  const o = unwrap(
    await supabase.from('offers')
      .select('id, status, selected_scenario, potential_price, analysis, analyzed_at, clients(first_name, last_name), properties(address_line1, city, state, zip_code, listing_price, beds, baths, square_feet, year_built, property_tax, hoa_fee, days_on_market, primary_photo)')
      .eq('id', offerId).single(),
  )
  if (!o.analysis) throw new Error('Run the offer analysis before downloading the report.')
  return {
    offer: o,
    analysis: o.analysis as unknown as OfferAnalysis,
    image: await photo(o.properties?.primary_photo),
  }
}
export type OfferReportData = Awaited<ReturnType<typeof loadOfferReport>>

// ── Tour summary ────────────────────────────────────────────────────
export async function loadTourReport(tourId: string) {
  const tour = unwrap(
    await supabase.from('tours')
      .select('id, name, tour_date, status, client_id, clients(first_name, last_name, down_payment_amount), tour_properties(id, sequence_number, scheduled_time, status, property_id, properties(id, address_line1, city, state, listing_price, beds, baths, square_feet, property_tax, hoa_fee, primary_photo))')
      .eq('id', tourId).single(),
  )
  const ids = tour.tour_properties.map((s) => s.property_id)
  const [scores, showings] = await Promise.all([
    supabase.from('property_scores').select('property_id, overall_score, location_score, emotional_score').eq('client_id', tour.client_id).in('property_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('showings').select('property_id, ai_summary, ai_analysis, buyer_interest_level, buyer_interest_score, ended_at')
      .eq('tour_id', tourId).eq('status', 'completed').order('ended_at', { ascending: false }),
  ])
  const scoreBy = new Map(unwrap(scores).map((s) => [s.property_id, s]))
  const shRows = unwrap(showings)
  const showingBy = new Map<string, (typeof shRows)[number]>()
  for (const s of shRows) if (!showingBy.has(s.property_id)) showingBy.set(s.property_id, s)

  const stops = [...tour.tour_properties].sort((a, b) => a.sequence_number - b.sequence_number).map((s) => {
    const p = s.properties!
    const sh = showingBy.get(s.property_id)
    return {
      id: s.id, seq: s.sequence_number, time: s.scheduled_time, property: p,
      score: scoreBy.get(s.property_id)?.overall_score ?? null,
      location: scoreBy.get(s.property_id)?.location_score ?? null,
      emotional: scoreBy.get(s.property_id)?.emotional_score ?? null,
      monthly: estimateMonthly(p, tour.clients)?.total ?? null,
      shown: !!sh, interest: sh?.buyer_interest_level ?? null,
      summary: sh?.ai_summary ?? null, analysis: (sh?.ai_analysis ?? null) as AiAnalysis | null,
    }
  })
  const images = await Promise.all(stops.map((s) => photo(s.property.primary_photo)))
  return { tour, stops: stops.map((s, i) => ({ ...s, image: images[i] })) }
}
export type TourReportData = Awaited<ReturnType<typeof loadTourReport>>

// ── Buyer journey ───────────────────────────────────────────────────
export async function loadJourneyReport(clientId: string) {
  const [client, prefs, scores, showings, ratings, offers] = await Promise.all([
    supabase.from('clients').select('id, first_name, last_name, status, target_price_min, target_price_max, preapproval_amount, target_areas, min_beds, min_baths, down_payment_amount, client_members(first_name, last_name)').eq('id', clientId).single(),
    supabase.from('client_preferences').select('preference_type, value, weight, confidence').eq('client_id', clientId).eq('status', 'active').order('weight', { ascending: false }),
    supabase.from('property_scores').select('property_id, overall_score, properties(address_line1, city, listing_price, property_tax, hoa_fee, beds, baths)').eq('client_id', clientId).order('overall_score', { ascending: false }),
    supabase.from('showings').select('property_id, ended_at, buyer_interest_level, ai_analysis').eq('client_id', clientId).eq('status', 'completed').order('ended_at', { ascending: false }),
    supabase.from('buyer_ratings').select('property_id, overall, decision').eq('client_id', clientId),
    supabase.from('offers').select('status, potential_price, properties(address_line1)').eq('client_id', clientId).neq('status', 'withdrawn'),
  ])
  const c = unwrap(client)
  const sh = unwrap(showings)
  const toured = new Set(sh.map((s) => s.property_id))
  const ratingBy = new Map(unwrap(ratings).map((r) => [r.property_id, r]))
  const interestBy = new Map<string, string | null>()
  for (const s of sh) if (!interestBy.has(s.property_id)) interestBy.set(s.property_id, s.buyer_interest_level)

  const homes = unwrap(scores).filter((s) => toured.has(s.property_id) && s.properties).map((s) => ({
    ...s, monthly: estimateMonthly(s.properties!, c)?.total ?? null,
    interest: interestBy.get(s.property_id) ?? null, rating: ratingBy.get(s.property_id) ?? null,
  }))

  const count = (pick: (a: AiAnalysis) => string[]) => {
    const m = new Map<string, number>()
    for (const s of sh) for (const k of pick((s.ai_analysis ?? {}) as AiAnalysis)) m.set(k, (m.get(k) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => ({ label: k, count: n }))
  }
  return {
    client: c,
    preferences: unwrap(prefs),
    homes,
    showingsCount: sh.length,
    loved: count((a) => (a.positives ?? []).map((p) => p.feature)),
    concerns: count((a) => (a.concerns ?? []).map((x) => x.title)),
    nextStep: (sh[0]?.ai_analysis as AiAnalysis | null)?.recommended_next_action ?? null,
    offers: unwrap(offers),
  }
}
export type JourneyReportData = Awaited<ReturnType<typeof loadJourneyReport>>
