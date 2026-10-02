import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogoMark } from '@/components/brand/Logo'
import { useAuth } from '@/providers/AuthProvider'

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-10" />
        <Loader2 className="size-5 animate-spin text-muted" />
      </div>
    </div>
  )
}

/** Signed in + onboarded + staff role. */
export function RequireRealtor() {
  const { session, initializing, profile, profileLoading } = useAuth()
  const location = useLocation()
  if (initializing || profileLoading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!profile || !profile.onboarding_completed || !profile.organization_id) return <Navigate to="/onboarding" replace />
  if (profile.role === 'buyer') return <Navigate to="/portal" replace />
  return <Outlet />
}

export function RequireSession() {
  const { session, initializing } = useAuth()
  if (initializing) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function PublicOnly() {
  const { session, initializing } = useAuth()
  if (initializing) return <FullScreenLoader />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}

/** Signed-in buyer linked to a client account. */
export function RequireBuyer() {
  const { session, initializing, profile, profileLoading } = useAuth()
  if (initializing || profileLoading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role !== 'buyer') return <Navigate to="/" replace />
  return <Outlet />
}

export function RequireSuperAdmin() {
  const { profile } = useAuth()
  if (profile?.role !== 'super_admin') return <Navigate to="/" replace />
  return <Outlet />
}
