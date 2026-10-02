import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Sparkles, UserPlus } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Logo } from '@/components/brand/Logo'
import { FullScreenLoader } from '@/components/RouteGuards'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { US_STATES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

const schema = z.object({
  first_name: z.string().trim().min(1, 'Required'),
  last_name: z.string().trim().min(1, 'Required'),
  phone: z.string().trim().optional(),
  brokerage: z.string().trim().min(1, 'Required'),
  license_state: z.string().min(2, 'Required'),
  license_number: z.string().trim().optional(),
  primary_market: z.string().trim().min(1, 'Required'),
})
type Values = z.infer<typeof schema>

export function OnboardingPage() {
  const { profile, profileLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = React.useState<'profile' | 'ready'>('profile')
  const [seeding, setSeeding] = React.useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      first_name: profile?.first_name ?? '',
      last_name: profile?.last_name ?? '',
      phone: profile?.phone ?? '',
      brokerage: profile?.brokerage_name ?? '',
      license_state: profile?.license_state ?? 'MA',
      license_number: profile?.license_number ?? '',
      primary_market: profile?.primary_market ?? '',
    },
  })

  if (profileLoading) return <FullScreenLoader />
  if (profile?.onboarding_completed && step === 'profile') return <Navigate to="/" replace />

  async function onSubmit(v: Values) {
    const { error } = await supabase.rpc('complete_onboarding', {
      p_first_name: v.first_name,
      p_last_name: v.last_name,
      p_phone: v.phone ?? '',
      p_brokerage: v.brokerage,
      p_license_state: v.license_state,
      p_license_number: v.license_number ?? '',
      p_primary_market: v.primary_market,
    })
    if (error) return toast.error(error.message)
    setStep('ready')
    await refreshProfile()
  }

  async function loadDemo() {
    setSeeding(true)
    const { error } = await supabase.rpc('seed_demo_data')
    setSeeding(false)
    if (error) return toast.error(error.message)
    toast.success('Demo workspace loaded: Mike & Sarah Johnson + 5 homes')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-background px-5 py-8">
      <div className="mx-auto max-w-xl">
        <Logo />
        {step === 'profile' ? (
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Step 1 of 2</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Set up your Realtor profile</h1>
            <p className="mt-2 text-sm text-muted">
              We'll create a workspace for you with a 14-day Pro trial. Your clients stay private to your organization.
            </p>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4 rounded-2xl border bg-card p-6 shadow-card" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="first_name" error={form.formState.errors.first_name?.message}>
                  <Input id="first_name" {...form.register('first_name')} />
                </Field>
                <Field label="Last name" htmlFor="last_name" error={form.formState.errors.last_name?.message}>
                  <Input id="last_name" {...form.register('last_name')} />
                </Field>
              </div>
              <Field label="Phone" htmlFor="phone">
                <Input id="phone" type="tel" autoComplete="tel" {...form.register('phone')} />
              </Field>
              <Field label="Brokerage" htmlFor="brokerage" error={form.formState.errors.brokerage?.message}>
                <Input id="brokerage" placeholder="Northstar Realty" {...form.register('brokerage')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                <Field label="License state" htmlFor="license_state" error={form.formState.errors.license_state?.message}>
                  <NativeSelect id="license_state" {...form.register('license_state')}>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="License number" htmlFor="license_number">
                  <Input id="license_number" {...form.register('license_number')} />
                </Field>
              </div>
              <Field label="Primary market" htmlFor="primary_market" error={form.formState.errors.primary_market?.message}>
                <Input id="primary_market" placeholder="North Shore, MA" {...form.register('primary_market')} />
              </Field>
              <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
                Continue <ArrowRight />
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Step 2 of 2</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">You're ready for your first AI-powered showing.</h1>
            <p className="mt-2 text-sm text-muted">Start with your own buyer, or explore with a realistic demo workspace.</p>
            <div className="mt-8 grid gap-3">
              <button
                onClick={() => navigate('/clients/new')}
                className="flex items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-card transition hover:shadow-lift"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-primary text-white"><UserPlus className="size-5" /></div>
                <div className="flex-1">
                  <div className="font-semibold">Add your first buyer</div>
                  <div className="text-sm text-muted">Keymivo starts learning what they're looking for.</div>
                </div>
                <ArrowRight className="size-4 text-muted" />
              </button>
              <button
                onClick={loadDemo}
                disabled={seeding}
                className="flex items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-card transition hover:shadow-lift disabled:opacity-60"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-accent"><Sparkles className="size-5" /></div>
                <div className="flex-1">
                  <div className="font-semibold">{seeding ? 'Loading demo…' : 'Explore with demo data'}</div>
                  <div className="text-sm text-muted">Mike & Sarah Johnson, 5 Massachusetts homes and a Saturday tour. Clearly labeled as demo.</div>
                </div>
                <ArrowRight className="size-4 text-muted" />
              </button>
              <Button variant="ghost" onClick={() => navigate('/')}>Skip to dashboard</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
