import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, unwrap } from '@/lib/supabase'

export function useConnections() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () =>
      unwrap(await supabase.from('integration_connections').select('provider, account_label, status, settings, last_sync_at, last_error, created_at')),
  })
}
export type Connection = NonNullable<ReturnType<typeof useConnections>['data']>[number]

export function useFubConnection() {
  const { data } = useConnections()
  return data?.find((c) => c.provider === 'follow_up_boss') ?? null
}

async function crm<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('crm', { body })
  if (error) {
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      const b = await error.context.json().catch(() => null)
      if (b?.error) message = b.error
    }
    throw new Error(message)
  }
  return data as T
}

export function useCrm() {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['integrations'] })
    qc.invalidateQueries({ queryKey: ['integration-links'] })
  }
  return {
    connect: useMutation({ mutationFn: (apiKey: string) => crm<{ account_label: string }>({ action: 'connect', api_key: apiKey }), onSuccess: done }),
    disconnect: useMutation({ mutationFn: () => crm({ action: 'disconnect' }), onSuccess: done }),
    settings: useMutation({ mutationFn: (autoSync: boolean) => crm({ action: 'settings', auto_sync_showings: autoSync }), onSuccess: done }),
    syncClient: useMutation({ mutationFn: (clientId: string) => crm<{ person_id: string }>({ action: 'sync_client', client_id: clientId }), onSettled: done }),
    pushShowing: useMutation({
      mutationFn: (showingId: string) => crm<{ note_sent: boolean; tasks_sent: number }>({ action: 'push_showing', showing_id: showingId }),
      onSettled: done,
    }),
    pushMessage: useMutation({ mutationFn: (messageId: string) => crm({ action: 'push_message', message_id: messageId }), onSettled: done }),
  }
}

export function useIntegrationLink(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['integration-links', entityType, entityId],
    enabled: !!entityId,
    queryFn: async () =>
      unwrap(
        await supabase.from('integration_links').select('external_id, synced_at').eq('provider', 'follow_up_boss')
          .eq('entity_type', entityType).eq('entity_id', entityId!).maybeSingle(),
      ),
  })
}

export function useGoogleConnection() {
  const { data } = useConnections()
  return data?.find((c) => c.provider === 'google') ?? null
}
export type GoogleSettings = { email?: string; gmail?: boolean; calendar?: boolean }

async function googleFn<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-oauth', { body })
  if (error) {
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      const b = await error.context.json().catch(() => null)
      if (b?.error) message = b.error
    }
    throw new Error(message)
  }
  return data as T
}

export function useGoogle() {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['integrations'] })
    qc.invalidateQueries({ queryKey: ['google-links'] })
  }
  return {
    /** Redirects the browser to Google's consent screen; Google returns to /integrations. */
    connect: useMutation({
      mutationFn: async () => {
        const { url } = await googleFn<{ url: string }>({ action: 'start', return_origin: window.location.origin })
        window.location.assign(url)
      },
    }),
    disconnect: useMutation({ mutationFn: () => googleFn({ action: 'disconnect' }), onSuccess: done }),
    sendEmail: useMutation({
      mutationFn: (v: { messageId: string; subject: string; body: string }) =>
        googleFn<{ to: string }>({ action: 'send_email', message_id: v.messageId, subject: v.subject, body: v.body }),
      onSettled: () => { done(); qc.invalidateQueries({ queryKey: ['messages'] }) },
    }),
    syncTour: useMutation({
      mutationFn: (tourId: string) => googleFn<{ created: number; updated: number; events: number }>({ action: 'sync_tour', tour_id: tourId }),
      onSettled: done,
    }),
  }
}

/** Whether a Keymivo tour already has events in Google Calendar. */
export function useTourInGoogle(tourId: string | undefined, stopIds: string[]) {
  return useQuery({
    queryKey: ['google-links', 'tour', tourId, stopIds.join(',')],
    enabled: !!tourId,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('integration_links').select('entity_id, synced_at').eq('provider', 'google')
          .in('entity_type', ['calendar_tour', 'calendar_stop']).in('entity_id', [tourId!, ...stopIds]),
      )
      return rows.length ? rows.map((r) => r.synced_at).sort().at(-1)! : null
    },
  })
}
