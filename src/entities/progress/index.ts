export { BADGES, BADGES_BY_ID, getBadge, TRACK_CLEARED_BADGE } from './config/badges'
export type { Badge } from './config/badges'
export { currentWeek, dayKey, daysBetween, parseDayKey, recentDays } from './lib/dates'
export {
  averageStarsFor,
  earnsSpeedTrophy,
  recordTake,
  starsFor,
  takesInDays,
  totalStars,
  TROPHY_ACCURACY,
} from './lib/record'
export type { RecordContext, RecordResult } from './lib/record'
export { levelForXp, levelProgress, xpForLevel, xpForTake } from './lib/xp'
export type { LevelProgress } from './lib/xp'
export { PROGRESS_SLICE, useProgress } from './model/store'
export type { ProgressStore } from './model/store'
export {
  DEFAULT_WEEKLY_GOAL,
  EMPTY_PROGRESS,
} from './model/types'
export type { DrillProgress, ProgressState, StreakState, TakeOutcome } from './model/types'
