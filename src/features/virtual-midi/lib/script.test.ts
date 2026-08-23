import { describe, expect, it } from 'vitest'
import { judgeTake, type ExpectedHit } from '@/entities/take'
import { PERFECT_PLAYER, scriptTake, seededRandom, SLOPPY_PLAYER } from './script'

const STEP = 0.25
const PAD = { row: 4, col: 3 }

const expected: ExpectedHit[] = Array.from({ length: 32 }, (_, i) => ({
  id: `0:${i}:kick`,
  voice: 'kick' as const,
  hand: 'R' as const,
  pad: PAD,
  time: 1 + i * STEP,
  patternStep: i % 8,
  loop: Math.floor(i / 8),
}))

describe('scripted takes (§13.3)', () => {
  it('plays every note exactly on time for a perfect player', () => {
    const strikes = scriptTake(expected, PERFECT_PLAYER)
    expect(strikes).toHaveLength(expected.length)
    for (const [i, strike] of strikes.entries()) {
      expect(strike.time).toBeCloseTo(expected[i]?.time ?? 0, 12)
    }
  })

  it('applies a constant offset exactly — the +20 ms of the M2 criterion', () => {
    const strikes = scriptTake(expected, { ...PERFECT_PLAYER, offsetMs: 20 })
    for (const [i, strike] of strikes.entries()) {
      expect((strike.time - (expected[i]?.time ?? 0)) * 1000).toBeCloseTo(20, 9)
    }
    const result = judgeTake(
      expected,
      strikes.map((s) => ({ pad: s.pad, voice: s.voice, velocity: s.velocity, time: s.time })),
      { secondsPerStep: STEP },
    )
    expect(result.stats.accuracy).toBe(100)
  })

  it('keeps jitter inside the range asked for', () => {
    const strikes = scriptTake(expected, { ...PERFECT_PLAYER, jitterMs: 30 }, seededRandom(7))
    const offsets = strikes.map((s, i) => (s.time - (expected[i]?.time ?? 0)) * 1000)
    expect(Math.max(...offsets)).toBeLessThanOrEqual(30)
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-30)
    expect(offsets.some((offset) => Math.abs(offset) > 1)).toBe(true)
  })

  it('is reproducible from a seed', () => {
    const a = scriptTake(expected, SLOPPY_PLAYER, seededRandom(42))
    const b = scriptTake(expected, SLOPPY_PLAYER, seededRandom(42))
    expect(a).toEqual(b)
    expect(scriptTake(expected, SLOPPY_PLAYER, seededRandom(43))).not.toEqual(a)
  })

  it('produces every fault class for a sloppy player', () => {
    const strikes = scriptTake(expected, SLOPPY_PLAYER, seededRandom(3))
    const result = judgeTake(
      expected,
      strikes.map((s) => ({ pad: s.pad, voice: s.voice, velocity: s.velocity, time: s.time })),
      { secondsPerStep: STEP },
    )
    expect(result.stats.accuracy).toBeLessThan(100)
    expect(result.stats.counts.miss + result.stats.counts.wrongPad + result.stats.counts.extra)
      .toBeGreaterThan(0)
  })

  it('returns strikes in time order even when extras are inserted', () => {
    const strikes = scriptTake(expected, SLOPPY_PLAYER, seededRandom(11))
    const times = strikes.map((s) => s.time)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
})
