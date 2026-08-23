import { describe, expect, it } from 'vitest'
import {
  fromBarStep,
  isBeatStep,
  mod,
  secondsPerBar,
  secondsPerStep,
  secondsToSteps,
  stepsPerBar,
  stepsPerBeat,
  stepsToSeconds,
  toBarStep,
} from './time'

describe('musical time math', () => {
  it('derives steps per beat and per bar from the subdivision', () => {
    expect(stepsPerBeat(8)).toBe(2)
    expect(stepsPerBeat(16)).toBe(4)
    expect(stepsPerBar([4, 4], 8)).toBe(8)
    expect(stepsPerBar([4, 4], 16)).toBe(16)
    expect(stepsPerBar([3, 4], 8)).toBe(6)
  })

  it('converts steps to seconds at a given tempo', () => {
    // 120 BPM: a quarter is 0.5 s, so an 8th is 0.25 s and a 16th 0.125 s.
    expect(secondsPerStep(120, 8)).toBeCloseTo(0.25, 12)
    expect(secondsPerStep(120, 16)).toBeCloseTo(0.125, 12)
    expect(secondsPerBar(120, [4, 4], 16)).toBeCloseTo(2, 12)
    expect(stepsToSeconds(4, 60, 16)).toBeCloseTo(1, 12)
  })

  it('round-trips seconds and steps', () => {
    for (const bpm of [50, 80, 140, 200]) {
      for (const subdivision of [8, 16]) {
        const seconds = stepsToSeconds(13, bpm, subdivision)
        expect(secondsToSteps(seconds, bpm, subdivision)).toBeCloseTo(13, 10)
      }
    }
  })

  it('maps absolute steps to (bar, step) and back', () => {
    expect(toBarStep(0, 8)).toEqual({ bar: 0, step: 0 })
    expect(toBarStep(9, 8)).toEqual({ bar: 1, step: 1 })
    expect(fromBarStep(2, 3, 8)).toBe(19)
  })

  it('identifies beats and handles negative modulo', () => {
    expect(isBeatStep(0, 16)).toBe(true)
    expect(isBeatStep(4, 16)).toBe(true)
    expect(isBeatStep(5, 16)).toBe(false)
    expect(mod(-1, 8)).toBe(7)
    expect(mod(-8, 8)).toBe(0)
  })
})
