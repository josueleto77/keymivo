import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'

export interface AdminMetrics {
  total_users: number
  active_realtors: number
  realtors: number
  active_buyers: number
  clients: number
  organizations: number
  showings: number
  showings_completed: number
  ai_analyses: number
  mrr: number
  committed_mrr: number
  subscriptions: { free_trial: number; trial_expired: number; paid_trialing: number; active: number; past_due: number; pro: number; team: number }
  trial_conversion: { converted: number; eligible: number }
  signups_by_day: { day: string; count: number }[]
  recent_signups: { name: string; email: string | null; role: string; organization: string | null; onboarded: boolean; created_at: string }[]
  organizations_list: { name: string; plan: string; status: string; trial_ends_at: string | null; paid: boolean; created_at: string; members: number; clients: number }[]
  recent_activity: { action: string; entity_type: string | null; organization: string | null; created_at: string }[]
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => unwrap(await supabase.rpc('admin_metrics')) as unknown as AdminMetrics,
  })
}
