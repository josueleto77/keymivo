// extract-listing — Property Intelligence Agent: reads a listing sheet (PDF or photo/screenshot)
// and returns structured property fields for the Realtor to review. Nothing is saved here.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini'
const MAX_BYTES = 15 * 1024 * 1024
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const num = { type: ['number', 'null'] }
const str = { type: ['string', 'null'] }
const SCHEMA = {
  name: 'listing',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'address_line1', 'city', 'state', 'zip_code', 'listing_price', 'beds', 'baths', 'square_feet', 'lot_size', 'year_built',
      'property_type', 'tax_amount', 'tax_period', 'hoa_amount', 'hoa_period', 'days_on_market', 'mls_number', 'listing_agent_name', 'listing_brokerage',
      'status', 'highlights', 'confidence_notes',
    ],
    properties: {
      address_line1: str, city: str, state: str, zip_code: str,
      listing_price: num, beds: num, baths: num, square_feet: num, lot_size: str, year_built: num,
      property_type: { type: ['string', 'null'], enum: ['single_family', 'condo', 'townhouse', 'multi_family', 'land', 'other', null] },
      tax_amount: { ...num, description: 'Property tax amount exactly as printed (no conversion)' },
      tax_period: { type: ['string', 'null'], enum: ['annual', 'semiannual', 'quarterly', 'monthly', null] },
      hoa_amount: { ...num, description: 'HOA/condo fee exactly as printed (0 if the sheet says none)' },
      hoa_period: { type: ['string', 'null'], enum: ['annual', 'semiannual', 'quarterly', 'monthly', null] },
      days_on_market: num, mls_number: str, listing_agent_name: str, listing_brokerage: str,
      status: { type: ['string', 'null'], enum: ['active', 'coming_soon', 'pending', 'under_contract', 'sold', 'off_market', null] },
      highlights: { type: 'array', items: { type: 'string' }, description: 'Up to 8 objective features stated in the listing (e.g. "2-car garage", "finished basement")' },
      confidence_notes: { type: 'array', items: { type: 'string' }, description: 'Fields that were unclear, inferred or converted (e.g. "Tax was quarterly; converted to annual")' },
    },
  },
}

const SYSTEM = `You extract facts from US residential real estate listing sheets (MLS printouts, flyers, screenshots).
Return only what the document states. Use null when a field is missing — never guess.
Baths: full=1, half=0.5 (e.g. "2 full, 1 half" = 2.5). Copy tax and HOA amounts exactly as printed with their period — do not convert.
State must be a 2-letter code. Highlights must be objective listing features only — no opinions and nothing about the
neighborhood's people or demographics (Fair Housing). Return JSON only.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const auth = req.headers.get('Authorization')
  if (!auth) return json({ error: 'Not signed in' }, 401)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })

  try {
    const { data: u } = await db.auth.getUser()
    if (!u.user) return json({ error: 'Not signed in' }, 401)
    if ((await db.rpc('is_org_staff')).data !== true) return json({ error: 'Not allowed' }, 403)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'AI is not configured yet (missing OPENAI_API_KEY secret).' }, 503)

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: 'Attach a PDF or image of the listing.' }, 400)
    if (file.size > MAX_BYTES) return json({ error: 'File is larger than 15 MB.' }, 400)
    const type = file.type || 'application/octet-stream'
    const isPdf = type === 'application/pdf'
    if (!isPdf && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return json({ error: 'Use a PDF, JPG, PNG or WebP image.' }, 400)

    const b64 = toBase64(new Uint8Array(await file.arrayBuffer()))
    const content = isPdf
      ? { type: 'file', file: { filename: file.name || 'listing.pdf', file_data: `data:application/pdf;base64,${b64}` } }
      : { type: 'image_url', image_url: { url: `data:${type};base64,${b64}` } }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: [{ type: 'text', text: 'Extract the listing fields from this document.' }, content] },
        ],
      }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error('OpenAI error', res.status, detail.slice(0, 500))
      if (res.status === 429 && /insufficient_quota|credit_balance/.test(detail)) throw new Error('The OpenAI account has no API credits.')
      throw new Error(`Couldn't read this file (${res.status}). Try a clearer photo or the PDF.`)
    }
    const msg = (await res.json()).choices?.[0]?.message
    if (msg?.refusal) throw new Error('The AI declined to read this file.')
    const out = JSON.parse(msg?.content ?? '{}')
    if (!out.address_line1 && !out.listing_price) {
      return json({ error: "That doesn't look like a listing sheet — no address or price found." }, 422)
    }
    if (typeof out.state === 'string') out.state = out.state.trim().toUpperCase().slice(0, 2)
    // Period conversions are done here, not by the model (LLM arithmetic is unreliable for money).
    const perYear: Record<string, number> = { annual: 1, semiannual: 2, quarterly: 4, monthly: 12 }
    const notes: string[] = Array.isArray(out.confidence_notes) ? out.confidence_notes.filter((n: string) => !/convert/i.test(n)) : []
    out.property_tax = out.tax_amount == null ? null : Math.round(out.tax_amount * (perYear[out.tax_period ?? 'annual'] ?? 1) * 100) / 100
    if (out.tax_amount != null && out.tax_period && out.tax_period !== 'annual') notes.push(`Tax was ${out.tax_period} ($${out.tax_amount}); converted to annual.`)
    out.hoa_fee = out.hoa_amount == null ? null : Math.round((out.hoa_amount * (perYear[out.hoa_period ?? 'monthly'] ?? 12)) / 12 * 100) / 100
    if (out.hoa_amount && out.hoa_period && out.hoa_period !== 'monthly') notes.push(`HOA was ${out.hoa_period} ($${out.hoa_amount}); converted to monthly.`)
    out.confidence_notes = notes
    for (const k of ['tax_amount', 'tax_period', 'hoa_amount', 'hoa_period']) delete out[k]
    return json({ listing: out })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('extract-listing failed', message)
    return json({ error: message }, 500)
  }
})

function toBase64(bytes: Uint8Array) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(bin)
}
