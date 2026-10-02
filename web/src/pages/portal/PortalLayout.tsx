import { CalendarDays, GitCompareArrows, Home, LogOut, MessageSquare, Search } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { ErrorState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortalData } from '@/features/portal'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

const NAV = [
  { to: '/portal', label: 'Home', icon: Home, end: true },
  { to: '/portal/properties', label: 'Properties', icon: Search },
  { to: '/portal/tours', label: 'Tours', icon: CalendarDays },
  { to: '/portal/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/portal/messages', label: 'Messages', icon: MessageSquare },
]

export function PortalLayout() {
  const { signOut } = useAuth()
  const { data, isLoading, error, refetch } = usePortalData()

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <NavLink to="/portal"><Logo markClassName="size-6" className="[&>span:last-child]:text-lg" /></NavLink>
          <nav className="hidden flex-1 gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cn('rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground', isActive && 'bg-subtle text-foreground')}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {data && <span className="hidden text-sm text-muted sm:inline">{data.client.name}</span>}
            <button onClick={signOut} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">
        {error ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <Outlet context={data} />
        )}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted', isActive && 'text-foreground')}
            >
              <n.icon className="size-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
