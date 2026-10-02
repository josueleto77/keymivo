import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase, unwrap } from '@/lib/supabase'

const FEED = 'https://ymilfkgnbrpmgmxghvqt.supabase.co/functions/v1/calendar?token='

/** Private ICS subscription: tours appear in Google / Apple / Outlook calendars automatically. */
export function CalendarSyncCard() {
  const qc = useQueryClient()
  const { data: token } = useQuery({
    queryKey: ['calendar-token'],
    queryFn: async () => unwrap(await supabase.rpc('get_calendar_token')) as string,
  })
  const rotate = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('rotate_calendar_token')) as string,
    onSuccess: (t) => {
      qc.setQueryData(['calendar-token'], t)
      toast.success('New link created. Re-subscribe in your calendar with the new link.')
    },
  })
  const https = token ? FEED + token : ''
  const webcal = https.replace(/^https:/, 'webcal:')
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-4" /> Calendar sync</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">Subscribe once and every tour stop shows up in your calendar with the address and buyer. Changes in Keymivo sync automatically.</p>
        <div className="flex gap-2">
          <Input readOnly value={https} onFocus={(e) => e.target.select()} aria-label="Calendar subscription link" className="font-mono text-xs" />
          <Button variant="outline" size="icon" aria-label="Copy link" disabled={!token}
            onClick={async () => { try { await navigator.clipboard.writeText(https); toast.success('Link copied') } catch { toast.error('Select the link and copy it.') } }}>
            <Copy />
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild disabled={!token}><a href={google} target="_blank" rel="noreferrer">Add to Google Calendar</a></Button>
          <Button variant="outline" asChild disabled={!token}><a href={webcal}>Add to Apple / Outlook</a></Button>
        </div>
        <p className="text-xs text-muted">
          Google refreshes subscribed calendars every few hours; Apple and Outlook more often. Keep this link private — anyone with it can see your tour schedule.{' '}
          <button className="inline-flex items-center gap-1 font-semibold underline" onClick={() => { if (confirm('Create a new link? The current one stops working.')) rotate.mutate() }}>
            <RefreshCw className="size-3" /> Reset link
          </button>
        </p>
      </CardContent>
    </Card>
  )
}
