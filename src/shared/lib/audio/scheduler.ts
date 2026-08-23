import { SCHEDULER } from '@/shared/config'
import type { Clock } from '@/shared/lib/transport'
import { defaultTickSource, type TickSource } from './tick-source'

export interface LookaheadSchedulerOptions {
  clock: Clock
  /** Called every tick with the window `[now, now + lookahead)` in clock seconds. */
  onWindow: (windowStart: number, windowEnd: number) => void
  intervalMs?: number
  lookaheadSec?: number
  /** Heartbeat source; defaults to a worker timer, falling back to setInterval. */
  tickSource?: TickSource
}

export interface LookaheadScheduler {
  start(): void
  stop(): void
  /** Force an immediate window pass (used on play, seek and tempo edits). */
  flush(): void
  /** Stop and release the tick source. */
  dispose(): void
  readonly running: boolean
  readonly tickKind: TickSource['kind']
}

/** The "Tale of Two Clocks" scheduler (§7.3): a coarse timer that hands out a
 *  short lookahead window, inside which events are placed at exact clock
 *  timestamps. Main-thread jank shifts *when we schedule*, never *when the
 *  sound happens* — and the tick itself runs off the main thread, so a hidden
 *  tab cannot throttle it into dropouts. */
export function createLookaheadScheduler({
  clock,
  onWindow,
  intervalMs = SCHEDULER.intervalMs,
  lookaheadSec = SCHEDULER.lookaheadSec,
  tickSource,
}: LookaheadSchedulerOptions): LookaheadScheduler {
  const source = tickSource ?? defaultTickSource()
  let running = false

  const tick = () => {
    const now = clock.now()
    onWindow(now, now + lookaheadSec)
  }

  return {
    start() {
      if (running) return
      running = true
      source.start(intervalMs, tick)
      tick()
    },
    stop() {
      if (!running) return
      running = false
      source.stop()
    },
    flush: tick,
    dispose() {
      running = false
      source.dispose()
    },
    get running() {
      return running
    },
    get tickKind() {
      return source.kind
    },
  }
}
