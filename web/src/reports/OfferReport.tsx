import { Document, Image, Text, View } from '@react-pdf/renderer'
import { format } from 'date-fns'
import type { Agent, OfferReportData } from './data'
import { Bullets, C, Disclaimer, Pill, ReportPage, Section, Stat, fullName, money, s, signedMoney } from './kit'

const SCENARIO_LABEL = { conservative: 'Conservative', competitive: 'Competitive', strong: 'Strong' } as const

const FIT = {
  within: { label: 'Within budget', color: C.green, bg: C.greenBg },
  stretch: { label: 'Stretch', color: C.amber, bg: C.amberBg },
  over: { label: 'Over preapproval', color: C.red, bg: C.redBg },
} as const

export function OfferReport({ data, agent }: { data: OfferReportData; agent: Agent }) {
  const { offer, analysis: a, image } = data
  const p = offer.properties!
  const b = a.basis
  return (
    <Document title={`Offer Strategy — ${p.address_line1}`} author={agent.name} creator="Keymivo">
      <ReportPage kind="Offer Strategy" agent={agent}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {image && <Image src={image} style={{ width: 150, height: 100, borderRadius: 6, objectFit: 'cover' }} />}
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{p.address_line1}</Text>
            <Text style={s.muted}>{p.city}, {p.state} {p.zip_code ?? ''}</Text>
            <Text style={{ marginTop: 6 }}>
              Prepared for <Text style={s.bold}>{fullName(offer.clients)}</Text> · {format(new Date(a.generated_at), 'MMMM d, yyyy')}
            </Text>
            <Text style={[s.muted, { marginTop: 2 }]}>
              Asking {money(p.listing_price)}
              {p.beds ? ` · ${p.beds} bd` : ''}{p.baths ? ` · ${p.baths} ba` : ''}{p.square_feet ? ` · ${p.square_feet.toLocaleString('en-US')} sq ft` : ''}
              {p.days_on_market != null ? ` · ${p.days_on_market} days on market` : ''}
            </Text>
          </View>
        </View>

        <View style={[s.card, { marginTop: 14, backgroundColor: C.blueBg, borderColor: C.blueBg }]}>
          <Text>{a.summary}</Text>
          <Text style={{ marginTop: 6 }}>
            <Text style={s.bold}>Suggested starting point: {SCENARIO_LABEL[a.recommended.scenario]}. </Text>
            {a.recommended.reason}
          </Text>
        </View>

        <Section title="Three ways to offer">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {a.scenarios.map((sc) => {
              const fit = FIT[sc.fit]
              const chosen = offer.selected_scenario === sc.key
              return (
                <View key={sc.key} style={[s.card, { flex: 1, borderColor: chosen ? C.brand : C.line, borderWidth: chosen ? 1.5 : 1 }]}>
                  <Text style={[s.small, s.bold, s.muted]}>{SCENARIO_LABEL[sc.key].toUpperCase()}{chosen ? '  ·  SELECTED' : ''}</Text>
                  <Text style={{ fontSize: 17, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginTop: 2 }}>{money(sc.price)}</Text>
                  <Text style={[s.small, s.muted]}>
                    {signedMoney(sc.diff_from_asking)} vs asking{sc.diff_pct != null ? ` (${sc.diff_pct > 0 ? '+' : ''}${sc.diff_pct}%)` : ''}
                  </Text>
                  <View style={{ marginTop: 6, gap: 3 }}>
                    <Pill color={fit.color} bg={fit.bg}>{fit.label}</Pill>
                    {sc.appraisal_gap > 0 && <Pill color={C.amber} bg={C.amberBg}>Appraisal gap {money(sc.appraisal_gap)}</Pill>}
                  </View>
                  <View style={{ marginTop: 8, gap: 2 }}>
                    <Line k="Monthly (est.)" v={money(sc.monthly.total)} bold />
                    <Line k="P&I" v={money(sc.monthly.principal_interest)} />
                    <Line k="Taxes + insurance" v={money(sc.monthly.taxes + sc.monthly.insurance)} />
                    {sc.monthly.hoa + sc.monthly.pmi > 0 && <Line k="HOA + PMI" v={money(sc.monthly.hoa + sc.monthly.pmi)} />}
                    <Line k={`Down (${sc.down_payment_pct}%)`} v={money(sc.down_payment)} />
                    <Line k="Cash to close" v={`~${money(sc.cash_to_close_est)}`} />
                  </View>
                  {sc.fit_notes.length > 0 && <Text style={[s.small, s.muted, { marginTop: 6 }]}>{sc.fit_notes.join('; ')}</Text>}
                </View>
              )
            })}
          </View>
        </Section>

        {a.scenarios.map((sc) => (
          <Section key={sc.key} title={`${SCENARIO_LABEL[sc.key]} · ${money(sc.price)}`} wrap={false}>
            <Text style={{ marginBottom: 6 }}>{sc.explanation}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Text style={[s.h3, { color: C.green }]}>Advantages</Text><Bullets items={sc.advantages} color={C.green} /></View>
              <View style={{ flex: 1 }}><Text style={[s.h3, { color: C.red }]}>Risks</Text><Bullets items={sc.risks} color={C.red} /></View>
              <View style={{ flex: 1 }}><Text style={s.h3}>Terms to discuss</Text><Bullets items={sc.terms_to_discuss} /></View>
            </View>
          </Section>
        ))}

        {a.questions_to_verify.length > 0 && (
          <Section title="To verify before writing the offer" wrap={a.questions_to_verify.length > 8}>
            <Bullets items={a.questions_to_verify} />
          </Section>
        )}

        <Section title="How these numbers were set">
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <Stat label={b.anchor_source === 'comps_midpoint' ? 'Comps midpoint' : 'Asking price'} value={money(b.anchor)} />
            <Stat label="Market" value={b.market[0]!.toUpperCase() + b.market.slice(1) + (b.multiple_offers ? ' · multiple offers' : '')} />
            <Stat label="Rate (30-yr fixed)" value={`${b.interest_rate}%`} />
          </View>
          <Text style={[s.small, s.muted]}>
            {b.anchor_source === 'comps_midpoint' ? `Comparable value range ${money(b.comps_low)}–${money(b.comps_high)}. ` : 'No comparable value range was entered; scenarios are anchored on the asking price. '}
            {b.dom_adjustment_pct ? `Days on market adjustment ${b.dom_adjustment_pct > 0 ? '+' : ''}${b.dom_adjustment_pct}%. ` : ''}
            {b.repairs > 0 ? `Estimated repairs ${money(b.repairs)} (Conservative deducts all, Competitive half, Strong none). ` : ''}
            Payments assume {b.down_payment_source === 'buyer' ? 'the down payment shown' : '20% down'}, insurance at {b.insurance_pct}% of price per year and PMI below 20% down.
            Cash to close adds about {b.closing_cost_pct}% in closing costs. Appraisal gap is the amount above the high end of the comps range.
          </Text>
        </Section>

        <Disclaimer>
          AI-generated analysis is informational and does not guarantee seller acceptance or substitute for professional real estate judgment.
          Payment figures are estimates, not a lending quote — confirm with your lender. Not legal advice; review offer terms with your attorney.
        </Disclaimer>
      </ReportPage>
    </Document>
  )
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[s.small, bold ? s.bold : s.muted]}>{k}</Text>
      <Text style={[s.small, bold ? s.bold : {}]}>{v}</Text>
    </View>
  )
}
