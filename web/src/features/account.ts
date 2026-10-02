import { useMutation } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('account', { body })
  if (error) {
    let message = error.message
    if (error instanceof FunctionsHttpError) {
      const b = await error.context.json().catch(() => null)
      if (b?.error) message = b.error
    }
    throw new Error(message)
  }
  return data as T
}

/** Downloads everything the caller can access as a JSON file. */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const data = await call<unknown>({ action: 'export' })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `keymivo-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const res = await call<{ deleted: string }>({ action: 'delete', confirm: 'DELETE' })
      await supabase.auth.signOut()
      return res
    },
  })
}
