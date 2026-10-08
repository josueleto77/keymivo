import { format } from 'date-fns'
import { Building2, Check, CreditCard } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useBillingRedirect, useBillingStatus } from '@/features/billing'
import { PLANS, accessState, planLabel, trialDaysLeft } from '@/lib/billing'
import { cn } from '@/lib/utils'
import { useAuth, useSession } from '@/providers/AuthProvider'

export function BillingPage() {
  const { organization } = useSession()
  const { refreshProfile } = useAuth()
  const status = useBillingStatus()
  const redirect = useBillingRedirect()
  const [params, setParams] = useSearchParams()
  const state = accessState(organization)
  const days = trialDaysLeft(organization)
  const subscribed = !!organization.stripe_subscription_id

  // After Checkout, the webhook updates the org a moment later — poll briefly.
  React.useEffect(() => {
    const result = params.get('checkout')
    if (!result) return
    if (result === 'success') {
      toast.success('Subscription started — updating your plan…')
      let n = 0
      const t = setInterval(() => { refreshProfile(); if (++n >= 5) clearInterval(t) }, 2000)
      setParams({}, { replace: true })
      return () => clearInterval(t)
    }
    toast('Checkout cancelled — no charge was made.')
    setParams({}, { replace: true })
  }, [params, setParams, refreshProfile])

  const go = (v: Parameters<typeof redirect.mutate>[0]) => redirect.mutate(v, { onError: (e) => toast.error(e.message) })

  return (
    <div className="max-w-4xl">
      <PageHeader title="Plan & billing" subtitle={organization.name} />

      <Card className={cn('mb-6', state === 'expired' && 'border-amber-300 bg-amber-50/50')}>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-white"><CreditCard className="size-5" /></div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{planLabel(organization)}</span>
              <Badge variant={state === 'active' ? 'success' : state === 'trial' ? 'accent' : 'warning'}>
                {state === 'active' ? 'Active' : state === 'trial' ? 'Trial' : state === 'past_due' ? 'Payment issue' : 'Trial ended'}
              </Badge>
              {organization.cancel_at_period_end && <Badge variant="warning">Cancels at period end</Badge>}
            </div>
            <p className="text-sm text-muted">
              {state === 'trial' && days != null && `${days} day${days === 1 ? '' : 's'} left in your trial${subscribed ? ' — billing starts when it ends' : ''}.`}
              {state === 'active' && organization.current_period_end && `Renews ${format(new Date(organization.current_period_end), 'MMM d, yyyy')}.`}
              {state === 'past_due' && 'Your last payment failed. Update your payment method to keep access.'}
              {state === 'expired' && 'Your trial has ended. Your clients, tours and notes are safe — choose a plan to keep working.'}
            </p>
          </div>
          {subscribed && <Button variant="outline" onClick={() => go({ action: 'portal' })} loading={redirect.isPending}>Manage billing</Button>}
        </CardContent>
      </Card>

      {status.data && !status.data.configured && (
        <p className="mb-4 rounded-xl bg-subtle px-4 py-3 text-sm text-slate-600">Online billing isn't connected yet. Plans will become available as soon as Stripe is configured.</p>
      )}
      {status.data?.test_mode && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Stripe <b>test mode</b> — use card 4242 4242 4242 4242, any future date and any CVC. No real charges.</p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const current = subscribed && organization.subscription_plan === p.id
          return (
            <Card key={p.id} className={cn(p.id === 'pro' && 'border-primary')}>
              <CardContent className="flex h-full flex-col">
                <div className="font-semibold">{p.name}</div>
                <div className="mt-2"><span className="font-display text-3xl font-bold">{p.price}</span><span className="text-sm text-muted">{p.period}</span></div>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>)}
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={p.id === 'pro' ? 'default' : 'outline'}
                  disabled={current || !status.data?.configured}
                  loading={redirect.isPending && redirect.variables?.action !== 'portal' && redirect.variables?.plan === p.id}
                  onClick={() => go({ action: subscribed ? 'change_plan' : 'checkout', plan: p.id })}
                >
                  {current ? 'Current plan' : subscribed ? `Switch to ${p.name}` : `Choose ${p.name}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
        <Card>
          <CardContent className="flex h-full flex-col">
            <div className="flex items-center gap-2 font-semibold"><Building2 className="size-4" /> Brokerage</div>
            <div className="mt-2 font-display text-3xl font-bold">Custom</div>
            <p className="mt-4 flex-1 text-sm text-muted">Brokerage dashboards, advanced analytics and onboarding for your whole office.</p>
            <Button variant="outline" className="mt-5 w-full" asChild><a href="mailto:sales@keymivo.com?subject=Keymivo%20Brokerage%20plan">Contact sales</a></Button>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted">Prices in USD. Cancel anytime from “Manage billing”. Your data is never deleted when a trial or subscription ends.</p>
    </div>
  )
}

export function UpgradeScreen() {
  const { organization } = useSession()
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight">Your free trial has ended</h1>
      <p className="mt-3 text-muted">
        Everything you've built in {organization.name} — clients, tours, showing notes and AI insights — is saved. Choose a plan to pick up right where you left off.
      </p>
      <Button size="lg" className="mt-6" asChild><a href="/settings/billing">See plans</a></Button>
    </div>
  )
}
