import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, Handshake, MessageSquare, Star, UserCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase, unwrap } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const ICON = { buyer_rating: Star, offer_interest: Handshake, offer_response: Handshake, buyer_message: MessageSquare, portal_joined: UserCheck } as const

export function NotificationBell({ className }: { className?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['notifications'],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () =>
      unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(25)),
  })
  const markRead = useMutation({
    mutationFn: async (ids: string[]) =>
      unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const items = data ?? []
  const unread = items.filter((n) => !n.read_at)

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={cn('relative grid size-9 place-items-center rounded-full text-slate-600 hover:bg-subtle', className)} aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}>
          <Bell className="size-5" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border bg-card shadow-lift">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unread.length > 0 && (
              <button className="text-xs font-semibold text-accent" onClick={() => markRead.mutate(unread.map((n) => n.id))}>Mark all read</button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">You're all caught up. Buyer ratings, messages and portal activity show up here.</p>
            ) : (
              items.map((n) => {
                const Icon = ICON[n.kind as keyof typeof ICON] ?? Bell
                return (
                  <DropdownMenu.Item
                    key={n.id}
                    onSelect={() => {
                      if (!n.read_at) markRead.mutate([n.id])
                      if (n.link) navigate(n.link)
                    }}
                    className={cn('flex cursor-pointer gap-3 border-b px-4 py-3 outline-none last:border-0 data-[highlighted]:bg-subtle', !n.read_at && 'bg-blue-50/50')}
                  >
                    <div className={cn('grid size-8 shrink-0 place-items-center rounded-full', ['offer_interest', 'offer_response'].includes(n.kind) ? 'bg-green-50 text-success' : 'bg-blue-50 text-accent')}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-muted">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />}
                  </DropdownMenu.Item>
                )
              })
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
