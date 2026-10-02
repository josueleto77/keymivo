import { Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { household, type MemberRating } from '@/lib/household'
import { cn, scoreTone } from '@/lib/utils'

const DECISION_LABEL: Record<string, string> = { love: 'Love It', like: 'Like It', maybe: 'Maybe', pass: 'Pass', discuss_offer: 'Discuss Offer' }

/** "Mike: 95/100 · Sarah: 77/100 — Where you agree / Different opinions". */
export function HouseholdOpinions({ ratings, title = 'Household opinions' }: { ratings: MemberRating[]; title?: string }) {
  if (!ratings.length) return null
  const h = household(ratings)
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-4" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {h.scores.map((s) => (
            <div key={s.name} className="min-w-[120px] flex-1 rounded-xl border px-4 py-3">
              <div className="text-sm text-muted">{s.name}</div>
              <div className={cn('font-display text-2xl font-bold', scoreTone(s.score))}>{s.score ?? '—'}<span className="text-sm font-medium text-muted"> / 100</span></div>
              {s.decision && <div className="text-xs font-medium">{DECISION_LABEL[s.decision]}</div>}
            </div>
          ))}
        </div>
        {ratings.length >= 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Where you agree</div>
              {h.agree.length ? <div className="flex flex-wrap gap-1.5">{h.agree.map((a) => <Badge key={a} variant="success">{a}</Badge>)}</div> : <p className="text-sm text-muted">—</p>}
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Different opinions</div>
              {h.differ.length ? (
                <ul className="space-y-1 text-sm">{h.differ.map((d) => <li key={d.label}><b>{d.label}</b> <span className="text-muted">· {d.detail}</span></li>)}</ul>
              ) : <p className="text-sm text-muted">—</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
