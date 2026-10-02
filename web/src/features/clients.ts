import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert, Update } from '@/lib/types'

const CLIENT_LIST_SELECT =
  '*, client_members(id, first_name, last_name), showings(id, status, property_id), property_scores(overall_score, property_id, properties(id, address_line1))'

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () =>
      unwrap(await supabase.from('clients').select(CLIENT_LIST_SELECT).order('updated_at', { ascending: false })),
  })
}
export type ClientListItem = NonNullable<ReturnType<typeof useClients>['data']>[number]

/** Derived buyer-journey metrics shown on cards and the dashboard. */
export function clientMetrics(c: Pick<ClientListItem, 'showings' | 'property_scores'>) {
  const completed = c.showings.filter((s) => s.status === 'completed')
  const homesToured = new Set(completed.map((s) => s.property_id)).size
  const sorted = [...c.property_scores].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))
  const top = sorted[0]
  return {
    homesToured,
    favorite: top?.properties ? { id: top.properties.id, address: top.properties.address_line1, score: top.overall_score } : null,
    runnerUp: sorted[1]?.properties ? { id: sorted[1].properties.id, address: sorted[1].properties.address_line1, score: sorted[1].overall_score } : null,
  }
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['client', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('clients')
          .select('*, client_members(*), client_preferences(*)')
          .eq('id', id!)
          .single(),
      ),
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      client: Omit<Insert<'clients'>, 'organization_id'>
      members: { first_name: string; last_name?: string | null; email?: string | null }[]
      preferences: { preference_type: string; category: string; value: string; weight: number }[]
    }) => {
      const client = unwrap(await supabase.from('clients').insert(input.client as Insert<'clients'>).select().single())
      if (input.members.length) {
        unwrap(
          await supabase.from('client_members').insert(
            input.members.map((m, i) => ({ ...m, client_id: client.id, is_primary: i === 0 }) as Insert<'client_members'>),
          ),
        )
      }
      if (input.preferences.length) {
        unwrap(
          await supabase.from('client_preferences').insert(
            input.preferences.map(
              (p) =>
                ({
                  ...p,
                  client_id: client.id,
                  source: 'onboarding',
                  confidence: 'high',
                  confirmed_by_realtor: true,
                }) as Insert<'client_preferences'>,
            ),
          ),
        )
      }
      return client
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Update<'clients'>) =>
      unwrap(await supabase.from('clients').update(patch).eq('id', id).select().single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('clients').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

// ── Household members ───────────────────────────────────────────────
export function useAddMember(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: { first_name: string; last_name?: string | null; email?: string | null }) =>
      unwrap(
        await supabase
          .from('client_members')
          .insert({ ...m, client_id: clientId } as Insert<'client_members'>)
          .select()
          .single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', clientId] }),
  })
}

export function useRemoveMember(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('client_members').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', clientId] }),
  })
}

// ── Preferences ─────────────────────────────────────────────────────
export function useUpsertPreference(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id?: string } & Omit<Update<'client_preferences'>, 'id'>) => {
      if (p.id) {
        const { id, ...patch } = p
        return unwrap(await supabase.from('client_preferences').update(patch).eq('id', id).select().single())
      }
      return unwrap(
        await supabase
          .from('client_preferences')
          .insert({ ...p, client_id: clientId, confirmed_by_realtor: true, source: 'realtor' } as Insert<'client_preferences'>)
          .select()
          .single(),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', clientId] }),
  })
}

export function useDeletePreference(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('client_preferences').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client', clientId] }),
  })
}

// ── Client-scoped related data ──────────────────────────────────────
export function useClientScores(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-scores', clientId],
    enabled: !!clientId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('property_scores')
          .select('*, properties(*)')
          .eq('client_id', clientId!)
          .order('overall_score', { ascending: false }),
      ),
  })
}

export function useClientShowings(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-showings', clientId],
    enabled: !!clientId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('showings')
          .select('*, properties(id, address_line1, city, state)')
          .eq('client_id', clientId!)
          .order('started_at', { ascending: false }),
      ),
  })
}

export function useClientActivity(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-activity', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const reactions = unwrap(
        await supabase
          .from('buyer_reactions')
          .select('*, properties(address_line1)')
          .eq('client_id', clientId!)
          .order('created_at', { ascending: false })
          .limit(30),
      )
      return reactions
    },
  })
}
