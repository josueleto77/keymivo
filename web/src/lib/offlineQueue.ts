/**
 * Offline queue for Showing Mode. Captures (reactions, notes, photos, recordings) are written to IndexedDB
 * when the network is unavailable and replayed in order once it returns. Each item keeps its capture time.
 */
const DB = 'keymivo-offline'
const STORE = 'queue'

export type QueuedOp =
  | { kind: 'reaction'; showingId: string; data: Record<string, unknown> }
  | { kind: 'note'; showingId: string; data: Record<string, unknown> }
  | { kind: 'photo'; showingId: string; data: { propertyId: string; roomType: string | null; caption: string | null; orgId: string }; blob: Blob; fileName: string }
  | { kind: 'recording'; showingId: string; data: { orgId: string; durationSeconds: number }; blob: Blob }

export type QueuedItem = QueuedOp & { id: string; createdAt: string; attempts: number }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function enqueue(op: QueuedOp): Promise<QueuedItem> {
  const item = { ...op, id: crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0 } as QueuedItem
  await tx('readwrite', (s) => s.put(item))
  notify()
  return item
}

export async function listQueue(showingId?: string): Promise<QueuedItem[]> {
  try {
    const all = (await tx('readonly', (s) => s.getAll())) as QueuedItem[]
    return all.filter((i) => !showingId || i.showingId === showingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } catch {
    return [] // private mode / storage blocked
  }
}

export async function removeQueued(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  notify()
}

export async function bumpAttempts(item: QueuedItem) {
  await tx('readwrite', (s) => s.put({ ...item, attempts: item.attempts + 1 }))
}

/** True when the error means "couldn't reach the server" (vs. a real rejection we shouldn't retry). */
export function isNetworkError(e: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch|NetworkError|Load failed|network|timed out|ERR_INTERNET|fetch failed/i.test(msg)
}

const listeners = new Set<() => void>()
export function onQueueChange(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function notify() {
  listeners.forEach((fn) => fn())
}
