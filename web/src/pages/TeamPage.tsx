import { Copy, Link2, Trash2, UserPlus } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { InitialsAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { TEAM_ROLES, teamInviteUrl, useTeam, useTeamMutations } from '@/features/team'
import { fullName } from '@/lib/utils'
import { useSession } from '@/providers/AuthProvider'

const MANAGERS = ['super_admin', 'brokerage_admin', 'team_leader']

export function TeamPage() {
  const { organization, profile } = useSession()
  const { data, isLoading } = useTeam(organization.id)
  const m = useTeamMutations(organization.id)
  const [role, setRole] = React.useState('realtor')
  const [email, setEmail] = React.useState('')
  const [link, setLink] = React.useState<string | null>(null)
  const isManager = MANAGERS.includes(profile.role)

  if (isLoading || !data) return <Skeleton className="h-80 w-full" />
  const used = data.members.length + data.invites.length
  const teamPlan = data.seatLimit > 1
  const err = (e: Error) => toast.error(e.message)

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Team"
        subtitle={teamPlan ? `${data.members.length} member${data.members.length === 1 ? '' : 's'} · ${used} of ${data.seatLimit >= 1000 ? 'unlimited' : data.seatLimit} seats used` : organization.name}
      />

      {!teamPlan && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm"><b>Invite agents with the Team plan</b> — up to 5 agents sharing clients, tours and buyer intelligence.</p>
            <Button asChild><Link to="/settings/billing">See Team plan</Link></Button>
          </CardContent>
        </Card>
      )}

      {isManager && teamPlan && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-4" /> Invite an agent</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault()
                m.invite.mutate({ role, email }, { onSuccess: (t) => { setLink(teamInviteUrl(t)); setEmail('') }, onError: err })
              }}
            >
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label="Email" />
              <NativeSelect value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                {TEAM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </NativeSelect>
              <Button type="submit" loading={m.invite.isPending}><Link2 /> Create link</Button>
            </form>
            <p className="mt-2 text-xs text-muted">Links expire in 14 days and work once. Send them yourself — nothing is emailed automatically.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {data.members.map((p) => {
            const me = p.user_id === profile.user_id
            const editable = isManager && !me && p.role !== 'super_admin'
            return (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <InitialsAvatar name={fullName(p) || p.email || '?'} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{fullName(p) || p.email} {me && <span className="font-normal text-muted">(you)</span>}</div>
                  <div className="truncate text-xs text-muted">{p.email}</div>
                </div>
                {editable ? (
                  <NativeSelect
                    value={p.role}
                    onChange={(e) => m.setRole.mutate({ profileId: p.id, role: e.target.value }, { onSuccess: () => toast.success('Role updated'), onError: err })}
                    className="h-8 w-auto text-xs"
                    aria-label="Role"
                  >
                    {TEAM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </NativeSelect>
                ) : (
                  <Badge>{p.role.replace('_', ' ')}</Badge>
                )}
                {editable && (
                  <button
                    onClick={() => { if (confirm(`Remove ${fullName(p) || p.email} from ${organization.name}? Their clients and notes stay with the team.`)) m.remove.mutate(p.id, { onError: err }) }}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-danger"
                    aria-label="Remove member"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {data.invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending invites</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {data.invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="flex-1">{i.email ?? 'Link invite'} <span className="text-xs text-muted">· {i.role.replace('_', ' ')}</span></div>
                <Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(teamInviteUrl(i.token)); toast.success('Link copied') } catch { setLink(teamInviteUrl(i.token)) } }}><Copy /> Copy</Button>
                {isManager && <Button size="sm" variant="ghost" className="text-danger" onClick={() => m.revoke.mutate(i.id, { onError: err })}>Revoke</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent title="Invite link ready" description="Send this private link to your agent.">
          <Input readOnly value={link ?? ''} onFocus={(e) => e.target.select()} aria-label="Invite link" />
          <Button className="mt-3 w-full" onClick={async () => { try { await navigator.clipboard.writeText(link!); toast.success('Link copied') } catch { toast.error('Select the link and copy it.') } }}><Copy /> Copy link</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
