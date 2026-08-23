import { describe, expect, it } from 'vitest'
import { EMPTY_PROGRESS, type ProgressState, type TakeOutcome } from '../model/types'
import { averageStarsFor, earnsSpeedTrophy, recordTake, takesInDays, totalStars } from './record'
import { dayKey } from './dates'

const CONTEXT = { trackDrillIds: ['a', 'b'], trackClearedStars: 2 }

function take(overrides: Partial<TakeOutcome> = {}): TakeOutcome {
  return {
    drillId: 'a',
    trackId: 'foundations',
    accuracy: 96,
    score: 4000,
    bpm: 90,
    stars: 3,
    maxCombo: 20,
    perfectCount: 40,
    strictHands: false,
    at: new Date(2026, 7, 20, 10, 0, 0),
    ...overrides,
  }
}

function on(day: number): Date {
  return new Date(2026, 7, day, 10, 0, 0)
}

describe('recording a take (§11.2)', () => {
  it('stores stars, accuracy, tempo and attempts', () => {
    const { progress } = recordTake(EMPTY_PROGRESS, take(), CONTEXT)
    expect(progress.drills.a).toMatchObject({
      drillId: 'a',
      stars: 3,
      bestAccuracy: 96,
      bestBpm: 90,
      attempts: 1,
    })
    expect(progress.drills.a?.lastPlayedAt).toBeDefined()
  })

  it('never lowers a record — a worse take only adds an attempt', () => {
    const first = recordTake(EMPTY_PROGRESS, take(), CONTEXT).progress
    const second = recordTake(first, take({ accuracy: 40, stars: 0, bpm: 60, score: 100 }), CONTEXT).progress

    expect(second.drills.a).toMatchObject({
      stars: 3,
      bestAccuracy: 96,
      bestBpm: 90,
      attempts: 2,
    })
  })

  it('awards XP for every take, even a poor one', () => {
    const poor = recordTake(EMPTY_PROGRESS, take({ score: 0, stars: 0 }), CONTEXT)
    expect(poor.xpGained).toBeGreaterThan(0)
    expect(poor.progress.xp).toBe(poor.xpGained)

    const good = recordTake(EMPTY_PROGRESS, take(), CONTEXT)
    expect(good.xpGained).toBeGreaterThan(poor.xpGained)
  })

  it('accumulates XP across takes', () => {
    const first = recordTake(EMPTY_PROGRESS, take(), CONTEXT)
    const second = recordTake(first.progress, take(), CONTEXT)
    expect(second.progress.xp).toBe(first.xpGained + second.xpGained)
  })

  it('logs the day for the heatmap', () => {
    const first = recordTake(EMPTY_PROGRESS, take({ at: on(20) }), CONTEXT).progress
    const second = recordTake(first, take({ at: on(20) }), CONTEXT).progress
    expect(second.history[dayKey(on(20))]).toBe(2)
  })

  it('leaves the original state untouched', () => {
    const before = JSON.stringify(EMPTY_PROGRESS)
    recordTake(EMPTY_PROGRESS, take(), CONTEXT)
    expect(JSON.stringify(EMPTY_PROGRESS)).toBe(before)
  })
})

describe('speed trophies (§11.2)', () => {
  it('records a new best only at 90 % or better', () => {
    expect(earnsSpeedTrophy(90, 120, 100)).toBe(true)
    expect(earnsSpeedTrophy(89.9, 120, 100)).toBe(false)
  })

  it('has to beat the existing best', () => {
    expect(earnsSpeedTrophy(100, 100, 100)).toBe(false)
    expect(earnsSpeedTrophy(100, 101, 100)).toBe(true)
  })

  it('keeps the old best when a faster take is scrappy', () => {
    const first = recordTake(EMPTY_PROGRESS, take({ bpm: 100, accuracy: 95 }), CONTEXT).progress
    const second = recordTake(first, take({ bpm: 140, accuracy: 60, stars: 0 }), CONTEXT)
    expect(second.speedTrophy).toBe(false)
    expect(second.progress.drills.a?.bestBpm).toBe(100)
  })

  it('reports the trophy so the results screen can celebrate it', () => {
    const result = recordTake(EMPTY_PROGRESS, take({ bpm: 120, accuracy: 95 }), CONTEXT)
    expect(result.speedTrophy).toBe(true)
  })
})

describe('daily streak (§11.2)', () => {
  it('starts at one', () => {
    const { progress } = recordTake(EMPTY_PROGRESS, take({ at: on(20) }), CONTEXT)
    expect(progress.streak).toMatchObject({ current: 1, longest: 1 })
  })

  it('does not double-count two takes on the same day', () => {
    let state = recordTake(EMPTY_PROGRESS, take({ at: on(20) }), CONTEXT).progress
    state = recordTake(state, take({ at: new Date(2026, 7, 20, 22, 0, 0) }), CONTEXT).progress
    expect(state.streak.current).toBe(1)
  })

  it('extends across consecutive days', () => {
    let state: ProgressState = EMPTY_PROGRESS
    for (const day of [20, 21, 22]) {
      state = recordTake(state, take({ at: on(day) }), CONTEXT).progress
    }
    expect(state.streak).toMatchObject({ current: 3, longest: 3 })
  })

  it('restarts after a missed day, but remembers the longest', () => {
    let state: ProgressState = EMPTY_PROGRESS
    for (const day of [20, 21, 22]) {
      state = recordTake(state, take({ at: on(day) }), CONTEXT).progress
    }
    state = recordTake(state, take({ at: on(25) }), CONTEXT).progress
    expect(state.streak).toMatchObject({ current: 1, longest: 3 })
  })

  it('spans a month boundary', () => {
    let state = recordTake(EMPTY_PROGRESS, take({ at: new Date(2026, 7, 31, 9, 0) }), CONTEXT).progress
    state = recordTake(state, take({ at: new Date(2026, 8, 1, 9, 0) }), CONTEXT).progress
    expect(state.streak.current).toBe(2)
  })
})

describe('badges (§11.2)', () => {
  it('awards the first 3★ once, and never again', () => {
    const first = recordTake(EMPTY_PROGRESS, take({ stars: 3 }), CONTEXT)
    expect(first.newBadges).toContain('first-three-star')

    const second = recordTake(first.progress, take({ stars: 3 }), CONTEXT)
    expect(second.newBadges).not.toContain('first-three-star')
    expect(second.progress.badges.filter((b) => b === 'first-three-star')).toHaveLength(1)
  })

  it('awards a 50 combo', () => {
    expect(recordTake(EMPTY_PROGRESS, take({ maxCombo: 50 }), CONTEXT).newBadges).toContain('combo-50')
    expect(recordTake(EMPTY_PROGRESS, take({ maxCombo: 49 }), CONTEXT).newBadges).not.toContain('combo-50')
  })

  it('counts Perfects across the whole day, not one take', () => {
    const first = recordTake(EMPTY_PROGRESS, take({ perfectCount: 60 }), CONTEXT)
    expect(first.newBadges).not.toContain('hundred-perfects')

    const second = recordTake(first.progress, take({ perfectCount: 45 }), CONTEXT)
    expect(second.newBadges).toContain('hundred-perfects')
  })

  it('resets the Perfect count on a new day', () => {
    const first = recordTake(EMPTY_PROGRESS, take({ at: on(20), perfectCount: 90 }), CONTEXT)
    const nextDay = recordTake(first.progress, take({ at: on(21), perfectCount: 90 }), CONTEXT)
    expect(nextDay.newBadges).not.toContain('hundred-perfects')
  })

  it('awards a 7-day streak', () => {
    let state: ProgressState = EMPTY_PROGRESS
    let awarded: string[] = []
    for (const day of [20, 21, 22, 23, 24, 25, 26]) {
      const result = recordTake(state, take({ at: on(day) }), CONTEXT)
      state = result.progress
      awarded = result.newBadges
    }
    expect(awarded).toContain('streak-7')
  })

  it('awards Ambidextrous only for 3★ on a strict-hands drill', () => {
    expect(recordTake(EMPTY_PROGRESS, take({ strictHands: true, stars: 3 }), CONTEXT).newBadges).toContain(
      'ambidextrous',
    )
    expect(recordTake(EMPTY_PROGRESS, take({ strictHands: true, stars: 2 }), CONTEXT).newBadges).not.toContain(
      'ambidextrous',
    )
    expect(recordTake(EMPTY_PROGRESS, take({ strictHands: false, stars: 3 }), CONTEXT).newBadges).not.toContain(
      'ambidextrous',
    )
  })

  it('awards Track cleared at two stars averaged over the whole track', () => {
    // One 3★ drill out of two averages 1.5 — not enough.
    const first = recordTake(EMPTY_PROGRESS, take({ drillId: 'a', stars: 3 }), CONTEXT)
    expect(first.newBadges).not.toContain('track-cleared')

    const second = recordTake(first.progress, take({ drillId: 'b', stars: 2 }), CONTEXT)
    expect(second.newBadges).toContain('track-cleared')
  })
})

describe('progress queries', () => {
  it('averages stars over a track, unplayed counting as zero', () => {
    const state = recordTake(EMPTY_PROGRESS, take({ drillId: 'a', stars: 3 }), CONTEXT).progress
    expect(averageStarsFor(state, ['a', 'b'])).toBe(1.5)
    expect(averageStarsFor(state, [])).toBe(0)
  })

  it('totals stars across every drill', () => {
    let state = recordTake(EMPTY_PROGRESS, take({ drillId: 'a', stars: 3 }), CONTEXT).progress
    state = recordTake(state, take({ drillId: 'b', stars: 2 }), CONTEXT).progress
    expect(totalStars(state)).toBe(5)
  })

  it('counts takes over a set of days for the weekly goal', () => {
    let state = recordTake(EMPTY_PROGRESS, take({ at: on(20) }), CONTEXT).progress
    state = recordTake(state, take({ at: on(20) }), CONTEXT).progress
    state = recordTake(state, take({ at: on(22) }), CONTEXT).progress
    expect(takesInDays(state, [dayKey(on(20)), dayKey(on(21)), dayKey(on(22))])).toBe(3)
    expect(takesInDays(state, [dayKey(on(21))])).toBe(0)
  })
})
