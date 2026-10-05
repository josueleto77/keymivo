import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCrm, useFubConnection, useIntegrationLink } from '@/features/integrations'

/** Client header button: create/update the buyer in Follow Up Boss. Hidden when FUB isn't connected. */
export function FubClientButton({ clientId }: { clientId: string }) {
  const conn = useFubConnection()
  const linkQ = useIntegrationLink('client', clientId)
  const crm = useCrm()
  if (!conn) return null
  return (
    <Button
      variant="outline"
      loading={crm.syncClient.isPending}
      onClick={() => crm.syncClient.mutate(clientId, {
        onSuccess: () => toast.success(linkQ.data ? 'Updated in Follow Up Boss' : 'Added to Follow Up Boss'),
        onError: (e) => toast.error(e.message),
      })}
      title={linkQ.data ? `Linked to FUB person #${linkQ.data.external_id}` : 'Create this buyer in Follow Up Boss'}
    >
      {linkQ.data ? 'FUB ✓ Sync' : 'Add to FUB'}
    </Button>
  )
}

/** On the showing summary: auto-sends the AI summary + tasks once (if enabled), plus a manual button. */
export function FubShowingSync({ showingId, analyzed }: { showingId: string; analyzed: boolean }) {
  const conn = useFubConnection()
  const linkQ = useIntegrationLink('showing_note', showingId)
  const crm = useCrm()
  const tried = React.useRef(false)
  const autoSync = (conn?.settings as { auto_sync_showings?: boolean } | null)?.auto_sync_showings ?? true

  React.useEffect(() => {
    if (!conn || !analyzed || !autoSync || linkQ.isLoading || linkQ.data || tried.current) return
    tried.current = true
    crm.pushShowing.mutate(showingId, {
      onSuccess: (r) => toast.success(`Sent to Follow Up Boss${r.tasks_sent ? ` · ${r.tasks_sent} task${r.tasks_sent === 1 ? '' : 's'}` : ''}`),
      onError: (e) => toast.error(`Follow Up Boss: ${e.message}`),
    })
  }, [conn, analyzed, autoSync, linkQ.isLoading, linkQ.data, showingId, crm.pushShowing])

  if (!conn || !analyzed) return null
  return (
    <button
      className="inline-flex shrink-0 items-center gap-1 font-semibold hover:text-foreground"
      disabled={crm.pushShowing.isPending}
      onClick={() => crm.pushShowing.mutate(showingId, {
        onSuccess: (r) => toast.success(r.note_sent || r.tasks_sent ? 'Sent to Follow Up Boss' : 'Already in Follow Up Boss'),
        onError: (e) => toast.error(e.message),
      })}
    >
      {crm.pushShowing.isPending ? 'Sending to FUB…' : linkQ.data ? 'In Follow Up Boss ✓' : 'Send to Follow Up Boss'}
    </button>
  )
}
