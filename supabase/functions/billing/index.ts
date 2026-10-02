// billing — Stripe Checkout / Billing Portal for an organization.
// Actions: status | checkout | portal. Works without Stripe keys (reports "not configured").
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM (test-mode keys during development).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const PRICES: Record<string, string | undefined> = {
  pro: Deno.env.get('STRIPE_PRICE_PRO'),
  team: Deno.env.get('STRIPE_PRICE_TEAM'),
}

async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const body = await res.json()
  if (!res.ok) {
    console.error('Stripe error', path, res.status, body?.error?.message)
    throw new Error(body?.error?.message ?? `Stripe request failed (${res.status})`)
  }
  return body
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)

  const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  try {
    const { data: u } = await userDb.auth.getUser()
    if (!u.user) return json({ error: 'Not signed in' }, 401)
    const { data: profile } = await userDb.from('profiles').select('organization_id, role, email').eq('user_id', u.user.id).single()
    if (!profile?.organization_id || profile.role === 'buyer') return json({ error: 'Not allowed' }, 403)
    const { data: org } = await admin.from('organizations').select('*').eq('id', profile.organization_id).single()
    if (!org) return json({ error: 'Organization not found' }, 404)

    const { action, plan, return_url } = await req.json().catch(() => ({}))
    const configured = !!STRIPE_KEY && !!PRICES.pro && !!PRICES.team
    const testMode = STRIPE_KEY.startsWith('sk_test_')

    if (action === 'status') return json({ configured, test_mode: testMode })
    if (!configured) return json({ error: "Billing isn't connected yet. Add the Stripe secrets in Supabase to enable upgrades." }, 503)

    const origin = typeof return_url === 'string' && /^https?:\/\//.test(return_url) ? new URL(return_url).origin : 'https://keymivo.vercel.app'

    // Reuse or create the Stripe customer for this organization.
    let customer = org.stripe_customer_id as string | null
    if (!customer) {
      const c = await stripe('customers', {
        name: org.name,
        email: profile.email ?? u.user.email ?? '',
        'metadata[organization_id]': org.id,
      })
      customer = c.id as string
      await admin.from('organizations').update({ stripe_customer_id: customer }).eq('id', org.id)
    }

    if (action === 'checkout') {
      const price = PRICES[plan as string]
      if (!price) return json({ error: 'Unknown plan' }, 400)
      const params: Record<string, string> = {
        mode: 'subscription',
        customer,
        client_reference_id: org.id,
        'line_items[0][price]': price,
        'line_items[0][quantity]': '1',
        allow_promotion_codes: 'true',
        success_url: `${origin}/settings/billing?checkout=success`,
        cancel_url: `${origin}/settings/billing?checkout=cancelled`,
        'metadata[organization_id]': org.id,
        'metadata[plan]': plan,
        'subscription_data[metadata][organization_id]': org.id,
        'subscription_data[metadata][plan]': plan,
      }
      // Keep the remaining free-trial days: billing starts when the trial ends (Stripe needs ≥48h).
      const trialEnd = org.trial_ends_at ? Math.floor(new Date(org.trial_ends_at).getTime() / 1000) : 0
      if (!org.stripe_subscription_id && trialEnd > Date.now() / 1000 + 48 * 3600) {
        params['subscription_data[trial_end]'] = String(trialEnd)
      }
      const session = await stripe('checkout/sessions', params)
      return json({ url: session.url })
    }

    if (action === 'portal') {
      const session = await stripe('billing_portal/sessions', { customer, return_url: `${origin}/settings/billing` })
      return json({ url: session.url })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('billing failed', message)
    return json({ error: message }, 500)
  }
})
