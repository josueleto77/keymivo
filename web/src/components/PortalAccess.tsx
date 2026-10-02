import { Copy, Link2, Mail, Share2, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/input'
import { useProperties } from '@/features/properties'
import { inviteUrl, useCreateInvite, usePortalShares, useSharePropertyMutations } from '@/features/portal'
import type { ClientMember } from '@/lib/types'

/** Per-member portal status + "Invite" → copyable private link (never auto-emailed). */
export function PortalInviteButton({ member }: { member: Pick<ClientMember, 'id' | 'first_name' | 'email' | 'user_id'> }) {
  const create = useCreateInvite()
  const [link, setLink] = React.useState<string | null>(null)
  if (member.user_id) return <Badge variant="success">Portal active</Badge>

  const mailto = link && member.email
    ? `mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent('Your Keymivo home-search portal')}&body=${encodeURIComponent(`Hi ${member.first_name},\n\nHere's your private link to see the homes we're considering, rate them and message me:\n\n${link}\n`)}`
    : null

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        loading={create.isPending}
        onClick={() => create.mutate(member.id, { onSuccess: (t) => setLink(inviteUrl(t)), onError: (e) => toast.error(e.message) })}
      >
        <Link2 /> Invite
      </Button>
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent title={`Invite ${member.first_name} to the portal`} description="Send this private link yourself. It expires in 30 days and works for one account.">
          <div className="space-y-3">
            <Input readOnly value={link ?? ''} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(link!); toast.success('Link copied') } catch { toast.error('Copy failed — select the link and copy it.') }
                }}
              >
                <Copy /> Copy link
              </Button>
              {mailto ? (
                <Button variant="outline" asChild><a href={mailto}><Mail /> Open in email</a></Button>
              ) : (
                <Button variant="outline" disabled title="Add an email for this buyer to use this"><Mail /> Open in email</Button>
              )}
            </div>
            <p className="text-xs text-muted">The buyer sees only homes you share or put on their tours, their tours, household ratings and portal messages — never your private notes or AI analysis.</p>
          </div>
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
