import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { supabase, unwrap } from '@/lib/supabase'
import type { Organization, Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  initializing: boolean
  profile: Profile | null
  organization: Organization | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = React.useState<Session | null>(null)
  const [initializing, setInitializing] = React.useState(true)

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitializing(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) qc.clear()
    })
    return () => sub.subscription.unsubscribe()
  }, [qc])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['me', userId],
    enabled: !!userId,
    queryFn: async () => {
      const profile = unwrap(await supabase.from('profiles').select('*').eq('user_id', userId!).maybeSingle())
      let organization: Organization | null = null
      if (profile?.organization_id) {
        organization = unwrap(
          await supabase.from('organizations').select('*').eq('id', profile.organization_id).maybeSingle(),
        )
      }
      return { profile, organization }
    },
  })

  const value: AuthState = {
    session,
    initializing,
    profile: profileQuery.data?.profile ?? null,
    organization: profileQuery.data?.organization ?? null,
    profileLoading: !!userId && profileQuery.isLoading,
    refreshProfile: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] })
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Profile + organization for pages behind the onboarding gate (guaranteed non-null). */
export function useSession() {
  const { profile, organization, session } = useAuth()
  if (!profile || !organization || !session) throw new Error('useSession used outside a protected route')
  return { profile, organization, user: session.user }
}
