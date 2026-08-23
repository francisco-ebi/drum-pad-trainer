import { SCHEDULER } from '@/shared/config'
import type { Clock } from '@/shared/lib/transport'

export interface LookaheadSchedulerOptions {
  clock: Clock
  /** Called every tick with the window `[now, now + lookahead)` in clock seconds. */
  onWindow: (windowStart: number, windowEnd: number) => void
  intervalMs?: number
  lookaheadSec?: number
}

export interface LookaheadScheduler {
  start(): void
  stop(): void
  /** Force an immediate window pass (used on play, seek and tempo edits). */
  flush(): void
  readonly running: boolean
}

/** The "Tale of Two Clocks" scheduler (§7.3): a coarse interval timer that
 *  hands out a short lookahead window, inside which events are placed at exact
 *  clock timestamps. Main-thread jank shifts *when we schedule*, never *when
 *  the sound happens*. */
export function createLookaheadScheduler({
  clock,
  onWindow,
  intervalMs = SCHEDULER.intervalMs,
  lookaheadSec = SCHEDULER.lookaheadSec,
}: LookaheadSchedulerOptions): LookaheadScheduler {
  let timer: ReturnType<typeof setInterval> | undefined

  const tick = () => {
    const now = clock.now()
    onWindow(now, now + lookaheadSec)
  }

  return {
    start() {
      if (timer !== undefined) return
      timer = setInterval(tick, intervalMs)
      tick()
    },
    stop() {
      if (timer === undefined) return
      clearInterval(timer)
      timer = undefined
    },
    flush: tick,
    get running() {
      return timer !== undefined
    },
  }
}
