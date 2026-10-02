import { format, formatDistanceToNow } from 'date-fns'
import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminMetrics, type AdminMetrics } from '@/features/admin'
import { cn } from '@/lib/utils'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

export function AdminPage() {
  const { data, isLoading, error, refetch } = useAdminMetrics()
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />

  const conv = data.trial_conversion.eligible ? Math.round((data.trial_conversion.converted / data.trial_conversion.eligible) * 100) : null
  const tiles: { label: string; value: string | number; sub?: string }[] = [
    { label: 'Total users', value: data.total_users, sub: `${data.realtors} realtors · ${data.active_buyers} buyers` },
    { label: 'Active realtors', value: data.active_realtors, sub: 'Activity in last 30 days' },
    { label: 'Active buyers', value: data.active_buyers, sub: 'Joined a buyer portal' },
    { label: 'Organizations', value: data.organizations, sub: `${data.clients} real clients` },
    { label: 'Showings', value: data.showings, sub: `${data.showings_completed} completed` },
    { label: 'AI analyses', value: data.ai_analyses, sub: 'Showings, buyer learning, follow-ups' },
    { label: 'MRR', value: usd(data.mrr), sub: `${usd(data.committed_mrr)} committed incl. paid trials` },
    { label: 'Trial conversion', value: conv == null ? '—' : `${conv}%`, sub: `${data.trial_conversion.converted} of ${data.trial_conversion.eligible} trials` },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Platform admin" subtitle="Super Admin · all organizations" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="text-xs font-medium text-muted">{t.label}</div>
            <div className="mt-1 font-display text-3xl font-bold">{t.value}</div>
            {t.sub && <div className="mt-0.5 text-xs text-muted">{t.sub}</div>}
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted">MRR uses list prices (Pro $99, Team $399) for active subscriptions; Stripe remains the source of truth for revenue.</p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Signups · last 30 days</CardTitle></CardHeader>
          <CardContent><SignupBars data={data.signups_by_day} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              {([
                ['Free trial', data.subscriptions.free_trial],
                ['Paid · in trial', data.subscriptions.paid_trialing],
                ['Active (billing)', data.subscriptions.active],
                ['Past due', data.subscriptions.past_due],
                ['Trial ended, not converted', data.subscriptions.trial_expired],
                ['Pro plans', data.subscriptions.pro],
                ['Team plans', data.subscriptions.team],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2"><dt className="text-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent signups</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {data.recent_signups.map((u, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name || u.email}</div>
                  <div className="truncate text-xs text-muted">{u.email} · {u.organization ?? 'No organization'}</div>
                </div>
                <Badge variant={u.role === 'buyer' ? 'accent' : 'default'}>{u.role.replace('_', ' ')}</Badge>
                {!u.onboarded && <Badge variant="warning">onboarding</Badge>}
                <span className="w-20 shrink-0 text-right text-xs text-muted">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>System activity</CardTitle></CardHeader>
          <CardContent className="max-h-[420px] divide-y overflow-y-auto">
            {data.recent_activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 text-sm">
                <code className="min-w-0 flex-1 truncate text-xs">{a.action}</code>
                <span className="max-w-[40%] truncate text-xs text-muted">{a.organization ?? '—'}</span>
                <span className="w-20 shrink-0 text-right text-xs text-muted">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Organizations</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-subtle/50 text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Organization</th>
                <th className="px-3 py-2.5 font-medium">Plan</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Agents</th>
                <th className="px-3 py-2.5 text-right font-medium">Clients</th>
                <th className="px-5 py-2.5 text-right font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.organizations_list.map((o, i) => (
                <tr key={i}>
                  <td className="px-5 py-2.5 font-medium">{o.name}</td>
                  <td className="px-3 py-2.5">{o.paid ? o.plan : 'trial'}</td>
                  <td className="px-3 py-2.5"><StatusBadge o={o} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.members}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{o.clients}</td>
                  <td className="px-5 py-2.5 text-right text-muted">{format(new Date(o.created_at), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ o }: { o: AdminMetrics['organizations_list'][number] }) {
  const expired = !o.paid && o.status === 'trialing' && o.trial_ends_at && new Date(o.trial_ends_at) < new Date()
  const label = expired ? 'trial ended' : o.status === 'trialing' && o.paid ? 'paid · trial' : o.status.replace('_', ' ')
  const variant = o.status === 'active' || (o.paid && o.status === 'trialing') ? 'success' : o.status === 'past_due' || expired ? 'warning' : 'default'
  return <Badge variant={variant}>{label}</Badge>
}

/** Single-series bar chart: one hue, rounded data-ends, 2px gaps, per-bar hover tooltip, table fallback. */
function SignupBars({ data }: { data: AdminMetrics['signups_by_day'] }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((a, d) => a + d.count, 0)
  return (
    <div>
      <div className="mb-3 text-sm text-muted"><span className="font-display text-2xl font-bold text-foreground">{total}</span> new accounts</div>
      <div className="relative">
        <div className="flex h-40 items-end gap-[2px] border-b border-slate-200" role="img" aria-label={`Signups per day, last 30 days, total ${total}`}>
          {data.map((d, i) => (
            <div
              key={d.day}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={cn('w-full rounded-t-[4px] bg-accent transition-opacity', hover != null && hover !== i && 'opacity-40')}
                style={{ height: d.count ? `${(d.count / max) * 100}%` : 0 }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-xs text-white shadow-lift">
                  {format(new Date(`${d.day}T00:00:00`), 'MMM d')} · <b>{d.count}</b> signup{d.count === 1 ? '' : 's'}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>{format(new Date(`${data[0]?.day}T00:00:00`), 'MMM d')}</span>
          <span>Today</span>
        </div>
      </div>
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 w-full">
          <tbody>{data.filter((d) => d.count).map((d) => <tr key={d.day}><td className="py-0.5">{d.day}</td><td className="text-right tabular-nums">{d.count}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  )
}
