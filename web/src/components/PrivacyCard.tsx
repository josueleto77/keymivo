import { Download, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDeleteAccount, useExportData } from '@/features/account'

export function PrivacyCard({ buyer = false, soleMember = true }: { buyer?: boolean; soleMember?: boolean }) {
  const exp = useExportData()
  const del = useDeleteAccount()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [typed, setTyped] = React.useState('')

  const what = buyer
    ? 'your portal login. Your agent keeps the ratings and messages you shared.'
    : soleMember
      ? 'your account and your entire organization: clients, properties, tours, showings, recordings, photos and AI insights. Any subscription is cancelled.'
      : 'your login. Your team keeps the clients and records you worked on.'

  return (
    <Card>
      <CardHeader><CardTitle>Your data</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted">Download a copy of {buyer ? 'your portal data' : 'all your organization data'} as a JSON file.</p>
          <Button variant="outline" loading={exp.isPending} onClick={() => exp.mutate(undefined, { onError: (e) => toast.error(e.message) })}><Download /> Export data</Button>
        </div>
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted">Permanently delete {what}</p>
          <Button variant="outline" className="text-danger" onClick={() => { setTyped(''); setOpen(true) }}><Trash2 /> Delete account</Button>
        </div>
        <p className="text-xs text-muted"><Link to="/privacy" className="underline">Privacy policy</Link> · <Link to="/terms" className="underline">Terms of service</Link></p>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Delete account permanently?" description={`This deletes ${what} It cannot be undone.`}>
          <p className="mb-2 text-sm">Type <b>DELETE</b> to confirm. We recommend exporting your data first.</p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
          <Button
            variant="danger"
            className="mt-4 w-full"
            disabled={typed !== 'DELETE'}
            loading={del.isPending}
            onClick={() => del.mutate(undefined, {
              onSuccess: () => { toast.success('Your account was deleted.'); navigate('/login', { replace: true }) },
              onError: (e) => toast.error(e.message),
            })}
          >
            Delete permanently
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
