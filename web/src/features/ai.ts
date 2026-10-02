import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, unwrap } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export interface PreferenceSuggestion {
  status: 'pending' | 'accepted' | 'rejected'
  preference_id: string
  value: string
  from_type?: string
  from_weight?: number
  to_type: string
  to_weight: number
  reason: string
  evidence: string
  evidence_count?: number
}

export function useAnalyzeShowing(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-showing', { body: { showing_id: showingId } })
      if (error) {
        let message = error.message
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null)
          if (body?.error) message = body.error
        }
        throw new Error(message)
      }
      return data
    },
    onSettled: () => {
      for (const key of ['showing', 'showing-insights', 'tasks', 'dashboard', 'clients', 'client', 'client-scores', 'client-intel', 'properties', 'property']) {
        qc.invalidateQueries({ queryKey: [key] })
      }
    },
  })
}

export function useShowingInsights(showingId: string | undefined) {
  return useQuery({
    queryKey: ['showing-insights', showingId],
    enabled: !!showingId,
    queryFn: async () => {
      const [insights, tasks, score] = await Promise.all([
        supabase.from('ai_insights').select('*').eq('showing_id', showingId!).order('created_at'),
        supabase.from('tasks').select('*').eq('showing_id', showingId!).eq('ai_generated', true).order('priority'),
        supabase.from('showings').select('client_id, property_id').eq('id', showingId!).single(),
      ])
      const s = unwrap(score)
      const propertyScore = unwrap(
        await supabase.from('property_scores').select('*').eq('client_id', s.client_id).eq('property_id', s.property_id).maybeSingle(),
      )
      return { insights: unwrap(insights), tasks: unwrap(tasks), propertyScore }
    },
  })
}

/** Accept / reject / edit an AI preference suggestion. Confirmed preferences only change on accept. */
export function useResolveSuggestion(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      insightId,
      kind,
      data,
      decision,
      override,
    }: {
      insightId: string
      kind: 'preference_new' | 'preference_change'
      data: PreferenceSuggestion
      decision: 'accepted' | 'rejected'
      override?: { to_type: string; to_weight: number }
    }) => {
      const final = { ...data, ...override }
      if (decision === 'accepted') {
        if (kind === 'preference_new') {
          unwrap(
            await supabase
              .from('client_preferences')
              .update({ status: 'active', confirmed_by_realtor: true, preference_type: final.to_type, weight: final.to_weight })
              .eq('id', data.preference_id),
          )
        } else {
          const current = unwrap(
            await supabase.from('client_preferences').select('evidence_count').eq('id', data.preference_id).single(),
          )
          unwrap(
            await supabase
              .from('client_preferences')
              .update({
                preference_type: final.to_type,
                weight: final.to_weight,
                evidence_count: current.evidence_count + 1,
                source: 'showing_ai',
                confirmed_by_realtor: true,
              })
              .eq('id', data.preference_id),
          )
        }
      } else if (kind === 'preference_new') {
        unwrap(await supabase.from('client_preferences').update({ status: 'rejected' }).eq('id', data.preference_id))
      }
      unwrap(
        await supabase
          .from('ai_insights')
          .update({ structured_data: { ...final, status: decision } as unknown as Json })
          .eq('id', insightId),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['showing-insights'] })
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      qc.invalidateQueries({ queryKey: ['client-intel', clientId] })
    },
  })
}
