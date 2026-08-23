import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runFor, TestClock } from '@/shared/lib/testing'
import { Transport, type StepEvent } from './transport'

function collect(transport: Transport): StepEvent[] {
  const events: StepEvent[] = []
  transport.on('schedule', (event) => events.push(event))
  return events
}

function makeTransport(overrides: Partial<{ bpm: number; subdivision: number; bars: number }> = {}) {
  const clock = new TestClock()
  const transport = new Transport({
    clock,
    bpm: 120,
    subdivision: 8,
    timeSig: [4, 4],
    bars: 1,
    startLeadSec: 0,
    ...overrides,
  })
  return { clock, transport }
}

describe('Transport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('places every step at an exact time — no drift over a long take', () => {
    const { clock, transport } = makeTransport()
    const events = collect(transport)
    transport.play()
    runFor(clock, 8) // 8 s at 120 BPM 8ths = 32 steps

    expect(events.length).toBeGreaterThan(30)
    const stepSec = 0.25
    for (const [i, event] of events.entries()) {
      // Scheduling jitter must stay far below the 2 ms budget (§15).
      expect(Math.abs(event.time - i * stepSec)).toBeLessThan(1e-9)
    }
    transport.dispose()
  })

  it('wraps the pattern step while looping', () => {
    const { clock, transport } = makeTransport()
    const events = collect(transport)
    transport.play()
    runFor(clock, 4) // 16 steps over 2 loops of an 8-step bar

    expect(events.slice(0, 10).map((e) => e.patternStep)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1])
    expect(events[8]?.rawStep).toBe(8)
    transport.dispose()
  })

  it('applies a tempo change at the next bar boundary while playing', () => {
    const { clock, transport } = makeTransport()
    const events = collect(transport)
    transport.play()
    runFor(clock, 0.6) // mid-bar (steps 0..2 at 120 BPM)
    transport.setBpm(60)
    runFor(clock, 4)

    const bar1 = events.filter((e) => e.rawStep < 8)
    for (const [i, event] of bar1.entries()) {
      expect(event.time).toBeCloseTo(i * 0.25, 9) // old tempo holds to the bar line
    }
    const boundary = events.find((e) => e.rawStep === 8)
    const afterBoundary = events.find((e) => e.rawStep === 9)
    expect(boundary?.time).toBeCloseTo(2, 9)
    expect((afterBoundary?.time ?? 0) - (boundary?.time ?? 0)).toBeCloseTo(0.5, 9) // 60 BPM
    transport.dispose()
  })

  it('runs a count-in before the pattern and parks the playhead', () => {
    const { clock, transport } = makeTransport()
    transport.setCountInBars(1)
    const events = collect(transport)
    transport.play()
    expect(transport.countInRemaining).toBe(8)

    runFor(clock, 2.1)
    const countIn = events.filter((e) => e.isCountIn)
    expect(countIn).toHaveLength(8)
    expect(countIn.filter((e) => e.isBeat)).toHaveLength(4)
    expect(countIn[0]?.isBarStart).toBe(true)
    expect(events.find((e) => !e.isCountIn)?.patternStep).toBe(0)
    transport.dispose()
  })

  it('stops at the end of the range when looping is off', () => {
    const { clock, transport } = makeTransport()
    const ended = vi.fn()
    transport.on('end', ended)
    transport.setLoop(false)
    const events = collect(transport)
    transport.play()
    runFor(clock, 3)

    expect(events).toHaveLength(8)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(transport.transportState).toBe('stopped')
    transport.dispose()
  })

  it('honours an A/B loop range', () => {
    const { clock, transport } = makeTransport()
    transport.setRange(2, 4)
    const events = collect(transport)
    transport.play()
    runFor(clock, 1.6)

    expect(events.slice(0, 6).map((e) => e.patternStep)).toEqual([2, 3, 2, 3, 2, 3])
    transport.dispose()
  })

  it('reports a continuous position derived from the clock', () => {
    const { clock, transport } = makeTransport()
    transport.play()
    runFor(clock, 0.375) // one and a half steps
    expect(transport.position).toBeCloseTo(1.5, 6)
    transport.pause()
    const parked = transport.position
    runFor(clock, 1)
    expect(transport.position).toBe(parked)
    transport.dispose()
  })

  it('steps through one step at a time while stopped, wrapping at the ends', () => {
    const { transport } = makeTransport()
    const events = collect(transport)

    expect(transport.stepBy(1)?.patternStep).toBe(1)
    expect(transport.stepBy(1)?.patternStep).toBe(2)
    expect(transport.stepBy(-1)?.patternStep).toBe(1)
    transport.seekToStep(0)
    expect(transport.stepBy(-1)?.patternStep).toBe(7)
    expect(events).toHaveLength(4)
    transport.dispose()
  })

  it('ignores step-through while playing', () => {
    const { clock, transport } = makeTransport()
    transport.play()
    runFor(clock, 0.1)
    expect(transport.stepBy(1)).toBeUndefined()
    transport.dispose()
  })
})
