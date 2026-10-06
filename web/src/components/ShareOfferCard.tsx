import { formatDistanceToNow } from 'date-fns'
import { MessageSquareQuote, Send, Share2 } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import {
  CHOICE_LABEL, useOfferResponses, usePortalMembers, useShareOffer, useUnshareOffer,
  type BuyerChoice, type OfferDetail,
} from '@/features/offers'

/** Share the offer strategy to the buyer portal, and see what each buyer picked. */
export function ShareOfferCard({ offer }: { offer: OfferDetail }) {
  const share = useShareOffer(offer.id)
  const unshare = useUnshareOffer(offer.id)
  const responses = useOfferResponses(offer.id)
  const members = usePortalMembers(offer.client_id)
  const [note, setNote] = React.useState(offer.share_note ?? '')
  const [editing, setEditing] = React.useState(false)

  const joined = (members.data ?? []).filter((m) => m.user_id)
  const shared = !!offer.shared_at
  const outdated = shared && !!offer.analyzed_at && new Date(offer.analyzed_at) > new Date(offer.shared_at!)
  const buyer = offer.clients?.first_name ?? 'the buyer'

  function doShare() {
    share.mutate(note, {
      onSuccess: () => { toast.success(shared ? 'Shared version updated' : `Shared with ${buyer}`); setEditing(false) },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold"><Share2 className="size-4" /> Buyer portal</div>
          {shared ? (
            <Badge variant={outdated ? 'warning' : 'success'}>
              {outdated ? 'Shared version is older' : `Shared ${formatDistanceToNow(new Date(offer.shared_at!), { addSuffix: true })}`}
            </Badge>
          ) : (
            <Badge variant="outline">Not shared</Badge>
          )}
        </div>

        {(!shared || editing) && (
          <>
            <p className="text-sm text-muted">
              {buyer} will see the three scenarios with payments, cash to close, advantages, risks and terms to discuss, and can tell you which one they prefer.
              Your notes and the "data gaps" list stay private. They see a copy of this version — re-share after changing it.
            </p>
            {members.data && joined.length === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No one in this household has joined the portal yet. <Link to={`/clients/${offer.client_id}`} className="font-medium underline">Invite them</Link> so they can see it.
              </p>
            )}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the buyer, e.g. Let's talk tonight before we decide." className="min-h-16" />
            <div className="flex gap-2">
              <Button onClick={doShare} loading={share.isPending}><Send /> {shared ? 'Share updated version' : 'Share to buyer portal'}</Button>
              {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
          </>
        )}

        {shared && !editing && (
          <div className="space-y-3">
            {outdated && <p className="text-sm text-amber-800">You re-ran the analysis after sharing. {buyer} still sees the earlier version.</p>}
            {joined.length > 0 && <p className="text-xs text-muted">Visible to {joined.map((m) => m.first_name).join(' & ')} in the portal.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={outdated ? 'default' : 'outline'} onClick={() => setEditing(true)}>{outdated ? 'Share updated version' : 'Edit note / re-share'}</Button>
              <Button
                size="sm" variant="ghost" className="text-danger" loading={unshare.isPending}
                onClick={() => { if (confirm(`Remove this offer strategy from ${buyer}'s portal?`)) unshare.mutate(undefined, { onSuccess: () => toast.success('Removed from portal'), onError: (e) => toast.error(e.message) }) }}
              >
                Stop sharing
              </Button>
            </div>
          </div>
        )}

        {(responses.data?.length ?? 0) > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Buyer feedback</div>
            {responses.data!.map((r) => (
              <div key={r.id} className="flex gap-2 text-sm">
                <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-accent" />
                <div>
                  <span className="font-medium">{r.client_members?.first_name ?? 'Buyer'}</span>{' '}
                  <span className="text-slate-700">{CHOICE_LABEL[r.choice as BuyerChoice] ?? r.choice}</span>
                  <span className="text-xs text-muted"> · {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}</span>
                  {r.comment && <p className="text-muted">“{r.comment}”</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
