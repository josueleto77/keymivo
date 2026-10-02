import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useDeletePreference, useUpsertPreference } from '@/features/clients'
import { PREFERENCE_CATEGORIES, PREFERENCE_TYPES, labelFor } from '@/lib/constants'
import { DEFAULT_WEIGHT, groupPreferences, inferCategory, sourceLabel } from '@/lib/preferences'
import type { ClientPreference } from '@/lib/types'
import { cn } from '@/lib/utils'

const GROUPS = [
  { key: 'mustHave', title: 'Must Have', dot: 'bg-success' },
  { key: 'prefers', title: 'Prefers', dot: 'bg-accent' },
  { key: 'dislikes', title: 'Dislikes', dot: 'bg-warning' },
  { key: 'dealBreakers', title: 'Deal Breakers', dot: 'bg-danger' },
] as const

export function PreferenceManager({ clientId, preferences }: { clientId: string; preferences: ClientPreference[] }) {
  const groups = groupPreferences(preferences)
  const [editing, setEditing] = React.useState<ClientPreference | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">What This Buyer Wants</h2>
          <p className="text-sm text-muted">Objective property criteria. Keymivo will suggest changes as it learns from showings.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing('new')}><Plus /> Add</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((g) => (
          <Card key={g.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><span className={cn('size-2 rounded-full', g.dot)} /> {g.title}</CardTitle>
              <span className="text-xs text-muted">{groups[g.key].length}</span>
            </CardHeader>
            <CardContent className="space-y-1">
              {groups[g.key].length === 0 ? (
                <p className="py-2 text-sm text-muted">None yet.</p>
              ) : (
                groups[g.key].map((p) => <PreferenceRow key={p.id} p={p} clientId={clientId} onEdit={() => setEditing(p)} />)
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <PreferenceDialog clientId={clientId} editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function PreferenceRow({ p, clientId, onEdit }: { p: ClientPreference; clientId: string; onEdit: () => void }) {
  const upsert = useUpsertPreference(clientId)
  const del = useDeletePreference(clientId)
  const nudge = (delta: number) =>
    upsert.mutate({ id: p.id, weight: Math.max(0, Math.min(100, p.weight + delta)) }, { onError: (e) => toast.error(e.message) })

  return (
    <div className="group -mx-2 rounded-xl px-2 py-2.5 hover:bg-subtle/60">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-sm font-medium">{p.value}</span>
        {p.status === 'suggested' && <Badge variant="accent">AI suggestion</Badge>}
        {p.confirmed_by_realtor ? (
          <Check className="size-4 text-success" aria-label="Confirmed" />
        ) : (
          <Button size="sm" variant="subtle" onClick={() => upsert.mutate({ id: p.id, confirmed_by_realtor: true, status: 'active' })}>
            Confirm
          </Button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.weight}%` }} />
        </div>
        <span className="w-9 text-right text-xs font-semibold tabular-nums">{p.weight}%</span>
        <div className="flex">
          <button onClick={() => nudge(-10)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-card" aria-label="Decrease importance"><ChevronDown className="size-4" /></button>
          <button onClick={() => nudge(10)} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-card" aria-label="Increase importance"><ChevronUp className="size-4" /></button>
          <button onClick={onEdit} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-card" aria-label="Edit"><Pencil className="size-3.5" /></button>
          <button
            onClick={() => { if (confirm(`Delete "${p.value}"?`)) del.mutate(p.id) }}
            className="grid size-7 place-items-center rounded-lg text-muted hover:bg-card hover:text-danger"
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Confidence: <span className="font-medium capitalize text-slate-600">{p.confidence}</span> · Learned from: {sourceLabel(p)}
      </p>
    </div>
  )
}

function PreferenceDialog({ clientId, editing, onClose }: { clientId: string; editing: ClientPreference | 'new' | null; onClose: () => void }) {
  const upsert = useUpsertPreference(clientId)
  const existing = editing && editing !== 'new' ? editing : null
  const [value, setValue] = React.useState('')
  const [type, setType] = React.useState('must_have')
  const [category, setCategory] = React.useState('other')
  const [weight, setWeight] = React.useState(90)
  const [catTouched, setCatTouched] = React.useState(false)

  React.useEffect(() => {
    if (!editing) return
    setValue(existing?.value ?? '')
    setType(existing?.preference_type ?? 'must_have')
    setCategory(existing?.category ?? 'other')
    setWeight(existing?.weight ?? 90)
    setCatTouched(!!existing)
  }, [editing, existing])

  async function save() {
    if (!value.trim()) return
    try {
      await upsert.mutateAsync({
        id: existing?.id,
        value: value.trim(),
        preference_type: type,
        category,
        weight,
        ...(existing ? { confirmed_by_realtor: true, status: 'active' } : {}),
      })
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={existing ? 'Edit preference' : 'Add preference'}>
        <div className="space-y-4">
          <Field label="Preference" htmlFor="pv">
            <Input
              id="pv"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (!catTouched) setCategory(inferCategory(e.target.value))
              }}
              placeholder="e.g. Garage"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="pt">
              <NativeSelect
                id="pt"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  if (!existing) setWeight(DEFAULT_WEIGHT[e.target.value] ?? 50)
                }}
              >
                {PREFERENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Category" htmlFor="pc">
              <NativeSelect id="pc" value={category} onChange={(e) => { setCategory(e.target.value); setCatTouched(true) }}>
                {PREFERENCE_CATEGORIES.map((c) => <option key={c} value={c}>{c[0]!.toUpperCase() + c.slice(1)}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label={`Importance · ${weight}%`} htmlFor="pw">
            <input id="pw" type="range" min={0} max={100} step={5} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full accent-[#111827]" />
          </Field>
          <p className="text-xs text-muted">{labelFor(PREFERENCE_TYPES, type)} preferences feed the Buyer Match score.</p>
          <Button className="w-full" size="lg" onClick={save} loading={upsert.isPending} disabled={!value.trim()}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
