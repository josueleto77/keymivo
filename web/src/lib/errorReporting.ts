/** In-app error monitoring: uncaught errors are stored in `app_errors` and listed in Admin → Errors. */
import { supabase } from '@/lib/supabase'

const RELEASE = (import.meta.env.VITE_RELEASE as string | undefined) ?? __BUILD_TIME__
const MAX_PER_SESSION = 20
const seen = new Set<string>()
let sent = 0

// Browser noise that isn't a Keymivo bug.
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Non-Error promise rejection captured/i, /AbortError/i]

function area(): 'app' | 'portal' | 'public' {
  const p = window.location.pathname
  if (p.startsWith('/portal')) return 'portal'
  if (/^\/(login|signup|forgot-password|reset-password|terms|privacy|delete-account|join)/.test(p)) return 'public'
  return 'app'
}

/** A deploy replaced the hashed bundles this tab still references: reload once to pick up the new version. */
function isStaleBundle(message: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)
}

export function reportError(error: unknown, kind: 'error' | 'unhandledrejection' | 'render' = 'error') {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error))
  const message = (err.message || String(error)).slice(0, 500)
  if (IGNORE.some((re) => re.test(message))) return

  if (isStaleBundle(message) && !sessionStorage.getItem('kmv-reloaded')) {
    sessionStorage.setItem('kmv-reloaded', '1')
    window.location.reload()
    return
  }

  const key = `${kind}:${message}`
  if (seen.has(key) || sent >= MAX_PER_SESSION) return
  seen.add(key)
  sent++
  void supabase.from('app_errors').insert({
    kind, area: area(), message,
    stack: err.stack?.slice(0, 4000) ?? null,
    path: (window.location.pathname + window.location.search).slice(0, 300),
    user_agent: navigator.userAgent.slice(0, 300),
    release: RELEASE.slice(0, 60),
  }).then(() => undefined, () => undefined)
}

export function installErrorReporting() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'error'))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'unhandledrejection'))
}
