import { format } from 'date-fns'
import {
  ArrowRight, CheckCircle2, GitCompareArrows, HelpCircle, Home, ListChecks, Mail, Mic, RefreshCw, Sparkles, TriangleAlert, User,
} from 'lucide-react'
import * as React from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useSignedUrl } from '@/components/PropertyImage'
import { Badge, DemoBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/empty-state'
import { ScoreRing } from '@/components/ui/score-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { FollowUpEditor } from '@/components/FollowUpEditor'
import { SuggestionRow } from '@/components/SuggestionRow'
import { toast } from 'sonner'
import { useGenerateFollowup, type MessageItem } from '@/features/messages'
import { useAnalyzeShowing, useShowingInsights } from '@/features/ai'
import { splitPhotoUrl } from '@/features/properties'
import { useShowing, useShowingRecordings, type ShowingDetail } from '@/features/showings'
import { sortedStops, useTour } from '@/features/tours'
import { REACTIONS } from '@/lib/constants'
import { cn, fullName, scoreLabel, scoreTone } from '@/lib/utils'

const INTEREST_LABEL = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', very_high: 'VERY HIGH' } as const
const PROGRESS = ['Analyzing buyer reactions…', 'Finding important concerns…', 'Updating buyer preferences…', 'Building next steps…']

export function ShowingCompletePage() {
  const { id } = useParams()
  const location = useLocation()
  const { data: s, isLoading, error, refetch } = useShowing(id)
  const analyze = useAnalyzeShowing(id ?? '')
  const started = React.useRef(false)

  // Kick off analysis automatically right after ending a showing (or if it never ran).
  React.useEffect(() => {
    if (!s || started.current) return
    const justEnded = (location.state as { justEnded?: boolean } | null)?.justEnded
    if (s.status === 'completed' && (s.ai_status === 'not_started' || (justEnded && s.ai_status !== 'completed'))) {
      started.current = true
      analyze.mutate()
    }
  }, [s, location.state, analyze])

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (error || !s) return <ErrorState message={(error as Error)?.message ?? 'Showing not found'} onRetry={() => refetch()} />

  const processing = analyze.isPending || s.ai_status === 'processing'
  const failed = !processing && (analyze.isError || s.ai_status === 'failed')

  return (
    <div className="mx-auto max-w-4xl">
      <Header s={s} />
      {processing ? (
        <Processing />
      ) : failed ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TriangleAlert className="size-5 shrink-0 text-warning" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">We couldn't analyze this showing right now.</p>
              <p className="text-slate-600">Your notes have been saved and you can retry the analysis.</p>
              {analyze.error && <p className="mt-1 text-xs text-muted">{(analyze.error as Error).message}</p>}
            </div>
            <Button variant="outline" onClick={() => analyze.mutate()}><RefreshCw /> Retry analysis</Button>
          </CardContent>
        </Card>
      ) : s.ai_status === 'completed' ? (
        <AiResults s={s} onRerun={() => analyze.mutate()} />
      ) : s.status === 'active' ? null : (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">This showing hasn't been analyzed yet.</p>
            <Button variant="accent" onClick={() => analyze.mutate()}><Sparkles /> Analyze showing</Button>
          </CardContent>
        </Card>
      )}

      {!processing && <CapturedData s={s} />}
      <Actions s={s} />
    </div>
  )
}

function Header({ s }: { s: ShowingDetail }) {
  const minutes = s.ended_at ? Math.max(1, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)) : null
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-green-50 text-success">
        <CheckCircle2 className="size-7" />
      </div>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">{s.status === 'active' ? 'Showing in progress' : 'Showing Complete'}</h1>
      <p className="mt-2 text-muted">
        Property: <Link to={`/properties/${s.property_id}`} className="font-semibold text-foreground hover:underline">{s.properties?.address_line1}</Link>
        {' · '}
        Buyer: <Link to={`/clients/${s.client_id}`} className="font-semibold text-foreground hover:underline">{fullName(s.clients)}</Link>
        {s.properties?.is_demo && <> <DemoBadge /></>}
      </p>
      <p className="mt-1 text-xs text-muted">{format(new Date(s.started_at), 'EEE, MMM d · h:mm a')}{minutes ? ` · ${minutes} min` : ''}</p>
    </div>
  )
}

function Processing() {
  const [i, setI] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % PROGRESS.length), 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="relative grid size-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/15" />
          <Sparkles className="relative size-7 text-accent" />
        </div>
        <p className="mt-5 font-display text-xl font-bold">Keymivo is organizing your showing</p>
        <p key={i} className="mt-2 text-sm text-muted">{PROGRESS[i]}</p>
      </CardContent>
    </Card>
  )
}

function AiResults({ s, onRerun }: { s: ShowingDetail; onRerun: () => void }) {
  const { data, isLoading } = useShowingInsights(s.id)
  if (isLoading || !data) return <Skeleton className="mb-6 h-72 w-full" />
  const by = (t: string) => data.insights.filter((i) => i.insight_type === t)
  const summary = by('showing_summary')[0]
  const nextAction = by('next_action')[0]
  const concerns = by('concern')
  const questions = by('question')
  const suggestions = data.insights.filter((i) => i.insight_type === 'preference_new' || i.insight_type === 'preference_change')
  const level = (s.buyer_interest_level ?? 'medium') as keyof typeof INTEREST_LABEL
  const match = data.propertyScore?.overall_score
  const aiReactions = s.buyer_reactions

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-5">
            <ScoreRing score={s.buyer_interest_score ?? 0} size={96} stroke={8} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted">Buyer Interest</div>
              <div className={cn('mt-1 font-display text-2xl font-bold', scoreTone(s.buyer_interest_score))}>{INTEREST_LABEL[level]}</div>
              <div className="text-sm text-muted">{s.buyer_interest_score} / 100</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-5">
            {match != null ? <ScoreRing score={match} size={96} stroke={8} /> : <Skeleton className="size-24 rounded-full" />}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted">Buyer Match</div>
              <div className={cn('mt-1 font-display text-2xl font-bold', scoreTone(match))}>{match != null ? scoreLabel(match) : '—'}</div>
              <Link to={`/properties/${s.property_id}`} className="text-sm font-medium text-accent">Why this score?</Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card className="border-blue-100 bg-blue-50/40">
          <CardContent className="flex gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
            <p className="text-sm leading-relaxed">{summary.content}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <ReactionCard title="Loved" items={aiReactions.filter((r) => r.reaction === 'love')} tone="success" />
        <ReactionCard title="Liked" items={aiReactions.filter((r) => r.reaction === 'like')} tone="accent" />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TriangleAlert className="size-4 text-warning" /> Concerns</CardTitle></CardHeader>
          <CardContent>
            {concerns.length === 0 ? <p className="text-sm text-muted">None identified.</p> : (
              <ul className="space-y-2.5">
                {concerns.map((c) => {
                  const d = c.structured_data as { detail?: string; basis?: string } | null
                  return (
                    <li key={c.id} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{c.content}</span>
                        <ConfidenceBadge value={c.confidence} />
                      </div>
                      {d?.detail && <p className="text-xs text-muted">{d.detail}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HelpCircle className="size-4 text-accent" /> Questions</CardTitle></CardHeader>
          <CardContent>
            {questions.length === 0 ? <p className="text-sm text-muted">No open questions.</p> : (
              <ul className="list-disc space-y-1.5 pl-5 text-sm">{questions.map((q) => <li key={q.id}>{q.content}</li>)}</ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-success" /> Tasks</CardTitle>
            <Link to="/tasks" className="text-xs font-semibold text-accent">All tasks</Link>
          </CardHeader>
          <CardContent>
            {data.tasks.length === 0 ? <p className="text-sm text-muted">No tasks created.</p> : (
              <ul className="space-y-2">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', t.priority === 'high' ? 'bg-danger' : t.priority === 'medium' ? 'bg-warning' : 'bg-slate-300')} />
                    <span className={t.status === 'done' ? 'text-muted line-through' : ''}>{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>New Preferences Learned</CardTitle>
            <p className="mt-1 text-xs text-muted">Nothing changes until you accept. Confirmed preferences are never overwritten automatically.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted">No preference changes suggested from this showing.</p>
          ) : (
            suggestions.map((i) => <SuggestionRow key={i.id} insight={i} clientId={s.client_id} />)
          )}
        </CardContent>
      </Card>

      {nextAction && (
        <Card className="border-primary bg-primary text-white">
          <CardContent>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Recommended Next Action</div>
            <p className="mt-1.5 text-base font-medium">{nextAction.content}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-xs text-muted">
        <span>AI-generated analysis is informational. Verify physical conditions with qualified professionals.</span>
        <button onClick={onRerun} className="inline-flex shrink-0 items-center gap-1 font-semibold hover:text-foreground"><RefreshCw className="size-3" /> Re-run</button>
      </div>
    </div>
  )
}

function ConfidenceBadge({ value }: { value: string | null }) {
  if (!value) return null
  return <Badge variant={value === 'high' ? 'success' : value === 'medium' ? 'warning' : 'default'} className="shrink-0">{value}</Badge>
}

function CapturedData({ s }: { s: ShowingDetail }) {
  const recordings = useShowingRecordings(s.id)
  const realtorReactions = s.buyer_reactions.filter((r) => r.source !== 'showing_ai')
  return (
    <details className="group mb-6 rounded-2xl border bg-card shadow-card" open={s.ai_status !== 'completed'}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[15px] font-semibold">
        Captured during the showing
        <span className="text-xs font-normal text-muted">
          {realtorReactions.length} reactions · {s.showing_notes.length} notes · {s.property_photos.length} photos
        </span>
      </summary>
      <div className="space-y-4 border-t px-5 py-4">
        {realtorReactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {realtorReactions.map((r) => (
              <Badge key={r.id} variant={r.sentiment === 'positive' ? 'success' : r.sentiment === 'negative' ? 'warning' : 'default'}>
                {REACTIONS.find((x) => x.value === r.reaction)?.emoji} {r.feature}
              </Badge>
            ))}
          </div>
        )}
        {s.showing_notes.length > 0 && (
          <ul className="space-y-2">
            {s.showing_notes.map((n) => (
              <li key={n.id} className="text-sm">“{n.content}”{n.room_type && <span className="ml-2 text-xs text-muted">· {n.room_type}</span>}</li>
            ))}
          </ul>
        )}
        {s.property_photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{s.property_photos.map((p) => <Thumb key={p.id} photo={p} />)}</div>
        )}
        {!!recordings.data?.length && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Mic className="size-4" /> {recordings.data.length} recording{recordings.data.length === 1 ? '' : 's'} ·{' '}
            {recordings.data.map((r) => r.transcription_status).join(', ')}
          </p>
        )}
        {!realtorReactions.length && !s.showing_notes.length && !s.property_photos.length && !recordings.data?.length && (
          <p className="text-sm text-muted">Nothing was captured.</p>
        )}
      </div>
    </details>
  )
}

function Actions({ s }: { s: ShowingDetail }) {
  const tour = useTour(s.tour_id ?? undefined)
  const nextStop = tour.data ? sortedStops(tour.data).find((t) => t.status === 'scheduled') : undefined
  const followup = useGenerateFollowup(s.id)
  const [draft, setDraft] = React.useState<MessageItem | null>(null)
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {s.status === 'active' ? (
        <Button size="lg" asChild className="sm:col-span-2 lg:col-span-4"><Link to={`/showings/${s.id}`}>Return to showing</Link></Button>
      ) : nextStop ? (
        <Button size="lg" variant="accent" asChild className="sm:col-span-2 lg:col-span-4">
          <Link to={`/tours/${s.tour_id}`}>Next: {nextStop.properties?.address_line1} <ArrowRight /></Link>
        </Button>
      ) : null}
      <Button size="lg" variant="outline" asChild><Link to={`/compare?client=${s.client_id}`}><GitCompareArrows /> Compare Property</Link></Button>
      {s.status === 'completed' && (
        <Button
          size="lg"
          variant="outline"
          loading={followup.isPending}
          onClick={() => followup.mutate(undefined, { onSuccess: (m) => setDraft(m), onError: (e) => toast.error(e.message) })}
        >
          {!followup.isPending && <Mail />} {followup.isPending ? 'Drafting…' : 'Generate Follow-up'}
        </Button>
      )}
      <Button size="lg" variant="outline" asChild><Link to={`/properties/${s.property_id}`}><Home /> View Property</Link></Button>
      <Button size="lg" variant="outline" asChild><Link to={`/clients/${s.client_id}`}><User /> View Client</Link></Button>
      <FollowUpEditor message={draft} open={!!draft} onOpenChange={(v) => !v && setDraft(null)} />
    </div>
  )
}

function ReactionCard({ title, items, tone }: { title: string; items: ShowingDetail['buyer_reactions']; tone: 'success' | 'accent' }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><span className="text-xs text-muted">{items.length}</span></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted">—</p> : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((r) => (
              <Badge key={r.id} variant={tone}>
                {r.feature}{r.source === 'showing_ai' && <Sparkles className="size-3 opacity-70" />}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Thumb({ photo }: { photo: ShowingDetail['property_photos'][number] }) {
  const { bucket, path } = splitPhotoUrl(photo.photo_url)
  const { data: url } = useSignedUrl(bucket, path)
  return <div className="aspect-square overflow-hidden rounded-lg bg-subtle">{url && <img src={url} alt={photo.room_type ?? ''} className="size-full object-cover" />}</div>
}
