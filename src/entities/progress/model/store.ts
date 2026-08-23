import { create } from 'zustand'
import { loadSlice, saveSlice, storageKey, type PersistedSlice } from '@/shared/lib/persist'
import { recordTake, type RecordContext, type RecordResult } from '../lib/record'
import { EMPTY_PROGRESS, type ProgressState, type TakeOutcome } from './types'

export const PROGRESS_SLICE: PersistedSlice<ProgressState> = {
  key: storageKey('progress'),
  version: 1,
  fallback: () => EMPTY_PROGRESS,
}

export interface ProgressStore {
  progress: ProgressState
  /** The badges awarded by the most recent take, for the results screen. */
  lastAward: Pick<RecordResult, 'newBadges' | 'xpGained' | 'speedTrophy'> | undefined

  record: (outcome: TakeOutcome, context: RecordContext) => RecordResult
  setWeeklyGoal: (takes: number) => void
  /** Replace everything — used by import (§14). */
  replace: (progress: ProgressState) => void
  reset: () => void
  clearAward: () => void
}

export const useProgress = create<ProgressStore>()((set, get) => ({
  progress: loadSlice(PROGRESS_SLICE),
  lastAward: undefined,

  record(outcome, context) {
    const result = recordTake(get().progress, outcome, context)
    saveSlice(PROGRESS_SLICE, result.progress)
    set({
      progress: result.progress,
      lastAward: {
        newBadges: result.newBadges,
        xpGained: result.xpGained,
        speedTrophy: result.speedTrophy,
      },
    })
    return result
  },

  setWeeklyGoal(takes) {
    const progress = { ...get().progress, weeklyGoal: Math.max(1, Math.round(takes)) }
    saveSlice(PROGRESS_SLICE, progress)
    set({ progress })
  },

  replace(progress) {
    saveSlice(PROGRESS_SLICE, progress)
    set({ progress, lastAward: undefined })
  },

  reset() {
    saveSlice(PROGRESS_SLICE, EMPTY_PROGRESS)
    set({ progress: EMPTY_PROGRESS, lastAward: undefined })
  },

  clearAward() {
    set({ lastAward: undefined })
  },
}))
