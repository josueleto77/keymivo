import { useMutation, useQuery } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('billing', { body: { ...body, return_url: window.location.href } })
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

export function useBillingStatus() {
  return useQuery({
    queryKey: ['billing-status'],
    staleTime: 5 * 60_000,
    queryFn: () => call<{ configured: boolean; test_mode: boolean }>({ action: 'status' }),
  })
}

/** Redirects to Stripe Checkout / Billing Portal. */
export function useBillingRedirect() {
  return useMutation({
    mutationFn: async (v: { action: 'checkout'; plan: 'pro' | 'team' } | { action: 'portal' }) => {
      const { url } = await call<{ url: string }>(v)
      window.location.assign(url)
    },
  })
}
