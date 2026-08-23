import { defaultStorage, type KeyValueStorage } from './storage'

/** Everything is stored under a versioned envelope so a schema change can be
 *  migrated rather than discarded (§14). */
export interface Envelope<T> {
  version: number
  data: T
}

export interface PersistedSlice<T> {
  /** localStorage key, namespaced by the app prefix. */
  key: string
  version: number
  /** Used on first run, and whenever stored data cannot be salvaged. */
  fallback: () => T
  /**
   * Upgrade data written by an older version. Return undefined to give up on
   * it, which falls back to a clean value rather than crashing the app.
   */
  migrate?: (data: unknown, fromVersion: number) => T | undefined
}

export const STORAGE_PREFIX = 'dpt'

export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}:${name}`
}

export function loadSlice<T>(slice: PersistedSlice<T>, storage: KeyValueStorage = defaultStorage()): T {
  const raw = storage.getItem(slice.key)
  if (raw === null) return slice.fallback()

  let envelope: Envelope<unknown>
  try {
    envelope = JSON.parse(raw) as Envelope<unknown>
  } catch {
    return slice.fallback()
  }
  if (typeof envelope !== 'object' || envelope === null || typeof envelope.version !== 'number') {
    return slice.fallback()
  }
  if (envelope.version === slice.version) return envelope.data as T
  if (envelope.version > slice.version) return slice.fallback() // written by a newer build
  return slice.migrate?.(envelope.data, envelope.version) ?? slice.fallback()
}

export function saveSlice<T>(
  slice: PersistedSlice<T>,
  value: T,
  storage: KeyValueStorage = defaultStorage(),
): void {
  const envelope: Envelope<T> = { version: slice.version, data: value }
  try {
    storage.setItem(slice.key, JSON.stringify(envelope))
  } catch {
    // Quota or a blocked store: losing a preference must never break a take.
  }
}

export function clearSlice(slice: PersistedSlice<unknown>, storage: KeyValueStorage = defaultStorage()): void {
  storage.removeItem(slice.key)
}

/** One JSON file holding every slice — the Settings export/import and the
 *  backup story until cloud sync exists (§14). */
export interface Backup {
  app: 'drum-pad-trainer'
  exportedAt: string
  slices: Record<string, Envelope<unknown>>
}

export function exportBackup(
  slices: PersistedSlice<unknown>[],
  storage: KeyValueStorage = defaultStorage(),
): Backup {
  const out: Record<string, Envelope<unknown>> = {}
  for (const slice of slices) {
    const raw = storage.getItem(slice.key)
    if (raw === null) continue
    try {
      out[slice.key] = JSON.parse(raw) as Envelope<unknown>
    } catch {
      // Skip anything unreadable rather than exporting corruption.
    }
  }
  return { app: 'drum-pad-trainer', exportedAt: new Date().toISOString(), slices: out }
}

export function isBackup(value: unknown): value is Backup {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Backup>
  return candidate.app === 'drum-pad-trainer' && typeof candidate.slices === 'object' && candidate.slices !== null
}

/** Restore a backup, returning the keys written. Unknown keys are ignored so
 *  a file from a newer build cannot inject arbitrary storage entries. */
export function importBackup(
  backup: unknown,
  slices: PersistedSlice<unknown>[],
  storage: KeyValueStorage = defaultStorage(),
): string[] {
  if (!isBackup(backup)) throw new Error('Not a Drum Pad Trainer backup file')
  const known = new Set(slices.map((slice) => slice.key))
  const written: string[] = []
  for (const [key, envelope] of Object.entries(backup.slices)) {
    if (!known.has(key)) continue
    storage.setItem(key, JSON.stringify(envelope))
    written.push(key)
  }
  return written
}
