import { formatDistanceToNowStrict } from 'date-fns'
import { Camera, ChevronLeft, Heart, Mic, MicOff, PenLine, Square, ThumbsUp, Trash2, TriangleAlert } from 'lucide-react'
import * as React from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useSignedUrl } from '@/components/PropertyImage'
import { FullScreenLoader } from '@/components/RouteGuards'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/empty-state'
import { NativeSelect, Textarea } from '@/components/ui/input'
import { uploadPropertyPhoto, splitPhotoUrl } from '@/features/properties'
import {
  useAddNote, useAddReaction, useDeleteNote, useDeleteReaction, useEndShowing, useRecordConsent, useSaveRecording,
  useShowing, useShowingRecordings, type ShowingDetail,
} from '@/features/showings'
import { PHOTO_SUBJECTS, REACTIONS, REACTION_FEATURES, type ReactionValue } from '@/lib/constants'
import { cn, fullName } from '@/lib/utils'
import { useSession } from '@/providers/AuthProvider'
import { useQueryClient } from '@tanstack/react-query'

function useElapsed(since: string, stopAt?: string | null) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (stopAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopAt])
  const end = stopAt ? new Date(stopAt).getTime() : now
  const s = Math.max(0, Math.floor((end - new Date(since).getTime()) / 1000))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

type Sheet = null | { kind: 'reaction'; reaction: ReactionValue } | { kind: 'note' } | { kind: 'photo'; file: File } | { kind: 'consent' } | { kind: 'end' }

export function ShowingModePage() {
  const { id } = useParams()
  const { data: showing, isLoading, error, refetch } = useShowing(id)
  if (isLoading) return <FullScreenLoader />
  if (error || !showing) return <div className="p-6"><ErrorState message={(error as Error)?.message ?? 'Showing not found'} onRetry={() => refetch()} /></div>
  if (showing.status !== 'active') return <Navigate to={`/showings/${showing.id}/complete`} replace />
  return <ShowingMode showing={showing} />
}

function ShowingMode({ showing }: { showing: ShowingDetail }) {
  const navigate = useNavigate()
  const elapsed = useElapsed(showing.started_at)
  const [sheet, setSheet] = React.useState<Sheet>(null)
  const photoInput = React.useRef<HTMLInputElement>(null)
  const recorder = useRecorder(showing.id)
  const property = showing.properties!
  const client = showing.clients!

  function onRecordTap() {
    if (recorder.state === 'recording') return recorder.stop()
    if (!showing.recording_consent) return setSheet({ kind: 'consent' })
    recorder.start()
  }

  const timeline = [
    ...showing.buyer_reactions.map((r) => ({ kind: 'reaction' as const, at: r.created_at, r })),
    ...showing.showing_notes.map((n) => ({ kind: 'note' as const, at: n.created_at, n })),
    ...showing.property_photos.map((p) => ({ kind: 'photo' as const, at: p.created_at, p })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="flex min-h-dvh flex-col bg-primary text-white">
      {/* Header */}
      <header className="pt-safe sticky top-0 z-20 bg-primary/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="Back">
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold leading-tight">{property.address_line1}</div>
            <div className="truncate text-xs text-slate-400">{fullName(client)}</div>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-sm tabular-nums">{elapsed}</div>
        </div>
        {recorder.state === 'recording' && (
          <div className="flex items-center justify-center gap-2 bg-danger py-1.5 text-xs font-semibold">
            <span className="size-2 animate-pulse rounded-full bg-white" /> Recording · {recorder.elapsed}
          </div>
        )}
      </header>

      {/* Action grid */}
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pb-40 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <BigButton
            label={recorder.state === 'recording' ? 'Stop' : recorder.state === 'saving' ? 'Saving…' : 'Record'}
            icon={recorder.state === 'recording' ? Square : recorder.state === 'unsupported' ? MicOff : Mic}
            onClick={onRecordTap}
            disabled={recorder.state === 'saving' || recorder.state === 'unsupported'}
            className={recorder.state === 'recording' ? 'bg-danger' : ''}
          />
          <BigButton label="Photo" icon={Camera} onClick={() => photoInput.current?.click()} />
          <BigButton label="Note" icon={PenLine} onClick={() => setSheet({ kind: 'note' })} />
          <BigButton label="Like" icon={ThumbsUp} onClick={() => setSheet({ kind: 'reaction', reaction: 'like' })} className="bg-emerald-600/90" />
          <BigButton label="Concern" icon={TriangleAlert} onClick={() => setSheet({ kind: 'reaction', reaction: 'dislike' })} className="bg-amber-600/90" />
          <BigButton label="Love It" icon={Heart} onClick={() => setSheet({ kind: 'reaction', reaction: 'love' })} className="bg-brand" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => setSheet({ kind: 'reaction', reaction: 'neutral' })} className="rounded-2xl bg-white/10 py-3 text-sm font-semibold active:scale-[0.98]">😐 Neutral</button>
          <button onClick={() => setSheet({ kind: 'reaction', reaction: 'deal_breaker' })} className="rounded-2xl bg-white/10 py-3 text-sm font-semibold text-red-300 active:scale-[0.98]">⛔ Deal Breaker</button>
        </div>

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setSheet({ kind: 'photo', file: f })
            e.target.value = ''
          }}
        />

        {/* Timeline */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Captured · {timeline.length}{recorder.count > 0 ? ` · ${recorder.count} recording${recorder.count === 1 ? '' : 's'}` : ''}
          </h2>
          {timeline.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
              Tap a reaction, add a note or snap a photo. Everything saves instantly.
            </p>
          ) : (
            <ul className="space-y-2">
              {timeline.map((item) =>
                item.kind === 'reaction' ? (
                  <ReactionItem key={item.r.id} showing={showing} r={item.r} />
                ) : item.kind === 'note' ? (
                  <NoteItem key={item.n.id} showingId={showing.id} n={item.n} />
                ) : (
                  <PhotoItem key={item.p.id} p={item.p} />
                ),
              )}
            </ul>
          )}
        </section>
      </div>

      {/* End showing */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-primary via-primary to-transparent px-4 pt-6">
        <div className="mx-auto max-w-lg pb-4">
          <button
            onClick={() => setSheet({ kind: 'end' })}
            className="w-full rounded-2xl bg-white py-4 text-base font-bold tracking-wide text-primary shadow-lg active:scale-[0.99]"
          >
            END SHOWING
          </button>
        </div>
      </div>

      <ReactionSheet showing={showing} sheet={sheet} onClose={() => setSheet(null)} />
      <NoteSheet showingId={showing.id} open={sheet?.kind === 'note'} onClose={() => setSheet(null)} />
      <PhotoSheet showing={showing} file={sheet?.kind === 'photo' ? sheet.file : null} onClose={() => setSheet(null)} />
      <ConsentSheet
        showing={showing}
        open={sheet?.kind === 'consent'}
        onClose={() => setSheet(null)}
        onConfirmed={() => {
          setSheet(null)
          recorder.start()
        }}
      />
      <EndSheet
        showing={showing}
        open={sheet?.kind === 'end'}
        onClose={() => setSheet(null)}
        beforeEnd={async () => {
          if (recorder.state === 'recording') await recorder.stop()
        }}
      />
    </div>
  )
}

function BigButton({ label, icon: Icon, onClick, className, disabled }: { label: string; icon: typeof Mic; onClick: () => void; className?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl bg-white/10 text-sm font-semibold transition active:scale-95 disabled:opacity-50',
        className,
      )}
    >
      <Icon className="size-7" strokeWidth={2} />
      {label}
    </button>
  )
}

// ── Timeline items ──────────────────────────────────────────────────
function ReactionItem({ showing, r }: { showing: ShowingDetail; r: ShowingDetail['buyer_reactions'][number] }) {
  const del = useDeleteReaction(showing.id)
  const meta = REACTIONS.find((x) => x.value === r.reaction)
  const who = showing.clients?.client_members.find((m) => m.id === r.client_member_id)?.first_name
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
      <span className="text-xl">{meta?.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{meta?.label} · {r.feature}</div>
        <div className="text-xs text-slate-400">{who ? `${who} · ` : ''}{formatDistanceToNowStrict(new Date(r.created_at))} ago</div>
      </div>
      <button onClick={() => del.mutate(r.id)} className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-white/10" aria-label="Delete reaction">
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}

function NoteItem({ showingId, n }: { showingId: string; n: ShowingDetail['showing_notes'][number] }) {
  const del = useDeleteNote(showingId)
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
      <PenLine className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{n.content}</p>
        <div className="text-xs text-slate-400">{n.note_type === 'voice' ? 'Voice note · ' : ''}{formatDistanceToNowStrict(new Date(n.created_at))} ago</div>
      </div>
      <button onClick={() => del.mutate(n.id)} className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-white/10" aria-label="Delete note">
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}

function PhotoItem({ p }: { p: ShowingDetail['property_photos'][number] }) {
  const { bucket, path } = splitPhotoUrl(p.photo_url)
  const { data: url } = useSignedUrl(bucket, path)
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2 pr-4">
      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-white/10">{url && <img src={url} alt="" className="size-full object-cover" />}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Photo · {p.room_type ?? 'Other'}</div>
        {p.caption && <div className="truncate text-xs text-slate-400">{p.caption}</div>}
      </div>
    </li>
  )
}

// ── Sheets ──────────────────────────────────────────────────────────
function ReactionSheet({ showing, sheet, onClose }: { showing: ShowingDetail; sheet: Sheet; onClose: () => void }) {
  const add = useAddReaction({ id: showing.id, client_id: showing.client_id, property_id: showing.property_id })
  const open = sheet?.kind === 'reaction'
  const [reaction, setReaction] = React.useState<ReactionValue>('like')
  const [memberId, setMemberId] = React.useState<string | null>(null)
  const members = showing.clients?.client_members ?? []
  React.useEffect(() => {
    if (sheet?.kind === 'reaction') setReaction(sheet.reaction)
  }, [sheet])

  function pick(feature: string) {
    add.mutate(
      { reaction, feature, client_member_id: memberId },
      {
        onSuccess: () => {
          toast.success(`${REACTIONS.find((r) => r.value === reaction)?.label} · ${feature}`, { duration: 1500 })
          onClose()
        },
        onError: (e) => toast.error(`Couldn't save reaction: ${e.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="What's the reaction about?">
        <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {REACTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReaction(r.value)}
              className={cn('shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium', reaction === r.value ? 'border-primary bg-primary text-white' : 'bg-card')}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>
        {members.length > 1 && (
          <div className="mb-4 flex gap-1.5">
            {[{ id: null, first_name: 'Both / All' }, ...members].map((m) => (
              <button
                key={m.id ?? 'all'}
                onClick={() => setMemberId(m.id)}
                className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', memberId === m.id ? 'border-accent bg-blue-50 text-secondary' : 'bg-card')}
              >
                {m.first_name}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REACTION_FEATURES.map((f) => (
            <button
              key={f}
              onClick={() => pick(f)}
              disabled={add.isPending}
              className="rounded-2xl border bg-card px-3 py-4 text-sm font-semibold transition hover:bg-subtle active:scale-95 disabled:opacity-50"
            >
              {f}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
}

function NoteSheet({ showingId, open, onClose }: { showingId: string; open: boolean; onClose: () => void }) {
  const add = useAddNote(showingId)
  const [text, setText] = React.useState('')
  const [room, setRoom] = React.useState('')
  const [listening, setListening] = React.useState(false)
  const [usedVoice, setUsedVoice] = React.useState(false)
  const recRef = React.useRef<SpeechRecognitionLike | null>(null)
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition

  React.useEffect(() => {
    if (open) {
      setText('')
      setRoom('')
      setUsedVoice(false)
    } else {
      recRef.current?.stop()
    }
  }, [open])

  function toggleDictation() {
    if (!SR) return
    if (listening) return recRef.current?.stop()
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    const base = text
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0]!.transcript).join(' ')
      setText((base ? base + ' ' : '') + said.trim())
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
    setUsedVoice(true)
  }

  function save() {
    if (!text.trim()) return
    add.mutate(
      { content: text.trim(), room_type: room || null, note_type: usedVoice ? 'voice' : 'text' },
      { onSuccess: onClose, onError: (e) => toast.error(`Couldn't save note: ${e.message}`) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Quick note">
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'“Mike loves the kitchen.”  “Ask listing agent about roof.”'}
            className="min-h-[120px] text-base"
            autoFocus
          />
          <div className="flex gap-2">
            <NativeSelect value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room" className="flex-1">
              <option value="">Room (optional)</option>
              {REACTION_FEATURES.map((f) => <option key={f}>{f}</option>)}
            </NativeSelect>
            {SR && (
              <Button type="button" variant={listening ? 'danger' : 'outline'} onClick={toggleDictation}>
                <Mic /> {listening ? 'Stop' : 'Dictate'}
              </Button>
            )}
          </div>
          <Button className="w-full" size="lg" onClick={save} loading={add.isPending} disabled={!text.trim()}>Save note</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PhotoSheet({ showing, file, onClose }: { showing: ShowingDetail; file: File | null; onClose: () => void }) {
  const { organization } = useSession()
  const qc = useQueryClient()
  const [subject, setSubject] = React.useState('')
  const [caption, setCaption] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const preview = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  React.useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  React.useEffect(() => {
    if (file) {
      setSubject('')
      setCaption('')
    }
  }, [file])

  async function save() {
    if (!file) return
    setSaving(true)
    try {
      await uploadPropertyPhoto({
        orgId: organization.id,
        propertyId: showing.property_id,
        showingId: showing.id,
        file,
        roomType: subject || 'Other',
        caption: caption || null,
        bucket: 'showing-media',
      })
      qc.invalidateQueries({ queryKey: ['showing', showing.id] })
      onClose()
    } catch (e) {
      toast.error(`Couldn't upload photo: ${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="What is this?">
        <div className="space-y-3">
          {preview && <img src={preview} alt="" className="max-h-56 w-full rounded-2xl object-cover" />}
          <NativeSelect value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
            <option value="">Select…</option>
            {PHOTO_SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </NativeSelect>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional note (e.g. water stain near panel)" className="min-h-[70px]" />
          <Button className="w-full" size="lg" onClick={save} loading={saving}>Save to showing</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConsentSheet({ showing, open, onClose, onConfirmed }: { showing: ShowingDetail; open: boolean; onClose: () => void; onConfirmed: () => void }) {
  const consent = useRecordConsent({ id: showing.id, property_id: showing.property_id })
  const [checked, setChecked] = React.useState(false)
  React.useEffect(() => { if (open) setChecked(false) }, [open])
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Recording Consent Required">
        <p className="text-sm text-slate-600">
          Keymivo can record and transcribe conversations to create showing notes. Make sure everyone participating has
          provided consent where legally required.
        </p>
        {(showing.properties?.state ?? 'MA') === 'MA' && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <b>Massachusetts requires the consent of everyone being recorded</b> (all-party consent). Ask every person present, including buyers and anyone else in the home.
          </p>
        )}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
          <span className="text-sm font-medium">I confirm required consent has been obtained.</span>
        </label>
        <Button
          className="mt-4 w-full"
          size="lg"
          variant="danger"
          disabled={!checked}
          loading={consent.isPending}
          onClick={() => consent.mutate(undefined, { onSuccess: onConfirmed, onError: (e) => toast.error(e.message) })}
        >
          <Mic /> Start Recording
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function EndSheet({ showing, open, onClose, beforeEnd }: { showing: ShowingDetail; open: boolean; onClose: () => void; beforeEnd: () => Promise<void> }) {
  const navigate = useNavigate()
  const end = useEndShowing({ id: showing.id, tour_id: showing.tour_id, property_id: showing.property_id })
  const count = showing.buyer_reactions.length + showing.showing_notes.length + showing.property_photos.length
  async function confirmEnd() {
    try {
      await beforeEnd()
      await end.mutateAsync()
      navigate(`/showings/${showing.id}/complete`, { replace: true, state: { justEnded: true } })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="End this showing?" description={`${count} item${count === 1 ? '' : 's'} captured. You can still edit notes afterwards.`}>
        <div className="grid gap-2">
          <Button size="lg" onClick={confirmEnd} loading={end.isPending}>End Showing</Button>
          <Button size="lg" variant="ghost" onClick={onClose}>Keep going</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Audio recording (MediaRecorder → private 'recordings' bucket) ───
function useRecorder(showingId: string) {
  const { organization } = useSession()
  const save = useSaveRecording(showingId)
  const recordings = useShowingRecordings(showingId)
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
  const [state, setState] = React.useState<'idle' | 'recording' | 'saving' | 'unsupported'>(supported ? 'idle' : 'unsupported')
  const [startedAt, setStartedAt] = React.useState<string | null>(null)
  const mr = React.useRef<MediaRecorder | null>(null)
  const chunks = React.useRef<Blob[]>([])
  const stopResolver = React.useRef<(() => void) | null>(null)
  const elapsed = useElapsed(startedAt ?? new Date().toISOString(), startedAt ? null : new Date().toISOString())

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunks.current = []
      const began = Date.now()
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setState('saving')
        setStartedAt(null)
        try {
          const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
          await save.mutateAsync({ orgId: organization.id, blob, durationSeconds: Math.round((Date.now() - began) / 1000) })
          toast.success('Recording saved')
        } catch (e) {
          toast.error(`Recording upload failed: ${(e as Error).message}`)
        } finally {
          setState('idle')
          stopResolver.current?.()
          stopResolver.current = null
        }
      }
      rec.start(1000)
      mr.current = rec
      setStartedAt(new Date().toISOString())
      setState('recording')
    } catch {
      toast.error('Microphone access was blocked. Enable it in your browser settings to record.')
    }
  }

  function stop() {
    return new Promise<void>((resolve) => {
      if (!mr.current || mr.current.state === 'inactive') return resolve()
      stopResolver.current = resolve
      mr.current.stop()
    })
  }

  React.useEffect(() => () => { if (mr.current?.state === 'recording') mr.current.stop() }, [])

  return { state, start, stop, elapsed: elapsed.slice(3), count: recordings.data?.length ?? 0, isSaving: state === 'saving' }
}

