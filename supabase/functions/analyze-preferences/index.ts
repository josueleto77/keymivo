// analyze-preferences — Buyer Preference Agent.
// Looks across ALL of a buyer's showings and produces a "What We've Learned" narrative plus
// evidence-backed preference suggestions. Nothing is applied: suggestions wait for Realtor review.
// Runs with the caller's JWT so RLS enforces tenant isolation.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini'

const ALLOWED_CATEGORIES = [
  'bedrooms', 'bathrooms', 'price', 'location', 'commute', 'yard', 'garage', 'kitchen', 'basement', 'size',
  'condition', 'taxes', 'hoa', 'layout', 'parking', 'outdoor', 'amenities', 'other',
]
const PREF_TYPES = ['must_have', 'strong_preference', 'prefer', 'neutral', 'dislike', 'strong_dislike', 'deal_breaker']

const SYSTEM_PROMPT = `You are the Buyer Preference Agent for licensed residential buyer agents in the United States.
You receive a buyer's stated preferences and everything observed across multiple home showings
(quick reactions, notes, AI showing summaries, Buyer Match scores).

Your job: explain how the buyer's real behavior compares with what they said they wanted.
- "narrative": 2-4 sentences in the style of: "After five showings, Mike and Sarah appear more sensitive to
  road noise and property condition than originally indicated. A garage has become increasingly important,
  while a finished basement appears less important than initially stated." Mention the number of showings.
- "suggestions": only where behavior across showings gives real evidence that a preference should change or a
  new preference exists. evidence_count = number of distinct showing interactions supporting it. Reference an
  existing preference id when it applies, else null. Prefer fewer, well-supported suggestions.
- "consistently_love" / "consistently_reject": features the buyer reacted to the same way at 2+ homes.
- Use ONLY objective property criteria (features, price, condition, size, layout, commute, taxes, HOA, transport,
  buyer-selected amenities). Never infer or mention protected characteristics or neighborhood demographics, never
  steer. Never give legal, appraisal or inspection conclusions.
Return JSON only, matching the schema.`

const SCHEMA = {
  name: 'buyer_learning',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['narrative', 'consistently_love', 'consistently_reject', 'suggestions'],
    properties: {
      narrative: { type: 'string' },
      consistently_love: { type: 'array', items: { type: 'string' } },
      consistently_reject: { type: 'array', items: { type: 'string' } },
      suggestions: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['existing_preference_id', 'value', 'category', 'suggested_type', 'suggested_weight', 'confidence', 'evidence_count', 'evidence', 'reason'],
          properties: {
            existing_preference_id: { type: ['string', 'null'] },
            value: { type: 'string' },
            category: { type: 'string', enum: ALLOWED_CATEGORIES },
            suggested_type: { type: 'string', enum: PREF_TYPES },
            suggested_weight: { type: 'integer' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            evidence_count: { type: 'integer' },
            evidence: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) return json({ error: 'Not signed in' }, 401)
    if ((await db.rpc('is_org_staff')).data !== true) return json({ error: 'Not allowed' }, 403)
    const { client_id } = await req.json().catch(() => ({}))
    if (typeof client_id !== 'string') return json({ error: 'client_id is required' }, 400)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'AI is not configured yet (missing OPENAI_API_KEY secret).' }, 503)

    // ── Context (RLS-scoped) ─────────────────────────────────────────
    const { data: client, error } = await db
      .from('clients')
      .select('id, organization_id, first_name, last_name, target_price_min, target_price_max, client_members(id, first_name), client_preferences(*)')
      .eq('id', client_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!client) return json({ error: 'Client not found' }, 404)

    const { data: showings } = await db
      .from('showings')
      .select('id, started_at, ai_summary, buyer_interest_score, properties(address_line1, listing_price), showing_notes(content), buyer_reactions(feature, reaction, source, client_member_id)')
      .eq('client_id', client_id)
      .eq('status', 'completed')
      .order('started_at')
    if (!showings?.length) return json({ error: 'Complete at least one showing first.' }, 400)

    const { data: scores } = await db.from('property_scores').select('overall_score, properties(address_line1)').eq('client_id', client_id)
    const prefs = (client.client_preferences ?? []).filter((p: { status: string }) => p.status !== 'rejected')
    const member = (id: string | null) => client.client_members?.find((m: { id: string }) => m.id === id)?.first_name

    const context = {
      buyer: `${client.first_name} ${client.last_name ?? ''}`.trim(),
      household: (client.client_members ?? []).map((m: { first_name: string }) => m.first_name),
      stated_preferences: prefs.map((p: Record<string, unknown>) => ({
        id: p.id, value: p.value, type: p.preference_type, category: p.category, weight: p.weight,
        status: p.status, source: p.source, evidence_count: p.evidence_count,
      })),
      showings: showings.map((s: Record<string, any>, i: number) => ({
        number: i + 1,
        address: s.properties?.address_line1,
        list_price: s.properties?.listing_price,
        interest_score: s.buyer_interest_score,
        ai_summary: s.ai_summary,
        notes: (s.showing_notes ?? []).map((n: { content: string }) => n.content),
        reactions: (s.buyer_reactions ?? []).map((r: Record<string, any>) => ({
          feature: r.feature, reaction: r.reaction, by: member(r.client_member_id) ?? 'buyer(s)', inferred_by_ai: r.source === 'showing_ai',
        })),
      })),
      buyer_match_scores: (scores ?? []).map((s: Record<string, any>) => ({ address: s.properties?.address_line1, score: s.overall_score })),
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Buyer context (JSON):\n${JSON.stringify(context)}` },
        ],
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error('OpenAI error', res.status, detail.slice(0, 500))
      if (res.status === 429 && /insufficient_quota|credit_balance/.test(detail)) throw new Error('The OpenAI account has no API credits.')
      throw new Error(`AI request failed (${res.status}).`)
    }
    const msg = (await res.json()).choices?.[0]?.message
    if (msg?.refusal) throw new Error('The AI declined this request.')
    const out = JSON.parse(msg?.content ?? '{}')
    const narrative = typeof out.narrative === 'string' ? out.narrative.trim() : ''
    if (!narrative) throw new Error('AI returned an incomplete result.')
    const prefIds = new Set(prefs.map((p: { id: string }) => p.id))
    const prefById = new Map(prefs.map((p: Record<string, any>) => [p.id, p]))
    const suggestions = (Array.isArray(out.suggestions) ? out.suggestions : [])
      .filter((s: Record<string, any>) => s.value && PREF_TYPES.includes(s.suggested_type) && ALLOWED_CATEGORIES.includes(s.category))
      .slice(0, 8)

    // ── Persist: replace previous client-level learning + still-pending client-level suggestions ──
    const { data: oldPending } = await db
      .from('ai_insights')
      .select('id, insight_type, structured_data')
      .eq('client_id', client_id)
      .is('showing_id', null)
      .in('insight_type', ['buyer_learning', 'preference_new', 'preference_change'])
    const stalePrefIds = (oldPending ?? [])
      .filter((i: Record<string, any>) => i.insight_type === 'preference_new' && i.structured_data?.status === 'pending')
      .map((i: Record<string, any>) => i.structured_data.preference_id)
    if (stalePrefIds.length) {
      await db.from('client_preferences').delete().in('id', stalePrefIds).eq('status', 'suggested')
    }
    const staleInsightIds = (oldPending ?? [])
      .filter((i: Record<string, any>) => i.insight_type === 'buyer_learning' || i.structured_data?.status === 'pending')
      .map((i: { id: string }) => i.id)
    if (staleInsightIds.length) await db.from('ai_insights').delete().in('id', staleInsightIds)

    const base = { organization_id: client.organization_id, client_id }
    const rows: Record<string, unknown>[] = [{
      ...base, insight_type: 'buyer_learning', content: narrative, confidence: showings.length >= 3 ? 'high' : showings.length === 2 ? 'medium' : 'low',
      structured_data: {
        showings_analyzed: showings.length,
        consistently_love: (out.consistently_love ?? []).slice(0, 10),
        consistently_reject: (out.consistently_reject ?? []).slice(0, 10),
        model: MODEL,
      },
    }]

    for (const s of suggestions) {
      const existing = s.existing_preference_id && prefIds.has(s.existing_preference_id) ? prefById.get(s.existing_preference_id) : null
      const data = {
        status: 'pending', value: existing?.value ?? s.value, to_type: s.suggested_type, to_weight: clamp(s.suggested_weight),
        reason: s.reason, evidence: s.evidence, evidence_count: Math.max(1, Math.round(Number(s.evidence_count) || 1)),
      }
      if (existing) {
        if (existing.preference_type === s.suggested_type && Math.abs(existing.weight - data.to_weight) < 10) continue
        rows.push({
          ...base, insight_type: 'preference_change', content: `${existing.value}: ${s.reason}`, confidence: s.confidence,
          structured_data: { ...data, preference_id: existing.id, from_type: existing.preference_type, from_weight: existing.weight },
        })
      } else {
        const { data: created } = await db.from('client_preferences').insert({
          ...base, preference_type: s.suggested_type, category: s.category, value: s.value, weight: data.to_weight,
          confidence: s.confidence, evidence_count: data.evidence_count, source: 'showing_ai', status: 'suggested',
        }).select('id').single()
        if (created) {
          rows.push({
            ...base, insight_type: 'preference_new', content: `${s.value}: ${s.reason}`, confidence: s.confidence,
            structured_data: { ...data, preference_id: created.id },
          })
        }
      }
    }
    const { error: insErr } = await db.from('ai_insights').insert(rows)
    if (insErr) throw new Error(insErr.message)

    await db.from('activity_logs').insert({
      organization_id: client.organization_id, user_id: u.user.id, action: 'buyer_preferences_analyzed',
      entity_type: 'clients', entity_id: client_id, metadata: { showings: showings.length, suggestions: rows.length - 1 },
    })
    return json({ narrative, suggestions: rows.length - 1 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('analyze-preferences failed', message)
    return json({ error: message }, 500)
  }
})
