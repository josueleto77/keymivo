import { FileUp, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export interface ExtractedListing {
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  listing_price: number | null
  beds: number | null
  baths: number | null
  square_feet: number | null
  lot_size: string | null
  year_built: number | null
  property_type: string | null
  property_tax: number | null
  hoa_fee: number | null
  days_on_market: number | null
  mls_number: string | null
  listing_agent_name: string | null
  listing_brokerage: string | null
  status: string | null
  highlights: string[]
  confidence_notes: string[]
}

/** Upload a listing sheet (PDF / photo / screenshot) → AI pre-fills the form for review. */
export function ListingImport({ onExtracted }: { onExtracted: (l: ExtractedListing) => void }) {
  const input = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [notes, setNotes] = React.useState<string[] | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setNotes(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const { data, error } = await supabase.functions.invoke('extract-listing', { body })
      if (error) {
        let message = error.message
        if (error instanceof FunctionsHttpError) {
          const b = await error.context.json().catch(() => null)
          if (b?.error) message = b.error
        }
        throw new Error(message)
      }
      const listing = (data as { listing: ExtractedListing }).listing
      onExtracted(listing)
      setNotes(listing.confidence_notes ?? [])
      toast.success('Listing read — review the fields before saving.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Card className="border-dashed border-accent/40 bg-blue-50/40">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-white"><Sparkles className="size-5" /></div>
        <div className="flex-1">
          <div className="font-semibold">Import from listing sheet</div>
          <p className="text-sm text-muted">Upload the MLS printout, flyer PDF or a screenshot. Keymivo fills in the fields — you review before saving.</p>
          {notes && notes.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
        </div>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" variant="accent" loading={busy} onClick={() => input.current?.click()}>
          {!busy && <FileUp />} {busy ? 'Reading listing…' : 'Upload listing'}
        </Button>
      </CardContent>
    </Card>
  )
}
