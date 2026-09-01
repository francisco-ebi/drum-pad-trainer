import { describe, expect, it } from 'vitest'
import { clampSwing, swingShift, swingUnwarp, swingWarp } from './swing'

describe('swing warp', () => {
  it('is the identity when straight', () => {
    for (const position of [0, 0.5, 1, 2, 7, 15.25]) {
      expect(swingWarp(position, 0)).toBe(position)
      expect(swingUnwarp(position, 0)).toBe(position)
    }
  })

  it('leaves whole pairs exactly where they were', () => {
    // A swung bar has to end where a straight one does, or the loop drifts.
    for (const amount of [0.25, 0.5, 1]) {
      for (const pair of [0, 1, 2, 7, 8]) {
        expect(swingWarp(pair * 2, amount)).toBeCloseTo(pair * 2, 12)
      }
    }
  })

  it('pushes the off-beat late, by a third of a step at full swing', () => {
    expect(swingWarp(1, 1)).toBeCloseTo(1 + 1 / 3, 12)
    expect(swingWarp(3, 1)).toBeCloseTo(3 + 1 / 3, 12)
    // Full swing puts the off-beat two-thirds through its pair — triplet feel.
    expect(swingWarp(1, 1) / 2).toBeCloseTo(2 / 3, 12)
  })

  it('scales with the amount', () => {
    expect(swingWarp(1, 0.5)).toBeCloseTo(1 + 1 / 6, 12)
    expect(swingWarp(1, 0.25)).toBeCloseTo(1 + 1 / 12, 12)
  })

  it('round-trips exactly', () => {
    for (const amount of [0.1, 0.33, 0.6, 1]) {
      for (let position = 0; position <= 16; position += 0.125) {
        expect(swingUnwarp(swingWarp(position, amount), amount)).toBeCloseTo(position, 10)
      }
    }
  })

  it('stays monotonic, so the playhead never goes backwards', () => {
    for (const amount of [0.25, 0.6, 1]) {
      let previous = -Infinity
      for (let position = 0; position <= 16; position += 0.05) {
        const warped = swingWarp(position, amount)
        expect(warped).toBeGreaterThan(previous)
        previous = warped
      }
    }
  })

  it('leaves the count-in straight', () => {
    for (const position of [-8, -3.5, -1]) {
      expect(swingWarp(position, 1)).toBe(position)
      expect(swingUnwarp(position, 1)).toBe(position)
    }
  })

  it('clamps nonsense amounts rather than distorting time', () => {
    expect(clampSwing(-1)).toBe(0)
    expect(clampSwing(5)).toBe(1)
    expect(clampSwing(Number.NaN)).toBe(0)
    expect(swingShift(1)).toBeCloseTo(1 / 3, 12)
  })
})
