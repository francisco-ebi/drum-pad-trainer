import { describe, expect, it } from 'vitest'
import { applyCalibration, computeCalibration, resolvePad } from '@/entities/device'
import { getPattern, indexPattern, type Pattern } from '@/entities/pattern'
import { judgeTake, type UserHit } from '@/entities/take'
import { secondsPerStep } from '@/shared/lib/transport'
import { buildTakeTimeline } from './expected-timeline'

/**
 * The M2 acceptance criterion (§16): a scripted take at a constant +20 ms
 * offset, with calibration applied, must score ≥ 99 %; wrong-pad and extra
 * hits must be classified per §10.
 */
function loadPattern(id: string): Pattern {
  const pattern = getPattern(id)
  if (!pattern) throw new Error(`Missing seed pattern ${id}`)
  return pattern
}

const variation = loadPattern('variation-1')
const index = indexPattern(variation)
const BPM = 90
const STEP_SEC = secondsPerStep(BPM, variation.subdivision)

function timeline(loops = 4) {
  return buildTakeTimeline({
    index,
    isUserLane: () => true,
    loops,
    secondsPerStep: STEP_SEC,
    startTime: 1,
  })
}

/** Play every expected note, shifted by a constant device latency. */
function scriptedTake(offsetMs: number, calibrationMs = 0, loops = 4): UserHit[] {
  return timeline(loops).map((hit) => ({
    pad: hit.pad,
    voice: hit.voice,
    velocity: 100,
    time: applyCalibration(hit.time + offsetMs / 1000, calibrationMs),
  }))
}

describe('scripted take (§16 M2 acceptance)', () => {
  it('builds the expected timeline from the pattern', () => {
    const hits = timeline(1)
    // Variation #1 has 14 hits per bar (§5.1).
    expect(hits).toHaveLength(14)
    expect(timeline(4)).toHaveLength(56)
    expect(hits[0]).toMatchObject({ patternStep: 0, loop: 0, time: 1 })
    expect(hits.at(-1)?.time).toBeCloseTo(1 + 7 * STEP_SEC, 9)
  })

  it('scores a perfect take at +20 ms with calibration applied at ≥ 99 %', () => {
    // What §8.3 would have measured from a device that reports 20 ms late.
    const calibration = computeCalibration(Array.from({ length: 16 }, () => 20))
    expect(calibration.usable).toBe(true)
    expect(calibration.offsetMs).toBe(20)

    const result = judgeTake(timeline(), scriptedTake(20, calibration.offsetMs), {
      secondsPerStep: STEP_SEC,
    })

    expect(result.stats.accuracy).toBeGreaterThanOrEqual(99)
    expect(result.stats.accuracy).toBe(100)
    expect(result.grade).toBe('S')
    expect(result.stats.counts).toMatchObject({ perfect: 56, good: 0, miss: 0, wrongPad: 0, extra: 0 })
    expect(result.stats.maxCombo).toBe(56)
  })

  it('still passes uncalibrated at +20 ms, because that is inside Perfect', () => {
    const result = judgeTake(timeline(), scriptedTake(20), { secondsPerStep: STEP_SEC })
    expect(result.stats.accuracy).toBe(100)
    expect(result.timing.verdict).toMatch(/Dragging by about 20 ms/)
  })

  it('shows what calibration is for: +60 ms is only Good until it is applied', () => {
    const uncalibrated = judgeTake(timeline(), scriptedTake(60), { secondsPerStep: STEP_SEC })
    expect(uncalibrated.stats.counts.good).toBe(56)
    expect(uncalibrated.stats.accuracy).toBe(60)
    expect(uncalibrated.grade).toBe('D')

    const calibrated = judgeTake(timeline(), scriptedTake(60, 60), { secondsPerStep: STEP_SEC })
    expect(calibrated.stats.accuracy).toBe(100)
    expect(calibrated.grade).toBe('S')
  })

  it('reports a device far enough out that every hit misses', () => {
    const result = judgeTake(timeline(), scriptedTake(200), { secondsPerStep: STEP_SEC })
    expect(result.stats.counts.miss).toBe(56)
    expect(result.stats.counts.extra).toBe(56)
    expect(result.stats.accuracy).toBe(0)
  })
})

describe('classification of faults (§10)', () => {
  const expectedHits = timeline(1)

  it('classifies a wrong pad, leaving the note charged only once', () => {
    const hits = scriptedTake(0, 0, 1)
    // Step 2 is a snare; play the kick pad there instead.
    const snareIndex = expectedHits.findIndex((hit) => hit.voice === 'snare')
    const kickPad = resolvePad('kick', 'R')
    const target = hits[snareIndex]
    if (!target || !kickPad) throw new Error('fixture')
    hits[snareIndex] = { ...target, pad: kickPad, voice: 'kick' }

    const result = judgeTake(expectedHits, hits, { secondsPerStep: STEP_SEC })
    expect(result.stats.counts.wrongPad).toBe(1)
    expect(result.stats.counts.miss).toBe(0)
    expect(result.stats.counts.extra).toBe(0)
  })

  it('classifies a stray strike between steps as an Extra', () => {
    const hits = scriptedTake(0, 0, 1)
    const kickPad = resolvePad('kick', 'R')
    if (!kickPad) throw new Error('fixture')
    // Halfway between two steps, well outside every window.
    hits.push({ pad: kickPad, voice: 'kick', velocity: 100, time: 1 + STEP_SEC * 0.5 })

    const result = judgeTake(expectedHits, hits, { secondsPerStep: STEP_SEC })
    expect(result.stats.counts.extra).toBe(1)
    expect(result.stats.counts.miss).toBe(0)
    expect(result.stats.accuracy).toBeLessThan(100)
  })

  it('classifies an unplayed note as a Miss', () => {
    const hits = scriptedTake(0, 0, 1).filter((_, i) => i !== 0)
    const result = judgeTake(expectedHits, hits, { secondsPerStep: STEP_SEC })
    expect(result.stats.counts.miss).toBe(1)
    expect(result.weakSpot).toMatchObject({ patternStep: 0, averagePoints: 0 })
  })

  it('judges a lane-assigned take only on the lanes the player owns (§9.2)', () => {
    const kickOnly = buildTakeTimeline({
      index,
      isUserLane: (voice) => voice === 'kick',
      loops: 1,
      secondsPerStep: STEP_SEC,
      startTime: 1,
    })
    // Variation #1 has four kicks in the bar.
    expect(kickOnly).toHaveLength(4)
    const result = judgeTake(
      kickOnly,
      kickOnly.map((hit) => ({ pad: hit.pad, voice: hit.voice, velocity: 100, time: hit.time })),
      { secondsPerStep: STEP_SEC },
    )
    expect(result.stats.accuracy).toBe(100)
  })
})

describe('strict hands on the 16th-note drill (§4.2)', () => {
  const sixteenths = loadPattern('basic-16th-beat')
  const sixteenthIndex = indexPattern(sixteenths)
  const stepSec = secondsPerStep(80, sixteenths.subdivision)

  it('passes when each hat is played with the hand the pattern asks for', () => {
    const expectedHits = buildTakeTimeline({
      index: sixteenthIndex,
      isUserLane: () => true,
      loops: 1,
      secondsPerStep: stepSec,
      startTime: 1,
    })
    const result = judgeTake(
      expectedHits,
      expectedHits.map((hit) => ({ pad: hit.pad, voice: hit.voice, velocity: 100, time: hit.time })),
      { secondsPerStep: stepSec, strictHands: true },
    )
    expect(result.stats.accuracy).toBe(100)
  })

  it('fails the alternate-hand hats when everything is played with the lead hand', () => {
    const expectedHits = buildTakeTimeline({
      index: sixteenthIndex,
      isUserLane: () => true,
      loops: 1,
      secondsPerStep: stepSec,
      startTime: 1,
    })
    const leadPad = resolvePad('hihat', 'R')
    if (!leadPad) throw new Error('fixture')
    const hits = expectedHits.map((hit) => ({
      pad: hit.voice === 'hihat' ? leadPad : hit.pad,
      voice: hit.voice,
      velocity: 100,
      time: hit.time,
    }))

    const strict = judgeTake(expectedHits, hits, { secondsPerStep: stepSec, strictHands: true })
    // Eight alternate-hand hats, all played on the lead pad.
    expect(strict.stats.counts.wrongPad).toBe(8)

    const lenient = judgeTake(expectedHits, hits, { secondsPerStep: stepSec, strictHands: false })
    expect(lenient.stats.accuracy).toBe(100)
  })
})
