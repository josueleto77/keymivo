import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert } from '@/lib/types'
import type { ReactionValue } from '@/lib/constants'

export function useShowing(id: string | undefined) {
  return useQuery({
    queryKey: ['showing', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('showings')
          .select(
            '*, properties(*), clients(id, first_name, last_name, client_members(id, first_name)), showing_notes(*), buyer_reactions(*), property_photos(*), recording_consents(*)',
          )
          .eq('id', id!)
          .single(),
      ),
  })
}
export type ShowingDetail = NonNullable<ReturnType<typeof useShowing>['data']>

/** Starts (or resumes) a showing for client+property. Marks the tour stop as in progress. */
export function useStartShowing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { client_id: string; property_id: string; tour_id?: string | null }) => {
      const existing = unwrap(
        await supabase
          .from('showings')
          .select('id')
          .eq('client_id', input.client_id)
          .eq('property_id', input.property_id)
          .eq('status', 'active')
          .maybeSingle(),
      )
      if (existing) return existing
      // Started outside a tour? Attach it to this buyer's open tour that includes the home, so tour
      // progress and the Tour Summary stay accurate.
      if (!input.tour_id) {
        const stops = unwrap(
          await supabase
            .from('tour_properties')
            .select('tour_id, status, tours!inner(client_id, status, tour_date)')
            .eq('property_id', input.property_id)
            .eq('tours.client_id', input.client_id)
            .in('tours.status', ['planned', 'active'])
            .neq('status', 'completed'),
        )
        const today = new Date().toISOString().slice(0, 10)
        const best = [...stops].sort(
          (a, b) => Math.abs(Date.parse(a.tours.tour_date) - Date.parse(today)) - Math.abs(Date.parse(b.tours.tour_date) - Date.parse(today)),
        )[0]
        if (best) input = { ...input, tour_id: best.tour_id }
      }
      const showing = unwrap(
        await supabase
          .from('showings')
          .insert({ ...input, tour_id: input.tour_id ?? null } as Insert<'showings'>)
          .select('id')
          .single(),
      )
      if (input.tour_id) {
        await supabase
          .from('tour_properties')
          .update({ status: 'showing' })
          .eq('tour_id', input.tour_id)
          .eq('property_id', input.property_id)
        await supabase.from('tours').update({ status: 'active' }).eq('id', input.tour_id).eq('status', 'planned')
      }
      await supabase.from('clients').update({ status: 'touring' }).eq('id', input.client_id).in('status', ['new', 'searching'])
      return showing
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tours'] })
      qc.invalidateQueries({ queryKey: ['tour'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

function invalidateShowing(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ['showing', id] })
}

export function useAddNote(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (n: { content: string; note_type?: string; room_type?: string | null; sentiment?: string | null }) =>
      unwrap(
        await supabase
          .from('showing_notes')
          .insert({ ...n, showing_id: showingId } as Insert<'showing_notes'>)
          .select()
          .single(),
      ),
    onSuccess: () => invalidateShowing(qc, showingId),
  })
}

export function useDeleteNote(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('showing_notes').delete().eq('id', id)),
    onSuccess: () => invalidateShowing(qc, showingId),
  })
}

export const SENTIMENT: Record<ReactionValue, 'positive' | 'neutral' | 'negative'> = {
  love: 'positive', like: 'positive', neutral: 'neutral', dislike: 'negative', deal_breaker: 'negative',
}
export const STRENGTH: Record<ReactionValue, number> = { love: 5, like: 4, neutral: 3, dislike: 2, deal_breaker: 1 }

export function useAddReaction(showing: { id: string; client_id: string; property_id: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: { reaction: ReactionValue; feature: string; client_member_id?: string | null }) =>
      unwrap(
        await supabase
          .from('buyer_reactions')
          .insert({
            showing_id: showing.id,
            client_id: showing.client_id,
            property_id: showing.property_id,
            feature: r.feature,
            reaction: r.reaction,
            sentiment: SENTIMENT[r.reaction],
            strength: STRENGTH[r.reaction],
            client_member_id: r.client_member_id ?? null,
            source: 'realtor',
          } as Insert<'buyer_reactions'>)
          .select()
          .single(),
      ),
    onSuccess: () => invalidateShowing(qc, showing.id),
  })
}

export function useDeleteReaction(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('buyer_reactions').delete().eq('id', id)),
    onSuccess: () => invalidateShowing(qc, showingId),
  })
}

export function useRecordConsent(showing: { id: string; property_id: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(
        await supabase
          .from('recording_consents')
          .insert({ showing_id: showing.id, property_id: showing.property_id, consent_confirmed: true } as Insert<'recording_consents'>),
      )
      unwrap(await supabase.from('showings').update({ recording_consent: true }).eq('id', showing.id))
    },
    onSuccess: () => invalidateShowing(qc, showing.id),
  })
}

export function useSaveRecording(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { orgId: string; blob: Blob; durationSeconds: number }) => {
      const ext = input.blob.type.includes('mp4') ? 'm4a' : 'webm'
      const path = `${input.orgId}/${showingId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('recordings').upload(path, input.blob, { contentType: input.blob.type })
      if (error) throw new Error(error.message)
      return unwrap(
        await supabase
          .from('recordings')
          .insert({ showing_id: showingId, audio_url: path, duration_seconds: input.durationSeconds } as Insert<'recordings'>)
          .select()
          .single(),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['showing-recordings', showingId] }),
  })
}

export function useShowingRecordings(showingId: string | undefined) {
  return useQuery({
    queryKey: ['showing-recordings', showingId],
    enabled: !!showingId,
    queryFn: async () =>
      unwrap(await supabase.from('recordings').select('*').eq('showing_id', showingId!).order('created_at')),
  })
}

export function useEndShowing(showing: { id: string; tour_id: string | null; property_id: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      unwrap(
        await supabase
          .from('showings')
          .update({ status: 'completed', ended_at: new Date().toISOString() })
          .eq('id', showing.id),
      )
      if (showing.tour_id) {
        await supabase
          .from('tour_properties')
          .update({ status: 'completed' })
          .eq('tour_id', showing.tour_id)
          .eq('property_id', showing.property_id)
        const remaining = unwrap(
          await supabase
            .from('tour_properties')
            .select('id')
            .eq('tour_id', showing.tour_id)
            .in('status', ['scheduled', 'showing']),
        )
        if (remaining.length === 0) {
          await supabase.from('tours').update({ status: 'completed' }).eq('id', showing.tour_id)
        }
      }
    },
    onSuccess: () => {
      invalidateShowing(qc, showing.id)
      qc.invalidateQueries({ queryKey: ['tours'] })
      qc.invalidateQueries({ queryKey: ['tour'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Deletes the audio file and its row (transcripts cascade). */
export function useDeleteRecording(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rec: { id: string; audio_url: string }) => {
      const { error } = await supabase.storage.from('recordings').remove([rec.audio_url])
      if (error) throw new Error(error.message)
      unwrap(await supabase.from('recordings').delete().eq('id', rec.id))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['showing-recordings', showingId] }),
  })
}
