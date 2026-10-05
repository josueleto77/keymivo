import { formatDistanceToNow } from 'date-fns'
import { CalendarDays, CreditCard, FileSignature, Mail, MapPin, Plug, Users } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { useBillingStatus } from '@/features/billing'
import { useCrm, useFubConnection, useGoogle, useGoogleConnection, type GoogleSettings } from '@/features/integrations'
import { mapsEnabled } from '@/lib/maps'

type State = 'connected' | 'available' | 'setup' | 'soon' | 'error'
const BADGE: Record<State, { label: string; variant: 'success' | 'accent' | 'warning' | 'outline' | 'danger' }> = {
  connected: { label: 'Connected', variant: 'success' },
  available: { label: 'Available', variant: 'accent' },
  setup: { label: 'Setup in progress', variant: 'warning' },
  soon: { label: 'Coming soon', variant: 'outline' },
  error: { label: 'Needs attention', variant: 'danger' },
}

function Tile({ icon: Icon, name, state, detail, children }: { icon: typeof Plug; name: string; state: State; detail: React.ReactNode; children?: React.ReactNode }) {
  const b = BADGE[state]
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-subtle"><Icon className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{name}</div>
            <div className="text-xs text-muted">{detail}</div>
          </div>
          <Badge variant={b.variant}>{b.label}</Badge>
        </div>
        {children && <div className="mt-auto">{children}</div>}
      </CardContent>
    </Card>
  )
}

export function IntegrationsPage() {
  const billing = useBillingStatus()
  const fubConn = useFubConnection()
  const crm = useCrm()
  const [open, setOpen] = React.useState(false)
  const [key, setKey] = React.useState('')
  const googleConn = useGoogleConnection()
  const google = useGoogle()
  const gs = (googleConn?.settings ?? {}) as GoogleSettings
  const [params, setParams] = useSearchParams()

  // Google sends the Realtor back here after the consent screen.
  React.useEffect(() => {
    const g = params.get('google')
    if (!g) return
    if (g === 'connected') toast.success('Google connected — Gmail and Calendar are ready.')
    else if (g === 'partial') toast.warning('Google connected, but some permissions were not allowed. Reconnect and keep every box checked.')
    else if (g === 'cancelled') toast('Google connection cancelled.')
    else toast.error('Google connection failed. Please try again.')
    params.delete('google')
    setParams(params, { replace: true })
  }, [params, setParams])

  const googleState = (ok: boolean | undefined): State => (googleConn ? (googleConn.status === 'error' || ok === false ? 'error' : 'connected') : 'available')
  const googleDetail = (what: string) => googleConn
    ? <>{googleConn.account_label}{googleConn.last_sync_at ? ` · used ${formatDistanceToNow(new Date(googleConn.last_sync_at), { addSuffix: true })}` : ''}</>
    : what
  const googleActions = googleConn ? (
    <div className="space-y-3">
      {googleConn.status === 'error' && googleConn.last_error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{googleConn.last_error}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" loading={google.connect.isPending} onClick={() => google.connect.mutate(undefined, { onError: (e) => toast.error(e.message) })}>Reconnect</Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => { if (confirm('Disconnect Google? Gmail sending and Calendar sync stop. Events already created stay in your calendar.')) google.disconnect.mutate(undefined, { onError: (e) => toast.error(e.message) }) }}>Disconnect</Button>
      </div>
    </div>
  ) : (
    <Button size="sm" loading={google.connect.isPending} onClick={() => google.connect.mutate(undefined, { onError: (e) => toast.error(e.message) })}>Connect Google</Button>
  )

  const fubState: State = fubConn ? (fubConn.status === 'error' ? 'error' : 'connected') : 'available'
  const autoSync = (fubConn?.settings as { auto_sync_showings?: boolean } | null)?.auto_sync_showings ?? true

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Only working integrations are marked available or connected." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Tile
          icon={Users}
          name="Follow Up Boss"
          state={fubState}
          detail={fubConn
            ? <>{fubConn.account_label}{fubConn.last_sync_at ? ` · synced ${formatDistanceToNow(new Date(fubConn.last_sync_at), { addSuffix: true })}` : ''}</>
            : 'Sync buyers, showing summaries and AI tasks to your FUB account.'}
        >
          {fubConn ? (
            <div className="space-y-3">
              {fubConn.status === 'error' && fubConn.last_error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{fubConn.last_error}</p>}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={autoSync} onCheckedChange={(v) => crm.settings.mutate(v === true, { onError: (e) => toast.error(e.message) })} />
                Send each analyzed showing to FUB automatically
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setKey(''); setOpen(true) }}>Update key</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => { if (confirm('Disconnect Follow Up Boss? Your FUB data is not deleted.')) crm.disconnect.mutate() }}>Disconnect</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => { setKey(''); setOpen(true) }}>Connect</Button>
          )}
        </Tile>

        <Tile icon={Mail} name="Gmail" state={googleState(gs.gmail)} detail={googleDetail('Send follow-ups from your own Gmail address, one click from the draft.')}>
          {googleActions}
        </Tile>

        <Tile icon={CalendarDays} name="Google Calendar" state={googleState(gs.calendar)} detail={googleDetail('Put tour stops in your Google Calendar with address, time and buyer.')}>
          <div className="space-y-2">
            {!googleConn && googleActions}
            <Button size="sm" variant="outline" asChild><Link to="/settings">Calendar feed for Apple / Outlook</Link></Button>
          </div>
        </Tile>

        <Tile icon={CreditCard} name="Stripe" state={billing.data?.configured ? 'connected' : 'soon'} detail={billing.data?.configured ? `Subscriptions & billing${billing.data.test_mode ? ' · test mode' : ''}` : 'Subscriptions & billing'} />

        <Tile
          icon={MapPin}
          name="Google Maps"
          state={mapsEnabled() ? 'connected' : 'setup'}
          detail={mapsEnabled() ? 'Address autocomplete, property maps, tour routes with drive times and order optimization.' : 'Waiting for the Google Maps API key.'}
        />
        <Tile icon={FileSignature} name="DocuSign" state="setup" detail="Send buyer agency agreements for e-signature. Waiting for the DocuSign developer setup." />
        <Tile icon={Plug} name="HubSpot" state="soon" detail="Contacts, notes and tasks sync." />
        <Tile icon={Plug} name="GoHighLevel" state="soon" detail="Contacts, notes and tasks sync." />
        <Tile icon={Plug} name="MLS" state="soon" detail="Requires an MLS data license (e.g. MLS PIN via a RESO Web API vendor)." />
        <Tile icon={Plug} name="ShowingTime" state="soon" detail="Partner API access required." />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Connect Follow Up Boss" description="Find your key in Follow Up Boss → Admin → API. It's stored encrypted and never shown again.">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              crm.connect.mutate(key.trim(), {
                onSuccess: (r) => { toast.success(`Connected to ${r.account_label}`); setOpen(false) },
                onError: (err) => toast.error(err.message),
              })
            }}
          >
            <Field label="API key" htmlFor="fub-key"><Input id="fub-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="fka_…" /></Field>
            <p className="text-xs text-muted">Keymivo creates/updates buyers as People, logs showing summaries and follow-ups as Notes, and adds AI tasks as Tasks. It never sends emails or texts from FUB.</p>
            <Button type="submit" className="w-full" loading={crm.connect.isPending} disabled={key.trim().length < 10}>Connect</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
