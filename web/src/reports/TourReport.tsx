import { Document, Image, Text, View } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import type { Agent, TourReportData } from './data'
import { Bullets, C, Disclaimer, Pill, ReportPage, Section, Stat, Table, cap, fullName, money, s } from './kit'

const time = (t: string | null) => (t ? format(parseISO(`2000-01-01T${t}`), 'h:mm a') : '')

export function TourReport({ data, agent }: { data: TourReportData; agent: Agent }) {
  const { tour, stops } = data
  const shown = stops.filter((x) => x.shown)
  const ranked = [...shown].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const pick = <T,>(f: (x: (typeof stops)[number]) => T | null, better: (a: T, b: T) => boolean) =>
    shown.reduce<(typeof stops)[number] | null>((w, x) => {
      const v = f(x)
      if (v == null) return w
      const wv = w ? f(w) : null
      return wv == null || better(v, wv) ? x : w
    }, null)
  const highlights = [
    { label: 'Best overall match', x: ranked[0] && ranked[0].score != null ? ranked[0] : null },
    { label: 'Best location', x: pick((x) => x.location, (a, b) => a > b) },
    { label: 'Lowest monthly cost', x: pick((x) => x.monthly, (a, b) => a < b) },
    { label: 'Buyer favorite', x: pick((x) => x.emotional, (a, b) => a > b) },
  ].filter((h) => h.x)

  const concernCount = new Map<string, number>()
  for (const x of shown) for (const c of x.analysis?.concerns ?? []) concernCount.set(c.title, (concernCount.get(c.title) ?? 0) + 1)
  const concerns = [...concernCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => (n > 1 ? `${t} (${n} homes)` : t))

  return (
    <Document title={`Tour Summary — ${tour.name}`} author={agent.name} creator="Keymivo">
      <ReportPage kind="Tour Summary" agent={agent}>
        <Text style={s.h1}>{tour.name}</Text>
        <Text style={s.muted}>
          {fullName(tour.clients)} · {format(parseISO(tour.tour_date), 'EEEE, MMMM d, yyyy')} · {stops.length} home{stops.length === 1 ? '' : 's'}, {shown.length} shown
        </Text>

        {highlights.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {highlights.map((h) => (
              <Stat key={h.label} label={h.label} value={h.x!.property.address_line1} />
            ))}
          </View>
        )}

        <Section title="Homes on this tour">
          <Table
            rows={stops}
            cols={[
              { label: '#', flex: 0.4, render: (x) => String(x.seq) },
              { label: 'Time', flex: 0.9, render: (x) => time(x.time) || '—' },
              { label: 'Home', flex: 3, render: (x) => `${x.property.address_line1}, ${x.property.city}` },
              { label: 'Price', flex: 1.2, right: true, render: (x) => money(x.property.listing_price) },
              { label: 'Est. monthly', flex: 1.2, right: true, render: (x) => money(x.monthly) },
              { label: 'Match', flex: 0.8, right: true, render: (x) => (x.score != null ? `${x.score}` : '—') },
              { label: 'Interest', flex: 1, right: true, render: (x) => (x.shown ? cap(x.interest) : 'Not shown') },
            ]}
          />
        </Section>

        {concerns.length > 0 && (
          <Section title="Concerns that came up">
            <Bullets items={concerns} color={C.red} />
          </Section>
        )}

        {ranked.map((x, i) => (
          <Section key={x.id} title={`${i + 1}. ${x.property.address_line1}`} wrap={false}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {x.image && <Image src={x.image} style={{ width: 120, height: 80, borderRadius: 5, objectFit: 'cover' }} />}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                  {x.score != null && <Pill color={C.brand} bg={C.blueBg}>Match {x.score}/100</Pill>}
                  {x.interest && <Pill color={C.ink} bg={C.subtle}>{cap(x.interest)} interest</Pill>}
                </View>
                <Text style={[s.small, s.muted]}>
                  {money(x.property.listing_price)}{x.property.beds ? ` · ${x.property.beds} bd` : ''}{x.property.baths ? ` · ${x.property.baths} ba` : ''}
                  {x.monthly ? ` · ~${money(x.monthly)}/mo` : ''}
                </Text>
                {x.summary && <Text style={{ marginTop: 4 }}>{x.summary}</Text>}
              </View>
            </View>
            {(x.analysis?.positives?.length || x.analysis?.concerns?.length) ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.h3, { color: C.green }]}>Liked</Text>
                  <Bullets items={(x.analysis?.positives ?? []).slice(0, 5).map((p) => p.feature)} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.h3, { color: C.red }]}>To look into</Text>
                  <Bullets items={(x.analysis?.concerns ?? []).slice(0, 5).map((c) => c.title)} color={C.red} />
                </View>
              </View>
            ) : null}
            {x.analysis?.recommended_next_action && (
              <Text style={[s.small, { marginTop: 4 }]}><Text style={s.bold}>Next step: </Text>{x.analysis.recommended_next_action}</Text>
            )}
          </Section>
        ))}

        <Disclaimer>
          Summaries are AI-assisted from showing notes and reactions — verify property details independently. Match scores reflect this buyer's stated
          preferences. Monthly costs are estimates (20% down unless the buyer's down payment is on file), not a lending quote.
        </Disclaimer>
      </ReportPage>
    </Document>
  )
}
