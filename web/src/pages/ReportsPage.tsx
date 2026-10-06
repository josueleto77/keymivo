import { format } from 'date-fns'
import { CalendarDays, Handshake, UserRound, type LucideIcon } from 'lucide-react'
import * as React from 'react'
import { ReportButton } from '@/components/ReportButton'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { useClients } from '@/features/clients'
import { useOffers } from '@/features/offers'
import { useTours } from '@/features/tours'
import type { ReportKind } from '@/reports/render'
import { formatPrice, fullName, parseDateOnly } from '@/lib/utils'

export function ReportsPage() {
  const clients = useClients()
  const tours = useTours()
  const offers = useOffers()

  const clientOptions = (clients.data ?? []).map((c) => ({ id: c.id, label: fullName(c) }))
  const tourOptions = [...(tours.data ?? [])].reverse().map((t) => ({ id: t.id, label: `${t.name} · ${fullName(t.clients)} · ${format(parseDateOnly(t.tour_date), 'MMM d')}` }))
  const offerOptions = (offers.data ?? []).filter((o) => o.ai_status === 'completed').map((o) => ({
    id: o.id, label: `${o.properties?.address_line1} · ${fullName(o.clients)}${o.potential_price ? ` · ${formatPrice(o.potential_price)}` : ''}`,
  }))

  return (
    <div>
      <PageHeader title="Reports" subtitle="Branded PDFs to send your buyers — generated from what Keymivo already knows." />
      <div className="grid gap-4 lg:grid-cols-3">
        <ReportCard
          kind="journey" icon={UserRound} title="Home Search Summary"
          text="For a buyer: what they're looking for, every home they've seen ranked by match, patterns from showings and the next step."
          options={clientOptions} placeholder="Select a buyer…" empty="Add a buyer first."
        />
        <ReportCard
          kind="tour" icon={CalendarDays} title="Tour Summary"
          text="After a tour: each home's match score, estimated monthly cost, what the buyer liked, concerns and next steps."
          options={tourOptions} placeholder="Select a tour…" empty="Create a tour first."
        />
        <ReportCard
          kind="offer" icon={Handshake} title="Offer Strategy"
          text="Conservative, Competitive and Strong scenarios with payments, cash to close, risks and terms to discuss."
          options={offerOptions} placeholder="Select an offer analysis…" empty="Run an offer analysis first (Offers)."
        />
      </div>
    </div>
  )
}

function ReportCard({ kind, icon: Icon, title, text, options, placeholder, empty }: {
  kind: ReportKind; icon: LucideIcon; title: string; text: string; options: { id: string; label: string }[]; placeholder: string; empty: string
}) {
  const [id, setId] = React.useState('')
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-subtle"><Icon className="size-5" /></div>
          <div className="font-semibold">{title}</div>
        </div>
        <p className="text-sm text-muted">{text}</p>
        <div className="mt-auto space-y-2">
          {options.length ? (
            <NativeSelect aria-label={placeholder} value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">{placeholder}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </NativeSelect>
          ) : (
            <p className="text-sm text-muted">{empty}</p>
          )}
          <ReportButton kind={kind} id={id} label="Download PDF" variant="default" className="w-full" disabled={!id} />
        </div>
      </CardContent>
    </Card>
  )
}
