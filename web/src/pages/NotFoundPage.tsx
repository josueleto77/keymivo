import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <p className="font-display text-6xl font-bold text-slate-200">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <Button asChild className="mt-6"><Link to="/">Back to dashboard</Link></Button>
    </div>
  )
}
