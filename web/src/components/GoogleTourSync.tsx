import { formatDistanceToNow } from 'date-fns'
import { CalendarCheck2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useGoogle, useGoogleConnection, useTourInGoogle, type GoogleSettings } from '@/features/integrations'

/** "Sync to Google Calendar" — only shown when the Realtor connected Google with calendar access. */
export function GoogleTourSync({ tourId, stopIds }: { tourId: string; stopIds: string[] }) {
  const conn = useGoogleConnection()
  const google = useGoogle()
  const synced = useTourInGoogle(tourId, stopIds)
  if (!conn || (conn.settings as GoogleSettings | null)?.calendar === false) return null
  return (
    <Button
      variant="outline"
      loading={google.syncTour.isPending}
      title={synced.data ? `Last synced ${formatDistanceToNow(new Date(synced.data), { addSuffix: true })}` : undefined}
      onClick={() =>
        google.syncTour.mutate(tourId, {
          onSuccess: (r) => toast.success(r.created || r.updated
            ? `Google Calendar updated (${r.created} new, ${r.updated} updated)`
            : 'Google Calendar is up to date'),
          onError: (e) => toast.error(e.message),
        })}
    >
      <CalendarCheck2 /> {synced.data ? 'Update Google Calendar' : 'Sync to Google Calendar'}
    </Button>
  )
}
