import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert, Update } from '@/lib/types'

const TOUR_SELECT =
  '*, clients(id, first_name, last_name), tour_properties(*, properties(id, address_line1, city, state, listing_price, beds, baths, square_feet, primary_photo, is_demo))'

export function useTours() {
  return useQuery({
    queryKey: ['tours'],
    queryFn: async () =>
      unwrap(await supabase.from('tours').select(TOUR_SELECT).order('tour_date', { ascending: true })),
  })
}
export type TourWithStops = NonNullable<ReturnType<typeof useTours>['data']>[number]

export function sortedStops(t: Pick<TourWithStops, 'tour_properties'>) {
  return [...t.tour_properties].sort((a, b) => a.sequence_number - b.sequence_number)
}

export function useTour(id: string | undefined) {
  return useQuery({
    queryKey: ['tour', id],
    enabled: !!id,
    queryFn: async () => {
      const tour = unwrap(await supabase.from('tours').select(TOUR_SELECT).eq('id', id!).single())
      const showings = unwrap(
        await supabase.from('showings').select('id, property_id, status, buyer_interest_score').eq('tour_id', id!),
      )
      return { ...tour, showings }
    },
  })
}

export function useCreateTour() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tour: Omit<Insert<'tours'>, 'organization_id'>
      stops: { property_id: string; scheduled_time: string | null }[]
    }) => {
      const tour = unwrap(await supabase.from('tours').insert(input.tour as Insert<'tours'>).select().single())
      if (input.stops.length) {
        unwrap(
          await supabase.from('tour_properties').insert(
            input.stops.map(
              (s, i) =>
                ({ tour_id: tour.id, property_id: s.property_id, scheduled_time: s.scheduled_time, sequence_number: i + 1 }) as Insert<'tour_properties'>,
            ),
          ),
        )
      }
      return tour
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tours'] }),
  })
}

export function useUpdateTour(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Update<'tours'>) =>
      unwrap(await supabase.from('tours').update(patch).eq('id', id).select().single()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tour', id] })
      qc.invalidateQueries({ queryKey: ['tours'] })
    },
  })
}

export function useDeleteTour() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('tours').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tours'] }),
  })
}

export function useAddTourStop(tourId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: { property_id: string; scheduled_time: string | null; sequence_number: number }) =>
      unwrap(
        await supabase
          .from('tour_properties')
          .insert({ ...s, tour_id: tourId } as Insert<'tour_properties'>)
          .select()
          .single(),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tour', tourId] })
      qc.invalidateQueries({ queryKey: ['tours'] })
    },
  })
}

export function useUpdateTourStop(tourId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Update<'tour_properties'>) =>
      unwrap(await supabase.from('tour_properties').update(patch).eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tour', tourId] })
      qc.invalidateQueries({ queryKey: ['tours'] })
    },
  })
}

export function useRemoveTourStop(tourId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('tour_properties').delete().eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tour', tourId] })
      qc.invalidateQueries({ queryKey: ['tours'] })
    },
  })
}
