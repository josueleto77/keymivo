import {
  BarChart3, CalendarDays, CheckSquare, GitCompareArrows, Handshake, Home, LayoutDashboard, LogOut,
  MessageSquare, MoreHorizontal, Play, Plug, Settings, Shield, Users, X,
} from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogoMark, Logo } from '@/components/brand/Logo'
import { InitialsAvatar } from '@/components/ui/avatar'
import { StartShowingDialog } from '@/components/StartShowingDialog'
import { accessState, trialDaysLeft } from '@/lib/billing'
import { UpgradeScreen } from '@/pages/BillingPage'
import { useAuth, useSession } from '@/providers/AuthProvider'
import { cn, fullName } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/tours', label: 'Tours', icon: CalendarDays },
  { to: '/properties', label: 'Properties', icon: Home },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/offers', label: 'Offers', icon: Handshake },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/tours', label: 'Tours', icon: CalendarDays },
  { to: '/properties', label: 'Properties', icon: Home },
]

export function AppShell() {
  const { profile, organization } = useSession()
  const { signOut } = useAuth()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [startOpen, setStartOpen] = React.useState(false)
  const location = useLocation()
  React.useEffect(() => setMoreOpen(false), [location.pathname])

  const access = accessState(organization)
  const daysLeft = trialDaysLeft(organization)
  // Expired trials see the upgrade screen everywhere except Settings (data is never deleted).
  const blocked = access === 'expired' && profile.role !== 'super_admin' && !location.pathname.startsWith('/settings')

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="px-5 py-5">
          <Link to="/"><Logo markClassName="size-7" /></Link>
        </div>
        <div className="px-3">
          <button
            onClick={() => setStartOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary"
          >
            <Play className="size-4 fill-current" /> Start Showing
          </button>
        </div>
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {(profile.role === 'super_admin' ? [...NAV, { to: '/admin', label: 'Admin', icon: Shield, end: false }] : NAV).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-subtle hover:text-foreground',
                  isActive && 'bg-subtle text-foreground',
                )
              }
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        {access !== 'active' && (
          <Link to="/settings/billing" className={cn('mx-3 mb-3 rounded-xl px-3 py-2.5 text-xs', access === 'trial' ? 'bg-blue-50 text-secondary' : 'bg-amber-50 text-amber-800')}>
            {access === 'trial' ? (organization.stripe_subscription_id
              ? <><span className="font-semibold">{organization.subscription_plan === 'team' ? 'Team' : 'Pro'}</span> · trial ends in {daysLeft} days</>
              : <><span className="font-semibold">Pro trial</span> · {daysLeft} days left · Upgrade</>) : access === 'past_due' ? <span className="font-semibold">Payment issue — update billing</span> : <span className="font-semibold">Trial ended — choose a plan</span>}
          </Link>
        )}
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <InitialsAvatar name={fullName(profile) || profile.email || '?'} className="size-9 text-xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{fullName(profile)}</div>
            <div className="truncate text-xs text-muted">{organization.name}</div>
          </div>
          <button onClick={signOut} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="pt-safe sticky top-0 z-30 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/"><Logo markClassName="size-6" className="[&>span:last-child]:text-lg" /></Link>
        <Link to="/settings">
          <InitialsAvatar name={fullName(profile) || '?'} className="size-8 text-xs" />
        </Link>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          {access === 'past_due' && (
            <Link to="/settings/billing" className="mb-6 block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <b>Payment issue.</b> Update your payment method to keep access.
            </Link>
          )}
          {blocked ? <UpgradeScreen /> : <Outlet />}
        </div>
      </main>

      {/* Mobile floating Start Showing — only on list screens; detail pages have their own button and the FAB would cover actions */}
      {['/', '/clients', '/properties', '/tours'].includes(location.pathname) && (
      <button
        onClick={() => setStartOpen(true)}
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 active:scale-95 lg:hidden"
      >
        <Play className="size-4 fill-current" /> Start Showing
      </button>
      )}

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted', isActive && 'text-foreground')
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted"
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMoreOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-3xl bg-card p-4">
            <div className="mb-2 flex items-center justify-between px-2">
              <LogoMark className="size-6" />
              <button onClick={() => setMoreOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-subtle">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(profile.role === 'super_admin' ? [...NAV.slice(4), { to: '/admin', label: 'Admin', icon: Shield }] : NAV.slice(4)).map((item) => (
                <NavLink key={item.to} to={item.to} className="flex flex-col items-center gap-2 rounded-2xl bg-subtle px-2 py-4 text-xs font-medium">
                  <item.icon className="size-5" />
                  {item.label}
                </NavLink>
              ))}
              <button onClick={signOut} className="flex flex-col items-center gap-2 rounded-2xl bg-subtle px-2 py-4 text-xs font-medium text-danger">
                <LogOut className="size-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <StartShowingDialog open={startOpen} onOpenChange={setStartOpen} />
    </div>
  )
}
