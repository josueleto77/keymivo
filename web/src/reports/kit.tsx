/** Shared react-pdf building blocks: brand header, agent footer, sections, tables. */
import { Page, Path, StyleSheet, Svg, Text, View, G } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import type { Agent } from './data'

export const C = {
  brand: '#1B5CF6', ink: '#111827', muted: '#64748B', line: '#E2E8F0', subtle: '#F1F5F9',
  green: '#15803D', greenBg: '#F0FDF4', amber: '#B45309', amberBg: '#FFFBEB', red: '#B91C1C', redBg: '#FEF2F2', blueBg: '#EFF6FF',
}

export const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 10, fontFamily: 'Helvetica', color: C.ink, lineHeight: 1.4 },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 4 },
  h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', lineHeight: 1.25, marginBottom: 6 },
  h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  muted: { color: C.muted },
  small: { fontSize: 8.5 },
  bold: { fontFamily: 'Helvetica-Bold' },
  section: { marginTop: 16 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 10 },
  row: { flexDirection: 'row' },
  pill: { borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', alignSelf: 'flex-start' },
})

function Mark({ size = 18 }: { size?: number }) {
  return (
    <Svg viewBox="-2 -2 108 104" width={size} height={size}>
      <G fill={C.brand}>
        <Path fillRule="evenodd" d="M7 0h31a5 5 0 0 1 5 5v90a5 5 0 0 1-5 5H7a7 7 0 0 1-7-7V7a7 7 0 0 1 7-7Zm16.5 37a11 11 0 0 0-6 20.2V75h12V57.2a11 11 0 0 0-6-20.2Z" />
        <Path d="M51 28 77 3a10 10 0 0 1 7-3h12a6 6 0 0 1 4.2 10.3L66 44.5a12 12 0 0 1-8.5 3.5H55a4 4 0 0 1-4-4Z" />
        <Path d="M51 56a4 4 0 0 1 4-4h2.5a12 12 0 0 1 8.2 3.3l33.6 31.3A7.7 7.7 0 0 1 94 100H80a10 10 0 0 1-7-3L54 78a10 10 0 0 1-3-7Z" />
      </G>
    </Svg>
  )
}

/** A report page with the Keymivo header strip and an agent/page-number footer on every page. */
export function ReportPage({ kind, agent, children }: { kind: string; agent: Agent; children: ReactNode }) {
  return (
    <Page size="LETTER" style={s.page}>
      <View fixed style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Mark />
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>Keymivo</Text>
        </View>
        <Text style={[s.small, s.muted]}>{kind}</Text>
      </View>
      {children}
      <Text fixed style={[s.small, s.muted, { position: 'absolute', bottom: 24, left: 40, right: 90 }]}>
        {[agent.name, agent.brokerage, agent.phone, agent.email, agent.license].filter(Boolean).join('  ·  ')}
      </Text>
      <Text fixed style={[s.small, s.muted, { position: 'absolute', bottom: 24, right: 40, width: 60, textAlign: 'right' }]} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </Page>
  )
}

export function Section({ title, children, wrap = true }: { title: string; children: ReactNode; wrap?: boolean }) {
  return (
    <View style={s.section} wrap={wrap}>
      <Text style={s.h2} minPresenceAhead={40}>{title}</Text>
      {children}
    </View>
  )
}

export function Bullets({ items, color }: { items: string[]; color?: string }) {
  if (!items?.length) return null
  return (
    <View style={{ gap: 2 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 4 }} wrap={false}>
          <Text style={{ color: color ?? C.muted }}>•</Text>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

export function Pill({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return <Text style={[s.pill, { color, backgroundColor: bg }]}>{children}</Text>
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.subtle, borderRadius: 6, padding: 8 }}>
      <Text style={[s.small, s.muted]}>{label}</Text>
      <Text style={[s.bold, { fontSize: 12, lineHeight: 1.25 }]}>{value}</Text>
    </View>
  )
}

/** Simple table: columns with flex widths and optional right alignment. */
export function Table<T>({ cols, rows }: { cols: { label: string; flex: number; right?: boolean; render: (r: T) => string }[]; rows: T[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 6 }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.subtle, paddingVertical: 5, paddingHorizontal: 8 }} fixed>
        {cols.map((c) => <Text key={c.label} style={[s.small, s.bold, s.muted, { flex: c.flex, textAlign: c.right ? 'right' : 'left' }]}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
          {cols.map((c) => <Text key={c.label} style={{ flex: c.flex, textAlign: c.right ? 'right' : 'left' }}>{c.render(r)}</Text>)}
        </View>
      ))}
    </View>
  )
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <Text style={[s.small, s.muted, { marginTop: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }]}>{children}</Text>
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const money = (n: number | null | undefined) => (n == null ? '—' : usd.format(Number(n)))
export const signedMoney = (n: number | null | undefined) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '-' : ''}${usd.format(Math.abs(Number(n)))}`)
export const fullName = (p: { first_name: string | null; last_name: string | null } | null | undefined) => (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '')
export const cap = (t: string | null | undefined) => (t ? t.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase()) : '—')
