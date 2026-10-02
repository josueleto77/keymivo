import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert } from '@/lib/types'

export function useCompareData(clientId: string | undefined) {
  return useQuery({
    queryKey: ['compare', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [client, scores, showings, comparisons] = await Promise.all([
        supabase.from('clients').select('id, first_name, last_name, down_payment_amount, target_price_max').eq('id', clientId!).single(),
        supabase.from('property_scores').select('*').eq('client_id', clientId!),
        supabase
          .from('showings')
          .select('id, property_id, ended_at, ai_analysis, buyer_interest_score, buyer_reactions(feature, reaction)')
          .eq('client_id', clientId!)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false }),
        supabase
          .from('comparisons')
          .select('id, name, created_at, comparison_properties(property_id, rank)')
          .eq('client_id', clientId!)
          .order('created_at', { ascending: false }),
      ])
      return {
        client: unwrap(client),
        scores: unwrap(scores),
        showings: unwrap(showings),
        comparisons: unwrap(comparisons),
      }
    },
  })
}
export type CompareData = NonNullable<ReturnType<typeof useCompareData>['data']>

export function useSaveComparison(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, propertyIds }: { name: string; propertyIds: string[] }) => {
      const c = unwrap(
        await supabase.from('comparisons').insert({ client_id: clientId, name } as Insert<'comparisons'>).select().single(),
      )
      unwrap(
        await supabase.from('comparison_properties').insert(
          propertyIds.map((property_id, i) => ({ comparison_id: c.id, property_id, rank: i + 1 }) as Insert<'comparison_properties'>),
        ),
      )
      return c
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compare', clientId] }),
  })
}

export function useDeleteComparison(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('comparisons').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compare', clientId] }),
  })
}
