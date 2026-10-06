import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import type { ReportKind } from '@/reports/render'

/** Builds a PDF report in the browser and downloads it (or opens the share sheet on phones). */
export function useDownloadReport() {
  const { profile, organization } = useAuth()
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: ReportKind; id: string }) => {
      if (!profile) throw new Error('Not signed in')
      const [{ buildReport }, { agentFrom }] = await Promise.all([import('@/reports/render'), import('@/reports/data')])
      const { blob, filename } = await buildReport(kind, id, agentFrom(profile, organization))
      const file = new File([blob], filename, { type: 'application/pdf' })
      const touch = window.matchMedia('(pointer: coarse)').matches
      if (touch && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename })
          return filename
        } catch (e) {
          if ((e as Error).name === 'AbortError') return filename
        }
      }
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: filename })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      return filename
    },
  })
}
