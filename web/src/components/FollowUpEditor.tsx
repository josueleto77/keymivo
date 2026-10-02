import { Clock, Copy, Mail, Save } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { joinDraft, splitDraft, useUpdateMessage, type MessageItem } from '@/features/messages'

/** Edit / Copy / Send later / Save. Keymivo never sends messages automatically. */
export function FollowUpEditor({ message, open, onOpenChange }: { message: MessageItem | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const update = useUpdateMessage()
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  React.useEffect(() => {
    if (message) {
      const d = splitDraft(message.content)
      setSubject(d.subject)
      setBody(d.body)
    }
  }, [message])
  if (!message) return null

  const persist = (status: 'draft' | 'scheduled' | 'sent', toastMsg: string, channel?: 'portal') =>
    update.mutate(
      { id: message.id, content: joinDraft(subject, body), status, ...(channel ? { channel } : {}) },
      { onSuccess: () => { toast.success(toastMsg); onOpenChange(false) }, onError: (e) => toast.error(e.message) },
    )

  async function copy() {
    try {
      await navigator.clipboard.writeText(subject ? `${subject}\n\n${body}` : body)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed — select the text and copy manually.')
    }
  }

  const email = message.clients?.email
  const mailto = email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Client follow-up"
        description={`Draft for ${message.clients?.first_name ?? 'client'}${message.properties ? ` · ${message.properties.address_line1}` : ''}. Review before sending — nothing is sent automatically.`}
        className="sm:max-w-2xl"
      >
        <div className="space-y-3">
          <Field label="Subject" htmlFor="fu-subject"><Input id="fu-subject" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Message" htmlFor="fu-body"><Textarea id="fu-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] leading-relaxed" /></Field>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" onClick={copy}><Copy /> Copy</Button>
            <Button variant="outline" onClick={() => persist('scheduled', 'Moved to Send later')} disabled={update.isPending}><Clock /> Send later</Button>
            {mailto ? (
              <Button variant="outline" asChild><a href={mailto}><Mail /> Open in email</a></Button>
            ) : (
              <Button variant="outline" disabled title="Add the client's email to open it in your email app"><Mail /> Open in email</Button>
            )}
            <Button onClick={() => persist('draft', 'Draft saved')} loading={update.isPending}><Save /> Save</Button>
          </div>
          <Button
            variant="accent"
            className="w-full"
            disabled={update.isPending || (message.channel === 'portal' && message.status === 'sent')}
            onClick={() => {
              if (confirm(`Post this message to ${message.clients?.first_name ?? 'the client'}'s Keymivo portal? They'll see it the next time they open the portal.`)) {
                persist('sent', 'Posted to the buyer portal', 'portal')
              }
            }}
          >
            {message.channel === 'portal' && message.status === 'sent' ? 'Posted to buyer portal' : 'Post to buyer portal'}
          </Button>
          <p className="text-xs text-muted">"Send later" keeps it in your queue under Messages. Email is always sent by you from your own email; the portal post only appears inside Keymivo.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
