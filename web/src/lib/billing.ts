import type { Organization } from './types'

export const PLANS = [
  {
    id: 'pro',
    name: 'Pro Realtor',
    price: '$99',
    period: '/month',
    features: ['Unlimited clients', 'Unlimited tours', 'AI showing summaries', 'Buyer preference learning', 'Property comparisons', 'Financial tools', 'AI follow-up'],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$399',
    period: '/month · 5 agents',
    features: ['Everything in Pro', 'Team management', 'Analytics', 'Shared workflows'],
  },
] as const

export type AccessState = 'trial' | 'active' | 'past_due' | 'expired'

/** Trial expiry is derived (no cron needed). Data is never deleted — expired orgs just see the upgrade screen. */
export function accessState(org: Pick<Organization, 'subscription_status' | 'trial_ends_at' | 'stripe_subscription_id'>): AccessState {
  switch (org.subscription_status) {
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'trialing':
      if (org.stripe_subscription_id) return 'trial' // paid plan still in its trial window
      return org.trial_ends_at && new Date(org.trial_ends_at).getTime() > Date.now() ? 'trial' : 'expired'
    default:
      return 'expired'
  }
}

export function trialDaysLeft(org: Pick<Organization, 'trial_ends_at'>) {
  if (!org.trial_ends_at) return null
  return Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86_400_000))
}

export function planLabel(org: Pick<Organization, 'subscription_plan' | 'subscription_status' | 'stripe_subscription_id'>) {
  if (org.subscription_plan === 'team') return 'Team'
  if (org.subscription_plan === 'pro') return 'Pro Realtor'
  if (org.subscription_plan === 'brokerage') return 'Brokerage'
  return 'Free trial (Pro)'
}
