import { useQuery } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { FullScreenLoader } from '@/components/RouteGuards'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { AuthLayout } from './AuthLayout'

interface Preview { organization: string; role: string; email: string | null; inviter: string }

/** /join?token=… — an invited agent creates an account (or signs in) and joins the organization. */
export function JoinTeamPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { session, initializing, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = React.useState<'signup' | 'login'>('signup')
  const [first, setFirst] = React.useState('')
  const [last, setLast] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const invite = useQuery({
    queryKey: ['team-invite', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_invite', { p_token: token })
      if (error) throw new Error(error.message)
      return data as unknown as Preview | null
    },
  })
  React.useEffect(() => { if (invite.data?.email && !email) setEmail(invite.data.email) }, [invite.data, email])
  React.useEffect(() => {
    if (profile?.first_name && !first) setFirst(profile.first_name)
    if (profile?.last_name && !last) setLast(profile.last_name)
  }, [profile, first, last])

  async function accept() {
    setBusy(true)
    const { error } = await supabase.rpc('accept_team_invite', { p_token: token, p_first_name: first, p_last_name: last })
    setBusy(false)
    if (error) return setError(error.message)
    await refreshProfile()
    toast.success(`Welcome to ${invite.data?.organization ?? 'the team'}`)
    navigate('/', { replace: true })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!first.trim() || !last.trim()) return toast.error('Enter your first and last name.')
    if (!email || password.length < 8) return toast.error('Enter your email and a password of at least 8 characters.')
    setBusy(true)
    const res = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/join?token=${token}`, data: { first_name: first, last_name: last } } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (res.error) return toast.error(res.error.message)
    if (mode === 'signup' && !res.data.session) setSent(true)
  }

  if (!token) return <div className="p-6"><ErrorState message="This link is missing its invite code." /></div>
  if (initializing || invite.isLoading) return <FullScreenLoader />
  if (!invite.data) return <AuthLayout title="Invite not found"><ErrorState message="This invite link is invalid, used or expired. Ask your team leader for a new one." /></AuthLayout>
  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted">
          <MailCheck className="mx-auto mb-3 size-10 text-accent" />
          We sent a confirmation link to <b className="text-foreground">{email}</b>. Open it on this device to finish joining.
        </div>
      </AuthLayout>
    )
  }

  const title = `Join ${invite.data.organization}`
  const subtitle = `${invite.data.inviter || 'Your team leader'} invited you as ${invite.data.role === 'assistant' ? 'an assistant' : `a ${invite.data.role.replace('_', ' ')}`} on Keymivo.`

  if (session) {
    return (
      <AuthLayout title={title} subtitle={subtitle}>
        {error && <div className="mb-4"><ErrorState message={error} /></div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="jt-f"><Input id="jt-f" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
            <Field label="Last name" htmlFor="jt-l"><Input id="jt-l" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
          </div>
          <Button size="lg" className="w-full" onClick={accept} loading={busy} disabled={!first.trim() || !last.trim()}>Join team</Button>
          <Button variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>Use a different account</Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      footer={<button className="font-semibold text-accent" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="jt-f"><Input id="jt-f" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label="Last name" htmlFor="jt-l"><Input id="jt-l" value={last} onChange={(e) => setLast(e.target.value)} /></Field>
        </div>
        <Field label="Email" htmlFor="jt-e"><Input id="jt-e" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="jt-p"><Input id="jt-p" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Button>
      </form>
    </AuthLayout>
  )
}
