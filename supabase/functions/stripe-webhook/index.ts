// stripe-webhook — keeps organizations' plan/status in sync with Stripe.
// No JWT (Stripe calls it); authenticity is verified with the Stripe-Signature header (HMAC-SHA256).
// Secrets: STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM.
import { createClient } from 'npm:@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const PLAN_BY_PRICE: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_PRO') ?? '_pro']: 'pro',
  [Deno.env.get('STRIPE_PRICE_TEAM') ?? '_team']: 'team',
}
const TOLERANCE_SECONDS = 300

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

async function verify(payload: string, header: string | null) {
  if (!header || !WEBHOOK_SECRET) return false
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]))
  const t = Number(parts.t)
  const signatures = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3))
  if (!t || !signatures.length || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return signatures.some((s) => timingSafeEqual(s, expected))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const STATUS_MAP: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due', unpaid: 'past_due', incomplete: 'past_due',
  canceled: 'canceled', incomplete_expired: 'canceled', paused: 'past_due',
}

// deno-lint-ignore no-explicit-any
async function syncSubscription(sub: any) {
  const orgId = sub.metadata?.organization_id
  const query = orgId
    ? admin.from('organizations').select('id').eq('id', orgId)
    : admin.from('organizations').select('id').eq('stripe_customer_id', sub.customer)
  const { data: org } = await query.maybeSingle()
  if (!org) {
    console.error('No organization for subscription', sub.id)
    return null
  }
  const item = sub.items?.data?.[0]
  const plan = PLAN_BY_PRICE[item?.price?.id] ?? sub.metadata?.plan ?? 'pro'
  const periodEnd = item?.current_period_end ?? sub.current_period_end
  const status = STATUS_MAP[sub.status] ?? 'past_due'
  await admin.from('organizations').update({
    stripe_customer_id: sub.customer,
    stripe_subscription_id: status === 'canceled' ? null : sub.id,
    subscription_plan: status === 'canceled' ? 'pro_trial' : plan,
    subscription_status: status === 'canceled' ? 'canceled' : status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    ...(sub.trial_end ? { trial_ends_at: new Date(sub.trial_end * 1000).toISOString() } : {}),
  }).eq('id', org.id)
  return org.id as string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const payload = await req.text()
  if (!(await verify(payload, req.headers.get('Stripe-Signature')))) {
    return new Response('Invalid signature', { status: 400 })
  }
  const event = JSON.parse(payload)

  // Idempotency: Stripe retries; process each event once.
  const { error: dup } = await admin.from('stripe_events').insert({ id: event.id, type: event.type })
  if (dup) return new Response('Already processed', { status: 200 })

  try {
    let orgId: string | null = null
    const obj = event.data?.object
    switch (event.type) {
      case 'checkout.session.completed':
        if (obj.subscription) {
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
            headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
          })
          if (res.ok) orgId = await syncSubscription(await res.json())
        }
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        orgId = await syncSubscription(obj)
        break
      default:
        break
    }
    if (orgId) {
      await admin.from('stripe_events').update({ organization_id: orgId }).eq('id', event.id)
      await admin.from('activity_logs').insert({
        organization_id: orgId, action: `stripe_${event.type.replace(/\./g, '_')}`, entity_type: 'organizations', entity_id: orgId,
        metadata: { event_id: event.id },
      })
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    // Let Stripe retry: remove the idempotency marker.
    await admin.from('stripe_events').delete().eq('id', event.id)
    console.error('webhook failed', event.type, e instanceof Error ? e.message : e)
    return new Response('Webhook handler failed', { status: 500 })
  }
})
