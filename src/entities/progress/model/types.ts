/** What is remembered about one drill (§11.2, §14). */
export interface DrillProgress {
  drillId: string
  /** Best stars ever earned — never taken away. */
  stars: number
  bestAccuracy: number
  /** Best tempo held at 90 % or better: the speed trophy (§11.2). */
  bestBpm: number
  attempts: number
  /** ISO timestamp of the most recent assessed take. */
  lastPlayedAt?: string
}

export interface StreakState {
  current: number
  longest: number
  /** ISO date (YYYY-MM-DD) of the most recent day with an assessed take. */
  lastDay?: string
}

export interface ProgressState {
  drills: Record<string, DrillProgress>
  xp: number
  /** Badge ids, additive only — nothing is ever lost (§11.2). */
  badges: string[]
  streak: StreakState
  /** ISO date -> assessed takes that day, for the heatmap (§11.2). */
  history: Record<string, number>
  /** Takes per week the user is aiming for (§11.2). */
  weeklyGoal: number
  /** Perfect judgments per day, for the "100 Perfects in a day" badge. */
  perfectsByDay: Record<string, number>
}

export const DEFAULT_WEEKLY_GOAL = 5

export const EMPTY_PROGRESS: ProgressState = {
  drills: {},
  xp: 0,
  badges: [],
  streak: { current: 0, longest: 0 },
  history: {},
  weeklyGoal: DEFAULT_WEEKLY_GOAL,
  perfectsByDay: {},
}

/** One assessed take, reduced to what progress cares about. */
export interface TakeOutcome {
  drillId: string
  trackId: string
  accuracy: number
  score: number
  bpm: number
  stars: number
  maxCombo: number
  perfectCount: number
  strictHands: boolean
  /** ISO timestamp; injected so the rules stay pure and testable. */
  at: Date
}
