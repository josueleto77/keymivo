// generate-followup — Follow-Up Agent.
// Drafts a professional Realtor → buyer follow-up after a showing. Saved as a DRAFT message;
// nothing is ever sent automatically. Runs with the caller's JWT (RLS-scoped).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini'

const SYSTEM_PROMPT = `You write follow-up messages from a licensed residential buyer's agent to their buyer client after a home showing.
Style: warm, professional, concise (90-160 words), plain language, first person from the agent, addressed to the buyer(s) by first name.
Content: how this home compares with the others toured (ranking language, not raw numbers unless helpful), what the buyers responded
to most positively, the main items the agent will investigate (phrase physical issues as things to verify, never as conclusions),
and one clear next step.
Rules: never give legal, tax, lending or appraisal advice; never guarantee outcomes or seller acceptance; never mention or infer protected
characteristics or neighborhood demographics; only use facts present in the context; no emojis; sign with the agent's first name.
Return JSON only.`

const SCHEMA = {
  name: 'followup',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['subject', 'body'],
    properties: { subject: { type: 'string' }, body: { type: 'string' } },
  },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

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
    const { showing_id } = await req.json().catch(() => ({}))
    if (typeof showing_id !== 'string') return json({ error: 'showing_id is required' }, 400)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'AI is not configured yet (missing OPENAI_API_KEY secret).' }, 503)

    const { data: s, error } = await db
      .from('showings')
      .select('id, organization_id, client_id, property_id, ai_analysis, ai_summary, properties(address_line1, city), clients(first_name, last_name, client_members(first_name)), buyer_reactions(feature, reaction), showing_notes(content)')
      .eq('id', showing_id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!s) return json({ error: 'Showing not found' }, 404)

    const [{ data: me }, { data: scores }] = await Promise.all([
      db.from('profiles').select('first_name, last_name, brokerage_name, phone').eq('user_id', u.user.id).single(),
      db.from('property_scores').select('property_id, overall_score, properties(address_line1)').eq('client_id', s.client_id).order('overall_score', { ascending: false }),
    ])
    const rank = (scores ?? []).findIndex((x: { property_id: string }) => x.property_id === s.property_id)
    const a = (s.ai_analysis ?? {}) as Record<string, any>
    const members = ((s.clients as any)?.client_members ?? []).map((m: { first_name: string }) => m.first_name)

    const context = {
      agent: { first_name: me?.first_name, brokerage: me?.brokerage_name },
      buyers: members.length ? members : [(s.clients as any)?.first_name],
      property: `${(s.properties as any)?.address_line1}, ${(s.properties as any)?.city}`,
      ranking: rank >= 0 ? { position: rank + 1, of: scores!.length, others: scores!.slice(0, 5).map((x: any) => x.properties?.address_line1) } : null,
      positives: a.positives ?? (s.buyer_reactions ?? []).filter((r: any) => ['love', 'like'].includes(r.reaction)).map((r: any) => r.feature),
      concerns: (a.concerns ?? []).map((c: any) => c.title),
      questions: a.questions ?? [],
      recommended_next_action: a.recommended_next_action ?? null,
      summary: s.ai_summary ?? null,
      notes: (s.showing_notes ?? []).map((n: any) => n.content),
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Context (JSON):\n${JSON.stringify(context)}` },
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
    const subject = String(out.subject ?? '').trim().slice(0, 200)
    const body = String(out.body ?? '').trim().slice(0, 4000)
    if (!body) throw new Error('AI returned an empty draft.')

    const { data: saved, error: insErr } = await db
      .from('messages')
      .insert({
        organization_id: s.organization_id, client_id: s.client_id, property_id: s.property_id,
        type: 'follow_up', channel: 'email', status: 'draft', content: subject ? `Subject: ${subject}\n\n${body}` : body,
      })
      .select()
      .single()
    if (insErr) throw new Error(insErr.message)

    await db.from('activity_logs').insert({
      organization_id: s.organization_id, user_id: u.user.id, action: 'followup_drafted',
      entity_type: 'messages', entity_id: saved.id, metadata: { showing_id },
    })
    return json({ message: saved })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('generate-followup failed', message)
    return json({ error: message }, 500)
  }
})
