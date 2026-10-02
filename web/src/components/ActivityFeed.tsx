import { formatDistanceToNow } from 'date-fns'
import { Activity, CalendarPlus, CheckCircle2, Heart, Home, Mic, Play, Sliders, ThumbsDown, ThumbsUp, UserPlus } from 'lucide-react'
import type { ActivityLog } from '@/lib/types'

const ACTION_COPY: Record<string, { text: string; icon: typeof Activity }> = {
  client_created: { text: 'New buyer added', icon: UserPlus },
  property_created: { text: 'Property added', icon: Home },
  tour_created: { text: 'Tour scheduled', icon: CalendarPlus },
  showing_started: { text: 'Showing started', icon: Play },
  showing_completed: { text: 'Showing completed', icon: CheckCircle2 },
  recording_consent_confirmed: { text: 'Recording consent confirmed', icon: Mic },
  preference_created: { text: 'Buyer preference added', icon: Sliders },
  preference_updated: { text: 'Buyer preference updated', icon: Sliders },
  task_created: { text: 'Task created', icon: CheckCircle2 },
  onboarding_completed: { text: 'Workspace created', icon: CheckCircle2 },
  AI_analysis_generated: { text: 'AI showing analysis completed', icon: Activity },
  buyer_preferences_analyzed: { text: 'Buyer intelligence updated', icon: Sliders },
  followup_drafted: { text: 'Client follow-up drafted', icon: CheckCircle2 },
  buyer_portal_joined: { text: 'A buyer joined their portal', icon: UserPlus },
  buyer_rating_submitted: { text: 'Buyer rated a home in the portal', icon: Heart },
}

export interface ReactionFeedItem {
  id: string
  reaction: string
  feature: string
  created_at: string
  clients: { first_name: string } | null
  client_members: { first_name: string } | null
  properties: { id: string; address_line1: string } | null
}

const VERB: Record<string, string> = {
  love: 'loved', like: 'liked', neutral: 'was neutral on', dislike: 'had concerns about', deal_breaker: 'flagged a deal breaker:',
}

export function ActivityFeed({ logs, reactions }: { logs: ActivityLog[]; reactions: ReactionFeedItem[] }) {
  const items = [
    ...reactions.map((r) => {
      const who = r.client_members?.first_name ?? r.clients?.first_name ?? 'Buyer'
      const positive = r.reaction === 'love' || r.reaction === 'like'
      return {
        id: `r-${r.id}`,
        at: r.created_at,
        icon: r.reaction === 'love' ? Heart : positive ? ThumbsUp : ThumbsDown,
        tone: positive ? 'bg-green-50 text-success' : r.reaction === 'neutral' ? 'bg-subtle text-muted' : 'bg-amber-50 text-warning',
        text: `${who} ${VERB[r.reaction] ?? r.reaction} the ${r.feature.toLowerCase()}${r.properties ? ` at ${r.properties.address_line1}` : ''}`,
      }
    }),
    ...logs
      // reactions above already narrate showing activity in richer form
      .filter((l) => l.action !== 'preference_created')
      .map((l) => {
        const copy = ACTION_COPY[l.action] ?? { text: l.action.replace(/_/g, ' '), icon: Activity }
        return { id: `l-${l.id}`, at: l.created_at, icon: copy.icon, tone: 'bg-blue-50 text-accent', text: copy.text }
      }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10)

  if (!items.length) return <p className="text-sm text-muted">Activity from showings and clients will appear here.</p>

  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
        <li key={i.id} className="flex items-start gap-3">
          <div className={`grid size-8 shrink-0 place-items-center rounded-full ${i.tone}`}>
            <i.icon className="size-4" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm leading-snug">{i.text}</p>
            <p className="text-xs text-muted">{formatDistanceToNow(new Date(i.at), { addSuffix: true })}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
