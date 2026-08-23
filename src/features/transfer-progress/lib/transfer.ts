import { DEVICE_SLICE } from '@/entities/device'
import { EMPTY_PROGRESS, PROGRESS_SLICE, useProgress, type ProgressState } from '@/entities/progress'
import {
  exportBackup,
  importBackup,
  loadSlice,
  type Backup,
  type PersistedSlice,
} from '@/shared/lib/persist'

/** Everything a backup carries: progress and per-device settings (§14). */
const SLICES: PersistedSlice<unknown>[] = [
  PROGRESS_SLICE as PersistedSlice<unknown>,
  DEVICE_SLICE as PersistedSlice<unknown>,
]

export function buildBackup(): Backup {
  return exportBackup(SLICES)
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `drum-pad-trainer-${stamp}.json`
}

/**
 * Restore a backup and refresh the live stores.
 *
 * Storage is written first and the stores re-read from it, so what the user
 * sees afterwards is exactly what was persisted — never a half-applied import
 * that disagrees with the file on the next reload.
 */
export function restoreBackup(raw: unknown): { restored: string[] } {
  const restored = importBackup(raw, SLICES)
  useProgress.getState().replace(loadSlice(PROGRESS_SLICE))
  // Device settings are read at store creation, so a reload is the honest way
  // to apply them; the panel says so.
  return { restored }
}

/** Wipe everything back to a first-run state (§14, and the M3 accept path). */
export function wipeProgress(): void {
  useProgress.getState().replace(EMPTY_PROGRESS)
}

export function parseBackup(text: string): unknown {
  return JSON.parse(text) as unknown
}

export type { ProgressState }
