/** Judging windows (§10.2). Fixed milliseconds, clamped as a fraction of the
 *  step duration so they can never overlap a neighbouring step at high tempo. */
export const TIMING_WINDOWS = {
  perfectMs: 35,
  goodMs: 70,
  /** Perfect never exceeds this fraction of one step. */
  perfectStepFraction: 0.4,
  /** Good never exceeds this fraction of one step. */
  goodStepFraction: 0.45,
} as const

/** Lookahead scheduler constants (§7.3, "Tale of Two Clocks"). */
export const SCHEDULER = {
  /** How often the interval timer wakes up. */
  intervalMs: 25,
  /** How far ahead of the clock events are scheduled. */
  lookaheadSec: 0.1,
} as const

/** Same-note retrigger guard for pad double-fires (§8.1). */
export const MIDI_DEBOUNCE_MS = 30
