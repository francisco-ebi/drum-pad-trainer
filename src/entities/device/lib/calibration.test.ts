import { describe, expect, it } from 'vitest'
import {
  applyCalibration,
  CALIBRATION,
  computeCalibration,
  interquartileRange,
  median,
  offsetsFromClicks,
} from './calibration'

describe('calibration statistics', () => {
  it('takes a median that ignores a single wild hit', () => {
    expect(median([10, 12, 14])).toBe(12)
    expect(median([10, 12, 14, 16])).toBe(13)
    expect(median([12, 12, 12, 12, 900])).toBe(12)
    expect(median([])).toBe(0)
  })

  it('measures spread with the interquartile range', () => {
    expect(interquartileRange([1, 2, 3, 4, 5, 6, 7, 8])).toBe(4)
    expect(interquartileRange([5, 5, 5, 5])).toBe(0)
    expect(interquartileRange([1, 2])).toBe(0)
  })

  it('offsets each hit from its nearest click', () => {
    const clicks = [0, 0.5, 1, 1.5]
    const hits = [0.02, 0.52, 0.98]
    expect(offsetsFromClicks(hits, clicks).map((o) => Math.round(o))).toEqual([20, 20, -20])
    expect(offsetsFromClicks(hits, [])).toEqual([])
  })
})

describe('computeCalibration (§8.3)', () => {
  /** 16 hits, all `offset` ms late, with the warm-up hits deliberately wrong. */
  const run = (offset: number, warmUp = [80, -60, 70, -50]) => [
    ...warmUp,
    ...Array.from({ length: CALIBRATION.clicks - warmUp.length }, () => offset),
  ]

  it('discards the warm-up hits and returns the median of the rest', () => {
    const result = computeCalibration(run(24))
    expect(result.offsetMs).toBe(24)
    expect(result.usable).toBe(true)
    expect(result.sampleCount).toBe(12)
  })

  it('is unmoved by one flubbed hit late in the run', () => {
    const offsets = run(20)
    offsets[10] = 240
    expect(computeCalibration(offsets).offsetMs).toBe(20)
  })

  it('rejects a run whose spread is too wide to trust', () => {
    const sloppy = [0, 0, 0, 0, -90, 80, -70, 95, -85, 75, -60, 90, -95, 65, -75, 85]
    const result = computeCalibration(sloppy)
    expect(result.iqrMs).toBeGreaterThan(CALIBRATION.maxIqrMs)
    expect(result.usable).toBe(false)
  })

  it('drops implausible offsets rather than storing garbage', () => {
    const offsets = run(15)
    offsets[8] = 5000
    const result = computeCalibration(offsets)
    expect(result.offsetMs).toBe(15)
    expect(result.sampleCount).toBe(11)
  })

  it('reports an empty run as unusable', () => {
    expect(computeCalibration([])).toEqual({ offsetMs: 0, iqrMs: 0, sampleCount: 0, usable: false })
    expect(computeCalibration([1, 2, 3, 4]).usable).toBe(false) // nothing survives the warm-up cut
  })

  it('handles a device that reports hits early', () => {
    expect(computeCalibration(run(-18)).offsetMs).toBe(-18)
  })
})

describe('applyCalibration', () => {
  it('pulls a late-reported hit back to when it was played', () => {
    expect(applyCalibration(1.02, 20)).toBeCloseTo(1, 9)
    expect(applyCalibration(0.98, -20)).toBeCloseTo(1, 9)
    expect(applyCalibration(1, 0)).toBe(1)
  })
})
