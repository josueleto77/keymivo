/**
 * Google Maps Platform helpers (browser key, restricted by HTTP referrer to Keymivo domains).
 * Maps JavaScript API for maps/geocoding/autocomplete; Routes API (REST) for tour routing.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ''
export const mapsEnabled = () => !!MAPS_KEY

let loading: Promise<any> | null = null

/** Loads the Maps JS API once (Google's dynamic-import bootstrap) and resolves to `google.maps`. */
export function loadMaps(): Promise<any> {
  if (!MAPS_KEY) return Promise.reject(new Error('Google Maps is not configured'))
  const w = window as any
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const cb = `__keymivoMaps${Date.now()}`
    w[cb] = () => resolve(w.google.maps)
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&loading=async&libraries=places,geometry,marker&callback=${cb}`
    s.async = true
    s.onerror = () => { loading = null; reject(new Error('Could not load Google Maps')) }
    document.head.appendChild(s)
  })
  return loading
}

export interface LatLng { lat: number; lng: number }

/** Geocodes an address; when a ZIP is given, results outside that ZIP are rejected (avoids same-name streets elsewhere). */
export async function geocode(address: string, zip?: string | null): Promise<LatLng | null> {
  const maps = await loadMaps()
  const { Geocoder } = await maps.importLibrary('geocoding')
  const req: Record<string, unknown> = { address, region: 'us' }
  if (zip) req.componentRestrictions = { country: 'US', postalCode: zip }
  const { results } = await new Geocoder().geocode(req).catch(() => ({ results: [] }))
  const loc = results?.[0]?.geometry?.location
  return loc ? { lat: loc.lat(), lng: loc.lng() } : null
}

export interface AddressSuggestion { id: string; text: string; prediction: any }

export async function suggestAddresses(input: string, sessionToken: any): Promise<AddressSuggestion[]> {
  if (input.trim().length < 3) return []
  const maps = await loadMaps()
  const { AutocompleteSuggestion } = await maps.importLibrary('places')
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input, sessionToken, includedRegionCodes: ['us'], includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
  })
  return (suggestions ?? [])
    .filter((s: any) => s.placePrediction)
    .slice(0, 5)
    .map((s: any) => ({ id: s.placePrediction.placeId, text: s.placePrediction.text.toString(), prediction: s.placePrediction }))
}

export async function newSessionToken() {
  const maps = await loadMaps()
  const { AutocompleteSessionToken } = await maps.importLibrary('places')
  return new AutocompleteSessionToken()
}

export interface ResolvedAddress { address_line1: string; city: string; state: string; zip_code: string; lat: number | null; lng: number | null }

export async function resolveAddress(prediction: any): Promise<ResolvedAddress> {
  const place = prediction.toPlace()
  await place.fetchFields({ fields: ['addressComponents', 'location'] })
  const get = (type: string, short = false) => {
    const c = (place.addressComponents ?? []).find((x: any) => x.types.includes(type))
    return c ? (short ? c.shortText : c.longText) : ''
  }
  return {
    address_line1: [get('street_number'), get('route')].filter(Boolean).join(' '),
    city: get('locality') || get('postal_town') || get('sublocality') || get('administrative_area_level_3'),
    state: get('administrative_area_level_1', true),
    zip_code: get('postal_code'),
    lat: place.location ? place.location.lat() : null,
    lng: place.location ? place.location.lng() : null,
  }
}

export interface RouteResult {
  totalSeconds: number
  totalMeters: number
  legSeconds: number[]
  legMeters: number[]
  polyline: string | null
  optimizedOrder: number[] | null // indices into the intermediate stops
}

/** Routes API: drive time between consecutive stops (optionally optimizing the middle stops' order). */
export async function computeRoute(points: LatLng[], optimize = false): Promise<RouteResult | null> {
  if (points.length < 2) return null
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': MAPS_KEY,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex',
    },
    body: JSON.stringify({
      origin: wp(points[0]!),
      destination: wp(points[points.length - 1]!),
      intermediates: points.slice(1, -1).map(wp),
      travelMode: 'DRIVE',
      optimizeWaypointOrder: optimize && points.length > 3,
    }),
  })
  if (!res.ok) throw new Error(`Route unavailable (${res.status})`)
  const r = (await res.json()).routes?.[0]
  if (!r) return null
  const secs = (d?: string) => (d ? Number(d.replace('s', '')) : 0)
  return {
    totalSeconds: secs(r.duration),
    totalMeters: r.distanceMeters ?? 0,
    legSeconds: (r.legs ?? []).map((l: any) => secs(l.duration)),
    legMeters: (r.legs ?? []).map((l: any) => l.distanceMeters ?? 0),
    polyline: r.polyline?.encodedPolyline ?? null,
    optimizedOrder: r.optimizedIntermediateWaypointIndex ?? null,
  }
}

export const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`
export const miles = (m: number) => `${(m / 1609.34).toFixed(1)} mi`
