import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Plus, Sparkles } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { ListSkeleton } from '@/components/ui/skeleton'
import { useClients } from '@/features/clients'
import { useTasks } from '@/features/dashboard'
import { useProperties } from '@/features/properties'
import { supabase, unwrap } from '@/lib/supabase'
import type { Insert } from '@/lib/types'
import { cn, fullName } from '@/lib/utils'

const PRIORITY = { urgent: 'danger', high: 'danger', medium: 'warning', low: 'default' } as const

export function TasksPage() {
  const { data, isLoading, error, refetch } = useTasks()
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) =>
      unwrap(await supabase.from('tasks').update({ status: done ? 'done' : 'open' }).eq('id', id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const open_ = (data ?? []).filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const done = (data ?? []).filter((t) => t.status === 'done')

  return (
    <div>
      <PageHeader title="Tasks" actions={<Button onClick={() => setOpen(true)}><Plus /> New Task</Button>} />
      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={CheckSquare} title="No tasks yet" description="Add follow-ups manually. After AI showing analysis is enabled, Keymivo will create tasks from showing notes automatically." />
      ) : (
        <div className="space-y-8">
          {[{ title: 'Open', list: open_ }, { title: 'Completed', list: done }].map((g) =>
            g.list.length ? (
              <section key={g.title}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">{g.title} · {g.list.length}</h2>
                <div className="divide-y rounded-2xl border bg-card shadow-card">
                  {g.list.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-start gap-3 p-4">
                      <Checkbox checked={t.status === 'done'} onCheckedChange={(v) => toggle.mutate({ id: t.id, done: v === true })} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className={cn('text-sm font-medium', t.status === 'done' && 'text-muted line-through')}>{t.title}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {[t.properties?.address_line1, t.clients ? fullName(t.clients) : null, t.due_date ? `Due ${t.due_date}` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {t.ai_generated && <Badge variant="accent"><Sparkles className="size-3" /> AI</Badge>}
                      <Badge variant={PRIORITY[t.priority as keyof typeof PRIORITY]}>{t.priority}</Badge>
                    </label>
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}
      <NewTaskDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const clients = useClients()
  const properties = useProperties()
  const [title, setTitle] = React.useState('')
  const [priority, setPriority] = React.useState('medium')
  const [clientId, setClientId] = React.useState('')
  const [propertyId, setPropertyId] = React.useState('')
  const [due, setDue] = React.useState('')
  React.useEffect(() => {
    if (open) { setTitle(''); setPriority('medium'); setClientId(''); setPropertyId(''); setDue('') }
  }, [open])
  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await supabase.from('tasks').insert({
          title: title.trim(), priority, client_id: clientId || null, property_id: propertyId || null, due_date: due || null,
        } as Insert<'tasks'>),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New task">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate() }}>
          <Field label="Task" htmlFor="t-title"><Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Verify roof age" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority" htmlFor="t-pri">
              <NativeSelect id="t-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p[0]!.toUpperCase() + p.slice(1)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Due" htmlFor="t-due"><Input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <Field label="Client" htmlFor="t-client">
            <NativeSelect id="t-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">—</option>
              {clients.data?.map((c) => <option key={c.id} value={c.id}>{fullName(c)}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Property" htmlFor="t-prop">
            <NativeSelect id="t-prop" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">—</option>
              {properties.data?.map((p) => <option key={p.id} value={p.id}>{p.address_line1}</option>)}
            </NativeSelect>
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={create.isPending} disabled={!title.trim()}>Create task</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
