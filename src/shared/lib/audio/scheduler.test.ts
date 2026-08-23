import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runFor, TestClock } from '@/shared/lib/testing'
import { createLookaheadScheduler } from './scheduler'
import { defaultTickSource, intervalTickSource, workerTickSource } from './tick-source'

describe('lookahead scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hands out a window reaching one lookahead past now', () => {
    const clock = new TestClock()
    const windows: [number, number][] = []
    const scheduler = createLookaheadScheduler({
      clock,
      tickSource: intervalTickSource(),
      lookaheadSec: 0.1,
      onWindow: (start, end) => windows.push([start, end]),
    })

    scheduler.start()
    expect(windows).toHaveLength(1) // start() flushes immediately
    expect(windows[0]).toEqual([0, 0.1])

    runFor(clock, 0.1)
    expect(windows.length).toBeGreaterThan(3)
    for (const [start, end] of windows) expect(end - start).toBeCloseTo(0.1, 12)
    scheduler.dispose()
  })

  it('stops and restarts cleanly, and reports its heartbeat', () => {
    const clock = new TestClock()
    let ticks = 0
    const scheduler = createLookaheadScheduler({
      clock,
      tickSource: intervalTickSource(),
      onWindow: () => {
        ticks++
      },
    })

    expect(scheduler.running).toBe(false)
    expect(scheduler.tickKind).toBe('interval')
    scheduler.start()
    expect(scheduler.running).toBe(true)
    runFor(clock, 0.1)
    const afterRun = ticks

    scheduler.stop()
    runFor(clock, 0.5)
    expect(ticks).toBe(afterRun) // no ticks while stopped
    expect(scheduler.running).toBe(false)

    scheduler.start()
    runFor(clock, 0.1)
    expect(ticks).toBeGreaterThan(afterRun)
    scheduler.dispose()
  })

  it('flushes a window on demand without a running timer', () => {
    const clock = new TestClock()
    let ticks = 0
    const scheduler = createLookaheadScheduler({
      clock,
      tickSource: intervalTickSource(),
      onWindow: () => {
        ticks++
      },
    })
    scheduler.flush()
    expect(ticks).toBe(1)
    scheduler.dispose()
  })
})

describe('tick sources', () => {
  it('falls back to a main-thread interval where workers are unavailable', () => {
    // jsdom provides no Worker, which is exactly the fallback path.
    if (typeof Worker === 'undefined') {
      expect(workerTickSource()).toBeUndefined()
      expect(defaultTickSource().kind).toBe('interval')
    } else {
      expect(defaultTickSource().kind).toBe('worker')
    }
  })

  it('is idempotent across repeated start and stop', () => {
    vi.useFakeTimers()
    const source = intervalTickSource()
    let ticks = 0
    source.start(25, () => {
      ticks++
    })
    source.start(25, () => {
      ticks++
    }) // must replace, not stack a second timer
    vi.advanceTimersByTime(100)
    expect(ticks).toBe(4)
    source.stop()
    source.stop()
    vi.advanceTimersByTime(100)
    expect(ticks).toBe(4)
    source.dispose()
    vi.useRealTimers()
  })
})
