// crm — Follow Up Boss integration (CRMProvider: createContact/updateContact/createNote/createTask).
// The Realtor's FUB API key is stored encrypted in Vault and only read here (service role).
// Every read of Keymivo data uses the caller's JWT, so RLS still enforces tenant isolation.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.keymivo.com'
const FUB = 'https://api.followupboss.com/v1'

class UserError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

// ── Follow Up Boss provider ─────────────────────────────────────────
function fub(apiKey: string) {
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    'Content-Type': 'application/json',
    'X-System': 'Keymivo',
  }
  const sysKey = Deno.env.get('FUB_SYSTEM_KEY')
  if (sysKey) headers['X-System-Key'] = sysKey
  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${FUB}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (res.status === 401 || res.status === 403) throw new UserError('Follow Up Boss rejected the API key. Check it in FUB → Admin → API.', 401)
    if (!res.ok) throw new Error(`Follow Up Boss ${method} ${path} failed (${res.status}): ${data?.errorMessage ?? text.slice(0, 200)}`)
    return data
  }
  return {
    identity: () => call('GET', '/identity'),
    findPersonByEmail: async (email: string) => (await call('GET', `/people?email=${encodeURIComponent(email)}&limit=1`))?.people?.[0] ?? null,
    createPerson: (p: Record<string, unknown>) => call('POST', '/people', p),
    updatePerson: (id: string, p: Record<string, unknown>) => call('PUT', `/people/${id}`, p),
    createNote: (personId: string, subject: string, body: string) => call('POST', '/notes', { personId: Number(personId), subject, body, isHtml: false }),
    createTask: (personId: string, name: string, dueDate: string) => call('POST', '/tasks', { personId: Number(personId), name, type: 'Follow Up', dueDate }),
  }
}
type Fub = ReturnType<typeof fub>

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  let profileId: string | undefined
  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) throw new UserError('Not signed in', 401)
    const { data: profile } = await db.from('profiles').select('id, organization_id, role').eq('user_id', u.user.id).single()
    if (!profile?.organization_id || profile.role === 'buyer') throw new UserError('Not allowed', 403)
    profileId = profile.id
    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'connect') {
      const key = String(body.api_key ?? '').trim()
      if (key.length < 10) throw new UserError('Paste your Follow Up Boss API key.')
      const who = await fub(key).identity()
      const label = [who?.account?.name, who?.user?.email ?? who?.email].filter(Boolean).join(' · ') || 'Follow Up Boss'
      const { error } = await admin.rpc('integration_save', {
        p_profile: profile.id, p_provider: 'follow_up_boss', p_secret: key, p_label: label,
        p_settings: { auto_sync_showings: true },
      })
      if (error) throw new Error(error.message)
      await log(admin, profile.organization_id, u.user.id, 'integration_connected', { provider: 'follow_up_boss' })
      return json({ connected: true, account_label: label })
    }

    if (action === 'disconnect') {
      await admin.rpc('integration_delete', { p_profile: profile.id, p_provider: 'follow_up_boss' })
      await log(admin, profile.organization_id, u.user.id, 'integration_disconnected', { provider: 'follow_up_boss' })
      return json({ connected: false })
    }

    if (action === 'settings') {
      const { error } = await admin.from('integration_connections')
        .update({ settings: { auto_sync_showings: !!body.auto_sync_showings } })
        .eq('profile_id', profile.id).eq('provider', 'follow_up_boss')
      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    // Everything below needs a connected account.
    const { data: key } = await admin.rpc('integration_secret', { p_profile: profile.id, p_provider: 'follow_up_boss' })
    if (!key) throw new UserError('Connect Follow Up Boss in Integrations first.', 409)
    const api = fub(key as string)

    let result: Record<string, unknown>
    if (action === 'sync_client') result = { person_id: await syncClient(db, admin, api, profile.organization_id, body.client_id) }
    else if (action === 'push_showing') result = await pushShowing(db, admin, api, profile.organization_id, body.showing_id)
    else if (action === 'push_message') result = await pushMessage(db, admin, api, profile.organization_id, body.message_id)
    else throw new UserError('Unknown action')

    await admin.from('integration_connections').update({ last_sync_at: new Date().toISOString(), status: 'connected', last_error: null })
      .eq('profile_id', profile.id).eq('provider', 'follow_up_boss')
    return json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('crm failed', message)
    if (profileId && !(e instanceof UserError && e.status !== 401)) {
      await admin.from('integration_connections').update({ status: 'error', last_error: message.slice(0, 300) })
        .eq('profile_id', profileId).eq('provider', 'follow_up_boss')
    }
    return json({ error: message }, e instanceof UserError ? e.status : 502)
  }
})

async function link(admin: SupabaseClient, org: string, type: string, id: string) {
  const { data } = await admin.from('integration_links').select('external_id')
    .eq('organization_id', org).eq('provider', 'follow_up_boss').eq('entity_type', type).eq('entity_id', id).maybeSingle()
  return data?.external_id as string | undefined
}
async function saveLink(admin: SupabaseClient, org: string, type: string, id: string, ext: string) {
  await admin.from('integration_links').upsert(
    { organization_id: org, provider: 'follow_up_boss', entity_type: type, entity_id: id, external_id: String(ext), synced_at: new Date().toISOString() },
    { onConflict: 'organization_id,provider,entity_type,entity_id' },
  )
}
async function log(admin: SupabaseClient, org: string, user: string, action: string, metadata: Record<string, unknown>) {
  await admin.from('activity_logs').insert({ organization_id: org, user_id: user, action, entity_type: 'integrations', metadata })
}

/** createContact / updateContact. Dedupes by existing link, then by email in FUB. */
async function syncClient(db: SupabaseClient, admin: SupabaseClient, api: Fub, org: string, clientId: string) {
  const { data: c } = await db.from('clients').select('*, client_members(first_name, last_name, email, is_primary)').eq('id', clientId).maybeSingle()
  if (!c) throw new UserError('Client not found', 404)
  // deno-lint-ignore no-explicit-any
  const members = (c.client_members ?? []) as any[]
  const primary = members.find((m) => m.is_primary) ?? members[0]
  const email = c.email ?? primary?.email ?? null
  const person = {
    firstName: primary?.first_name ?? c.first_name,
    lastName: primary?.last_name ?? c.last_name ?? '',
    emails: email ? [{ value: email, type: 'home' }] : [],
    phones: c.phone ? [{ value: c.phone, type: 'mobile' }] : [],
    source: 'Keymivo',
    tags: ['Keymivo', ...(c.is_demo ? ['Keymivo demo'] : [])],
    price: c.target_price_max ?? undefined,
  }
  let id = await link(admin, org, 'client', clientId)
  if (!id && email) id = (await api.findPersonByEmail(email))?.id?.toString()
  if (id) {
    await api.updatePerson(id, person)
  } else {
    const created = await api.createPerson(person)
    id = String(created.id)
  }
  await saveLink(admin, org, 'client', clientId, id)
  return id
}

/** createNote (AI showing summary) + createTask (AI tasks not yet sent). */
async function pushShowing(db: SupabaseClient, admin: SupabaseClient, api: Fub, org: string, showingId: string) {
  const { data: s } = await db.from('showings')
    .select('id, client_id, ai_status, ai_summary, ai_analysis, buyer_interest_level, buyer_interest_score, started_at, properties(address_line1, city)')
    .eq('id', showingId).maybeSingle()
  if (!s) throw new UserError('Showing not found', 404)
  const personId = await syncClient(db, admin, api, org, s.client_id)
  // deno-lint-ignore no-explicit-any
  const p = s.properties as any
  // deno-lint-ignore no-explicit-any
  const a = (s.ai_analysis ?? {}) as any
  const address = `${p?.address_line1 ?? 'Home'}, ${p?.city ?? ''}`
  let noteSent = false
  if (!(await link(admin, org, 'showing_note', s.id))) {
    const lines = [
      s.ai_summary ?? 'Showing completed.',
      s.buyer_interest_score != null ? `Buyer interest: ${String(s.buyer_interest_level ?? '').replace('_', ' ')} (${s.buyer_interest_score}/100)` : '',
      a.positives?.length ? `Loved/liked: ${a.positives.map((x: { feature: string }) => x.feature).join(', ')}` : '',
      a.concerns?.length ? `Concerns: ${a.concerns.map((x: { title: string }) => x.title).join('; ')}` : '',
      a.questions?.length ? `Open questions: ${a.questions.join(' | ')}` : '',
      a.recommended_next_action ? `Next step: ${a.recommended_next_action}` : '',
      `Keymivo: ${APP_URL}/showings/${s.id}/complete`,
    ].filter(Boolean)
    const note = await api.createNote(personId, `Showing: ${address}`, lines.join('\n\n'))
    await saveLink(admin, org, 'showing_note', s.id, String(note?.id ?? 'sent'))
    noteSent = true
  }
  const { data: tasks } = await db.from('tasks').select('id, title, due_date, status').eq('showing_id', s.id).eq('ai_generated', true).neq('status', 'done')
  let tasksSent = 0
  const due = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  for (const t of tasks ?? []) {
    if (await link(admin, org, 'task', t.id)) continue
    const created = await api.createTask(personId, `${t.title} — ${p?.address_line1 ?? ''}`.trim(), t.due_date ?? due)
    await saveLink(admin, org, 'task', t.id, String(created?.id ?? 'sent'))
    tasksSent++
  }
  return { person_id: personId, note_sent: noteSent, tasks_sent: tasksSent }
}

/** createNote with a follow-up draft (never sends email/SMS — FUB just logs it). */
async function pushMessage(db: SupabaseClient, admin: SupabaseClient, api: Fub, org: string, messageId: string) {
  const { data: m } = await db.from('messages').select('id, client_id, content, properties(address_line1)').eq('id', messageId).maybeSingle()
  if (!m?.client_id) throw new UserError('Message not found', 404)
  const personId = await syncClient(db, admin, api, org, m.client_id)
  // deno-lint-ignore no-explicit-any
  const addr = (m.properties as any)?.address_line1
  const note = await api.createNote(personId, `Keymivo follow-up${addr ? ` · ${addr}` : ''}`, m.content)
  await saveLink(admin, org, 'message_note', m.id, String(note?.id ?? 'sent'))
  return { person_id: personId, note_sent: true }
}
