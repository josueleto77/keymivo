import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Link } from 'react-router-dom'
import { PrivacyCard } from '@/components/PrivacyCard'
import { useTeam } from '@/features/team'
import { planLabel } from '@/lib/billing'
import { US_STATES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuth, useSession } from '@/providers/AuthProvider'

export function SettingsPage() {
  const { profile, organization } = useSession()
  const { refreshProfile } = useAuth()
  const team = useTeam(organization.id)
  const qc = useQueryClient()
  const [form, setForm] = React.useState({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    phone: profile.phone ?? '',
    brokerage_name: profile.brokerage_name ?? '',
    license_state: profile.license_state ?? 'MA',
    license_number: profile.license_number ?? '',
    primary_market: profile.primary_market ?? '',
  })
  const [orgName, setOrgName] = React.useState(organization.name)
  const [saving, setSaving] = React.useState(false)
  const [demoBusy, setDemoBusy] = React.useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error('Name is required')
    setSaving(true)
    const [a, b] = await Promise.all([
      supabase.from('profiles').update(form).eq('id', profile.id),
      orgName.trim() !== organization.name ? supabase.from('organizations').update({ name: orgName.trim() }).eq('id', organization.id) : Promise.resolve({ error: null }),
    ])
    setSaving(false)
    const err = a.error ?? b.error
    if (err) return toast.error(err.message)
    toast.success('Settings saved')
    refreshProfile()
  }

  async function demo(action: 'seed_demo_data' | 'remove_demo_data') {
    if (action === 'remove_demo_data' && !confirm('Remove all demo clients, properties, tours and showings?')) return
    setDemoBusy(true)
    const { error } = await supabase.rpc(action)
    setDemoBusy(false)
    if (error) return toast.error(error.message)
    toast.success(action === 'seed_demo_data' ? 'Demo workspace loaded' : 'Demo data removed')
    qc.invalidateQueries()
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <form onSubmit={save} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Realtor profile</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="s-fn"><Input id="s-fn" value={form.first_name} onChange={set('first_name')} /></Field>
            <Field label="Last name" htmlFor="s-ln"><Input id="s-ln" value={form.last_name} onChange={set('last_name')} /></Field>
            <Field label="Email" htmlFor="s-em"><Input id="s-em" value={profile.email ?? ''} disabled /></Field>
            <Field label="Phone" htmlFor="s-ph"><Input id="s-ph" value={form.phone} onChange={set('phone')} /></Field>
            <Field label="Brokerage" htmlFor="s-br"><Input id="s-br" value={form.brokerage_name} onChange={set('brokerage_name')} /></Field>
            <Field label="Primary market" htmlFor="s-pm"><Input id="s-pm" value={form.primary_market} onChange={set('primary_market')} /></Field>
            <Field label="License state" htmlFor="s-ls">
              <NativeSelect id="s-ls" value={form.license_state} onChange={set('license_state')}>
                {US_STATES.map((s) => <option key={s}>{s}</option>)}
              </NativeSelect>
            </Field>
            <Field label="License number" htmlFor="s-lnum"><Input id="s-lnum" value={form.license_number} onChange={set('license_number')} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="s-org"><Input id="s-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></Field>
            <Field label="Plan" htmlFor="s-plan">
              <div className="flex gap-2">
                <Input id="s-plan" disabled value={planLabel(organization)} />
                <Button type="button" variant="outline" asChild><Link to="/settings/billing">Billing</Link></Button>
              </div>
            </Field>
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button type="submit" loading={saving}>Save changes</Button></div>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/settings/team" className="rounded-2xl border bg-card p-4 shadow-card hover:shadow-lift">
          <div className="font-semibold">Team</div>
          <div className="text-sm text-muted">Invite agents, roles and seats</div>
        </Link>
        <Link to="/settings/billing" className="rounded-2xl border bg-card p-4 shadow-card hover:shadow-lift">
          <div className="font-semibold">Plan & billing</div>
          <div className="text-sm text-muted">{planLabel(organization)}</div>
        </Link>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Demo workspace</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted">Load Mike & Sarah Johnson with five Massachusetts demo homes and a Saturday tour. Everything is labeled DEMO and can be removed at any time.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => demo('seed_demo_data')} loading={demoBusy}>Load demo data</Button>
            <Button variant="ghost" className="text-danger" onClick={() => demo('remove_demo_data')} disabled={demoBusy}>Remove demo data</Button>
          </div>
        </CardContent>
      </Card>
      <div className="mt-6"><PrivacyCard soleMember={(team.data?.members.length ?? 1) <= 1} /></div>
    </div>
  )
}
