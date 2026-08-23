import { BADGES, TRACK_CLEARED_BADGE } from '../config/badges'
import type { DrillProgress, ProgressState, TakeOutcome } from '../model/types'
import { dayKey, daysBetween } from './dates'
import { xpForTake } from './xp'

/** Accuracy at or above which a tempo counts as held (§11.2). */
export const TROPHY_ACCURACY = 90

/** Does this take set a new personal-best tempo? */
export function earnsSpeedTrophy(accuracy: number, bpm: number, currentBest: number): boolean {
  return accuracy >= TROPHY_ACCURACY && bpm > currentBest
}

export interface RecordContext {
  /** Every drill in the take's track, for the track-cleared badge. */
  trackDrillIds: readonly string[]
  /** Average stars that clears a track; supplied by the curriculum. */
  trackClearedStars: number
}

export interface RecordResult {
  progress: ProgressState
  /** Badges earned by this take — what the results screen celebrates. */
  newBadges: string[]
  xpGained: number
  /** True when this take beat the drill's stored tempo record. */
  speedTrophy: boolean
}

function emptyDrill(drillId: string): DrillProgress {
  return { drillId, stars: 0, bestAccuracy: 0, bestBpm: 0, attempts: 0 }
}

/**
 * Advance the streak for a take on `today` (§11.2).
 *
 * A second take on the same day changes nothing; a take the next day extends
 * it; any longer gap starts again at one. Days are local, because a streak is
 * about the user's day.
 */
function advanceStreak(streak: ProgressState['streak'], today: string): ProgressState['streak'] {
  if (streak.lastDay === today) return streak

  const gap = streak.lastDay ? daysBetween(streak.lastDay, today) : undefined
  const current = gap === 1 ? streak.current + 1 : 1
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastDay: today,
  }
}

/**
 * Apply one assessed take to the stored progress (§11.2).
 *
 * Pure, and everything it records is a high-water mark: stars, best accuracy
 * and best tempo only ever go up, and badges are only ever added. A bad take
 * costs the player nothing they had already earned — it just does not add.
 */
export function recordTake(
  state: ProgressState,
  outcome: TakeOutcome,
  context: RecordContext,
): RecordResult {
  const today = dayKey(outcome.at)
  const existing = state.drills[outcome.drillId] ?? emptyDrill(outcome.drillId)
  const speedTrophy = earnsSpeedTrophy(outcome.accuracy, outcome.bpm, existing.bestBpm)

  const drill: DrillProgress = {
    drillId: outcome.drillId,
    stars: Math.max(existing.stars, outcome.stars),
    bestAccuracy: Math.max(existing.bestAccuracy, outcome.accuracy),
    bestBpm: speedTrophy ? outcome.bpm : existing.bestBpm,
    attempts: existing.attempts + 1,
    lastPlayedAt: outcome.at.toISOString(),
  }

  const xpGained = xpForTake({ score: outcome.score, stars: outcome.stars })
  const perfectsToday = (state.perfectsByDay[today] ?? 0) + outcome.perfectCount

  const progress: ProgressState = {
    ...state,
    drills: { ...state.drills, [outcome.drillId]: drill },
    xp: state.xp + xpGained,
    streak: advanceStreak(state.streak, today),
    history: { ...state.history, [today]: (state.history[today] ?? 0) + 1 },
    perfectsByDay: { ...state.perfectsByDay, [today]: perfectsToday },
  }

  // Track cleared: the average across every drill in the track, counting
  // unplayed ones as zero.
  const trackStars = context.trackDrillIds.map((id) => progress.drills[id]?.stars ?? 0)
  const trackAverage =
    trackStars.length === 0 ? 0 : trackStars.reduce((sum, stars) => sum + stars, 0) / trackStars.length

  const newBadges: string[] = []
  for (const badge of BADGES) {
    if (progress.badges.includes(badge.id)) continue
    const earned =
      badge.id === TRACK_CLEARED_BADGE
        ? trackAverage >= context.trackClearedStars
        : badge.earned({ outcome, progress, perfectsToday })
    if (earned) newBadges.push(badge.id)
  }

  return {
    progress: newBadges.length > 0 ? { ...progress, badges: [...progress.badges, ...newBadges] } : progress,
    newBadges,
    xpGained,
    speedTrophy,
  }
}

/** Takes logged this week, against the weekly goal (§11.2). */
export function takesInDays(state: ProgressState, days: readonly string[]): number {
  return days.reduce((sum, day) => sum + (state.history[day] ?? 0), 0)
}

/** Average stars across a set of drills, unplayed counting as zero. */
export function averageStarsFor(state: ProgressState, drillIds: readonly string[]): number {
  if (drillIds.length === 0) return 0
  const total = drillIds.reduce((sum, id) => sum + (state.drills[id]?.stars ?? 0), 0)
  return total / drillIds.length
}

export function starsFor(state: ProgressState, drillId: string): number {
  return state.drills[drillId]?.stars ?? 0
}

export function totalStars(state: ProgressState): number {
  return Object.values(state.drills).reduce((sum, drill) => sum + drill.stars, 0)
}
