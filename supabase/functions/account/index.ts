// account — data export and account deletion (privacy requirements).
// export: returns the caller's data as JSON (staff: their organization, RLS-scoped; buyer: their portal data).
// delete: buyer → unlinks + deletes their login; agent in a team → leaves + deletes login;
//         sole member → cancels Stripe, deletes files, all organization data and logins. Irreversible.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const ORG_TABLES = [
  'clients', 'client_members', 'client_preferences', 'properties', 'property_photos', 'property_intelligence', 'tours',
  'tour_properties', 'showings', 'showing_notes', 'recording_consents', 'recordings', 'transcripts', 'buyer_reactions',
  'property_scores', 'tasks', 'mortgage_scenarios', 'comparisons', 'comparison_properties', 'offers', 'messages',
  'ai_insights', 'portal_shares', 'buyer_ratings', 'activity_logs',
]
const BUCKETS = ['property-photos', 'showing-media', 'recordings']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) return json({ error: 'Not signed in' }, 401)
    const { action, confirm } = await req.json().catch(() => ({}))
    const { data: profile } = await admin.from('profiles').select('*').eq('user_id', u.user.id).single()
    if (!profile) return json({ error: 'Profile not found' }, 404)
    const isBuyer = profile.role === 'buyer'

    // ── Export ────────────────────────────────────────────────────────
    if (action === 'export') {
      if (isBuyer) {
        const { data, error } = await db.rpc('portal_data')
        if (error) throw new Error(error.message)
        return json({ exported_at: new Date().toISOString(), account: { email: u.user.email }, portal: data })
      }
      const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile }
      const { data: org } = await db.from('organizations').select('*').eq('id', profile.organization_id).maybeSingle()
      out.organization = org
      for (const t of ORG_TABLES) {
        // Always scope to the caller's organization (super admins can otherwise read every tenant).
        const { data, error } = await db.from(t).select('*').eq('organization_id', profile.organization_id).limit(50000)
        if (error) throw new Error(`${t}: ${error.message}`)
        out[t] = data
      }
      await admin.from('activity_logs').insert({ organization_id: profile.organization_id, user_id: u.user.id, action: 'data_exported', entity_type: 'organizations' })
      return json(out)
    }

    // ── Delete ────────────────────────────────────────────────────────
    if (action === 'delete') {
      if (confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400)

      if (isBuyer) {
        await admin.from('client_members').update({ user_id: null }).eq('user_id', u.user.id)
        await admin.auth.admin.deleteUser(u.user.id)
        return json({ deleted: 'account' })
      }

      const orgId = profile.organization_id as string | null
      const { data: staff } = orgId
        ? await admin.from('profiles').select('id, user_id, role').eq('organization_id', orgId).neq('role', 'buyer')
        : { data: [] as { id: string; user_id: string; role: string }[] }
      const others = (staff ?? []).filter((s) => s.user_id !== u.user.id)

      if (others.length > 0) {
        const managers = ['super_admin', 'brokerage_admin', 'team_leader']
        if (managers.includes(profile.role) && !others.some((o) => managers.includes(o.role))) {
          return json({ error: 'Make another member a team leader before deleting your account.' }, 400)
        }
        await admin.from('activity_logs').insert({ organization_id: orgId, user_id: u.user.id, action: 'team_member_deleted_account', entity_type: 'profiles', entity_id: profile.id })
        await admin.auth.admin.deleteUser(u.user.id) // cascades to profile; the team keeps its data
        return json({ deleted: 'account' })
      }

      if (orgId) {
        const { data: org } = await admin.from('organizations').select('stripe_subscription_id').eq('id', orgId).single()
        if (org?.stripe_subscription_id && Deno.env.get('STRIPE_SECRET_KEY')) {
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${org.stripe_subscription_id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}` },
          })
          if (!res.ok && res.status !== 404) throw new Error('Could not cancel the Stripe subscription. Try again or cancel it from Manage billing first.')
        }
        for (const bucket of BUCKETS) await removePrefix(admin, bucket, orgId)
        const { data: buyers } = await admin.from('client_members').select('user_id').eq('organization_id', orgId).not('user_id', 'is', null)
        await admin.from('organizations').delete().eq('id', orgId) // cascades all tenant data
        for (const b of buyers ?? []) if (b.user_id) await admin.auth.admin.deleteUser(b.user_id)
      }
      await admin.auth.admin.deleteUser(u.user.id)
      return json({ deleted: 'organization' })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('account failed', message)
    return json({ error: message }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function removePrefix(admin: any, bucket: string, prefix: string) {
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  const files: string[] = []
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    if (entry.id) files.push(path)
    else await removePrefix(admin, bucket, path) // folder
  }
  if (files.length) await admin.storage.from(bucket).remove(files)
}
