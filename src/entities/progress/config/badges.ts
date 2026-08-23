import type { ProgressState, TakeOutcome } from '../model/types'

export interface Badge {
  id: string
  title: string
  description: string
  /** Emoji stand-in; a real icon set is a later concern. */
  icon: string
  /**
   * Has this badge been earned? Receives the take just recorded and the
   * progress state *after* it was applied.
   */
  earned: (context: { outcome: TakeOutcome; progress: ProgressState; perfectsToday: number }) => boolean
}

/**
 * Badges are additive only — nothing is ever taken away (§11.2), so each rule
 * only ever answers "has this happened by now", never "is this still true".
 */
export const BADGES: readonly Badge[] = [
  {
    id: 'first-three-star',
    title: 'First 3★',
    description: 'Earn three stars on any drill.',
    icon: '⭐',
    earned: ({ outcome }) => outcome.stars >= 3,
  },
  {
    id: 'combo-50',
    title: '50 combo',
    description: 'Land fifty clean hits in a row.',
    icon: '🔥',
    earned: ({ outcome }) => outcome.maxCombo >= 50,
  },
  {
    id: 'hundred-perfects',
    title: '100 Perfects in a day',
    description: 'A hundred Perfect judgments inside one day.',
    icon: '🎯',
    earned: ({ perfectsToday }) => perfectsToday >= 100,
  },
  {
    id: 'streak-7',
    title: '7-day streak',
    description: 'Practise seven days running.',
    icon: '📅',
    earned: ({ progress }) => progress.streak.current >= 7,
  },
  {
    id: 'ambidextrous',
    title: 'Ambidextrous',
    description: 'Three stars on a strict-hands drill.',
    icon: '🤲',
    earned: ({ outcome }) => outcome.strictHands && outcome.stars >= 3,
  },
  {
    id: 'track-cleared',
    title: 'Track cleared',
    description: 'Average two stars across a whole track.',
    icon: '🏁',
    // Awarded by the recorder, which knows the track's drills; see progress/lib.
    earned: () => false,
  },
]

export const BADGES_BY_ID: ReadonlyMap<string, Badge> = new Map(
  BADGES.map((badge) => [badge.id, badge]),
)

export const TRACK_CLEARED_BADGE = 'track-cleared'

export function getBadge(id: string): Badge | undefined {
  return BADGES_BY_ID.get(id)
}
