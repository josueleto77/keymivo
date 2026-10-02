import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './AuthLayout'

function GoogleButton() {
  return (
    <Button type="button" variant="outline" className="w-full whitespace-normal" disabled title="Google sign-in will be enabled once OAuth credentials are configured">
      <svg viewBox="0 0 24 24" className="size-4"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>
      Google sign-in · Coming soon
    </Button>
  )
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted">
      <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
    </div>
  )
}

// ── Login ───────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(v: z.infer<typeof loginSchema>) {
    const { error } = await supabase.auth.signInWithPassword(v)
    if (error) {
      toast.error(error.message === 'Email not confirmed' ? 'Please verify your email first — check your inbox.' : error.message)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Keymivo workspace."
      footer={<>New to Keymivo? <Link to="/signup" className="font-semibold text-accent">Start your 14-day trial</Link></>}
    >
      <GoogleButton />
      <Divider />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-muted hover:text-foreground">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Sign in</Button>
      </form>
    </AuthLayout>
  )
}

// ── Sign up ─────────────────────────────────────────────────────────
const signupSchema = z.object({
  first_name: z.string().trim().min(1, 'Required'),
  last_name: z.string().trim().min(1, 'Required'),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

export function SignupPage() {
  const navigate = useNavigate()
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { first_name: '', last_name: '', email: '', password: '' },
  })

  async function onSubmit(v: z.infer<typeof signupSchema>) {
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { first_name: v.first_name, last_name: v.last_name },
        emailRedirectTo: `${window.location.origin}/onboarding`,
      },
    })
    if (error) return toast.error(error.message)
    if (data.session) navigate('/onboarding', { replace: true })
    else setSentTo(v.email)
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={<Link to="/login" className="font-semibold text-accent">Back to sign in</Link>}>
        <div className="rounded-2xl border bg-card p-6 text-center">
          <MailCheck className="mx-auto size-10 text-accent" />
          <p className="mt-4 text-sm text-muted">
            We sent a verification link to <span className="font-semibold text-foreground">{sentTo}</span>. Click it to
            activate your account and finish setting up Keymivo.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="14-day Pro trial. No credit card required."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-accent">Sign in</Link></>}
    >
      <GoogleButton />
      <Divider />
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="first_name" error={form.formState.errors.first_name?.message}>
            <Input id="first_name" autoComplete="given-name" {...form.register('first_name')} />
          </Field>
          <Field label="Last name" htmlFor="last_name" error={form.formState.errors.last_name?.message}>
            <Input id="last_name" autoComplete="family-name" {...form.register('last_name')} />
          </Field>
        </div>
        <Field label="Work email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Create account</Button>
        <p className="text-center text-xs text-muted">
          By continuing you agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>, and to use Keymivo in compliance with the Fair Housing Act and recording-consent laws.
        </p>
      </form>
    </AuthLayout>
  )
}

// ── Forgot / reset password ─────────────────────────────────────────
export function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false)
  const form = useForm({ resolver: zodResolver(z.object({ email: z.email('Enter a valid email') })), defaultValues: { email: '' } })

  async function onSubmit(v: { email: string }) {
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) return toast.error(error.message)
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a secure link."}
      footer={<Link to="/login" className="font-semibold text-accent">Back to sign in</Link>}
    >
      {sent ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted">
          <MailCheck className="mx-auto mb-3 size-10 text-accent" />
          If an account exists for that email, a reset link is on its way.
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const form = useForm({
    resolver: zodResolver(z.object({ password: z.string().min(8, 'At least 8 characters') })),
    defaultValues: { password: '' },
  })
  async function onSubmit(v: { password: string }) {
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) return toast.error(error.message)
    toast.success('Password updated')
    navigate('/', { replace: true })
  }
  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Update password</Button>
      </form>
    </AuthLayout>
  )
}
