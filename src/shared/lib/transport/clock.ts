/** The master clock (§7.3). Everything schedulable reads time from here so
 *  audio and visuals can never disagree about "now". */
export interface Clock {
  /** Monotonic seconds. */
  now(): number
}

export function audioClock(ctx: BaseAudioContext): Clock {
  return { now: () => ctx.currentTime }
}

/** The `performance.now()` timeline, in seconds — the timeline input events
 *  (MIDI `timeStamp`, keyboard events) are stamped on. */
export function performanceClock(): Clock {
  return { now: () => performance.now() / 1000 }
}

/**
 * A paired reading of both timelines (§8.2). Captured at transport start, it
 * is what lets an input event stamped on the performance timeline be judged
 * against audio scheduled on the AudioContext timeline.
 */
export interface TimeAnchor {
  /** performance-timeline seconds */
  perfSec: number
  /** audio-clock seconds */
  audioSec: number
}

/**
 * Read both clocks back to back. The gap between the two reads is sub-microsecond
 * and is absorbed by latency calibration (§8.3) either way.
 *
 * Where the audio clock comes from an AudioContext, `AudioEngine.captureAnchor()`
 * prefers `getOutputTimestamp()`, which correlates the two timelines at the
 * output rather than at the call site.
 */
export function captureAnchor(clock: Clock, perfClock: Clock): TimeAnchor {
  return { perfSec: perfClock.now(), audioSec: clock.now() }
}

/**
 * Prefer an `AudioContext.getOutputTimestamp()` pairing, falling back when the
 * browser has not filled one in.
 *
 * Before any audio has been played, Chrome reports `{contextTime: 0,
 * performanceTime: 0}` — structurally valid and completely wrong, since the
 * performance timeline has certainly not just started. Taking it at face value
 * would offset every judged hit by the page's entire uptime, so a zero
 * `performanceTime` is treated as "not available yet".
 */
export function anchorFromOutputTimestamp(
  timestamp: AudioTimestamp | undefined,
  fallback: () => TimeAnchor,
): TimeAnchor {
  if (
    timestamp &&
    typeof timestamp.contextTime === 'number' &&
    typeof timestamp.performanceTime === 'number' &&
    timestamp.performanceTime > 0
  ) {
    return { audioSec: timestamp.contextTime, perfSec: timestamp.performanceTime / 1000 }
  }
  return fallback()
}
