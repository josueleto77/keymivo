import { ExternalLink, MapPin } from 'lucide-react'
import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { geocode, loadMaps, mapsEnabled } from '@/lib/maps'
import { supabase } from '@/lib/supabase'

interface P { id: string; address_line1: string; city: string; state: string; zip_code: string | null; latitude: number | null; longitude: number | null }

/** Interactive map for one property. Geocodes once (and saves lat/lng) when the property has no coordinates. */
export function PropertyMap({ p }: { p: P }) {
  const el = React.useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const [failed, setFailed] = React.useState(false)
  const full = `${p.address_line1}, ${p.city}, ${p.state} ${p.zip_code ?? ''}`.trim()

  React.useEffect(() => {
    if (!mapsEnabled() || !el.current) return
    let cancelled = false
    ;(async () => {
      try {
        let pos = p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : await geocode(full, p.zip_code)
        if (!pos) throw new Error('not found')
        if (p.latitude == null) {
          await supabase.from('properties').update({ latitude: pos.lat, longitude: pos.lng }).eq('id', p.id)
          qc.invalidateQueries({ queryKey: ['property', p.id] })
        }
        const maps = await loadMaps()
        const { Map } = await maps.importLibrary('maps')
        const { AdvancedMarkerElement } = await maps.importLibrary('marker')
        if (cancelled || !el.current) return
        const map = new Map(el.current, { center: pos, zoom: 15, mapId: 'DEMO_MAP_ID', disableDefaultUI: true, zoomControl: true })
        new AdvancedMarkerElement({ map, position: pos, title: p.address_line1 })
        pos = { lat: pos.lat, lng: pos.lng }
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [p.id, p.latitude, p.longitude, full, qc])

  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`
  return (
    <div>
      {mapsEnabled() && !failed ? (
        <div ref={el} className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-subtle" />
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-xl bg-subtle text-center text-sm text-muted">
          <div className="px-4"><MapPin className="mx-auto mb-2 size-6" />{failed ? "Couldn't locate this address." : 'Map not available.'}</div>
        </div>
      )}
      <a href={link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
        Open in Google Maps <ExternalLink className="size-3.5" />
      </a>
    </div>
  )
}
