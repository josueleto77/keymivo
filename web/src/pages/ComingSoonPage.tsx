import { BarChart3, Handshake, Plug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useBillingStatus } from '@/features/billing'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'

const FEATURES = {
  offers: { title: 'Offers', icon: Handshake, text: 'Offer analysis with Conservative, Competitive and Strong scenarios. Informational only — never a binding contract.' },
  reports: { title: 'Reports', icon: BarChart3, text: 'Tour summaries and buyer journey reports.' },
  integrations: { title: 'Integrations', icon: Plug, text: '' },
} as const

const INTEGRATIONS = ['Google Calendar', 'Google Maps', 'Follow Up Boss', 'HubSpot', 'GoHighLevel', 'DocuSign', 'MLS', 'ShowingTime', 'Stripe']

export function ComingSoonPage({ feature }: { feature: keyof typeof FEATURES }) {
  const f = FEATURES[feature]
  if (feature === 'integrations') {
    return (
      <div>
        <PageHeader title="Integrations" subtitle="Only working integrations are ever marked available." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((name) => (
            <IntegrationCard key={name} name={name} />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div>
      <PageHeader title={f.title} />
      <EmptyState icon={f.icon} title="Coming in the next build phase" description={f.text} />
    </div>
  )
}

function IntegrationCard({ name }: { name: string }) {
  const billing = useBillingStatus()
  const stripe = name === 'Stripe'
  const connected = stripe && billing.data?.configured
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card p-5 shadow-card">
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-muted">
          {connected ? (billing.data?.test_mode ? 'Connected · test mode' : 'Connected') : stripe ? 'Available · add Stripe secrets to connect' : 'Not connected'}
        </div>
      </div>
      <Badge variant={connected ? 'success' : stripe ? 'accent' : 'outline'}>{connected ? 'Connected' : stripe ? 'Available' : 'Coming Soon'}</Badge>
    </div>
  )
}
