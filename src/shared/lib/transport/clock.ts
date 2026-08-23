/** The master clock (§7.3). Everything schedulable reads time from here so
 *  audio and visuals can never disagree about "now". */
export interface Clock {
  /** Monotonic seconds. */
  now(): number
}

export function audioClock(ctx: BaseAudioContext): Clock {
  return { now: () => ctx.currentTime }
}
