import type { Drill, Stars } from '../model/types'

/** Average stars across a track needed to unlock the next one (§11.1). */
export const TRACK_UNLOCK_STARS = 2

export interface StarOutcome {
  stars: Stars
  /**
   * True when the take was below the drill's target tempo. Accuracy still
   * shows, but stars are withheld — speed is part of the pass (§11.1).
   */
  lockedByTempo: boolean
  /** Accuracy still needed for the next star, or undefined at 3★. */
  nextThreshold: number | undefined
}

/**
 * Stars for a take (§11.1).
 *
 * Below the drill's target tempo nothing is awarded, however clean the take:
 * playing a groove slowly is a different skill from playing it up to speed,
 * and the star is the claim that you have the second one.
 */
export function computeStars(drill: Drill, accuracy: number, bpm: number): StarOutcome {
  const [one, two, three] = drill.starAccuracy
  const lockedByTempo = bpm < drill.targetBpm

  const earned: Stars = accuracy >= three ? 3 : accuracy >= two ? 2 : accuracy >= one ? 1 : 0
  const stars: Stars = lockedByTempo ? 0 : earned

  const nextThreshold =
    earned >= 3 ? undefined : earned === 2 ? three : earned === 1 ? two : one

  return { stars, lockedByTempo, nextThreshold }
}

/**
 * Average stars across a set of drills, counting unplayed drills as zero — a
 * track is not cleared by doing three of its five drills well.
 */
export function averageStars(starsByDrill: readonly number[]): number {
  if (starsByDrill.length === 0) return 0
  return starsByDrill.reduce((sum, stars) => sum + stars, 0) / starsByDrill.length
}

/**
 * Track gating (§11.1): the next track opens at an average of 2★ across the
 * current one. A soft gate — Watch mode can still preview anything, so this
 * only governs assessed drills.
 */
export function isTrackUnlocked(trackIndex: number, previousTrackAverage: number): boolean {
  if (trackIndex <= 1) return true
  return previousTrackAverage >= TRACK_UNLOCK_STARS
}
