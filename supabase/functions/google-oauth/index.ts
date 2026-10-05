// google-oauth — per-Realtor Google connection (Gmail send + Calendar events).
//   POST {action:'start'}                 → { url } Google consent URL (signed state)
//   GET  /google-oauth/callback?code&state → stores the refresh token in Vault, redirects to /integrations
//   POST {action:'disconnect'}            → revokes + deletes
//   POST {action:'send_email', message_id, subject, body} → sends from the Realtor's Gmail, marks message sent
//   POST {action:'sync_tour', tour_id}    → creates/updates events in the Realtor's primary Google Calendar
// verify_jwt is off (Google's redirect has no JWT); POST actions verify the caller's JWT themselves.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.keymivo.com'
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const REDIRECT_URI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth/callback`
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/calendar.events']
const SHOWING_MINUTES = 45
// Where Google sends the Realtor back to (the origin they started from, if it's one of ours).
const ORIGINS = [APP_URL, 'https://keymivo.vercel.app', 'http://localhost:5173']
const safeOrigin = (o: unknown) => (typeof o === 'string' && ORIGINS.includes(o) ? o : APP_URL)

class UserError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

// ── signed OAuth state (HMAC-SHA256 with the client secret, 15 min) ──
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlText = (s: string) => b64url(new TextEncoder().encode(s))
const fromB64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))
async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))
}
async function signState(profileId: string, origin: string) {
  const payload = b64urlText(JSON.stringify({ p: profileId, o: origin, t: Date.now(), n: crypto.randomUUID() }))
  return `${payload}.${await hmac(payload)}`
}
async function readState(state: string): Promise<{ profileId: string | null; origin: string }> {
  const [payload, sig] = state.split('.')
  if (!payload || !sig || (await hmac(payload)) !== sig) return { profileId: null, origin: APP_URL }
  const { p, o, t } = JSON.parse(fromB64url(payload))
  return { profileId: Date.now() - t < 15 * 60_000 ? p : null, origin: safeOrigin(o) }
}

// ── Google token helpers ──
async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  })
  return { ok: res.ok, data: await res.json().catch(() => ({})) }
}

async function accessToken(profileId: string) {
  const { data: refresh } = await admin.rpc('integration_secret', { p_profile: profileId, p_provider: 'google' })
  if (!refresh) throw new UserError('Connect Google in Integrations first.', 409)
  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh as string })
  if (!r.ok) {
    if (r.data?.error === 'invalid_grant') throw new UserError('Google access was revoked or expired. Reconnect Google in Integrations.', 401)
    throw new Error(`Google token refresh failed: ${r.data?.error_description ?? r.data?.error ?? 'unknown'}`)
  }
  return r.data.access_token as string
}

async function google(token: string, method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  return { status: res.status, ok: res.ok, data }
}
const gErr = (what: string, r: { status: number; data: { error?: { message?: string } } | null }) =>
  r.status === 401 || r.status === 403
    ? new UserError(`Google refused (${what}): ${r.data?.error?.message ?? r.status}. Try reconnecting Google.`, 401)
    : new Error(`Google ${what} failed (${r.status}): ${r.data?.error?.message ?? ''}`)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  if (req.method === 'GET' && url.pathname.endsWith('/callback')) return callback(url)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'Google is not configured yet.' }, 503)

  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  })

  let profileId: string | undefined
  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) throw new UserError('Not signed in', 401)
    const { data: profile } = await db.from('profiles').select('id, organization_id, role, timezone').eq('user_id', u.user.id).single()
    if (!profile?.organization_id || profile.role === 'buyer') throw new UserError('Not allowed', 403)
    profileId = profile.id
    const body = await req.json().catch(() => ({}))

    switch (body.action) {
      case 'start': {
        const q = new URLSearchParams({
          client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: SCOPES.join(' '),
          access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: await signState(profile.id, safeOrigin(body.return_origin)),
        })
        if (u.user.email) q.set('login_hint', u.user.email)
        return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` })
      }
      case 'disconnect': {
        const { data: refresh } = await admin.rpc('integration_secret', { p_profile: profile.id, p_provider: 'google' })
        if (refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh as string)}`, { method: 'POST' }).catch(() => {})
        await admin.rpc('integration_delete', { p_profile: profile.id, p_provider: 'google' })
        await log(profile.organization_id, u.user.id, 'integration_disconnected', { provider: 'google' })
        return json({ connected: false })
      }
      case 'send_email': {
        const r = await sendEmail(db, profile.id, body.message_id, String(body.subject ?? ''), String(body.body ?? ''))
        await touch(profile.id)
        return json(r)
      }
      case 'sync_tour': {
        const r = await syncTour(db, profile.id, profile.organization_id, profile.timezone || 'America/New_York', body.tour_id)
        await touch(profile.id)
        return json(r)
      }
      default:
        throw new UserError('Unknown action')
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('google-oauth failed', message)
    if (profileId && (!(e instanceof UserError) || e.status === 401)) {
      await admin.from('integration_connections').update({ status: 'error', last_error: message.slice(0, 300) })
        .eq('profile_id', profileId).eq('provider', 'google')
    }
    return json({ error: message }, e instanceof UserError ? e.status : 502)
  }
})

async function callback(url: URL) {
  const { profileId, origin } = await readState(url.searchParams.get('state') ?? '').catch(() => ({ profileId: null, origin: APP_URL }))
  const back = (q: string) => Response.redirect(`${origin}/integrations?${q}`, 302)
  if (url.searchParams.get('error')) return back('google=cancelled')
  const code = url.searchParams.get('code')
  if (!profileId || !code) return back('google=error')

  const r = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
  if (!r.ok || !r.data.refresh_token) {
    console.error('google token exchange failed', r.data?.error, r.data?.error_description)
    return back('google=error')
  }
  const granted = String(r.data.scope ?? '').split(' ')
  const missing = SCOPES.filter((s) => s.startsWith('https://') && !granted.includes(s))
  let email = ''
  try { email = JSON.parse(fromB64url(String(r.data.id_token).split('.')[1]!)).email ?? '' } catch { /* label falls back */ }

  const { error } = await admin.rpc('integration_save', {
    p_profile: profileId, p_provider: 'google', p_secret: r.data.refresh_token, p_label: email || 'Google account',
    p_settings: { email, gmail: !missing.includes(SCOPES[2]!), calendar: !missing.includes(SCOPES[3]!) },
  })
  if (error) { console.error('integration_save', error.message); return back('google=error') }
  const { data: p } = await admin.from('profiles').select('organization_id, user_id').eq('id', profileId).single()
  if (p) await log(p.organization_id, p.user_id, 'integration_connected', { provider: 'google', missing_scopes: missing })
  return back(missing.length ? 'google=partial' : 'google=connected')
}

async function log(org: string, user: string, action: string, metadata: Record<string, unknown>) {
  await admin.from('activity_logs').insert({ organization_id: org, user_id: user, action, entity_type: 'integrations', metadata })
}
async function touch(profileId: string) {
  await admin.from('integration_connections').update({ last_sync_at: new Date().toISOString(), status: 'connected', last_error: null })
    .eq('profile_id', profileId).eq('provider', 'google')
}
async function link(org: string, type: string, id: string) {
  const { data } = await admin.from('integration_links').select('external_id')
    .eq('organization_id', org).eq('provider', 'google').eq('entity_type', type).eq('entity_id', id).maybeSingle()
  return data?.external_id as string | undefined
}
async function saveLink(org: string, type: string, id: string, ext: string) {
  await admin.from('integration_links').upsert(
    { organization_id: org, provider: 'google', entity_type: type, entity_id: id, external_id: ext, synced_at: new Date().toISOString() },
    { onConflict: 'organization_id,provider,entity_type,entity_id' },
  )
}
async function dropLink(org: string, type: string, id: string) {
  await admin.from('integration_links').delete().eq('organization_id', org).eq('provider', 'google').eq('entity_type', type).eq('entity_id', id)
}

// ── Gmail ──
const mimeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`)
const wrap76 = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? ''

async function sendEmail(db: SupabaseClient, profileId: string, messageId: string, subject: string, body: string) {
  const { data: m } = await db.from('messages')
    .select('id, organization_id, client_id, status, channel, clients(first_name, last_name, email, client_members(email, is_primary))')
    .eq('id', messageId).maybeSingle()
  if (!m) throw new UserError('Message not found', 404)
  // deno-lint-ignore no-explicit-any
  const c = m.clients as any
  const members = (c?.client_members ?? []) as { email: string | null; is_primary: boolean }[]
  const to = c?.email ?? members.find((x) => x.is_primary && x.email)?.email ?? members.find((x) => x.email)?.email
  if (!to) throw new UserError("Add the client's email first.")
  if (!body.trim()) throw new UserError('The message is empty.')
  if (m.channel === 'email' && m.status === 'sent') throw new UserError('This follow-up was already emailed.', 409)

  const { data: conn } = await admin.from('integration_connections').select('settings, account_label').eq('profile_id', profileId).eq('provider', 'google').maybeSingle()
  if (conn && (conn.settings as { gmail?: boolean })?.gmail === false) throw new UserError('Gmail permission was not granted. Reconnect Google and allow sending email.', 403)

  const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ')
  const raw = [
    `To: ${name ? `${mimeWord(name)} <${to}>` : to}`,
    `Subject: ${mimeWord(subject || 'Following up')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(btoa(String.fromCharCode(...new TextEncoder().encode(body.replace(/\r?\n/g, '\r\n'))))),
  ].join('\r\n')

  const token = await accessToken(profileId)
  const r = await google(token, 'POST', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw: b64urlText(raw) })
  if (!r.ok) throw gErr('Gmail send', r)

  const content = subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body
  await db.from('messages').update({ content, status: 'sent', channel: 'email' }).eq('id', m.id)
  await saveLink(m.organization_id, 'message_email', m.id, String(r.data?.id ?? 'sent'))
  return { sent: true, to }
}

// ── Google Calendar ──
const addMinutes = (date: string, minutes: number) => {
  const [y, mo, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y!, mo! - 1, d!, 0, minutes))
  return t.toISOString().slice(0, 19) // local wall time; timeZone is sent alongside
}
const nextDay = (date: string) => {
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, mo! - 1, d! + 1)).toISOString().slice(0, 10)
}

async function syncTour(db: SupabaseClient, profileId: string, org: string, tz: string, tourId: string) {
  const { data: t } = await db.from('tours')
    .select('id, name, tour_date, status, clients(first_name, last_name), tour_properties(id, scheduled_time, sequence_number, properties(address_line1, city, state, zip_code))')
    .eq('id', tourId).maybeSingle()
  if (!t) throw new UserError('Tour not found', 404)
  const { data: conn } = await admin.from('integration_connections').select('settings').eq('profile_id', profileId).eq('provider', 'google').maybeSingle()
  if (conn && (conn.settings as { calendar?: boolean })?.calendar === false) throw new UserError('Calendar permission was not granted. Reconnect Google and allow calendar events.', 403)

  const token = await accessToken(profileId)
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  // deno-lint-ignore no-explicit-any
  const c = t.clients as any
  const buyer = [c?.first_name, c?.last_name].filter(Boolean).join(' ')
  const tourUrl = `${APP_URL}/tours/${t.id}`
  // deno-lint-ignore no-explicit-any
  const stops = [...((t.tour_properties as any[]) ?? [])].sort((a, b) => a.sequence_number - b.sequence_number)
  const timed = stops.filter((s) => s.scheduled_time)
  const cancelled = t.status === 'cancelled'

  async function upsert(type: string, id: string, event: Record<string, unknown> | null) {
    const existing = await link(org, type, id)
    if (!event) {
      if (existing) {
        const r = await google(token, 'DELETE', `${base}/${existing}`)
        if (!r.ok && r.status !== 404 && r.status !== 410) throw gErr('Calendar delete', r)
        await dropLink(org, type, id)
      }
      return 'removed'
    }
    if (existing) {
      const r = await google(token, 'PUT', `${base}/${existing}`, event)
      if (r.ok) return 'updated'
      if (r.status !== 404 && r.status !== 410) throw gErr('Calendar update', r)
    }
    const r = await google(token, 'POST', base, event)
    if (!r.ok) throw gErr('Calendar create', r)
    await saveLink(org, type, id, r.data.id)
    return 'created'
  }

  let created = 0, updated = 0
  const count = (s: string) => { if (s === 'created') created++; else if (s === 'updated') updated++ }

  // One all-day event when no stop has a time; per-stop events otherwise.
  count(await upsert('calendar_tour', t.id, !cancelled && timed.length === 0 ? {
    summary: `${t.name} · ${buyer}`,
    description: `${stops.length} homes:\n${stops.map((s, i) => `${i + 1}. ${s.properties?.address_line1 ?? ''}`).join('\n')}\n\nOpen in Keymivo: ${tourUrl}`,
    start: { date: t.tour_date }, end: { date: nextDay(t.tour_date) },
    source: { title: 'Keymivo', url: tourUrl },
  } : null))

  for (const s of stops) {
    const p = s.properties
    let event: Record<string, unknown> | null = null
    if (!cancelled && s.scheduled_time) {
      const [h, m] = String(s.scheduled_time).split(':').map(Number)
      const start = h! * 60 + m!
      event = {
        summary: `Showing: ${p?.address_line1 ?? 'Home'} · ${buyer}`,
        location: p ? `${p.address_line1}, ${p.city}, ${p.state} ${p.zip_code ?? ''}`.trim() : undefined,
        description: `${t.name} — stop ${s.sequence_number} of ${stops.length}\nOpen in Keymivo: ${tourUrl}`,
        start: { dateTime: addMinutes(t.tour_date, start), timeZone: tz },
        end: { dateTime: addMinutes(t.tour_date, start + SHOWING_MINUTES), timeZone: tz },
        source: { title: 'Keymivo', url: tourUrl },
        reminders: { useDefault: true },
      }
    }
    count(await upsert('calendar_stop', s.id, event))
  }
  return { created, updated, events: timed.length || (cancelled ? 0 : 1) }
}
