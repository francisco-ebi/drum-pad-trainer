import { describe, expect, it } from 'vitest'
import type { Voice } from '@/entities/pattern/@x/take'
import type { PadIndex } from '@/shared/config'
import {
  buildHistogram,
  findWeakSpot,
  HISTOGRAM_BUCKET_MS,
  summarizeTiming,
} from './analyze'
import { judgeTake } from './judge-take'
import type { ExpectedHit, UserHit } from '../model/types'

const STEP = 0.25

/** Literal pads — see judge.test.ts. */
const PAD: Record<string, PadIndex> = {
  kick: { row: 4, col: 3 },
  snare: { row: 3, col: 3 },
  hihat: { row: 2, col: 3 },
}

function padFor(voice: Voice): PadIndex {
  const pad = PAD[voice]
  if (!pad) throw new Error(`No test pad for ${voice}`)
  return pad
}

function expected(step: number, voice: Voice, time: number, loop = 0): ExpectedHit {
  return { id: `${loop}:${step}:${voice}`, voice, hand: 'R', pad: padFor(voice), time, patternStep: step, loop }
}

function played(voice: Voice, time: number): UserHit {
  return { pad: padFor(voice), voice, velocity: 100, time }
}

describe('timing histogram (§10.4)', () => {
  it('buckets signed offsets around zero', () => {
    const result = judgeTake(
      [expected(0, 'kick', 1), expected(1, 'kick', 2), expected(2, 'kick', 3)],
      [played('kick', 1.005), played('kick', 2.025), played('kick', 3.025)],
      { secondsPerStep: STEP },
    )
    const nonEmpty = result.timing.histogram.filter((bucket) => bucket.count > 0)
    expect(nonEmpty).toEqual([
      { centerMs: 5, count: 1 },
      { centerMs: 25, count: 2 },
    ])
  })

  it('spans ±100 ms in 10 ms buckets', () => {
    const histogram = buildHistogram([])
    expect(histogram).toHaveLength(20)
    expect(histogram[0]?.centerMs).toBe(-95)
    expect(histogram[19]?.centerMs).toBe(95)
    expect(HISTOGRAM_BUCKET_MS).toBe(10)
  })

  it('counts only hits that carry a timing offset', () => {
    const result = judgeTake([expected(0, 'kick', 1)], [], { secondsPerStep: STEP })
    expect(result.timing.histogram.every((bucket) => bucket.count === 0)).toBe(true)
  })
})

describe('rushing and dragging verdict (§10.4)', () => {
  it('calls out a consistent rush', () => {
    const hits = [0, 1, 2, 3].map((i) => played('kick', 1 + i - 0.02))
    const result = judgeTake([0, 1, 2, 3].map((i) => expected(i, 'kick', 1 + i)), hits, {
      secondsPerStep: STEP,
    })
    expect(result.timing.meanOffsetMs).toBeCloseTo(-20, 6)
    expect(result.timing.verdict).toMatch(/Rushing by about 20 ms/)
    expect(result.timing.earlyShare).toBe(1)
  })

  it('calls out a consistent drag', () => {
    const hits = [0, 1, 2, 3].map((i) => played('snare', 1 + i + 0.03))
    const result = judgeTake([0, 1, 2, 3].map((i) => expected(i, 'snare', 1 + i)), hits, {
      secondsPerStep: STEP,
    })
    expect(result.timing.verdict).toMatch(/Dragging by about 30 ms/)
    expect(result.timing.earlyShare).toBe(0)
  })

  it('says nothing when the time is solid', () => {
    const hits = [0, 1, 2, 3].map((i) => played('kick', 1 + i + (i % 2 === 0 ? 0.004 : -0.004)))
    const result = judgeTake([0, 1, 2, 3].map((i) => expected(i, 'kick', 1 + i)), hits, {
      secondsPerStep: STEP,
    })
    expect(result.timing.verdict).toMatch(/Solid time/)
  })

  it('names the voice whose time is furthest out', () => {
    const expectedHits = [
      expected(0, 'hihat', 1),
      expected(1, 'hihat', 1.25),
      expected(2, 'snare', 1.5),
      expected(3, 'snare', 1.75),
    ]
    const hits = [
      played('hihat', 1.002),
      played('hihat', 1.252),
      played('snare', 1.53),
      played('snare', 1.78),
    ]
    const result = summarizeTiming(judgeTake(expectedHits, hits, { secondsPerStep: STEP }).judgments)
    expect(result.worstVoice?.voice).toBe('snare')
    expect(result.worstVoice?.meanOffsetMs).toBeCloseTo(30, 1)
  })
})

describe('weak spot (§10.4)', () => {
  it('finds the step and voice with the worst average', () => {
    // Three passes: the kick on step 4 is missed every time, everything else clean.
    const expectedHits: ExpectedHit[] = []
    const hits: UserHit[] = []
    for (let loop = 0; loop < 3; loop++) {
      const base = loop * 2
      expectedHits.push(expected(0, 'hihat', base + 1, loop))
      expectedHits.push(expected(4, 'kick', base + 1.5, loop))
      hits.push(played('hihat', base + 1))
    }
    const result = judgeTake(expectedHits, hits, { secondsPerStep: STEP })
    expect(result.weakSpot).toMatchObject({ patternStep: 4, voice: 'kick', attempts: 3 })
    expect(result.weakSpot?.averagePoints).toBe(0)
  })

  it('prefers a consistently weak cell over a single slip', () => {
    const expectedHits = [
      expected(0, 'kick', 1),
      expected(0, 'kick', 3, 1),
      expected(2, 'snare', 1.5),
      expected(2, 'snare', 3.5, 1),
    ]
    const hits = [
      played('kick', 1),
      played('kick', 3),
      played('snare', 1.55), // Good, not Perfect
      played('snare', 3.55),
    ]
    const result = judgeTake(expectedHits, hits, { secondsPerStep: STEP })
    expect(result.weakSpot).toMatchObject({ patternStep: 2, voice: 'snare', averagePoints: 60 })
  })

  it('reports no weak spot on a flawless take', () => {
    const result = judgeTake(
      [expected(0, 'kick', 1), expected(2, 'snare', 1.5)],
      [played('kick', 1), played('snare', 1.5)],
      { secondsPerStep: STEP },
    )
    expect(result.weakSpot).toBeUndefined()
    expect(findWeakSpot([])).toBeUndefined()
  })
})

describe('take result', () => {
  it('grades a clean take S and a half-played one D', () => {
    const expectedHits = [0, 1, 2, 3].map((i) => expected(i, 'kick', 1 + i))
    const clean = judgeTake(expectedHits, expectedHits.map((e) => played('kick', e.time)), {
      secondsPerStep: STEP,
    })
    expect(clean.stats.accuracy).toBe(100)
    expect(clean.grade).toBe('S')

    const half = judgeTake(expectedHits, [played('kick', 1), played('kick', 2)], {
      secondsPerStep: STEP,
    })
    expect(half.stats.accuracy).toBe(50)
    expect(half.grade).toBe('D')
    expect(half.stats.counts.miss).toBe(2)
  })

  it('sorts user hits by time, however they arrive', () => {
    const expectedHits = [expected(0, 'kick', 1), expected(1, 'kick', 1.25)]
    const result = judgeTake(expectedHits, [played('kick', 1.25), played('kick', 1)], {
      secondsPerStep: STEP,
    })
    expect(result.stats.accuracy).toBe(100)
  })
})
