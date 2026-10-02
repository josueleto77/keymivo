import { cn, initials } from '@/lib/utils'

const tones = ['bg-blue-100 text-blue-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800', 'bg-cyan-100 text-cyan-800']

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const tone = tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length]
  return (
    <div className={cn('grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold', tone, className)}>
      {initials(name) || '?'}
    </div>
  )
}
