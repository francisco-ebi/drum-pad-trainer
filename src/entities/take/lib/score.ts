import type { Grade, Judgment } from '../model/types'

/** Points per judgment, before the combo multiplier (§10.3). */
export const POINTS: Record<Grade, number> = {
  perfect: 100,
  good: 60,
  miss: 0,
  wrongPad: 0,
  extra: -10,
}

/** Combo counts at which the multiplier steps up (§10.3). */
export const COMBO_STEPS = [10, 25, 50] as const

/** Letter grades (§10.3). */
export const GRADE_THRESHOLDS: readonly (readonly [string, number])[] = [
  ['S', 97],
  ['A', 92],
  ['B', 85],
  ['C', 75],
]

export function comboMultiplier(combo: number): number {
  let multiplier = 1
  for (const step of COMBO_STEPS) {
    if (combo >= step) multiplier += 1
  }
  return multiplier
}

/**
 * Does this judgment continue a combo?
 *
 * §10.3 defines the combo as "consecutive Perfect/Good hits", so anything else
 * — Miss, Wrong-pad, and a stray Extra — ends the run.
 */
export function continuesCombo(grade: Grade): boolean {
  return grade === 'perfect' || grade === 'good'
}

export function gradeLetter(accuracy: number): string {
  for (const [letter, threshold] of GRADE_THRESHOLDS) {
    if (accuracy >= threshold) return letter
  }
  return 'D'
}

/**
 * Accuracy as a percentage of the points available (§10.3).
 *
 * The combo multiplier is deliberately excluded: accuracy is the star metric,
 * so it has to mean the same thing on a 4-step drill and a 64-step groove.
 */
export function accuracyOf(earnedPoints: number, expectedCount: number): number {
  if (expectedCount === 0) return 0
  const max = expectedCount * POINTS.perfect
  return Math.max(0, Math.min(100, (Math.max(0, earnedPoints) / max) * 100))
}

/** Raw points a judgment contributes to accuracy, ignoring the multiplier. */
export function accuracyPoints(judgment: Judgment): number {
  return judgment.points
}

/**
 * Accuracy over a single pass through the loop — what the tempo ladder counts
 * as a clean loop (§9.2).
 *
 * Every expected hit produces exactly one judgment (matched, wrong-padded or
 * missed), so the judgments carrying `expected.loop === loop` are both the
 * numerator and, in count, the denominator. Stray Extras belong to no loop and
 * are left out: the ladder asks "did you play the loop", not "did you also
 * knock the rim on the way past".
 */
export function loopAccuracy(judgments: readonly Judgment[], loop: number): number {
  const forLoop = judgments.filter((judgment) => judgment.expected?.loop === loop)
  if (forLoop.length === 0) return 0
  const earned = forLoop.reduce((sum, judgment) => sum + judgment.points, 0)
  return accuracyOf(earned, forLoop.length)
}
