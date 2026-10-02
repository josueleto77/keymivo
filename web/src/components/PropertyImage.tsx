import { Home } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const gradients = [
  'from-sky-200 via-blue-100 to-indigo-200',
  'from-emerald-100 via-teal-50 to-sky-200',
  'from-amber-100 via-orange-50 to-rose-200',
  'from-violet-100 via-indigo-50 to-blue-200',
  'from-slate-200 via-slate-100 to-sky-100',
]

/** Primary photo from private storage (signed URL), or a tasteful placeholder. */
export function PropertyImage({
  path,
  seed,
  className,
  children,
}: {
  path: string | null | undefined
  seed: string
  className?: string
  children?: React.ReactNode
}) {
  const { data: url } = useSignedUrl('property-photos', path)
  const gradient = gradients[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length]
  return (
    <div className={cn('relative overflow-hidden bg-gradient-to-br', gradient, className)}>
      {url ? (
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Home className="size-10 text-white/80 drop-shadow-sm" strokeWidth={1.5} />
        </div>
      )}
      {children}
    </div>
  )
}

export function useSignedUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}
