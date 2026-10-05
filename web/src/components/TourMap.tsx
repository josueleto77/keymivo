import { useQueryClient } from '@tanstack/react-query'
import { Car, Route } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { computeRoute, geocode, loadMaps, mapsEnabled, miles, minutes, type LatLng, type RouteResult } from '@/lib/maps'
import { supabase } from '@/lib/supabase'

export interface TourStopGeo {
  id: string
  property_id: string
  sequence_number: number
  scheduled_time: string | null
  properties: { address_line1: string; city: string; state: string; zip_code?: string | null; latitude?: number | null; longitude?: number | null } | null
}

/** Tour map: numbered stops, driving route and drive time between stops (Routes API), plus "optimize order". */
export function TourMap({ stops, onReorder }: { stops: TourStopGeo[]; onReorder: (orderedIds: string[]) => Promise<void> }) {
  const el = React.useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const [points, setPoints] = React.useState<(LatLng | null)[] | null>(null)
  const [route, setRoute] = React.useState<RouteResult | null>(null)
  const [optimizing, setOptimizing] = React.useState(false)
  const key = stops.map((s) => `${s.id}:${s.properties?.latitude ?? ''}`).join('|')

  // 1. Coordinates for every stop (geocode + persist the ones missing).
  React.useEffect(() => {
    if (!mapsEnabled() || stops.length === 0) return
    let cancelled = false
    ;(async () => {
      const pts = await Promise.all(stops.map(async (s) => {
        const p = s.properties
        if (!p) return null
        if (p.latitude != null && p.longitude != null) return { lat: p.latitude, lng: p.longitude }
        const g = await geocode(`${p.address_line1}, ${p.city}, ${p.state} ${p.zip_code ?? ''}`, p.zip_code)
        if (g) await supabase.from('properties').update({ latitude: g.lat, longitude: g.lng }).eq('id', s.property_id)
        return g
      }))
      if (!cancelled) setPoints(pts)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // 2. Route + map.
  React.useEffect(() => {
    if (!points || !el.current) return
    const valid = points.filter((p): p is LatLng => !!p)
    if (!valid.length) return
    let cancelled = false
    ;(async () => {
      const r = valid.length === points.length && valid.length >= 2 ? await computeRoute(valid).catch(() => null) : null
      if (cancelled) return
      setRoute(r)
      const maps = await loadMaps()
      const { Map, Polyline } = await maps.importLibrary('maps')
      const { AdvancedMarkerElement, PinElement } = await maps.importLibrary('marker')
      const { encoding } = await maps.importLibrary('geometry')
      if (cancelled || !el.current) return
      const map = new Map(el.current, { mapId: 'DEMO_MAP_ID', center: valid[0], zoom: 12, disableDefaultUI: true, zoomControl: true })
      const bounds = new maps.LatLngBounds()
      points.forEach((p, i) => {
        if (!p) return
        const pin = new PinElement({ glyph: String(i + 1), background: '#1B5CF6', borderColor: '#1D4ED8', glyphColor: '#ffffff' })
        new AdvancedMarkerElement({ map, position: p, content: pin.element, title: stops[i]?.properties?.address_line1 })
        bounds.extend(p)
      })
      if (r?.polyline) new Polyline({ map, path: encoding.decodePath(r.polyline), strokeColor: '#1B5CF6', strokeOpacity: 0.8, strokeWeight: 4 })
      // Fit once the map has a size (fitBounds before the first idle is ignored).
      maps.event.addListenerOnce(map, 'idle', () => {
        if (valid.length === 1) { map.setCenter(valid[0]); map.setZoom(14) } else map.fitBounds(bounds, 48)
      })
    })()
    return () => { cancelled = true }
  }, [points, stops])

  if (!mapsEnabled() || stops.length === 0) return null
  const unresolved = points ? stops.filter((_, i) => !points[i]).map((s) => s.properties?.address_line1 ?? 'a stop') : []

  async function optimize() {
    if (!points || points.some((p) => !p) || points.length < 4) return
    setOptimizing(true)
    try {
      const r = await computeRoute(points as LatLng[], true)
      const order = r?.optimizedOrder
      if (!order) return toast('This order is already the fastest.')
      const middle = order.map((i) => stops[i + 1]!.id)
      const ids = [stops[0]!.id, ...middle, stops[stops.length - 1]!.id]
      if (ids.join() === stops.map((s) => s.id).join()) return toast('This order is already the fastest.')
      await onReorder(ids)
      qc.invalidateQueries({ queryKey: ['tour'] })
      toast.success(`Reordered — about ${minutes(r!.totalSeconds)} of driving.`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <div ref={el} className="h-64 w-full bg-subtle sm:h-80" />
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Car className="size-4 text-muted" />
            {route ? (
              <span><b>{minutes(route.totalSeconds)}</b> of driving · {miles(route.totalMeters)}</span>
            ) : unresolved.length ? (
              <span className="text-amber-700">Couldn't locate {unresolved.join(', ')} — check the address and ZIP to get drive times.</span>
            ) : (
              <span className="text-muted">Calculating route…</span>
            )}
          </div>
          {stops.length >= 4 && (
            <Button size="sm" variant="outline" onClick={optimize} loading={optimizing}><Route /> Optimize order</Button>
          )}
        </div>
        {route && route.legSeconds.length > 0 && (
          <ol className="space-y-1 text-xs text-muted">
            {route.legSeconds.map((s, i) => (
              <li key={i}>{i + 1} → {i + 2}: {minutes(s)} · {miles(route.legMeters[i] ?? 0)} <span className="text-slate-400">({stops[i]?.properties?.address_line1} → {stops[i + 1]?.properties?.address_line1})</span></li>
            ))}
          </ol>
        )}
        <p className="text-[11px] text-muted">Optimize keeps the first and last stop and reorders the homes in between. Times are current traffic estimates from Google.</p>
      </CardContent>
    </Card>
  )
}
