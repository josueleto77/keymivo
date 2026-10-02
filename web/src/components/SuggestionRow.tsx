import { Check, Pencil, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { useResolveSuggestion, type PreferenceSuggestion } from '@/features/ai'
import { PREFERENCE_TYPES, labelFor } from '@/lib/constants'
import type { Row } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Accept / Reject / Edit an AI preference suggestion. Never applied without the Realtor. */
export function SuggestionRow({ insight, clientId }: { insight: Row<'ai_insights'>; clientId: string }) {
  const resolve = useResolveSuggestion(clientId)
  const data = insight.structured_data as unknown as PreferenceSuggestion
  const kind = insight.insight_type as 'preference_new' | 'preference_change'
  const [editing, setEditing] = React.useState(false)
  const [type, setType] = React.useState(data.to_type)
  const [weight, setWeight] = React.useState(data.to_weight)

  const act = (decision: 'accepted' | 'rejected') =>
    resolve.mutate(
      { insightId: insight.id, kind, data, decision, override: editing ? { to_type: type, to_weight: weight } : undefined },
      {
        onSuccess: () => toast.success(decision === 'accepted' ? `Preference updated: ${data.value}` : 'Suggestion dismissed'),
        onError: (e) => toast.error(e.message),
      },
    )

  return (
    <div className={cn('rounded-xl border p-4', data.status !== 'pending' && 'bg-subtle/50')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{data.value}</span>
        {kind === 'preference_change' && data.from_type ? (
          <span className="text-sm text-muted">
            {labelFor(PREFERENCE_TYPES, data.from_type)} {data.from_weight}% → <b className="text-foreground">{labelFor(PREFERENCE_TYPES, data.to_type)} {data.to_weight}%</b>
          </span>
        ) : (
          <Badge variant="accent">New · {labelFor(PREFERENCE_TYPES, data.to_type)} {data.to_weight}%</Badge>
        )}
        <ConfidenceBadge value={insight.confidence} />
      </div>
      <p className="mt-1.5 text-sm text-slate-600">{data.reason}</p>
      {data.evidence && (
        <p className="mt-1 text-xs text-muted">
          Evidence{data.evidence_count ? ` (${data.evidence_count} showing interaction${data.evidence_count === 1 ? '' : 's'})` : ''}: {data.evidence}
        </p>
      )}

      {data.status === 'pending' ? (
        <>
          {editing && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="Preference type">
                {PREFERENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
              <label className="flex items-center gap-3 text-sm">
                <input type="range" min={0} max={100} step={5} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="flex-1 accent-[#111827]" aria-label="Importance" />
                <span className="w-10 text-right font-semibold tabular-nums">{weight}%</span>
              </label>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => act('accepted')} loading={resolve.isPending}><Check /> Accept</Button>
            <Button size="sm" variant="outline" onClick={() => act('rejected')} disabled={resolve.isPending}><X /> Reject</Button>
            {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil /> Edit</Button>}
          </div>
        </>
      ) : (
        <p className={cn('mt-2 text-xs font-semibold', data.status === 'accepted' ? 'text-success' : 'text-muted')}>
          {data.status === 'accepted' ? '✓ Accepted' : 'Rejected'}
        </p>
      )}
    </div>
  )
}

function ConfidenceBadge({ value }: { value: string | null }) {
  if (!value) return null
  return <Badge variant={value === 'high' ? 'success' : value === 'medium' ? 'warning' : 'default'} className="shrink-0">{value}</Badge>
}
