import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'

export const TEAM_ROLES = [
  { value: 'realtor', label: 'Realtor' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'team_leader', label: 'Team leader' },
] as const

export function useTeam(orgId: string) {
  return useQuery({
    queryKey: ['team', orgId],
    queryFn: async () => {
      const [members, invites, limit] = await Promise.all([
        supabase.from('profiles').select('id, user_id, first_name, last_name, email, role, created_at').eq('organization_id', orgId).neq('role', 'buyer').order('created_at'),
        supabase.from('org_invites').select('*').eq('organization_id', orgId).is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }),
        supabase.rpc('org_seat_limit', { p_org: orgId }),
      ])
      const fresh = unwrap(invites).filter((i) => Date.now() - new Date(i.created_at).getTime() < 14 * 86_400_000)
      return { members: unwrap(members), invites: fresh, seatLimit: unwrap(limit) as number }
    },
  })
}

export function useTeamMutations(orgId: string) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['team', orgId] })
  return {
    invite: useMutation({
      mutationFn: async (v: { role: string; email: string }) =>
        unwrap(await supabase.rpc('create_team_invite', { p_role: v.role, p_email: v.email })) as string,
      onSuccess: done,
    }),
    revoke: useMutation({ mutationFn: async (id: string) => unwrap(await supabase.rpc('revoke_team_invite', { p_invite_id: id })), onSuccess: done }),
    setRole: useMutation({
      mutationFn: async (v: { profileId: string; role: string }) => unwrap(await supabase.rpc('set_member_role', { p_profile_id: v.profileId, p_role: v.role })),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: async (id: string) => unwrap(await supabase.rpc('remove_team_member', { p_profile_id: id })), onSuccess: done }),
  }
}

export const teamInviteUrl = (token: string) => `${window.location.origin}/join?token=${token}`
