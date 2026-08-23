import { describe, expect, it } from 'vitest'
import { EMPTY_PROGRESS, PROGRESS_SLICE, recordTake, type ProgressState } from '@/entities/progress'
import { exportBackup, importBackup, loadSlice, saveSlice, memoryStorage } from '@/shared/lib/persist'
import { backupFilename, parseBackup } from './transfer'

const SLICES = [PROGRESS_SLICE as never]

function playedProgress(): ProgressState {
  return recordTake(
    EMPTY_PROGRESS,
    {
      drillId: 'foundations-quarter-kick',
      trackId: 'foundations',
      accuracy: 97,
      score: 4200,
      bpm: 90,
      stars: 3,
      maxCombo: 30,
      perfectCount: 40,
      strictHands: false,
      at: new Date(2026, 7, 20, 10, 0),
    },
    { trackDrillIds: ['foundations-quarter-kick'], trackClearedStars: 2 },
  ).progress
}

describe('export → wipe → import (§16 M3 accept)', () => {
  it('restores everything the user had', () => {
    const storage = memoryStorage()
    const played = playedProgress()
    saveSlice(PROGRESS_SLICE, played, storage)

    const backup = exportBackup(SLICES, storage)
    // A full wipe, as the Settings panel does it.
    saveSlice(PROGRESS_SLICE, EMPTY_PROGRESS, storage)
    expect(loadSlice(PROGRESS_SLICE, storage).xp).toBe(0)

    // Round-tripped through a file, as an import really would be.
    const written = importBackup(parseBackup(JSON.stringify(backup)), SLICES, storage)
    expect(written).toContain(PROGRESS_SLICE.key)

    const restored = loadSlice(PROGRESS_SLICE, storage)
    expect(restored.xp).toBe(played.xp)
    expect(restored.badges).toEqual(played.badges)
    expect(restored.streak).toEqual(played.streak)
    expect(restored.drills).toEqual(played.drills)
    expect(restored.history).toEqual(played.history)
  })

  it('refuses a file that is not a backup', () => {
    expect(() => importBackup(parseBackup('{"hello":"world"}'), SLICES, memoryStorage())).toThrow(
      /backup file/,
    )
  })

  it('names the file by date', () => {
    expect(backupFilename(new Date(2026, 7, 20))).toMatch(/^drum-pad-trainer-2026-08-\d{2}\.json$/)
  })
})
