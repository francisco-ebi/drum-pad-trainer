import type { Hand, Voice } from '@/entities/pattern/@x/take'
import type { PadIndex } from '@/shared/config'

/** The outcome of matching one user hit against one expected hit (§2, §10). */
export type Grade = 'perfect' | 'good' | 'miss' | 'wrongPad' | 'extra'

/** Which side of the beat a non-Perfect hit fell on (§10.2). */
export type Direction = 'early' | 'late'

/**
 * One note the pattern asks for, placed on the audio clock.
 *
 * A take is several loops, so the same pattern step appears once per pass —
 * `loop` is what keeps them distinct.
 */
export interface ExpectedHit {
  id: string
  voice: Voice
  hand: Hand
  pad: PadIndex
  /** Audio-clock seconds (§7.3), as scheduled. */
  time: number
  patternStep: number
  loop: number
}

/** One strike by the player, already resolved to a pad and corrected for
 *  device latency (§8.3) — the judge only ever sees calibrated times. */
export interface UserHit {
  pad: PadIndex
  /** The voice under that pad, or undefined if the pad maps to nothing. */
  voice: Voice | undefined
  velocity: number
  /** Audio-clock seconds, calibration applied. */
  time: number
}

export interface Judgment {
  grade: Grade
  /** Absent on a Miss — nobody played it. */
  hit?: UserHit
  /** Absent on an Extra — it matched nothing. */
  expected?: ExpectedHit
  /** Signed seconds; negative is early. Only for matched hits. */
  offsetSec?: number
  direction?: Direction
  /** Points before the combo multiplier (§10.3). */
  points: number
  /** Combo multiplier in force when this was judged. */
  multiplier: number
}

export interface JudgeConfig {
  /** Step duration at the take's tempo — clamps the windows (§10.2). */
  secondsPerStep: number
  /** Require the exact pad, not merely the right voice (§4.2). */
  strictHands: boolean
  /** Level-1 drills switch the Extra penalty off (§10.3). */
  penalizeExtras: boolean
  /** Grace before an unplayed hit is settled as a Miss, absorbing the frame
   *  of latency between an input event and the next settle pass. */
  settleGraceSec: number
}

export const DEFAULT_JUDGE_CONFIG: Omit<JudgeConfig, 'secondsPerStep'> = {
  strictHands: false,
  penalizeExtras: true,
  settleGraceSec: 0.005,
}

export interface TakeStats {
  score: number
  combo: number
  maxCombo: number
  multiplier: number
  /** Rolling accuracy over what has been judged so far, 0–100. */
  accuracy: number
  counts: Record<Grade, number>
  /** Expected hits resolved so far (matched, wrong-padded or missed). */
  resolved: number
  /** Expected hits handed to the judge in total. */
  expected: number
}
