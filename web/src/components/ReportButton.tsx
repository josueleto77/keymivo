import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDownloadReport } from '@/features/reports'
import type { ReportKind } from '@/reports/render'

export function ReportButton({ kind, id, label = 'PDF report', variant = 'outline', disabled, className }: {
  kind: ReportKind; id: string; label?: string; variant?: 'outline' | 'default' | 'ghost'; disabled?: boolean; className?: string
}) {
  const dl = useDownloadReport()
  return (
    <Button
      variant={variant}
      className={className}
      disabled={disabled}
      loading={dl.isPending}
      onClick={() => dl.mutate({ kind, id }, { onSuccess: () => toast.success('Report ready'), onError: (e) => toast.error(e.message) })}
    >
      <FileDown /> {label}
    </Button>
  )
}
