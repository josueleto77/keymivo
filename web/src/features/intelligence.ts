import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, unwrap } from '@/lib/supabase'

export function useClientIntelligence(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-intel', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [reactions, insights, showings, scores] = await Promise.all([
        supabase
          .from('buyer_reactions')
          .select('feature, reaction, property_id, showing_id, source, properties(address_line1)')
          .eq('client_id', clientId!),
        supabase
          .from('ai_insights')
          .select('*')
          .eq('client_id', clientId!)
          .in('insight_type', ['buyer_learning', 'preference_new', 'preference_change'])
          .order('created_at', { ascending: false }),
        supabase
          .from('showings')
          .select('id, ended_at, ai_status')
          .eq('client_id', clientId!)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false }),
        supabase
          .from('property_scores')
          .select('*, properties(id, address_line1, city)')
          .eq('client_id', clientId!)
          .order('overall_score', { ascending: false }),
      ])
      const allInsights = unwrap(insights)
      return {
        reactions: unwrap(reactions).map((r) => ({ ...r, address: r.properties?.address_line1 })),
        learning: allInsights.find((i) => i.insight_type === 'buyer_learning') ?? null,
        suggestions: allInsights.filter(
          (i) => i.insight_type !== 'buyer_learning' && (i.structured_data as { status?: string } | null)?.status === 'pending',
        ),
        completedShowings: unwrap(showings),
        scores: unwrap(scores),
      }
    },
  })
}
export type ClientIntelligence = NonNullable<ReturnType<typeof useClientIntelligence>['data']>

export function useAnalyzePreferences(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('analyze-preferences', { body: { client_id: clientId } })
      if (error) {
        let message = error.message
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null)
          if (body?.error) message = body.error
        }
        throw new Error(message)
      }
      return data as { narrative: string; suggestions: number }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['client-intel', clientId] })
      qc.invalidateQueries({ queryKey: ['client', clientId] })
    },
  })
}
