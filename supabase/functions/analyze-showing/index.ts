// analyze-showing — Showing Intelligence Agent.
// Auth: the caller's JWT is forwarded to Supabase, so every read/write goes through RLS
// (tenant isolation is enforced by the database, not by this function).
// Secrets: OPENAI_API_KEY (required), OPENAI_MODEL (optional), OPENAI_TRANSCRIBE_MODEL (optional).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini'
const TRANSCRIBE_MODEL = Deno.env.get('OPENAI_TRANSCRIBE_MODEL') ?? 'whisper-1'

/** Default Buyer Match weights (playbook). Protected-class variables are never inputs. */
const WEIGHTS = { must_have: 0.3, price: 0.2, location: 0.15, size: 0.1, condition: 0.1, financial: 0.1, emotional: 0.05 }

const ALLOWED_CATEGORIES = [
  'bedrooms', 'bathrooms', 'price', 'location', 'commute', 'yard', 'garage', 'kitchen', 'basement', 'size',
  'condition', 'taxes', 'hoa', 'layout', 'parking', 'outdoor', 'amenities', 'other',
]
const PREF_TYPES = ['must_have', 'strong_preference', 'prefer', 'neutral', 'dislike', 'strong_dislike', 'deal_breaker']

const SYSTEM_PROMPT = `You are an AI assistant for licensed residential buyer agents in the United States.
Analyze showing notes, quick reactions and transcripts from a single home showing.
Extract objective buyer preferences, reactions, concerns, questions and action items.

Rules:
- Never provide legal advice. Never provide appraisal conclusions. Never replace a home inspector,
  engineer, electrician, contractor or code official — phrase physical observations as items to verify.
- Never infer or mention protected characteristics (race, color, religion, national origin, sex,
  familial status, disability, or proxies for them). Never engage in housing steering or comment on
  neighborhood demographics. Use only objective criteria: price, features, condition, size, layout,
  commute, taxes, HOA, transportation, buyer-selected amenities.
- Only state what the evidence supports. Do not invent facts about the property.
- Preference learning: compare the evidence with the buyer's current preferences. Suggest a change only
  when this showing gives real evidence. Reference an existing preference by its id when it applies;
  otherwise propose a new preference (existing_preference_id = null).
- interest_score is 0-100 and must be consistent with interest_level
  (low <40, medium 40-69, high 70-87, very_high 88+).
- location_score and condition_score are 0-100 judgments of how well this home's location and condition
  fit THIS buyer, based only on the evidence (use 70 when there is no evidence).
- Tasks are concrete next actions for the Realtor (e.g. "Verify roof age", "Request seller disclosures").
Return JSON only, matching the schema.`

const nullableString = { type: ['string', 'null'] }
const SCHEMA = {
  name: 'showing_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'interest_level', 'interest_score', 'summary', 'positives', 'negatives', 'concerns', 'questions', 'tasks',
      'preferences_learned', 'must_have_assessment', 'location_score', 'condition_score', 'comparison_insights',
      'recommended_next_action',
    ],
    properties: {
      interest_level: { type: 'string', enum: ['low', 'medium', 'high', 'very_high'] },
      interest_score: { type: 'integer' },
      summary: { type: 'string' },
      positives: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['feature', 'detail', 'strength'],
          properties: { feature: { type: 'string' }, detail: { type: 'string' }, strength: { type: 'string', enum: ['love', 'like'] } },
        },
      },
      negatives: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['feature', 'detail', 'severity'],
          properties: { feature: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string', enum: ['dislike', 'deal_breaker'] } },
        },
      },
      concerns: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['title', 'detail', 'confidence', 'basis'],
          properties: {
            title: { type: 'string' }, detail: { type: 'string' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            basis: { type: 'string' },
          },
        },
      },
      questions: { type: 'array', items: { type: 'string' } },
      tasks: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['title', 'description', 'priority'],
          properties: { title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] } },
        },
      },
      preferences_learned: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['existing_preference_id', 'value', 'category', 'suggested_type', 'suggested_weight', 'confidence', 'evidence', 'reason'],
          properties: {
            existing_preference_id: nullableString,
            value: { type: 'string' },
            category: { type: 'string', enum: ALLOWED_CATEGORIES },
            suggested_type: { type: 'string', enum: PREF_TYPES },
            suggested_weight: { type: 'integer' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            evidence: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
      must_have_assessment: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['preference_id', 'status'],
          properties: { preference_id: { type: 'string' }, status: { type: 'string', enum: ['met', 'not_met', 'unknown'] } },
        },
      },
      location_score: { type: 'integer' },
      condition_score: { type: 'integer' },
      comparison_insights: { type: 'array', items: { type: 'string' } },
      recommended_next_action: { type: 'string' },
    },
  },
}

type Analysis = {
  interest_level: 'low' | 'medium' | 'high' | 'very_high'
  interest_score: number
  summary: string
  positives: { feature: string; detail: string; strength: 'love' | 'like' }[]
  negatives: { feature: string; detail: string; severity: 'dislike' | 'deal_breaker' }[]
  concerns: { title: string; detail: string; confidence: 'low' | 'medium' | 'high'; basis: string }[]
  questions: string[]
  tasks: { title: string; description: string; priority: 'low' | 'medium' | 'high' }[]
  preferences_learned: {
    existing_preference_id: string | null; value: string; category: string; suggested_type: string
    suggested_weight: number; confidence: 'low' | 'medium' | 'high'; evidence: string; reason: string
  }[]
  must_have_assessment: { preference_id: string; status: 'met' | 'not_met' | 'unknown' }[]
  location_score: number
  condition_score: number
  comparison_insights: string[]
  recommended_next_action: string
}

const clamp = (n: unknown, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)))
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

class UserError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  let showingId: string | undefined
  try {
    const { data: userData, error: userErr } = await db.auth.getUser()
    if (userErr || !userData.user) throw new UserError('Not signed in', 401)
    const isStaff = (await db.rpc('is_org_staff')).data === true
    if (!isStaff) throw new UserError('Not allowed', 403)

    const body = await req.json().catch(() => ({}))
    showingId = typeof body.showing_id === 'string' ? body.showing_id : undefined
    if (!showingId) throw new UserError('showing_id is required')

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new UserError('AI is not configured yet (missing OPENAI_API_KEY secret).', 503)

    const result = await analyze(db, showingId, apiKey, userData.user.id)
    return json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('analyze-showing failed', showingId, message)
    if (showingId) await db.from('showings').update({ ai_status: 'failed' }).eq('id', showingId)
    return json({ error: message }, e instanceof UserError ? e.status : 500)
  }
})

async function analyze(db: SupabaseClient, showingId: string, apiKey: string, userId: string) {
  // ── 1. Load context (RLS-scoped) ───────────────────────────────────
  const { data: showing, error } = await db
    .from('showings')
    .select('*, properties(*), clients(*, client_members(id, first_name), client_preferences(*)), showing_notes(*), buyer_reactions(*), property_photos(room_type, caption)')
    .eq('id', showingId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!showing) throw new UserError('Showing not found', 404)

  await db.from('showings').update({ ai_status: 'processing' }).eq('id', showingId)

  const property = showing.properties
  const client = showing.clients
  const prefs = (client.client_preferences ?? []).filter((p: { status: string }) => p.status !== 'rejected')

  // ── 2. Transcribe any untranscribed recordings (best effort) ───────
  const transcript = await ensureTranscripts(db, showingId, apiKey)

  const { data: otherScores } = await db
    .from('property_scores')
    .select('overall_score, properties(address_line1, listing_price)')
    .eq('client_id', client.id)
    .neq('property_id', property.id)
    .order('overall_score', { ascending: false })
    .limit(6)

  const memberName = (id: string | null) => client.client_members?.find((m: { id: string }) => m.id === id)?.first_name
  const context = {
    property: {
      address: `${property.address_line1}, ${property.city}, ${property.state}`,
      list_price: property.listing_price, beds: property.beds, baths: property.baths, square_feet: property.square_feet,
      year_built: property.year_built, annual_property_tax: property.property_tax, hoa_monthly: property.hoa_fee,
      days_on_market: property.days_on_market, property_type: property.property_type,
    },
    buyer: {
      name: `${client.first_name} ${client.last_name ?? ''}`.trim(),
      household_members: (client.client_members ?? []).map((m: { first_name: string }) => m.first_name),
      budget_min: client.target_price_min, budget_max: client.target_price_max, preapproval: client.preapproval_amount,
      monthly_payment_comfort: client.preferred_monthly_payment, target_areas: client.target_areas,
      min_beds: client.min_beds, min_baths: client.min_baths,
    },
    current_preferences: prefs.map((p: Record<string, unknown>) => ({
      id: p.id, value: p.value, type: p.preference_type, category: p.category, weight: p.weight,
      confirmed_by_realtor: p.confirmed_by_realtor, status: p.status,
    })),
    quick_reactions: (showing.buyer_reactions ?? [])
      .filter((r: { source: string }) => r.source !== 'showing_ai')
      .map((r: { reaction: string; feature: string; client_member_id: string | null }) => ({
        reaction: r.reaction, feature: r.feature, by: memberName(r.client_member_id) ?? 'buyer(s)',
      })),
    notes: (showing.showing_notes ?? []).map((n: { content: string; room_type: string | null }) => ({ room: n.room_type, text: n.content })),
    photos: (showing.property_photos ?? []).map((p: { room_type: string | null; caption: string | null }) => ({ subject: p.room_type, note: p.caption })),
    transcript: transcript || null,
    previously_toured_homes: (otherScores ?? []).map((s: { overall_score: number; properties: { address_line1: string; listing_price: number } }) => ({
      address: s.properties?.address_line1, buyer_match: s.overall_score, list_price: s.properties?.listing_price,
    })),
  }

  if (!context.quick_reactions.length && !context.notes.length && !transcript && !context.photos.length) {
    throw new UserError('Nothing was captured during this showing. Add a reaction or note, then retry.')
  }

  // ── 3. OpenAI structured output ────────────────────────────────────
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Showing context (JSON):\n${JSON.stringify(context)}` },
      ],
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    console.error('OpenAI error', res.status, detail.slice(0, 500))
    if (res.status === 401) throw new Error('OpenAI rejected the API key.')
    if (res.status === 429) {
      throw new Error(/insufficient_quota|credit_balance/.test(detail)
        ? 'The OpenAI account has no API credits. Add credits at platform.openai.com → Billing, then retry.'
        : 'OpenAI rate limit reached. Wait a minute and retry.')
    }
    if (res.status === 404) throw new Error(`The AI model "${MODEL}" isn't available on this OpenAI account.`)
    throw new Error(`AI request failed (${res.status}).`)
  }
  const completion = await res.json()
  const raw = completion.choices?.[0]?.message
  if (raw?.refusal) throw new Error('The AI declined to analyze this showing.')
  const a = validate(JSON.parse(raw?.content ?? '{}'), new Set(prefs.map((p: { id: string }) => p.id)))

  // ── 4. Persist (idempotent: re-running replaces previous AI output) ─
  const prefById = new Map(prefs.map((p: { id: string }) => [p.id, p]))

  // Tasks
  await db.from('tasks').delete().eq('showing_id', showingId).eq('ai_generated', true).eq('status', 'open')
  if (a.tasks.length) {
    await must(db.from('tasks').insert(a.tasks.map((t) => ({
      organization_id: showing.organization_id, client_id: client.id, property_id: property.id, showing_id: showingId,
      title: t.title, description: t.description, priority: t.priority, ai_generated: true,
    }))))
  }

  // AI-sourced buyer reactions (only for features the Realtor didn't already tag)
  await db.from('buyer_reactions').delete().eq('showing_id', showingId).eq('source', 'showing_ai')
  const tagged = new Set((showing.buyer_reactions ?? []).filter((r: { source: string }) => r.source !== 'showing_ai').map((r: { feature: string }) => r.feature.toLowerCase()))
  const aiReactions = [
    ...a.positives.map((p) => ({ feature: p.feature, reaction: p.strength, sentiment: 'positive', strength: p.strength === 'love' ? 5 : 4 })),
    ...a.negatives.map((n) => ({ feature: n.feature, reaction: n.severity, sentiment: 'negative', strength: n.severity === 'deal_breaker' ? 1 : 2 })),
  ].filter((r) => !tagged.has(r.feature.toLowerCase()))
  if (aiReactions.length) {
    await must(db.from('buyer_reactions').insert(aiReactions.map((r) => ({
      ...r, organization_id: showing.organization_id, showing_id: showingId, client_id: client.id, property_id: property.id, source: 'showing_ai',
    }))))
  }

  // Preference suggestions — never overwrite confirmed preferences; Realtor must accept.
  await db.from('client_preferences').delete().eq('client_id', client.id).eq('status', 'suggested').eq('source', 'showing_ai')
    .filter('id', 'in', `(${(await suggestedFromThisShowing(db, showingId)).join(',') || '00000000-0000-0000-0000-000000000000'})`)
  await db.from('ai_insights').delete().eq('showing_id', showingId)

  const insights: Record<string, unknown>[] = [
    { insight_type: 'showing_summary', content: a.summary, confidence: 'high', structured_data: { interest_level: a.interest_level, interest_score: a.interest_score } },
    { insight_type: 'next_action', content: a.recommended_next_action, confidence: 'medium' },
    ...a.concerns.map((c) => ({ insight_type: 'concern', content: c.title, confidence: c.confidence, structured_data: c })),
    ...a.questions.map((q) => ({ insight_type: 'question', content: q, confidence: 'high' })),
    ...a.comparison_insights.map((c) => ({ insight_type: 'comparison', content: c, confidence: 'medium' })),
  ]

  const newPrefIds: string[] = []
  for (const p of a.preferences_learned) {
    const existing = p.existing_preference_id ? prefById.get(p.existing_preference_id) as Record<string, unknown> | undefined : undefined
    if (existing) {
      if (existing.preference_type === p.suggested_type && Math.abs(Number(existing.weight) - p.suggested_weight) < 10) continue
      insights.push({
        insight_type: 'preference_change',
        content: `${existing.value}: ${p.reason}`,
        confidence: p.confidence,
        structured_data: {
          status: 'pending', preference_id: existing.id, value: existing.value,
          from_type: existing.preference_type, from_weight: existing.weight,
          to_type: p.suggested_type, to_weight: p.suggested_weight, reason: p.reason, evidence: p.evidence,
        },
      })
    } else {
      const { data: created } = await db.from('client_preferences').insert({
        organization_id: showing.organization_id, client_id: client.id, preference_type: p.suggested_type,
        category: p.category, value: p.value, weight: p.suggested_weight, confidence: p.confidence,
        evidence_count: 1, source: 'showing_ai', status: 'suggested', confirmed_by_realtor: false,
      }).select('id').single()
      if (created) {
        newPrefIds.push(created.id)
        insights.push({
          insight_type: 'preference_new', content: `${p.value}: ${p.reason}`, confidence: p.confidence,
          structured_data: { status: 'pending', preference_id: created.id, value: p.value, to_type: p.suggested_type, to_weight: p.suggested_weight, reason: p.reason, evidence: p.evidence },
        })
      }
    }
  }

  await must(db.from('ai_insights').insert(insights.map((i) => ({
    ...i, organization_id: showing.organization_id, client_id: client.id, property_id: property.id, showing_id: showingId,
  }))))

  // ── 5. Buyer Match score (deterministic + explainable) ─────────────
  const allReactions = [...(showing.buyer_reactions ?? []).filter((r: { source: string }) => r.source !== 'showing_ai'), ...aiReactions]
  const score = computeScore({ property, client, prefs, analysis: a, reactions: allReactions })
  await must(db.from('property_scores').upsert({
    organization_id: showing.organization_id, client_id: client.id, property_id: property.id, ...score.parts,
    overall_score: score.overall, ai_reasoning: `${a.summary}\n\n${score.explanation}`, updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id,property_id' }))

  // ── 6. Showing + client + audit ────────────────────────────────────
  await must(db.from('showings').update({
    ai_status: 'completed', ai_summary: a.summary, ai_analysis: { ...a, model: MODEL, score },
    buyer_interest_score: a.interest_score, buyer_interest_level: a.interest_level,
  }).eq('id', showingId))

  const readiness = a.interest_level === 'very_high' && score.overall >= 85 ? 'high' : a.interest_score >= 70 ? 'medium' : null
  if (readiness && (client.offer_readiness === 'low' || (readiness === 'high' && client.offer_readiness !== 'high'))) {
    await db.from('clients').update({ offer_readiness: readiness }).eq('id', client.id)
  }

  await db.from('activity_logs').insert({
    organization_id: showing.organization_id, user_id: userId, action: 'AI_analysis_generated',
    entity_type: 'showings', entity_id: showingId, metadata: { model: MODEL, interest_score: a.interest_score, buyer_match: score.overall },
  })

  return { analysis: a, score, new_preference_ids: newPrefIds }
}

/** Suggested preferences created by a previous run of this showing (so re-runs don't duplicate them). */
async function suggestedFromThisShowing(db: SupabaseClient, showingId: string): Promise<string[]> {
  const { data } = await db.from('ai_insights').select('structured_data').eq('showing_id', showingId).eq('insight_type', 'preference_new')
  return (data ?? [])
    .map((r: { structured_data: { preference_id?: string; status?: string } | null }) => r.structured_data)
    .filter((d): d is { preference_id: string; status: string } => !!d?.preference_id && d.status === 'pending')
    .map((d) => d.preference_id)
}

async function ensureTranscripts(db: SupabaseClient, showingId: string, apiKey: string) {
  const [{ data: recs }, { data: existing }] = await Promise.all([
    db.from('recordings').select('*').eq('showing_id', showingId).order('created_at'),
    db.from('transcripts').select('recording_id, content').eq('showing_id', showingId),
  ])
  const done = new Set((existing ?? []).map((t: { recording_id: string | null }) => t.recording_id))
  const texts = (existing ?? []).map((t: { content: string }) => t.content)
  for (const r of recs ?? []) {
    if (done.has(r.id)) continue
    try {
      await db.from('recordings').update({ transcription_status: 'processing' }).eq('id', r.id)
      const { data: blob, error } = await db.storage.from('recordings').download(r.audio_url)
      if (error || !blob) throw new Error(error?.message ?? 'download failed')
      if (blob.size > 24 * 1024 * 1024) throw new Error('recording too large to transcribe')
      const form = new FormData()
      form.append('file', new File([blob], r.audio_url.split('/').pop() ?? 'audio.webm', { type: blob.type || 'audio/webm' }))
      form.append('model', TRANSCRIBE_MODEL)
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
      })
      if (!res.ok) throw new Error(`transcription ${res.status}`)
      const { text } = await res.json()
      if (text?.trim()) {
        await db.from('transcripts').insert({ organization_id: r.organization_id, showing_id: showingId, recording_id: r.id, content: text.trim() })
        texts.push(text.trim())
      }
      await db.from('recordings').update({ transcription_status: 'completed' }).eq('id', r.id)
    } catch (e) {
      console.error('transcription failed', r.id, e instanceof Error ? e.message : e)
      await db.from('recordings').update({ transcription_status: 'failed' }).eq('id', r.id)
    }
  }
  return texts.join('\n\n').slice(0, 40_000)
}

function validate(x: Partial<Analysis>, prefIds: Set<string>): Analysis {
  const arr = <T>(v: T[] | undefined) => (Array.isArray(v) ? v : [])
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const level = ['low', 'medium', 'high', 'very_high'].includes(x.interest_level as string) ? x.interest_level! : 'medium'
  const out: Analysis = {
    interest_level: level,
    interest_score: clamp(x.interest_score),
    summary: str(x.summary).slice(0, 2000),
    positives: arr(x.positives).filter((p) => str(p.feature)).slice(0, 15),
    negatives: arr(x.negatives).filter((n) => str(n.feature)).slice(0, 15),
    concerns: arr(x.concerns).filter((c) => str(c.title)).slice(0, 15),
    questions: arr(x.questions).map(str).filter(Boolean).slice(0, 15),
    tasks: arr(x.tasks).filter((t) => str(t.title)).slice(0, 12),
    preferences_learned: arr(x.preferences_learned)
      .filter((p) => str(p.value) && PREF_TYPES.includes(p.suggested_type) && ALLOWED_CATEGORIES.includes(p.category))
      .map((p) => ({ ...p, existing_preference_id: p.existing_preference_id && prefIds.has(p.existing_preference_id) ? p.existing_preference_id : null, suggested_weight: clamp(p.suggested_weight) }))
      .slice(0, 10),
    must_have_assessment: arr(x.must_have_assessment).filter((m) => prefIds.has(m.preference_id)),
    location_score: clamp(x.location_score ?? 70),
    condition_score: clamp(x.condition_score ?? 70),
    comparison_insights: arr(x.comparison_insights).map(str).filter(Boolean).slice(0, 8),
    recommended_next_action: str(x.recommended_next_action).slice(0, 1000),
  }
  if (!out.summary) throw new Error('AI returned an incomplete analysis.')
  return out
}

// deno-lint-ignore no-explicit-any
function computeScore({ property, client, prefs, analysis, reactions }: { property: any; client: any; prefs: any[]; analysis: Analysis; reactions: { reaction: string }[] }) {
  const why: string[] = []
  const price = Number(property.listing_price) || 0
  const max = Number(client.target_price_max) || Number(client.preapproval_amount) || 0

  // Price fit vs budget ceiling
  let price_score = 70
  if (price && max) {
    const r = price / max
    price_score = r <= 0.9 ? 100 : r <= 1 ? Math.round(100 - (r - 0.9) * 100) : clamp(90 - (r - 1) * 600)
    why.push(`Price: ${Math.round(r * 100)}% of budget ceiling → ${price_score}.`)
  }

  // Size vs minimum beds/baths
  const fit = (have: unknown, need: unknown) =>
    need == null || have == null ? 75 : Number(have) >= Number(need) ? 100 : clamp(100 - 35 * (Number(need) - Number(have)))
  const size_score = Math.round((fit(property.beds, client.min_beds) + fit(property.baths, client.min_baths)) / 2)
  why.push(`Size: ${property.beds ?? '?'} bd / ${property.baths ?? '?'} ba vs minimum ${client.min_beds ?? '—'} / ${client.min_baths ?? '—'} → ${size_score}.`)

  // Financial: estimated monthly cost vs comfort level (estimate only, not a lending quote)
  let financial_score = 70
  if (price) {
    const down = Number(client.down_payment_amount) || price * 0.2
    const loan = Math.max(0, price - down)
    const i = 0.0675 / 12
    const pi = (loan * i) / (1 - Math.pow(1 + i, -360))
    const monthly = pi + (Number(property.property_tax) || 0) / 12 + (Number(property.hoa_fee) || 0) + (price * 0.0035) / 12
    const comfort = Number(client.preferred_monthly_payment)
    if (comfort) {
      const r = monthly / comfort
      financial_score = r <= 1 ? 100 : clamp(100 - (r - 1) * 300)
      why.push(`Financial: est. $${Math.round(monthly).toLocaleString('en-US')}/mo vs $${comfort.toLocaleString('en-US')} comfort → ${financial_score}.`)
    } else if (client.preapproval_amount) {
      financial_score = price <= Number(client.preapproval_amount) ? 85 : 50
    }
  }

  // Must-haves (AI assessment of each active must-have)
  const mustHaves = prefs.filter((p) => p.preference_type === 'must_have' && p.status === 'active')
  const status = new Map(analysis.must_have_assessment.map((m) => [m.preference_id, m.status]))
  let must_have_score = 80
  if (mustHaves.length) {
    const pts = mustHaves.map((p) => ({ met: 1, unknown: 0.5, not_met: 0 })[status.get(p.id) ?? 'unknown'])
    must_have_score = Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 100)
    const missed = mustHaves.filter((p) => status.get(p.id) === 'not_met').map((p) => p.value)
    why.push(`Must-haves: ${mustHaves.length - missed.length}/${mustHaves.length} met or unverified${missed.length ? ` (missing: ${missed.join(', ')})` : ''} → ${must_have_score}.`)
  }
  const dealBreaker = reactions.some((r) => r.reaction === 'deal_breaker')
  if (dealBreaker) {
    must_have_score = 0
    why.push('A deal breaker was flagged during the showing → must-haves 0.')
  }

  // Buyer reaction: quick reactions blended with AI interest
  const map: Record<string, number> = { love: 100, like: 80, neutral: 55, dislike: 30, deal_breaker: 0 }
  const rx = reactions.map((r) => map[r.reaction] ?? 55)
  const rxAvg = rx.length ? rx.reduce((a, b) => a + b, 0) / rx.length : analysis.interest_score
  const emotional_score = Math.round((rxAvg + analysis.interest_score) / 2)
  why.push(`Buyer reaction: ${rx.length} reactions + interest ${analysis.interest_score} → ${emotional_score}.`)

  const parts = {
    price_score, size_score, financial_score, must_have_score, emotional_score,
    location_score: analysis.location_score, condition_score: analysis.condition_score,
  }
  why.push(`Location ${parts.location_score} and condition ${parts.condition_score} are AI judgments from showing evidence.`)
  const overall = clamp(
    parts.must_have_score * WEIGHTS.must_have + parts.price_score * WEIGHTS.price + parts.location_score * WEIGHTS.location +
    parts.size_score * WEIGHTS.size + parts.condition_score * WEIGHTS.condition + parts.financial_score * WEIGHTS.financial +
    parts.emotional_score * WEIGHTS.emotional,
  )
  return { overall, parts, weights: WEIGHTS, explanation: `How this score was calculated:\n- ${why.join('\n- ')}` }
}

async function must(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p
  if (error) throw new Error(error.message)
}
