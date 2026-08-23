import { describe, expect, it } from 'vitest'
import type { Voice } from '@/entities/pattern/@x/take'
import type { PadIndex } from '@/shared/config'
import { TakeJudge } from './judge'
import { comboMultiplier, gradeLetter, POINTS } from './score'
import { windowsFor } from './windows'
import type { ExpectedHit, UserHit } from '../model/types'

/** 120 BPM eighths: one step is 0.25 s — windows sit well clear of the clamp. */
const STEP = 0.25

/**
 * Literal pads rather than the real layout: the judge only ever compares pads
 * for equality, so these tests stay true even if the grid is re-arranged.
 */
const PAD: Record<string, PadIndex> = {
  kickR: { row: 4, col: 3 },
  snareR: { row: 3, col: 3 },
  hihatR: { row: 2, col: 3 },
  hihatL: { row: 2, col: 1 },
}

function padFor(voice: Voice, hand: 'R' | 'L'): PadIndex {
  const pad = PAD[`${voice}${hand}`] ?? PAD[`${voice}R`]
  if (!pad) throw new Error(`No test pad for ${voice}`)
  return pad
}

function expected(step: number, voice: Voice, time: number, loop = 0, hand: 'R' | 'L' = 'R'): ExpectedHit {
  return { id: `${loop}:${step}:${voice}`, voice, hand, pad: padFor(voice, hand), time, patternStep: step, loop }
}

function played(voice: Voice, time: number, hand: 'R' | 'L' = 'R'): UserHit {
  return { pad: padFor(voice, hand), voice, velocity: 100, time }
}

describe('timing windows (§10.2)', () => {
  it('uses the fixed millisecond windows at ordinary tempos', () => {
    const windows = windowsFor(STEP)
    expect(windows.perfectSec).toBeCloseTo(0.035, 9)
    expect(windows.goodSec).toBeCloseTo(0.07, 9)
  })

  it('clamps the windows so they cannot overlap the next step at speed', () => {
    // 200 BPM sixteenths: a step is 75 ms, so ±70 ms Good would swallow its
    // neighbours. The fractional clamp keeps them apart.
    const fast = windowsFor(0.075)
    expect(fast.perfectSec).toBeCloseTo(0.03, 9) // 40% of the step
    expect(fast.goodSec).toBeCloseTo(0.03375, 9) // 45% of the step
    expect(fast.goodSec).toBeLessThan(0.075 / 2)
  })
})

describe('judging one hit (§10.1)', () => {
  it('grades a dead-on hit Perfect with no direction', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    const judgment = judge.hit(played('kick', 1))
    expect(judgment.grade).toBe('perfect')
    expect(judgment.direction).toBeUndefined()
    expect(judgment.points).toBe(POINTS.perfect)
  })

  it('grades just inside the Perfect window Perfect, just outside it Good', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    judge.expect(expected(2, 'kick', 2))
    expect(judge.hit(played('kick', 1.035)).grade).toBe('perfect')
    expect(judge.hit(played('kick', 2.036)).grade).toBe('good')
  })

  it('records early and late on every non-Perfect judgment', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    judge.expect(expected(2, 'snare', 2))
    expect(judge.hit(played('kick', 0.95))).toMatchObject({ grade: 'good', direction: 'early' })
    expect(judge.hit(played('snare', 2.05))).toMatchObject({ grade: 'good', direction: 'late' })
  })

  it('calls a hit outside the Good window an Extra, and the note a Miss', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    expect(judge.hit(played('kick', 1.2)).grade).toBe('extra')
    expect(judge.settle(Infinity).map((j) => j.grade)).toEqual(['miss'])
  })

  it('matches the nearest of several candidates', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'hihat', 1))
    judge.expect(expected(1, 'hihat', 1.06))
    const judgment = judge.hit(played('hihat', 1.05))
    expect(judgment.expected?.patternStep).toBe(1)
  })

  it('gives each expected hit to at most one user hit', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'snare', 1))
    expect(judge.hit(played('snare', 1)).grade).toBe('perfect')
    expect(judge.hit(played('snare', 1.01)).grade).toBe('extra')
  })
})

describe('wrong pad (§10.1, §10.3)', () => {
  it('is wrong-pad when something else was due, not an Extra', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    const judgment = judge.hit(played('snare', 1.005))
    expect(judgment.grade).toBe('wrongPad')
    expect(judgment.expected?.voice).toBe('kick')
    expect(judgment.points).toBe(0)
  })

  it('charges the mistake once — the note it consumed is not also a Miss', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    judge.hit(played('snare', 1.005))
    expect(judge.settle(Infinity)).toEqual([])
    expect(judge.stats.counts).toMatchObject({ wrongPad: 1, miss: 0 })
  })

  it('never lets a voice steal a note due for another voice on the same step', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    judge.expect(expected(0, 'hihat', 1))
    // Hi-hat played fractionally nearer the kick's slot must still take the hat.
    expect(judge.hit(played('hihat', 1.002))).toMatchObject({ grade: 'perfect' })
    expect(judge.hit(played('kick', 1.004))).toMatchObject({ grade: 'perfect' })
    expect(judge.stats.counts.wrongPad).toBe(0)
  })

  it('is an Extra, not wrong-pad, when nothing at all was due', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    expect(judge.hit(played('snare', 5)).grade).toBe('extra')
  })
})

describe('strict hands (§4.2)', () => {
  it('accepts either pad of a voice by default', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'hihat', 1, 0, 'R'))
    expect(judge.hit(played('hihat', 1, 'L')).grade).toBe('perfect')
  })

  it('requires the exact pad when the drill teaches sticking', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP, strictHands: true })
    judge.expect(expected(0, 'hihat', 1, 0, 'R'))
    const judgment = judge.hit(played('hihat', 1, 'L'))
    expect(judgment.grade).toBe('wrongPad')
  })

  it('accepts the right pad under strict hands', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP, strictHands: true })
    judge.expect(expected(0, 'hihat', 1, 0, 'L'))
    expect(judge.hit(played('hihat', 1, 'L')).grade).toBe('perfect')
  })
})

describe('misses and settling', () => {
  it('does not settle a note whose window is still open', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    expect(judge.settle(1.05)).toEqual([])
    expect(judge.pending).toHaveLength(1)
  })

  it('settles it once the window has closed, with a grace period', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    expect(judge.settle(1.07)).toEqual([]) // inside the grace
    expect(judge.settle(1.09).map((j) => j.grade)).toEqual(['miss'])
    expect(judge.pending).toEqual([])
  })

  it('settles each note only once', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    judge.expect(expected(0, 'kick', 1))
    judge.settle(Infinity)
    expect(judge.settle(Infinity)).toEqual([])
  })

  it('counts trailing misses for the strict-mode stop (§9.2)', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    for (let i = 0; i < 3; i++) judge.expect(expected(i, 'kick', 1 + i))
    judge.settle(Infinity)
    expect(judge.trailingMisses).toBe(3)
  })
})

describe('scoring and combo (§10.3)', () => {
  it('steps the multiplier at 10, 25 and 50', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(9)).toBe(1)
    expect(comboMultiplier(10)).toBe(2)
    expect(comboMultiplier(24)).toBe(2)
    expect(comboMultiplier(25)).toBe(3)
    expect(comboMultiplier(50)).toBe(4)
    expect(comboMultiplier(500)).toBe(4)
  })

  it('breaks the combo on anything that is not Perfect or Good', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    for (let i = 0; i < 3; i++) judge.expect(expected(i, 'kick', 1 + i))
    judge.hit(played('kick', 1))
    judge.hit(played('kick', 2))
    expect(judge.stats.combo).toBe(2)
    judge.hit(played('snare', 3)) // wrong pad
    expect(judge.stats.combo).toBe(0)
    expect(judge.stats.maxCombo).toBe(2)
  })

  it('penalises extras, and can be told not to for level-1 drills', () => {
    const penalised = new TakeJudge({ secondsPerStep: STEP })
    expect(penalised.hit(played('kick', 9)).points).toBe(POINTS.extra)

    const forgiving = new TakeJudge({ secondsPerStep: STEP, penalizeExtras: false })
    expect(forgiving.hit(played('kick', 9)).points).toBe(0)
  })

  it('never lets the score go negative', () => {
    const judge = new TakeJudge({ secondsPerStep: STEP })
    for (let i = 0; i < 5; i++) judge.hit(played('kick', i * 10))
    expect(judge.stats.score).toBe(0)
  })

  it('maps accuracy onto the letter grades', () => {
    expect(gradeLetter(100)).toBe('S')
    expect(gradeLetter(97)).toBe('S')
    expect(gradeLetter(96.9)).toBe('A')
    expect(gradeLetter(92)).toBe('A')
    expect(gradeLetter(85)).toBe('B')
    expect(gradeLetter(75)).toBe('C')
    expect(gradeLetter(74.9)).toBe('D')
  })

  it('keeps accuracy independent of the combo multiplier', () => {
    const short = new TakeJudge({ secondsPerStep: STEP })
    short.expect(expected(0, 'kick', 1))
    short.hit(played('kick', 1))

    const long = new TakeJudge({ secondsPerStep: STEP })
    for (let i = 0; i < 60; i++) long.expect(expected(i, 'kick', 1 + i))
    for (let i = 0; i < 60; i++) long.hit(played('kick', 1 + i))

    // Same accuracy on a 1-hit and a 60-hit clean take; the score differs.
    expect(short.stats.accuracy).toBe(100)
    expect(long.stats.accuracy).toBe(100)
    expect(long.stats.score).toBeGreaterThan(60 * POINTS.perfect)
  })
})
