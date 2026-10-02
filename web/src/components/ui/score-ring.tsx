import { cn, scoreTone } from '@/lib/utils'

export function ScoreRing({ score, size = 120, stroke = 10, label }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-700', scoreTone(score))}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-3xl font-bold leading-none">{score}</div>
        <div className="mt-0.5 text-[11px] font-medium text-muted">{label ?? '/ 100'}</div>
      </div>
    </div>
  )
}

export function ScorePill({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score == null) return null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur', scoreTone(score), className)}>
      MATCH {score}
    </span>
  )
}
