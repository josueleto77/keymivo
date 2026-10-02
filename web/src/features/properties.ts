import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert, Update } from '@/lib/types'

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('properties')
          .select('*, property_scores(overall_score, client_id, clients(first_name, last_name))')
          .order('created_at', { ascending: false }),
      ),
  })
}
export type PropertyListItem = NonNullable<ReturnType<typeof useProperties>['data']>[number]

export function bestScore(p: Pick<PropertyListItem, 'property_scores'>) {
  return p.property_scores.reduce<null | (typeof p.property_scores)[number]>(
    (best, s) => (best == null || (s.overall_score ?? 0) > (best.overall_score ?? 0) ? s : best),
    null,
  )
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['property', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('properties')
          .select('*, property_photos(*), property_scores(*, clients(id, first_name, last_name))')
          .eq('id', id!)
          .single(),
      ),
  })
}

export function usePropertyShowings(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-showings', propertyId],
    enabled: !!propertyId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('showings')
          .select('*, clients(id, first_name, last_name), showing_notes(*), buyer_reactions(*)')
          .eq('property_id', propertyId!)
          .order('started_at', { ascending: false }),
      ),
  })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: Omit<Insert<'properties'>, 'organization_id'>) =>
      unwrap(await supabase.from('properties').insert(p as Insert<'properties'>).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Update<'properties'>) =>
      unwrap(await supabase.from('properties').update(patch).eq('id', id).select().single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property', id] })
      qc.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('properties').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

/** Uploads to the private bucket under {org_id}/... and records the photo row. */
export async function uploadPropertyPhoto(opts: {
  orgId: string
  propertyId: string
  file: File
  roomType?: string | null
  caption?: string | null
  showingId?: string | null
  bucket?: 'property-photos' | 'showing-media'
}) {
  const bucket = opts.bucket ?? 'property-photos'
  const ext = opts.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${opts.orgId}/${opts.propertyId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, opts.file, { contentType: opts.file.type })
  if (error) throw new Error(error.message)
  return unwrap(
    await supabase
      .from('property_photos')
      .insert({
        property_id: opts.propertyId,
        photo_url: `${bucket}/${path}`,
        room_type: opts.roomType ?? null,
        caption: opts.caption ?? null,
        showing_id: opts.showingId ?? null,
      } as Insert<'property_photos'>)
      .select()
      .single(),
  )
}

/** photo_url is stored as "{bucket}/{path}". */
export function splitPhotoUrl(stored: string): { bucket: string; path: string } {
  const i = stored.indexOf('/')
  return { bucket: stored.slice(0, i), path: stored.slice(i + 1) }
}
