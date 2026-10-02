import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase, unwrap } from '@/lib/supabase'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd')
      const [clients, todaysTours, offers, tasks, activity, reactions] = await Promise.all([
        supabase
          .from('clients')
          .select('id, first_name, last_name, status, offer_readiness, is_demo, showings(id, status, property_id), property_scores(overall_score, property_id, properties(id, address_line1))')
          .not('status', 'in', '(closed,paused)'),
        supabase
          .from('tours')
          .select('id, name, client_id, clients(id, first_name, last_name), tour_properties(id, scheduled_time, sequence_number, status, property_id, properties(id, address_line1, city))')
          .eq('tour_date', today)
          .neq('status', 'cancelled'),
        supabase.from('offers').select('id', { count: 'exact', head: true }).in('status', ['considering', 'preparing', 'submitted']),
        supabase
          .from('tasks')
          .select('*, clients(first_name, last_name), properties(address_line1)')
          .in('status', ['open', 'in_progress'])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(8),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(12),
        supabase
          .from('buyer_reactions')
          .select('id, reaction, feature, created_at, clients(first_name), client_members(first_name), properties(id, address_line1)')
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      return {
        clients: unwrap(clients),
        todaysTours: unwrap(todaysTours),
        offersInProgress: offers.count ?? 0,
        tasks: unwrap(tasks),
        activity: unwrap(activity),
        reactions: unwrap(reactions),
      }
    },
  })
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('tasks')
          .select('*, clients(id, first_name, last_name), properties(id, address_line1)')
          .order('status')
          .order('due_date', { ascending: true, nullsFirst: false }),
      ),
  })
}
