// calendar — private ICS feed of a Realtor's tours, for Google/Apple/Outlook calendar subscriptions.
// Public URL (calendar apps can't send auth headers); access is controlled by the secret token in the query.
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://app.keymivo.com'
const SHOWING_MINUTES = 45

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// RFC 5545: fold lines longer than 75 octets.
const fold = (line: string) => line.length <= 74 ? line : line.match(/.{1,73}/g)!.join('\r\n ')
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const localStamp = (date: string, minutes: number) => {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d!, 0, minutes))
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}T${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}00`
}
const dateOnly = (date: string, addDays = 0) => {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d! + addDays))
  return t.toISOString().slice(0, 10).replace(/-/g, '')
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Not found', { status: 404 })

  const { data: feed } = await admin.from('calendar_feeds').select('profile_id').eq('token', token).maybeSingle()
  if (!feed) return new Response('Not found', { status: 404 })
  const { data: profile } = await admin.from('profiles').select('id, first_name, timezone, organization_id, role').eq('id', feed.profile_id).single()
  if (!profile?.organization_id || profile.role === 'buyer') return new Response('Not found', { status: 404 })

  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10)
  const { data: tours } = await admin
    .from('tours')
    .select('id, name, tour_date, status, notes, clients(first_name, last_name), tour_properties(id, scheduled_time, sequence_number, properties(address_line1, city, state, zip_code))')
    .eq('organization_id', profile.organization_id)
    .eq('agent_id', profile.id)
    .neq('status', 'cancelled')
    .gte('tour_date', since)
    .order('tour_date')

  const tz = profile.timezone || 'America/New_York'
  const now = stamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Keymivo//Tours//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('Keymivo tours')}`, `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ]

  for (const t of tours ?? []) {
    // deno-lint-ignore no-explicit-any
    const c = t.clients as any
    const buyer = [c?.first_name, c?.last_name].filter(Boolean).join(' ')
    const url = `${APP_URL}/tours/${t.id}`
    // deno-lint-ignore no-explicit-any
    const stops = [...((t.tour_properties as any[]) ?? [])].sort((a, b) => a.sequence_number - b.sequence_number)
    const timed = stops.filter((s) => s.scheduled_time)

    if (timed.length === 0) {
      lines.push('BEGIN:VEVENT', `UID:tour-${t.id}@keymivo.com`, `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dateOnly(t.tour_date)}`, `DTEND;VALUE=DATE:${dateOnly(t.tour_date, 1)}`,
        `SUMMARY:${esc(`${t.name} · ${buyer}`)}`,
        `DESCRIPTION:${esc(`${stops.length} homes:\n${stops.map((s, i) => `${i + 1}. ${s.properties?.address_line1 ?? ''}`).join('\n')}\n\n${url}`)}`,
        `URL:${url}`, 'END:VEVENT')
      continue
    }
    for (const s of timed) {
      const [h, m] = String(s.scheduled_time).split(':').map(Number)
      const start = h! * 60 + m!
      const p = s.properties
      const address = p ? `${p.address_line1}, ${p.city}, ${p.state} ${p.zip_code ?? ''}`.trim() : ''
      lines.push('BEGIN:VEVENT', `UID:stop-${s.id}@keymivo.com`, `DTSTAMP:${now}`,
        `DTSTART;TZID=${tz}:${localStamp(t.tour_date, start)}`, `DTEND;TZID=${tz}:${localStamp(t.tour_date, start + SHOWING_MINUTES)}`,
        `SUMMARY:${esc(`Showing: ${p?.address_line1 ?? 'Home'} · ${buyer}`)}`,
        `LOCATION:${esc(address)}`,
        `DESCRIPTION:${esc(`${t.name} — stop ${s.sequence_number} of ${stops.length}\nOpen in Keymivo: ${url}`)}`,
        `URL:${url}`, 'END:VEVENT')
    }
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="keymivo-tours.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  })
})
