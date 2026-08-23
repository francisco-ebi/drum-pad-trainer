import { TIMING_WINDOWS } from '@/shared/config'

export interface TimingWindows {
  perfectSec: number
  goodSec: number
}

/**
 * Judging windows for a tempo (§10.2).
 *
 * The windows are fixed in milliseconds, then clamped to a fraction of the
 * step so they can never overlap a neighbouring step: at 200 BPM sixteenths a
 * step is 75 ms, and an unclamped ±70 ms "Good" would reach almost two steps
 * either side, making it impossible to play anything wrong.
 */
export function windowsFor(secondsPerStep: number): TimingWindows {
  return {
    perfectSec: Math.min(TIMING_WINDOWS.perfectMs / 1000, TIMING_WINDOWS.perfectStepFraction * secondsPerStep),
    goodSec: Math.min(TIMING_WINDOWS.goodMs / 1000, TIMING_WINDOWS.goodStepFraction * secondsPerStep),
  }
}

/** True once a hit is too far out to be Good — i.e. a Miss (§10.2). */
export function isOutsideGood(offsetSec: number, windows: TimingWindows): boolean {
  return Math.abs(offsetSec) > windows.goodSec
}
