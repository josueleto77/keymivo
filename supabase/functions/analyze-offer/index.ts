// analyze-offer — Conservative / Competitive / Strong offer scenarios for one buyer + one home.
// Prices, payments, cash to close, appraisal gap and financial fit are computed HERE, deterministically.
// The model only explains them (advantages, risks, terms to discuss) — it never sets a number and never
// estimates acceptance odds. RLS applies: the caller's JWT is forwarded on every read/write.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini'

class UserError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

// ── Deterministic pricing ───────────────────────────────────────────
type Market = 'hot' | 'balanced' | 'slow'
type Key = 'conservative' | 'competitive' | 'strong'
const KEYS: Key[] = ['conservative', 'competitive', 'strong']
/** Multipliers on the value anchor, by market pace. */
const PACE: Record<Market, Record<Key, number>> = {
  hot: { conservative: 1.0, competitive: 1.03, strong: 1.06 },
  balanced: { conservative: 0.97, competitive: 1.0, strong: 1.02 },
  slow: { conservative: 0.94, competitive: 0.97, strong: 1.0 },
}
/** Share of the estimated repair cost each scenario asks the seller to absorb. */
const REPAIR_SHARE: Record<Key, number> = { conservative: 1, competitive: 0.5, strong: 0 }
const CLOSING_COST_PCT = 2.5
const INSURANCE_PCT = 0.35
const PMI_PCT = 0.5

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)
const round1k = (n: number) => Math.round(n / 1000) * 1000

export interface Inputs {
  comps_low?: number | null; comps_high?: number | null; days_on_market?: number | null; repairs?: number | null
  market?: Market | null; interest_rate?: number | null; down_payment?: number | null; multiple_offers?: boolean | null
}

function pmt(loan: number, ratePct: number, years = 30) {
  if (loan <= 0) return 0
  const r = ratePct / 100 / 12, n = years * 12
  return r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n))
}

// deno-lint-ignore no-explicit-any
export function priceScenarios(property: any, client: any, inputs: Inputs) {
  const asking = num(property.listing_price)
  const low = num(inputs.comps_low), high = num(inputs.comps_high)
  const hasComps = low != null && high != null && low > 0 && high >= low
  const anchor = hasComps ? (low! + high!) / 2 : asking
  if (!anchor) throw new UserError('Add the asking price on the property, or a comparable value range, to run the analysis.')

  const market: Market = inputs.market === 'hot' || inputs.market === 'slow' ? inputs.market : 'balanced'
  const dom = num(inputs.days_on_market) ?? num(property.days_on_market)
  const domAdj = dom == null ? 0 : dom <= 7 ? 0.01 : dom >= 60 ? -0.02 : dom >= 30 ? -0.01 : 0
  const competitionAdj = inputs.multiple_offers ? 0.01 : 0
  const repairs = Math.max(0, num(inputs.repairs) ?? 0)
  const rate = num(inputs.interest_rate) ?? 6.75
  const taxes = num(property.property_tax) ?? 0
  const hoa = num(property.hoa_fee) ?? 0
  const preapproval = num(client.preapproval_amount)
  const budgetMax = num(client.target_price_max)
  const comfort = num(client.preferred_monthly_payment)
  const downInput = num(inputs.down_payment) ?? num(client.down_payment_amount)

  let prev = 0
  const scenarios = KEYS.map((key) => {
    let price = round1k(anchor * (PACE[market][key] + domAdj + competitionAdj) - repairs * REPAIR_SHARE[key])
    price = Math.max(price, prev) // never let a stronger scenario come in lower
    prev = price
    const down = Math.min(downInput ?? price * 0.2, price)
    const loan = price - down
    const downPct = (down / price) * 100
    const pi = pmt(loan, rate)
    const monthly = {
      principal_interest: Math.round(pi), taxes: Math.round(taxes / 12), insurance: Math.round((price * INSURANCE_PCT) / 100 / 12),
      hoa: Math.round(hoa), pmi: downPct < 20 ? Math.round((loan * PMI_PCT) / 100 / 12) : 0, total: 0,
    }
    monthly.total = monthly.principal_interest + monthly.taxes + monthly.insurance + monthly.hoa + monthly.pmi

    const fitNotes: string[] = []
    let fit: 'within' | 'stretch' | 'over' = 'within'
    if (preapproval != null && price > preapproval) { fit = 'over'; fitNotes.push(`$${(price - preapproval).toLocaleString('en-US')} above the preapproval`) }
    if (budgetMax != null && price > budgetMax) { if (fit === 'within') fit = 'stretch'; fitNotes.push(`$${(price - budgetMax).toLocaleString('en-US')} above the buyer's target max`) }
    if (comfort != null && monthly.total > comfort) {
      const over = monthly.total - comfort
      if (over > comfort * 0.1) { if (fit !== 'over') fit = 'stretch' } else if (fit === 'within') fit = 'stretch'
      fitNotes.push(`$${over.toLocaleString('en-US')}/mo above the buyer's monthly comfort`)
    }
    if (preapproval == null) fitNotes.push('No preapproval amount on file')

    return {
      key, price,
      diff_from_asking: asking ? price - asking : null,
      diff_pct: asking ? Math.round(((price - asking) / asking) * 1000) / 10 : null,
      down_payment: Math.round(down), down_payment_pct: Math.round(downPct * 10) / 10, loan_amount: Math.round(loan),
      monthly,
      cash_to_close_est: Math.round(down + (price * CLOSING_COST_PCT) / 100),
      appraisal_gap: hasComps && price > high! ? price - high! : 0,
      fit, fit_notes: fitNotes,
    }
  })

  return {
    scenarios,
    basis: {
      asking, anchor: Math.round(anchor), anchor_source: hasComps ? 'comps_midpoint' : 'asking_price',
      comps_low: hasComps ? low : null, comps_high: hasComps ? high : null,
      market, days_on_market: dom, dom_adjustment_pct: domAdj * 100, multiple_offers: !!inputs.multiple_offers,
      repairs, interest_rate: rate, closing_cost_pct: CLOSING_COST_PCT, insurance_pct: INSURANCE_PCT,
      down_payment_source: downInput != null ? 'buyer' : 'assumed_20_pct',
    },
  }
}

// ── AI explanation ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You assist licensed residential buyer agents in the United States preparing an offer strategy.
You receive one property, one buyer, the Realtor's market inputs and three offer scenarios whose prices,
payments, cash to close, appraisal gap and financial fit were ALREADY computed. Explain them.

Rules:
- Never change, recompute or invent numbers. Refer to the provided figures only.
- Never estimate or imply a probability that the seller accepts. Do not say "likely to win" or similar.
- No legal advice, no appraisal conclusions, no lending decisions. Terms are items to DISCUSS with the buyer,
  their lender and attorney (Massachusetts commonly uses an Offer to Purchase followed by a Purchase & Sale).
- Never mention protected characteristics or neighborhood demographics.
- Respect the buyer's financial limits: if a scenario is "over", say clearly that it exceeds what is on file.
- Use the buyer's preferences, showing feedback and concerns as evidence where relevant.
- recommended_scenario must be one the buyer can afford if any can; explain why in plain language.
- data_gaps lists missing inputs that would make the analysis more reliable (e.g. no comps provided).
Return JSON only, matching the schema.`

const list = { type: 'array', items: { type: 'string' } }
const scenarioSchema = {
  type: 'object', additionalProperties: false,
  required: ['advantages', 'risks', 'terms_to_discuss', 'explanation'],
  properties: { advantages: list, risks: list, terms_to_discuss: list, explanation: { type: 'string' } },
}
const SCHEMA = {
  name: 'offer_analysis', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['summary', 'conservative', 'competitive', 'strong', 'recommended_scenario', 'recommendation_reason', 'questions_to_verify', 'data_gaps'],
    properties: {
      summary: { type: 'string' },
      conservative: scenarioSchema, competitive: scenarioSchema, strong: scenarioSchema,
      recommended_scenario: { type: 'string', enum: KEYS },
      recommendation_reason: { type: 'string' },
      questions_to_verify: list,
      data_gaps: list,
    },
  },
}

async function callOpenAI(apiKey: string, context: unknown) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, temperature: 0.3,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(context) }],
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    if (res.status === 429) {
      throw new UserError(body?.error?.code === 'insufficient_quota'
        ? 'The OpenAI account has no API credits. Add credits at platform.openai.com → Billing, then retry.'
        : 'OpenAI is rate-limiting requests. Wait a minute and retry.', 429)
    }
    if (res.status === 401) throw new UserError('The OpenAI API key was rejected. Check the OPENAI_API_KEY secret.', 502)
    throw new Error(`OpenAI error ${res.status}: ${body?.error?.message ?? ''}`)
  }
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  })

  let offerId: string | undefined
  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) throw new UserError('Not signed in', 401)
    if ((await db.rpc('is_org_staff')).data !== true) throw new UserError('Not allowed', 403)
    const body = await req.json().catch(() => ({}))
    offerId = typeof body.offer_id === 'string' ? body.offer_id : undefined
    if (!offerId) throw new UserError('offer_id is required')
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new UserError('AI is not configured yet (missing OPENAI_API_KEY secret).', 503)
    return json(await analyze(db, offerId, apiKey))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('analyze-offer failed', offerId, message)
    if (offerId) await db.from('offers').update({ ai_status: 'failed' }).eq('id', offerId)
    return json({ error: message }, e instanceof UserError ? e.status : 500)
  }
})

async function analyze(db: SupabaseClient, offerId: string, apiKey: string) {
  const { data: offer, error } = await db.from('offers')
    .select('*, properties(*), clients(*, client_preferences(category, value, preference_type, weight, status))')
    .eq('id', offerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!offer) throw new UserError('Offer not found', 404)
  const property = offer.properties, client = offer.clients

  const priced = priceScenarios(property, client, (offer.inputs ?? {}) as Inputs)
  await db.from('offers').update({ ai_status: 'processing' }).eq('id', offerId)

  const [score, showings, ratings] = await Promise.all([
    db.from('property_scores').select('overall_score, price_score, condition_score, must_have_score, ai_reasoning')
      .eq('client_id', client.id).eq('property_id', property.id).maybeSingle(),
    db.from('showings').select('ai_summary, buyer_interest_level, ai_analysis').eq('client_id', client.id).eq('property_id', property.id)
      .eq('ai_status', 'completed').order('created_at', { ascending: false }).limit(2),
    db.from('buyer_ratings').select('overall, decision, comment').eq('client_id', client.id).eq('property_id', property.id),
  ])

  const context = {
    property: {
      address: `${property.address_line1}, ${property.city}, ${property.state}`, asking_price: property.listing_price,
      beds: property.beds, baths: property.baths, square_feet: property.square_feet, year_built: property.year_built,
      annual_property_tax: property.property_tax, hoa_monthly: property.hoa_fee, days_on_market: property.days_on_market,
      status: property.status,
    },
    buyer: {
      preapproval: client.preapproval_amount, preapproval_status: client.preapproval_status, budget_min: client.target_price_min,
      budget_max: client.target_price_max, monthly_payment_comfort: client.preferred_monthly_payment,
      down_payment: client.down_payment_amount, loan_type: client.loan_type, timeline: client.buying_timeline,
      preferences: (client.client_preferences ?? []).filter((p: { status: string }) => p.status !== 'rejected')
        .map((p: { value: string; preference_type: string }) => `${p.preference_type}: ${p.value}`),
    },
    buyer_match: score.data ?? null,
    showing_feedback: (showings.data ?? []).map((s) => ({
      summary: s.ai_summary, interest: s.buyer_interest_level,
      // deno-lint-ignore no-explicit-any
      concerns: ((s.ai_analysis as any)?.concerns ?? []).map((c: { title: string }) => c.title),
    })),
    buyer_portal_ratings: ratings.data ?? [],
    realtor_notes: offer.notes ?? null,
    pricing_basis: priced.basis,
    scenarios: priced.scenarios,
  }

  const ai = await callOpenAI(apiKey, context)
  const analysis = {
    version: 1,
    generated_at: new Date().toISOString(),
    model: MODEL,
    basis: priced.basis,
    scenarios: priced.scenarios.map((s) => ({ ...s, ...ai[s.key] })),
    summary: ai.summary,
    recommended: { scenario: ai.recommended_scenario, reason: ai.recommendation_reason },
    questions_to_verify: ai.questions_to_verify,
    data_gaps: ai.data_gaps,
  }
  const selected = (offer.selected_scenario ?? ai.recommended_scenario) as Key
  const { error: upErr } = await db.from('offers').update({
    analysis, ai_status: 'completed', analyzed_at: analysis.generated_at,
    selected_scenario: selected,
    potential_price: analysis.scenarios.find((s) => s.key === selected)!.price,
  }).eq('id', offerId)
  if (upErr) throw new Error(upErr.message)
  return analysis
}
