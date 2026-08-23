import { describe, expect, it } from 'vitest'
import {
  clearSlice,
  exportBackup,
  importBackup,
  isBackup,
  loadSlice,
  saveSlice,
  storageKey,
  type PersistedSlice,
} from './persisted'
import { memoryStorage } from './storage'

interface Prefs {
  bpm: number
}

const slice: PersistedSlice<Prefs> = {
  key: storageKey('prefs'),
  version: 2,
  fallback: () => ({ bpm: 80 }),
  migrate: (data, from) => (from === 1 ? { bpm: (data as { tempo: number }).tempo } : undefined),
}

describe('versioned persistence', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(loadSlice(slice, memoryStorage())).toEqual({ bpm: 80 })
  })

  it('round-trips a value', () => {
    const storage = memoryStorage()
    saveSlice(slice, { bpm: 132 }, storage)
    expect(loadSlice(slice, storage)).toEqual({ bpm: 132 })
  })

  it('migrates data written by an older version', () => {
    const storage = memoryStorage()
    storage.setItem(slice.key, JSON.stringify({ version: 1, data: { tempo: 96 } }))
    expect(loadSlice(slice, storage)).toEqual({ bpm: 96 })
  })

  it('falls back when a migration declines the data', () => {
    const storage = memoryStorage()
    storage.setItem(slice.key, JSON.stringify({ version: 0, data: { nonsense: true } }))
    expect(loadSlice(slice, storage)).toEqual({ bpm: 80 })
  })

  it('falls back on data from a newer build, rather than misreading it', () => {
    const storage = memoryStorage()
    storage.setItem(slice.key, JSON.stringify({ version: 99, data: { bpm: 1 } }))
    expect(loadSlice(slice, storage)).toEqual({ bpm: 80 })
  })

  it('falls back on corrupt JSON and on a missing envelope', () => {
    const storage = memoryStorage()
    storage.setItem(slice.key, '{not json')
    expect(loadSlice(slice, storage)).toEqual({ bpm: 80 })
    storage.setItem(slice.key, JSON.stringify({ data: { bpm: 1 } }))
    expect(loadSlice(slice, storage)).toEqual({ bpm: 80 })
  })

  it('clears a slice', () => {
    const storage = memoryStorage()
    saveSlice(slice, { bpm: 120 }, storage)
    clearSlice(slice, storage)
    expect(loadSlice(slice, storage)).toEqual({ bpm: 80 })
  })

  it('survives a storage that throws on write', () => {
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
    }
    expect(() => saveSlice(slice, { bpm: 100 }, hostile)).not.toThrow()
  })
})

describe('backup export and import', () => {
  it('exports every stored slice and restores it (§14 export → wipe → import)', () => {
    const source = memoryStorage()
    saveSlice(slice, { bpm: 144 }, source)
    const backup = exportBackup([slice as PersistedSlice<unknown>], source)
    expect(isBackup(backup)).toBe(true)

    // A full wipe, then a restore from the file.
    clearSlice(slice, source)
    expect(loadSlice(slice, source)).toEqual({ bpm: 80 })

    const written = importBackup(JSON.parse(JSON.stringify(backup)), [slice as PersistedSlice<unknown>], source)
    expect(written).toEqual([slice.key])
    expect(loadSlice(slice, source)).toEqual({ bpm: 144 })
  })

  it('skips slices that are not stored', () => {
    const backup = exportBackup([slice as PersistedSlice<unknown>], memoryStorage())
    expect(backup.slices).toEqual({})
  })

  it('ignores unknown keys in an imported file', () => {
    const storage = memoryStorage()
    const written = importBackup(
      { app: 'drum-pad-trainer', exportedAt: 'x', slices: { 'evil:key': { version: 1, data: 1 } } },
      [slice as PersistedSlice<unknown>],
      storage,
    )
    expect(written).toEqual([])
    expect(storage.getItem('evil:key')).toBeNull()
  })

  it('rejects a file that is not a backup', () => {
    expect(() => importBackup({ hello: 'world' }, [], memoryStorage())).toThrow(/backup file/)
    expect(isBackup(null)).toBe(false)
  })
})
