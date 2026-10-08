// send-invite — emails an invite straight from the app: a buyer's private portal link, or (kind: 'team')
// an agent invite to join the Realtor's organization.
// Delivery: the Realtor's own Gmail when Google is connected (best deliverability, replies go to them);
// otherwise Keymivo email via Resend when RESEND_API_KEY + RESEND_FROM are set.
// The invite token is created through the caller's JWT (RLS + create_buyer_invite checks the org).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.keymivo.com'
const ORIGINS = [APP_URL, 'https://keymivo.vercel.app', 'http://localhost:5173']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class UserError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const b64url = (s: string) => b64(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const mimeWord = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`)
const wrap76 = (s: string) => s.match(/.{1,76}/g)?.join('\r\n') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  })

  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) throw new UserError('Not signed in', 401)
    const { data: profile } = await db.from('profiles').select('id, organization_id, role, first_name, last_name, email, phone, brokerage_name').eq('user_id', u.user.id).single()
    if (!profile?.organization_id || profile.role === 'buyer') throw new UserError('Not allowed', 403)

    const body = await req.json().catch(() => ({}))
    if (body.kind === 'team') return json(await sendTeamInvite(db, profile, u.user.id, body))
    const { data: member } = await db.from('client_members')
      .select('id, first_name, email, user_id, client_id').eq('id', String(body.member_id ?? '')).maybeSingle()
    if (!member) throw new UserError('Buyer not found', 404)
    if (member.user_id) throw new UserError(`${member.first_name} already has portal access.`, 409)

    const to = String(body.email ?? member.email ?? '').trim().toLowerCase()
    if (!EMAIL_RE.test(to)) throw new UserError(`Add an email address for ${member.first_name}.`)
    // A Realtor/staff account can't join as a buyer — catch it before sending a link that won't work.
    const { data: existing } = await admin.from('profiles').select('role, onboarding_completed').ilike('email', to.replace(/[%_\\]/g, '\\$&')).limit(1).maybeSingle()
    if (existing && existing.role !== 'buyer' && existing.onboarding_completed) {
      throw new UserError(`${to} is already a Keymivo agent account. Use a different email for ${member.first_name}.`)
    }
    if (to !== (member.email ?? '').toLowerCase()) {
      const { error } = await db.from('client_members').update({ email: to }).eq('id', member.id)
      if (error) throw new Error(error.message)
    }

    const { data: token, error: tokErr } = await db.rpc('create_buyer_invite', { p_member_id: member.id })
    if (tokErr) throw new UserError(tokErr.message)
    const origin = ORIGINS.includes(String(body.origin)) ? String(body.origin) : APP_URL
    const link = `${origin}/portal/join?token=${token}`

    const agentName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your agent'
    const note = String(body.note ?? '').trim().slice(0, 1000)
    const subject = `${agentName} invited you to your home search portal`
    const text = [
      `Hi ${member.first_name},`, '',
      note || `I set up a private portal for our home search. You'll see the homes I share with you, our tour schedule and offer options — and you can rate homes and message me there.`,
      '', `Open your portal: ${link}`, '',
      'The link is just for you and expires in 30 days.', '',
      agentName, [profile.brokerage_name, profile.phone, profile.email].filter(Boolean).join(' · '),
    ].join('\n')
    const html = emailHtml({ first: member.first_name, agentName, note, link, footer: [profile.brokerage_name, profile.phone, profile.email].filter(Boolean).join(' · ') })

    const via = await deliver({ profileId: profile.id, agentName, agentEmail: profile.email, to, toName: member.first_name, subject, text, html })

    await admin.from('buyer_invites').update({ sent_at: new Date().toISOString(), sent_to: to, sent_via: via }).eq('token', token)
    await admin.from('activity_logs').insert({
      organization_id: profile.organization_id, user_id: u.user.id, action: 'portal_invite_sent',
      entity_type: 'clients', entity_id: member.client_id, metadata: { member_id: member.id, via },
    })
    return json({ sent_to: to, via })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('send-invite failed', message)
    return json({ error: message }, e instanceof UserError ? e.status : 502)
  }
})

const TEAM_ROLES: Record<string, string> = { realtor: 'an agent', assistant: 'an assistant', team_leader: 'a team leader' }

// deno-lint-ignore no-explicit-any
async function sendTeamInvite(db: any, profile: any, userId: string, body: any) {
  const to = String(body.email ?? '').trim().toLowerCase()
  const role = String(body.role ?? 'realtor')
  if (!EMAIL_RE.test(to)) throw new UserError('Enter the agent\'s email address.')
  if (!TEAM_ROLES[role]) throw new UserError('Invalid role')
  const { data: existing } = await admin.from('profiles').select('role, organization_id').ilike('email', to.replace(/[%_\\]/g, '\\$&')).limit(1).maybeSingle()
  if (existing?.organization_id === profile.organization_id && existing.role !== 'buyer') throw new UserError(`${to} is already on your team.`)
  if (existing?.role === 'buyer') throw new UserError(`${to} is a buyer portal account. Use a different email for the agent.`)
  if (existing?.organization_id) throw new UserError(`${to} already belongs to another Keymivo organization.`)

  // Seat limits and permissions are enforced inside create_team_invite.
  const { data: token, error } = await db.rpc('create_team_invite', { p_role: role, p_email: to })
  if (error) throw new UserError(error.message)
  const { data: org } = await db.from('organizations').select('name').eq('id', profile.organization_id).single()
  const origin = ORIGINS.includes(String(body.origin)) ? String(body.origin) : APP_URL
  const link = `${origin}/join?token=${token}`
  const agentName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your team leader'
  const orgName = org?.name ?? 'our team'
  const note = String(body.note ?? '').trim().slice(0, 1000)
  const intro = note || `I'd like you to join ${orgName} on Keymivo as ${TEAM_ROLES[role]}. Keymivo is our AI copilot for buyer showings — notes, buyer preferences, tours, offers and reports in one place.`
  const subject = `${agentName} invited you to join ${orgName} on Keymivo`
  const text = ['Hi,', '', intro, '', `Join the team: ${link}`, '', 'This link is just for you and expires in 14 days.', '', agentName, orgName].join('\n')
  const html = emailHtml({ first: '', agentName, note: intro, link, footer: orgName, button: 'Join the team', expires: '14 days' })
  let via: 'gmail' | 'keymivo_email'
  try {
    via = await deliver({ profileId: profile.id, agentName, agentEmail: profile.email, to, toName: to, subject, text, html })
  } catch (e) {
    // Don't let an undelivered invite hold a seat.
    await admin.from('org_invites').update({ revoked_at: new Date().toISOString() }).eq('token', token)
    throw e
  }
  await admin.from('activity_logs').insert({
    organization_id: profile.organization_id, user_id: userId, action: 'team_invite_sent', entity_type: 'org_invites', metadata: { role, via },
  })
  return { sent_to: to, via }
}

async function deliver(m: { profileId: string; agentName: string; agentEmail: string | null; to: string; toName: string; subject: string; text: string; html: string }): Promise<'gmail' | 'keymivo_email'> {
  // 1) The Realtor's Gmail, if connected with send permission.
  const { data: conn } = await admin.from('integration_connections').select('settings, status').eq('profile_id', m.profileId).eq('provider', 'google').maybeSingle()
  let gmailError: string | null = null
  if (conn && (conn.settings as { gmail?: boolean })?.gmail !== false) {
    try {
      await sendGmail(m)
      return 'gmail'
    } catch (e) {
      gmailError = e instanceof Error ? e.message : String(e)
    }
  }
  // 2) Keymivo email (Resend).
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('RESEND_FROM')
  if (key && from) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${m.agentName} via Keymivo <${from}>`, to: [m.to], subject: m.subject, text: m.text, html: m.html,
        ...(m.agentEmail ? { reply_to: m.agentEmail } : {}),
      }),
    })
    if (!res.ok) throw new Error(`Email failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
    return 'keymivo_email'
  }
  if (gmailError) throw new UserError(`Gmail couldn't send it: ${gmailError}`, 502)
  throw new UserError('Connect Gmail in Integrations to send invites from the app (or copy the link and send it yourself).', 409)
}

async function sendGmail(m: { profileId: string; to: string; toName: string; subject: string; text: string; html: string }) {
  const { data: refresh } = await admin.rpc('integration_secret', { p_profile: m.profileId, p_provider: 'google' })
  if (!refresh) throw new Error('Google is not connected')
  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '', client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      grant_type: 'refresh_token', refresh_token: refresh as string,
    }),
  })
  const t = await tok.json().catch(() => ({}))
  if (!tok.ok) throw new Error(t?.error === 'invalid_grant' ? 'Google access expired — reconnect Google in Integrations.' : `token refresh failed (${t?.error ?? tok.status})`)

  const boundary = `kmv_${crypto.randomUUID()}`
  const raw = [
    (m.toName && m.toName !== m.to ? `To: ${mimeWord(m.toName)} <${m.to}>` : `To: ${m.to}`),
    `Subject: ${mimeWord(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.text.replace(/\r?\n/g, '\r\n'))),
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(b64(m.html)),
    `--${boundary}--`,
  ].join('\r\n')
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(raw) }),
  })
  if (!res.ok) {
    const b = await res.json().catch(() => null)
    throw new Error(b?.error?.message ?? `Gmail error ${res.status}`)
  }
}

function emailHtml(v: { first: string; agentName: string; note: string; link: string; footer: string; button?: string; expires?: string }) {
  const body = v.note
    ? esc(v.note).replace(/\n/g, '<br>')
    : `I set up a private portal for our home search. You'll see the homes I share with you, our tour schedule and offer options — and you can rate homes and message me there.`
  return `<!doctype html><html><body style="margin:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;color:#1B5CF6;padding-bottom:20px">Keymivo</td></tr>
<tr><td style="font-size:16px;line-height:1.55">
<p style="margin:0 0 14px">Hi${v.first ? ` ${esc(v.first)}` : ''},</p>
<p style="margin:0 0 22px">${body}</p>
<p style="margin:0 0 22px"><a href="${esc(v.link)}" style="display:inline-block;background:#1B5CF6;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(v.button ?? 'Open my portal')}</a></p>
<p style="margin:0 0 22px;font-size:13px;color:#64748B">This link is just for you and expires in ${v.expires ?? '30 days'}. If the button doesn't work, paste this into your browser:<br><span style="word-break:break-all">${esc(v.link)}</span></p>
<p style="margin:0;font-weight:600">${esc(v.agentName)}</p>
${v.footer ? `<p style="margin:2px 0 0;font-size:13px;color:#64748B">${esc(v.footer)}</p>` : ''}
</td></tr></table></td></tr></table></body></html>`
}
