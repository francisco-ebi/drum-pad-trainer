import { describe, expect, it } from 'vitest'
import { DRILLS, drillsInTrack, getDrill } from '../config/curriculum'
import { TRACKS } from '../config/tracks'
import type { Drill } from '../model/types'
import { averageStars, computeStars, isTrackUnlocked } from './stars'

const drill: Drill = {
  id: 'test',
  trackId: 'foundations',
  patternId: 'quarter-kick',
  order: 1,
  title: 'Test',
  targetBpm: 90,
  starAccuracy: [70, 85, 95],
  strictHands: false,
  loops: 4,
}

describe('stars (§11.1)', () => {
  it('awards stars at the drill thresholds when played at target tempo', () => {
    expect(computeStars(drill, 96, 90).stars).toBe(3)
    expect(computeStars(drill, 95, 90).stars).toBe(3)
    expect(computeStars(drill, 94, 90).stars).toBe(2)
    expect(computeStars(drill, 85, 90).stars).toBe(2)
    expect(computeStars(drill, 84, 90).stars).toBe(1)
    expect(computeStars(drill, 70, 90).stars).toBe(1)
    expect(computeStars(drill, 69, 90).stars).toBe(0)
  })

  it('withholds stars below target tempo, however clean the take', () => {
    const slow = computeStars(drill, 100, 89)
    expect(slow.stars).toBe(0)
    expect(slow.lockedByTempo).toBe(true)
  })

  it('awards them again at or above target tempo', () => {
    expect(computeStars(drill, 100, 90).lockedByTempo).toBe(false)
    expect(computeStars(drill, 100, 140).stars).toBe(3)
  })

  it('reports the accuracy needed for the next star', () => {
    expect(computeStars(drill, 50, 90).nextThreshold).toBe(70)
    expect(computeStars(drill, 75, 90).nextThreshold).toBe(85)
    expect(computeStars(drill, 90, 90).nextThreshold).toBe(95)
    expect(computeStars(drill, 99, 90).nextThreshold).toBeUndefined()
  })
})

describe('track gating (§11.1)', () => {
  it('always opens the first track', () => {
    expect(isTrackUnlocked(1, 0)).toBe(true)
  })

  it('opens the next track at an average of 2 stars', () => {
    expect(isTrackUnlocked(2, 1.9)).toBe(false)
    expect(isTrackUnlocked(2, 2)).toBe(true)
    expect(isTrackUnlocked(3, 3)).toBe(true)
  })

  it('counts unplayed drills as zero when averaging', () => {
    expect(averageStars([3, 3, 0, 0])).toBe(1.5)
    expect(averageStars([])).toBe(0)
    expect(averageStars([2, 2, 2])).toBe(2)
  })
})

describe('seed curriculum (§16 M3)', () => {
  it('ships at least twelve drills across tracks 1–3', () => {
    expect(DRILLS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(DRILLS.map((d) => d.trackId))).toEqual(
      new Set(['foundations', 'sixteenths', 'colors']),
    )
  })

  it('gives every track at least three drills', () => {
    for (const track of TRACKS) {
      expect({ track: track.id, count: drillsInTrack(track.id).length }).toEqual({
        track: track.id,
        count: expect.any(Number),
      })
      expect(drillsInTrack(track.id).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('numbers drills consecutively within each track', () => {
    for (const track of TRACKS) {
      const orders = drillsInTrack(track.id).map((d) => d.order)
      expect(orders).toEqual(orders.map((_, i) => i + 1))
    }
  })

  it('gives every drill a unique id and a real pattern', () => {
    const ids = DRILLS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    // The builder throws on an unknown pattern, so reaching here proves it.
    expect(DRILLS.every((d) => d.patternId.length > 0)).toBe(true)
  })

  it('inherits target tempo and thresholds from the pattern unless overridden', () => {
    const inherited = getDrill('foundations-basic-beat')
    expect(inherited?.targetBpm).toBe(90)
    expect(inherited?.starAccuracy).toEqual([70, 85, 95])

    const overridden = getDrill('sixteenths-basic-beat-strict')
    expect(overridden?.starAccuracy).toEqual([65, 80, 92])
    expect(overridden?.strictHands).toBe(true)
  })

  it('lets two drills share one pattern with different rules', () => {
    const lenient = getDrill('sixteenths-basic-beat')
    const strict = getDrill('sixteenths-basic-beat-strict')
    expect(lenient?.patternId).toBe(strict?.patternId)
    expect(lenient?.strictHands).toBe(false)
    expect(strict?.strictHands).toBe(true)
  })

  it('assesses four loops per take by default (§9.3)', () => {
    expect(DRILLS.every((d) => d.loops === 4)).toBe(true)
  })
})
