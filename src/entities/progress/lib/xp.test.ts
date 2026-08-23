import { describe, expect, it } from 'vitest'
import { levelForXp, levelProgress, xpForLevel, xpForTake } from './xp'

describe('XP and levels (§11.2)', () => {
  it('rewards score and stars, with a floor for turning up', () => {
    expect(xpForTake({ score: 0, stars: 0 })).toBeGreaterThan(0)
    expect(xpForTake({ score: 4000, stars: 3 })).toBeGreaterThan(xpForTake({ score: 4000, stars: 0 }))
    expect(xpForTake({ score: 4000, stars: 0 })).toBeGreaterThan(xpForTake({ score: 100, stars: 0 }))
  })

  it('starts everyone at level 1', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(-5)).toBe(1)
    expect(levelForXp(99)).toBe(1)
  })

  it('levels up on a widening curve', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(3)).toBe(300)
    expect(xpForLevel(4)).toBe(600)
  })

  it('inverts the curve consistently', () => {
    for (let level = 1; level <= 30; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level)
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level)
    }
  })

  it('reports how far through a level the player is', () => {
    expect(levelProgress(0)).toMatchObject({ level: 1, into: 0, span: 100, fraction: 0 })
    expect(levelProgress(50)).toMatchObject({ level: 1, into: 50, fraction: 0.5 })
    expect(levelProgress(100)).toMatchObject({ level: 2, into: 0 })
    expect(levelProgress(200).fraction).toBeCloseTo(0.5, 6)
  })

  it('never reports a fraction outside 0–1', () => {
    for (const xp of [0, 1, 99, 100, 12_345, 1_000_000]) {
      const progress = levelProgress(xp)
      expect(progress.fraction).toBeGreaterThanOrEqual(0)
      expect(progress.fraction).toBeLessThanOrEqual(1)
    }
  })
})
