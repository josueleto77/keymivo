import { Document, Text, View } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { Agent, JourneyReportData } from './data'
import { Bullets, C, Disclaimer, ReportPage, Section, Stat, Table, cap, fullName, money, s } from './kit'

const GROUPS = [
  { title: 'Must have', types: ['must_have'] },
  { title: 'Prefers', types: ['strong_preference', 'prefer'] },
  { title: 'Would rather avoid', types: ['deal_breaker', 'strong_dislike', 'dislike'] },
] as const
const DECISION: Record<string, string> = { love: 'Love it', like: 'Like it', maybe: 'Maybe', pass: 'Pass', discuss_offer: 'Discuss offer' }

export function JourneyReport({ data, agent }: { data: JourneyReportData; agent: Agent }) {
  const { client: c, preferences, homes } = data
  const names = c.client_members?.length ? c.client_members.map((m) => m.first_name).join(' & ') : fullName(c)
  const prefsIn = (types: readonly string[]) =>
    [...preferences].filter((p) => types.includes(p.preference_type)).sort((a, b) => types.indexOf(a.preference_type) - types.indexOf(b.preference_type)).map((p) => (p.preference_type === 'deal_breaker' ? `${p.value} (deal breaker)` : p.value))
  const favorite = homes[0]

  return (
    <Document title={`Home Search Summary — ${fullName(c)}`} author={agent.name} creator="Keymivo">
      <ReportPage kind="Home Search Summary" agent={agent}>
        <Text style={s.h1}>{names}'s home search</Text>
        <Text style={s.muted}>Prepared {format(new Date(), 'MMMM d, yyyy')} by {agent.name}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Stat label="Budget" value={c.target_price_min || c.target_price_max ? `${money(c.target_price_min)} – ${money(c.target_price_max)}` : '—'} />
          <Stat label="Homes toured" value={String(homes.length)} />
          <Stat label="Current favorite" value={favorite?.properties?.address_line1 ?? '—'} />
          <Stat label="Stage" value={cap(c.status)} />
        </View>
        {c.target_areas?.length > 0 && <Text style={[s.small, s.muted, { marginTop: 6 }]}>Target areas: {c.target_areas.join(', ')}</Text>}

        {preferences.length > 0 && (
          <Section title="What you're looking for">
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {GROUPS.map((g) => {
                const items = prefsIn(g.types)
                return items.length ? (
                  <View key={g.title} style={{ flex: 1 }}>
                    <Text style={s.h3}>{g.title}</Text>
                    <Bullets items={items} color={g.title === 'Would rather avoid' ? C.red : C.brand} />
                  </View>
                ) : null
              })}
            </View>
          </Section>
        )}

        {homes.length > 0 && (
          <Section title="Homes you've seen, best match first">
            <Table
              rows={homes}
              cols={[
                { label: 'Home', flex: 3, render: (h) => `${h.properties!.address_line1}, ${h.properties!.city}` },
                { label: 'Price', flex: 1.2, right: true, render: (h) => money(h.properties!.listing_price) },
                { label: 'Est. monthly', flex: 1.2, right: true, render: (h) => money(h.monthly) },
                { label: 'Match', flex: 0.8, right: true, render: (h) => (h.overall_score != null ? String(h.overall_score) : '—') },
                { label: 'Your rating', flex: 1.2, right: true, render: (h) => (h.rating?.decision ? DECISION[h.rating.decision] ?? cap(h.rating.decision) : h.rating?.overall ? `${h.rating.overall}/5` : '—') },
              ]}
            />
          </Section>
        )}

        {(data.loved.length > 0 || data.concerns.length > 0) && (
          <Section title="Patterns from your showings" wrap={false}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {data.loved.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={[s.h3, { color: C.green }]}>What keeps winning you over</Text>
                  <Bullets items={data.loved.map((x) => (x.count > 1 ? `${x.label} (${x.count} homes)` : x.label))} color={C.green} />
                </View>
              )}
              {data.concerns.length > 0 && (
                <View style={{ flex: 1 }}>
                  <Text style={[s.h3, { color: C.red }]}>Recurring concerns</Text>
                  <Bullets items={data.concerns.map((x) => (x.count > 1 ? `${x.label} (${x.count} homes)` : x.label))} color={C.red} />
                </View>
              )}
            </View>
          </Section>
        )}

        {data.offers.length > 0 && (
          <Section title="Offers">
            <Bullets items={data.offers.map((o) => `${o.properties?.address_line1 ?? 'Home'} — ${cap(o.status)}${o.potential_price ? ` · ${money(o.potential_price)}` : ''}`)} />
          </Section>
        )}

        {data.nextStep && (
          <View style={[s.card, { marginTop: 16, backgroundColor: C.blueBg, borderColor: C.blueBg }]} wrap={false}>
            <Text><Text style={s.bold}>Suggested next step: </Text>{data.nextStep}</Text>
          </View>
        )}

        {homes.length === 0 && preferences.length === 0 && (
          <Text style={[s.muted, { marginTop: 16 }]}>No showings or preferences recorded yet.</Text>
        )}

        <Disclaimer>
          Preferences and patterns are learned from your feedback during showings and may be AI-assisted. Match scores reflect your stated priorities,
          not property value. Monthly costs are estimates, not a lending quote.
        </Disclaimer>
      </ReportPage>
    </Document>
  )
}
