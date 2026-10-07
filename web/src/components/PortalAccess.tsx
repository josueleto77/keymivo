import { Copy, Link2, MessageSquare, Send, Share2, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useProperties } from '@/features/properties'
import { useGoogleConnection } from '@/features/integrations'
import { inviteUrl, useCreateInvite, usePortalShares, useSendInvite, useSharePropertyMutations } from '@/features/portal'
import type { ClientMember } from '@/lib/types'

/** Per-member portal status + "Invite": emails the private link from the app (Gmail or Keymivo email), or copy it. */
export function PortalInviteButton({ member }: { member: Pick<ClientMember, 'id' | 'first_name' | 'email' | 'user_id'> }) {
  const create = useCreateInvite()
  const send = useSendInvite()
  const google = useGoogleConnection()
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState(member.email ?? '')
  const [note, setNote] = React.useState('')
  const [link, setLink] = React.useState<string | null>(null)
  if (member.user_id) return <Badge variant="success">Portal active</Badge>

  const gmail = google && (google.settings as { gmail?: boolean } | null)?.gmail !== false ? google.account_label : null
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setEmail(member.email ?? ''); setLink(null); setOpen(true) }}>
        <Send /> Invite
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Invite ${member.first_name} to the portal`} description="They get a private link to see the homes you share, tours and offer options, rate homes and message you.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              send.mutate({ memberId: member.id, email: email.trim(), note }, {
                onSuccess: (r) => { toast.success(`Invite sent to ${r.sent_to}`); setOpen(false) },
                onError: (err) => toast.error(err.message),
              })
            }}
          >
            <Field label="Email" htmlFor={`inv-email-${member.id}`}>
              <Input id={`inv-email-${member.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@email.com" />
            </Field>
            <Field label="Personal note (optional)" htmlFor={`inv-note-${member.id}`}>
              <Textarea id={`inv-note-${member.id}`} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20"
                placeholder="I set up a private portal for our home search — you'll see the homes I share, our tours and offer options." />
            </Field>
            <Button type="submit" className="w-full" loading={send.isPending} disabled={!validEmail}><Send /> Send invite</Button>
            <p className="text-xs text-muted">
              {gmail ? <>Sends from your Gmail (<b>{gmail}</b>), so replies come to you.</> : <>Sends by Keymivo email. <Link to="/integrations" className="underline">Connect Gmail</Link> to send it from your own address.</>}
            </p>

            <div className="border-t pt-3">
              {link ? (
                <div className="space-y-2">
                  <Input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={async () => {
                      try { await navigator.clipboard.writeText(link); toast.success('Link copied') } catch { toast.error('Copy failed — select the link and copy it.') }
                    }}><Copy /> Copy link</Button>
                    <Button type="button" variant="outline" asChild>
                      <a href={`sms:?&body=${encodeURIComponent(`Hi ${member.first_name}, here's your private link to our home search portal: ${link}`)}`}><MessageSquare /> Text it</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" disabled={create.isPending}
                  onClick={() => create.mutate(member.id, { onSuccess: (t) => setLink(inviteUrl(t)), onError: (e) => toast.error(e.message) })}>
                  <Link2 className="mr-1 inline size-4" />Or get the link to send it yourself (text, WhatsApp…)
                </button>
              )}
            </div>
            <p className="text-xs text-muted">The link expires in 30 days and works for one account. Buyers never see your private notes or AI analysis.</p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Explicitly share homes (with an optional note) to the buyer portal. */
export function PortalSharesCard({ clientId }: { clientId: string }) {
  const shares = usePortalShares(clientId)
  const properties = useProperties()
  const { share, unshare } = useSharePropertyMutations(clientId)
  const [propertyId, setPropertyId] = React.useState('')
  const [note, setNote] = React.useState('')
  const sharedIds = new Set((shares.data ?? []).map((s) => s.property_id))

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><Share2 className="size-4" /> Shared with buyer portal</CardTitle>
          <p className="mt-1 text-xs text-muted">Homes on this buyer's tours are visible automatically. Share others here, with an optional note.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            if (!propertyId) return
            share.mutate({ propertyId, note }, {
              onSuccess: () => { setPropertyId(''); setNote(''); toast.success('Shared with buyer') },
              onError: (err) => toast.error(err.message),
            })
          }}
        >
          <NativeSelect value={propertyId} onChange={(e) => setPropertyId(e.target.value)} aria-label="Property to share">
            <option value="">Choose a home…</option>
            {(properties.data ?? []).filter((p) => !sharedIds.has(p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.address_line1}, {p.city}</option>
            ))}
          </NativeSelect>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the buyer (optional)" aria-label="Note" />
          <Button type="submit" disabled={!propertyId} loading={share.isPending}>Share</Button>
        </form>
        {(shares.data ?? []).length > 0 && (
          <ul className="divide-y rounded-xl border">
            {shares.data!.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.properties?.address_line1}</div>
                  {s.note && <div className="text-xs text-muted">“{s.note}”</div>}
                </div>
                <button onClick={() => unshare.mutate(s.id)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-subtle" aria-label="Stop sharing">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
