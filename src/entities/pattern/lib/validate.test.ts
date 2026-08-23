import { describe, expect, it } from 'vitest'
import variation1 from '../seeds/variation-1.json'
import { parsePattern, patternStepsPerBar, validatePattern } from './validate'

function clone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(variation1)) as Record<string, unknown>
}

describe('pattern validation', () => {
  it('accepts a well-formed pattern', () => {
    expect(validatePattern(variation1)).toEqual([])
    expect(parsePattern(variation1).id).toBe('variation-1')
  })

  it('computes steps per bar from metre and subdivision', () => {
    expect(patternStepsPerBar({ timeSig: [4, 4], subdivision: 8 })).toBe(8)
    expect(patternStepsPerBar({ timeSig: [4, 4], subdivision: 16 })).toBe(16)
  })

  it('rejects a non-object', () => {
    expect(validatePattern(null)).toEqual([{ path: '$', message: 'must be an object' }])
  })

  it('requires one count label per step', () => {
    const raw = clone()
    raw.countLabels = ['1', 'a', '2']
    expect(validatePattern(raw)).toContainEqual({
      path: 'countLabels',
      message: 'must have one label per step (8), got 3',
    })
  })

  it('rejects hits outside the bar', () => {
    const raw = clone()
    raw.hits = [{ bar: 0, step: 99, voice: 'kick' }]
    expect(validatePattern(raw)).toContainEqual({
      path: 'hits[0].step',
      message: 'must be an integer in 0..7',
    })
  })

  it('rejects unknown voices and voices missing from lanes', () => {
    const raw = clone()
    raw.hits = [
      { bar: 0, step: 0, voice: 'cowbell' },
      { bar: 0, step: 1, voice: 'ride' },
    ]
    const issues = validatePattern(raw)
    expect(issues).toContainEqual({ path: 'hits[0].voice', message: 'unknown voice "cowbell"' })
    expect(issues).toContainEqual({ path: 'hits[1].voice', message: 'voice "ride" is not in lanes' })
  })

  it('rejects duplicate hits and impossible dynamics', () => {
    const raw = clone()
    raw.hits = [
      { bar: 0, step: 0, voice: 'kick' },
      { bar: 0, step: 0, voice: 'kick' },
      { bar: 0, step: 1, voice: 'kick', accent: true, ghost: true },
    ]
    const issues = validatePattern(raw)
    expect(issues).toContainEqual({ path: 'hits[1]', message: 'duplicate hit' })
    expect(issues).toContainEqual({ path: 'hits[2]', message: 'cannot be both accent and ghost' })
  })

  it('checks tempo bounds and star thresholds', () => {
    const raw = clone()
    raw.bpmDefault = 300
    raw.drill = { targetBpm: 90, starAccuracy: [95, 85, 70] }
    const issues = validatePattern(raw)
    expect(issues).toContainEqual({ path: 'bpmDefault', message: 'must sit inside bpmRange' })
    expect(issues).toContainEqual({
      path: 'drill.starAccuracy',
      message: 'thresholds must increase',
    })
  })

  it('throws a readable error from parsePattern', () => {
    expect(() => parsePattern({ id: 'Bad Id' })).toThrow(/Invalid pattern/)
  })
})
