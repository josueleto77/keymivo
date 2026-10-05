import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { uploadPropertyPhoto } from '@/features/properties'
import { bumpAttempts, isNetworkError, listQueue, onQueueChange, removeQueued, type QueuedItem } from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import type { Insert } from '@/lib/types'

const MAX_ATTEMPTS = 5
let flushing = false

async function run(item: QueuedItem) {
  switch (item.kind) {
    case 'reaction': {
      const { error } = await supabase.from('buyer_reactions').insert({ ...item.data, created_at: item.createdAt } as Insert<'buyer_reactions'>)
      if (error) throw new Error(error.message)
      return
    }
    case 'note': {
      const { error } = await supabase.from('showing_notes').insert({ ...item.data, created_at: item.createdAt } as Insert<'showing_notes'>)
      if (error) throw new Error(error.message)
      return
    }
    case 'photo': {
      const file = new File([item.blob], item.fileName, { type: item.blob.type || 'image/jpeg' })
      await uploadPropertyPhoto({
        orgId: item.data.orgId, propertyId: item.data.propertyId, showingId: item.showingId, file,
        roomType: item.data.roomType, caption: item.data.caption, bucket: 'showing-media',
      })
      return
    }
    case 'recording': {
      const ext = item.blob.type.includes('mp4') ? 'm4a' : 'webm'
      const path = `${item.data.orgId}/${item.showingId}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('recordings').upload(path, item.blob, { contentType: item.blob.type })
      if (up.error) throw new Error(up.error.message)
      const { error } = await supabase.from('recordings').insert({
        showing_id: item.showingId, audio_url: path, duration_seconds: item.data.durationSeconds, created_at: item.createdAt,
      } as Insert<'recordings'>)
      if (error) throw new Error(error.message)
    }
  }
}

/** Replays queued captures in capture order. Stops at the first network failure (still offline). */
export async function flushQueue(): Promise<{ synced: string[]; failed: number }> {
  if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return { synced: [], failed: 0 }
  flushing = true
  const synced: string[] = []
  let failed = 0
  try {
    for (const item of await listQueue()) {
      if (item.attempts >= MAX_ATTEMPTS) { failed++; continue }
      try {
        await run(item)
        await removeQueued(item.id)
        synced.push(item.showingId)
      } catch (e) {
        if (isNetworkError(e)) break
        await bumpAttempts(item)
        failed++
      }
    }
  } finally {
    flushing = false
  }
  return { synced, failed }
}

/** Online state + this showing's pending captures; flushes on reconnect and every 15 s. */
export function useOfflineSync(showingId: string) {
  const qc = useQueryClient()
  const [online, setOnline] = React.useState(() => navigator.onLine)
  const [pending, setPending] = React.useState<QueuedItem[]>([])

  const refresh = React.useCallback(async () => setPending(await listQueue(showingId)), [showingId])

  const flush = React.useCallback(async () => {
    const { synced } = await flushQueue()
    if (synced.length) {
      for (const id of new Set(synced)) {
        qc.invalidateQueries({ queryKey: ['showing', id] })
        qc.invalidateQueries({ queryKey: ['showing-recordings', id] })
      }
    }
    await refresh()
  }, [qc, refresh])

  React.useEffect(() => {
    refresh()
    const off = onQueueChange(refresh)
    const up = () => { setOnline(true); flush() }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    const t = setInterval(flush, 15_000)
    flush()
    return () => { off(); window.removeEventListener('online', up); window.removeEventListener('offline', down); clearInterval(t) }
  }, [refresh, flush])

  return { online, pending, flush }
}
