import { cn } from '@/lib/utils'

/** Keymivo mark: keyhole door + K arms. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-2 -2 108 104" className={cn('size-8', className)} aria-hidden="true">
      <g fill="#1B5CF6">
        <path fillRule="evenodd" d="M7 0h31a5 5 0 0 1 5 5v90a5 5 0 0 1-5 5H7a7 7 0 0 1-7-7V7a7 7 0 0 1 7-7Zm16.5 37a11 11 0 0 0-6 20.2V75h12V57.2a11 11 0 0 0-6-20.2Z" />
        <path d="M51 28 77 3a10 10 0 0 1 7-3h12a6 6 0 0 1 4.2 10.3L66 44.5a12 12 0 0 1-8.5 3.5H55a4 4 0 0 1-4-4Z" />
        <path d="M51 56a4 4 0 0 1 4-4h2.5a12 12 0 0 1 8.2 3.3l33.6 31.3A7.7 7.7 0 0 1 94 100H80a10 10 0 0 1-7-3L54 78a10 10 0 0 1-3-7Z" />
      </g>
    </svg>
  )
}

export function Logo({ className, markClassName, inverted }: { className?: string; markClassName?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label="Keymivo">
      <LogoMark className={markClassName} />
      <span className={cn('font-display text-[22px] font-bold tracking-tight', inverted ? 'text-white' : 'text-primary')}>
        Keymivo
      </span>
    </span>
  )
}
