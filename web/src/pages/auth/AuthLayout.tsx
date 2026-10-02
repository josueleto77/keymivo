import type * as React from 'react'
import { Logo } from '@/components/brand/Logo'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">
            <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute -right-24 -top-24 size-[520px] rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-32 left-10 size-[420px] rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-200">The AI copilot for buyer agents</p>
          <h2 className="mt-4 max-w-md font-display text-5xl font-bold leading-[1.05]">From showing to offer in minutes.</h2>
          <p className="mt-5 max-w-md text-base text-slate-300">
            Keymivo remembers everything between the first search and the final offer — what your buyers love,
            what worries them, and which home is winning.
          </p>
        </div>
      </div>
    </div>
  )
}
