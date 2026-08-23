import { describe, expect, it } from 'vitest'
import { anchorFromOutputTimestamp, captureAnchor } from './clock'
import { TestClock } from '@/shared/lib/testing'

const fallback = () => ({ perfSec: 42, audioSec: 7 })

describe('captureAnchor', () => {
  it('pairs a reading from each timeline', () => {
    expect(captureAnchor(new TestClock(3), new TestClock(1000))).toEqual({ perfSec: 1000, audioSec: 3 })
  })
})

describe('anchorFromOutputTimestamp (§8.2)', () => {
  it('uses the browser pairing when it is populated', () => {
    const anchor = anchorFromOutputTimestamp({ contextTime: 12.5, performanceTime: 34_000 }, fallback)
    expect(anchor).toEqual({ audioSec: 12.5, perfSec: 34 })
  })

  it('rejects the all-zero timestamp reported before playback begins', () => {
    // Structurally valid, factually wrong: the performance timeline has not
    // just started, and trusting it offsets every hit by the page's uptime.
    expect(anchorFromOutputTimestamp({ contextTime: 0, performanceTime: 0 }, fallback)).toEqual(fallback())
  })

  it('falls back when the browser does not implement it', () => {
    expect(anchorFromOutputTimestamp(undefined, fallback)).toEqual(fallback())
    expect(anchorFromOutputTimestamp({} as AudioTimestamp, fallback)).toEqual(fallback())
  })

  it('accepts a context time of zero once the performance time is real', () => {
    expect(anchorFromOutputTimestamp({ contextTime: 0, performanceTime: 5000 }, fallback)).toEqual({
      audioSec: 0,
      perfSec: 5,
    })
  })
})
