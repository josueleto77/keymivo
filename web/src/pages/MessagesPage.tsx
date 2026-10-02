import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Trash2 } from 'lucide-react'
import * as React from 'react'
import { FollowUpEditor } from '@/components/FollowUpEditor'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { ListSkeleton } from '@/components/ui/skeleton'
import { splitDraft, useDeleteMessage, useMessages, type MessageItem } from '@/features/messages'
import { cn, fullName } from '@/lib/utils'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Send later' },
  { value: 'buyer', label: 'From buyers' },
] as const

export function MessagesPage() {
  const { data, isLoading, error, refetch } = useMessages()
  const del = useDeleteMessage()
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]['value']>('all')
  const [open, setOpen] = React.useState<MessageItem | null>(null)
  const list = (data ?? []).filter((m) => filter === 'all' || (filter === 'buyer' ? m.sender === 'buyer' : m.status === filter && m.sender === 'agent'))

  return (
    <div>
      <PageHeader title="Messages" subtitle="AI-drafted follow-ups and buyer portal messages. Nothing is sent automatically." />
      <div className="mb-5 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', filter === f.value ? 'border-primary bg-primary text-white' : 'bg-card text-slate-600')}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : !list.length ? (
        <EmptyState icon={MessageSquare} title="No messages yet" description="After a showing, use “Generate client follow-up” to draft a message for your buyer." />
      ) : (
        <div className="divide-y rounded-2xl border bg-card shadow-card">
          {list.map((m) => {
            const d = splitDraft(m.content)
            const name = m.clients ? fullName(m.clients) : 'Client'
            return (
              <div key={m.id} className="flex items-start gap-3 p-4">
                <InitialsAvatar name={name} className="size-9 text-xs" />
                <button onClick={() => m.sender === 'agent' && setOpen(m)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{name}</span>
                    {m.properties && <span className="text-xs text-muted">· {m.properties.address_line1}</span>}
                    {m.sender === 'buyer' ? (
                      <Badge variant="accent">From buyer · portal</Badge>
                    ) : (
                      <Badge variant={m.status === 'scheduled' ? 'warning' : m.status === 'sent' ? 'success' : 'default'}>
                        {m.status === 'scheduled' ? 'Send later' : m.status === 'sent' && m.channel === 'portal' ? 'Posted to portal' : m.status}
                      </Badge>
                    )}
                  </div>
                  {m.sender === 'agent' && <div className="mt-0.5 truncate text-sm font-medium">{d.subject || 'Follow-up'}</div>}
                  <div className="line-clamp-2 text-sm text-muted">{d.body}</div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs text-muted">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  <button onClick={() => { if (confirm('Delete this draft?')) del.mutate(m.id) }} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-subtle" aria-label="Delete">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <FollowUpEditor message={open} open={!!open} onOpenChange={(v) => !v && setOpen(null)} />
    </div>
  )
}
