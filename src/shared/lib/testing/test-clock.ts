import { vi } from 'vitest'
import { SCHEDULER } from '@/shared/config'
import type { Clock } from '@/shared/lib/transport'

/** A hand-cranked master clock: tests own time, so scheduling is deterministic. */
export class TestClock implements Clock {
  constructor(private time = 0) {}

  now(): number {
    return this.time
  }

  advance(seconds: number): void {
    this.time += seconds
  }
}

/**
 * Advance clock and timers together in scheduler-sized slices, so the
 * lookahead scheduler wakes up exactly as it would in a browser.
 * Requires `vi.useFakeTimers()`.
 */
export function runFor(clock: TestClock, seconds: number, sliceMs = SCHEDULER.intervalMs): void {
  const slices = Math.ceil((seconds * 1000) / sliceMs)
  for (let i = 0; i < slices; i++) {
    clock.advance(sliceMs / 1000)
    vi.advanceTimersByTime(sliceMs)
  }
}
