// portal-signup — creates an invited buyer's account without a confirmation email.
// The invite link proves email ownership when the address matches where the invite was sent
// (or the email the Realtor saved for that buyer), so the account is created already confirmed and the
// invite is accepted with the buyer's own session (same accept_buyer_invite checks as the normal flow).
// Public endpoint (verify_jwt off): the invite token is the credential.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f-]{36}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body.token ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    if (!UUID.test(token)) return json({ error: 'Invalid invite link.' }, 400)
    if (password.length < 8) return json({ error: 'Choose a password of at least 8 characters.' }, 400)

    const { data: inv } = await admin.from('buyer_invites')
      .select('id, sent_to, accepted_at, created_at, client_members(email, user_id, first_name, last_name)')
      .eq('token', token).maybeSingle()
    if (!inv || Date.now() - new Date(inv.created_at).getTime() > 30 * 86_400_000) {
      return json({ error: 'This invite link is invalid or has expired. Ask your agent for a new one.' }, 410)
    }
    // deno-lint-ignore no-explicit-any
    const m = inv.client_members as any
    if (m?.user_id) return json({ error: 'This invite has already been used. Sign in instead.', code: 'used' }, 409)

    const known = [inv.sent_to, m?.email].filter(Boolean).map((e: string) => e.toLowerCase())
    if (!known.includes(email)) {
      // Not the address the invite went to — fall back to the normal sign-up (with email confirmation).
      return json({ error: 'Use the email address your invite was sent to, or ask your agent to update it.', code: 'email_mismatch' }, 422)
    }

    const { error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name: m?.first_name ?? null, last_name: m?.last_name ?? null },
    })
    if (createErr) {
      const exists = /already|registered|exists/i.test(createErr.message)
      return json({ error: exists ? 'An account with this email already exists. Sign in instead.' : createErr.message, code: exists ? 'exists' : undefined }, exists ? 409 : 400)
    }

    // Accept the invite as the new buyer (their own JWT → same rules as the regular flow).
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
    const { error: signErr } = await userClient.auth.signInWithPassword({ email, password })
    if (signErr) throw new Error(signErr.message)
    const { error: accErr } = await userClient.rpc('accept_buyer_invite', { p_token: token })
    if (accErr) throw new Error(accErr.message)

    return json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('portal-signup failed', message)
    return json({ error: message }, 500)
  }
})
