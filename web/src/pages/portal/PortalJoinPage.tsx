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
import { AuthLayout } from '../auth/AuthLayout'

interface InvitePreview { member_first_name: string; member_email: string | null; agent_name: string; brokerage: string | null; accepted: boolean }

/** /portal/join?token=… — buyer creates an account (or signs in), then the invite links them to their client. */
export function PortalJoinPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { session, initializing, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = React.useState<'signup' | 'login'>('signup')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [acceptError, setAcceptError] = React.useState<string | null>(null)
  const accepting = React.useRef(false)

  const invite = useQuery({
    queryKey: ['invite', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_buyer_invite', { p_token: token })
      if (error) throw new Error(error.message)
      return data as unknown as InvitePreview | null
    },
  })
  React.useEffect(() => {
    if (invite.data?.member_email && !email) setEmail(invite.data.member_email)
  }, [invite.data, email])

  // Once signed in, accept the invite.
  React.useEffect(() => {
    if (!session || !token || accepting.current) return
    accepting.current = true
    supabase.rpc('accept_buyer_invite', { p_token: token }).then(async ({ error }) => {
      if (error) {
        setAcceptError(error.message)
        accepting.current = false
        return
      }
      await refreshProfile()
      toast.success('Welcome to your Keymivo portal')
      navigate('/portal', { replace: true })
    })
  }, [session, token, refreshProfile, navigate])

  if (!token) return <div className="p-6"><ErrorState message="This link is missing its invite code. Ask your agent for a new link." /></div>
  if (initializing || invite.isLoading || (session && !acceptError)) return <FullScreenLoader />
  if (acceptError) {
    return (
      <AuthLayout title="We couldn't open your portal">
        <ErrorState message={acceptError} />
        <Button variant="outline" className="mt-4 w-full" onClick={() => supabase.auth.signOut()}>Sign out and try another account</Button>
      </AuthLayout>
    )
  }
  if (!invite.data) return <AuthLayout title="Invite not found"><ErrorState message="This invite link is invalid or has expired. Ask your agent for a new one." /></AuthLayout>

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || password.length < 8) return toast.error('Enter your email and a password of at least 8 characters.')
    setBusy(true)
    const redirect = `${window.location.origin}/portal/join?token=${token}`
    const res =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: { first_name: invite.data!.member_first_name } } })
        : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (res.error) return toast.error(res.error.message)
    if (mode === 'signup' && !res.data.session) setSent(true)
  }

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

  return (
    <AuthLayout
      title={`Hi ${invite.data.member_first_name}!`}
      subtitle={`${invite.data.agent_name || 'Your agent'}${invite.data.brokerage ? ` (${invite.data.brokerage})` : ''} invited you to your private home-search portal.`}
      footer={
        <button className="font-semibold text-accent" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="pj-email"><Input id="pj-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="pj-pass" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
          <Input id="pj-pass" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === 'signup' ? 'Create my portal account' : 'Sign in'}</Button>
        <p className="text-center text-xs text-muted">See shared homes, your tours, rate homes and message your agent.</p>
      </form>
    </AuthLayout>
  )
}
