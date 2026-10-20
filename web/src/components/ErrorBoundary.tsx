import { RotateCw } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { reportError } from '@/lib/errorReporting'

/** Replaces a blank white screen with a friendly recovery screen, and reports the crash. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    reportError(error, 'render')
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            This screen hit an unexpected error. We've been notified. Your data is safe — reload to continue.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}><RotateCw /> Reload</Button>
            <Button variant="outline" onClick={() => { window.location.href = '/' }}>Go to home</Button>
          </div>
        </div>
      </div>
    )
  }
}
