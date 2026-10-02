import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useClients } from '@/features/clients'
import { useProperties } from '@/features/properties'
import { useStartShowing } from '@/features/showings'
import { fullName } from '@/lib/utils'

/** Ad-hoc showing launcher (no tour). Tour stops start showings directly from the tour page. */
export function StartShowingDialog({
  open,
  onOpenChange,
  defaultClientId,
  defaultPropertyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultClientId?: string
  defaultPropertyId?: string
}) {
  const navigate = useNavigate()
  const clients = useClients()
  const properties = useProperties()
  const start = useStartShowing()
  const [clientId, setClientId] = React.useState(defaultClientId ?? '')
  const [propertyId, setPropertyId] = React.useState(defaultPropertyId ?? '')

  React.useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? '')
      setPropertyId(defaultPropertyId ?? '')
    }
  }, [open, defaultClientId, defaultPropertyId])

  const noData = clients.data?.length === 0 || properties.data?.length === 0

  async function onStart() {
    try {
      const s = await start.mutateAsync({ client_id: clientId, property_id: propertyId })
      onOpenChange(false)
      navigate(`/showings/${s.id}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Start Showing" description="Pick the buyer and the home you're walking into.">
        {noData ? (
          <p className="text-sm text-muted">
            You need at least one client and one property to start a showing.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Buyer" htmlFor="ss-client">
              <NativeSelect id="ss-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select a buyer…</option>
                {clients.data?.map((c) => (
                  <option key={c.id} value={c.id}>{fullName(c)}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Property" htmlFor="ss-prop">
              <NativeSelect id="ss-prop" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Select a property…</option>
                {properties.data?.map((p) => (
                  <option key={p.id} value={p.id}>{p.address_line1}, {p.city}</option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={!clientId || !propertyId}
              loading={start.isPending}
              onClick={onStart}
            >
              Start Showing
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
