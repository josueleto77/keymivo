import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase, unwrap } from '@/lib/supabase'
import type { Row } from '@/lib/types'

const SELECT = '*, clients(id, first_name, last_name, email), properties(id, address_line1)'

export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: async () => unwrap(await supabase.from('messages').select(SELECT).order('created_at', { ascending: false })),
  })
}
export type MessageItem = NonNullable<ReturnType<typeof useMessages>['data']>[number]

export function useGenerateFollowup(showingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-followup', { body: { showing_id: showingId } })
      if (error) {
        let message = error.message
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null)
          if (body?.error) message = body.error
        }
        throw new Error(message)
      }
      const id = (data as { message: Row<'messages'> }).message.id
      return unwrap(await supabase.from('messages').select(SELECT).eq('id', id).single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useUpdateMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; content?: string; status?: string; channel?: string }) =>
      unwrap(await supabase.from('messages').update(patch).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useDeleteMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('messages').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

/** Split a stored "Subject: …\n\nbody" draft. */
export function splitDraft(content: string) {
  const m = content.match(/^Subject:\s*(.*)\n\n([\s\S]*)$/)
  return m ? { subject: m[1]!, body: m[2]! } : { subject: '', body: content }
}
export function joinDraft(subject: string, body: string) {
  return subject.trim() ? `Subject: ${subject.trim()}\n\n${body}` : body
}
