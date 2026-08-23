import { samePad } from '@/shared/config'
import {
  DEFAULT_JUDGE_CONFIG,
  type ExpectedHit,
  type Grade,
  type Judgment,
  type JudgeConfig,
  type TakeStats,
  type UserHit,
} from '../model/types'
import { accuracyOf, comboMultiplier, continuesCombo, POINTS } from './score'
import { windowsFor, type TimingWindows } from './windows'

interface Slot {
  expected: ExpectedHit
  resolved: boolean
}

function emptyCounts(): Record<Grade, number> {
  return { perfect: 0, good: 0, miss: 0, wrongPad: 0, extra: 0 }
}

/**
 * Matches user hits against expected hits and keeps the running score (§10).
 *
 * Streaming rather than batch: the live HUD needs a verdict the instant a pad
 * is struck, and the results screen needs the same verdicts totted up. One
 * implementation serves both — `judgeTake` below just drives this to
 * completion — so the number on the HUD can never disagree with the number on
 * the results screen.
 */
export class TakeJudge {
  private readonly config: JudgeConfig
  private readonly windows: TimingWindows
  private readonly slots: Slot[] = []
  private readonly judgments: Judgment[] = []

  private score = 0
  private combo = 0
  private maxCombo = 0
  private earnedPoints = 0
  private counts = emptyCounts()

  constructor(config: Partial<JudgeConfig> & Pick<JudgeConfig, 'secondsPerStep'>) {
    this.config = { ...DEFAULT_JUDGE_CONFIG, ...config }
    this.windows = windowsFor(this.config.secondsPerStep)
  }

  get timingWindows(): TimingWindows {
    return this.windows
  }

  /** Expected hits still unplayed and still inside their window. */
  get pending(): ExpectedHit[] {
    return this.slots.filter((slot) => !slot.resolved).map((slot) => slot.expected)
  }

  get allJudgments(): readonly Judgment[] {
    return this.judgments
  }

  get stats(): TakeStats {
    const resolved = this.slots.filter((slot) => slot.resolved).length
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: comboMultiplier(this.combo),
      accuracy: accuracyOf(this.earnedPoints, resolved),
      counts: { ...this.counts },
      resolved,
      expected: this.slots.length,
    }
  }

  /** Register a note the pattern asks for, as the scheduler places it. */
  expect(hit: ExpectedHit): void {
    this.slots.push({ expected: hit, resolved: false })
  }

  expectAll(hits: readonly ExpectedHit[]): void {
    for (const hit of hits) this.expect(hit)
  }

  /**
   * Judge one strike (§10.1).
   *
   * Candidates are unresolved expected hits inside the Good window. A hit of
   * the right voice wins over a nearer hit of the wrong one, so two voices
   * landing on the same step cannot steal each other's note; only when nothing
   * of the right voice is due does a strike become Wrong-pad, consuming the
   * note it got wrong so the player is not also charged a Miss for it. With
   * nothing due at all, the strike is an Extra.
   */
  hit(userHit: UserHit): Judgment {
    const candidates = this.slots.filter(
      (slot) => !slot.resolved && Math.abs(slot.expected.time - userHit.time) <= this.windows.goodSec,
    )

    const correct = candidates.filter((slot) => this.matchesVoice(slot.expected, userHit))
    const nearest = this.nearest(correct.length > 0 ? correct : candidates, userHit.time)

    if (!nearest) {
      return this.record({
        grade: 'extra',
        hit: userHit,
        points: this.config.penalizeExtras ? POINTS.extra : 0,
        multiplier: comboMultiplier(this.combo),
      })
    }

    nearest.resolved = true
    const offsetSec = userHit.time - nearest.expected.time

    if (correct.length === 0) {
      return this.record({
        grade: 'wrongPad',
        hit: userHit,
        expected: nearest.expected,
        offsetSec,
        direction: offsetSec < 0 ? 'early' : 'late',
        points: POINTS.wrongPad,
        multiplier: comboMultiplier(this.combo),
      })
    }

    const grade: Grade = Math.abs(offsetSec) <= this.windows.perfectSec ? 'perfect' : 'good'
    return this.record({
      grade,
      hit: userHit,
      expected: nearest.expected,
      offsetSec,
      // Direction is recorded on every non-Perfect judgment and drives the
      // rushing/dragging feedback (§10.2, §10.4).
      ...(grade === 'perfect' ? {} : { direction: offsetSec < 0 ? ('early' as const) : ('late' as const) }),
      points: POINTS[grade],
      multiplier: comboMultiplier(this.combo),
    })
  }

  /**
   * Turn expected hits whose window has closed into Misses. Call this as the
   * clock advances; `Infinity` closes out a finished take.
   */
  settle(nowSec: number): Judgment[] {
    const deadline = this.windows.goodSec + this.config.settleGraceSec
    const missed: Judgment[] = []
    for (const slot of this.slots) {
      if (slot.resolved) continue
      if (nowSec <= slot.expected.time + deadline) continue
      slot.resolved = true
      missed.push(
        this.record({
          grade: 'miss',
          expected: slot.expected,
          points: POINTS.miss,
          multiplier: comboMultiplier(this.combo),
        }),
      )
    }
    return missed
  }

  /** Consecutive misses at the tail — drives the strict-mode stop (§9.2). */
  get trailingMisses(): number {
    let count = 0
    for (let i = this.judgments.length - 1; i >= 0; i--) {
      const grade = this.judgments[i]?.grade
      if (grade === 'miss' || grade === 'wrongPad') count += 1
      else break
    }
    return count
  }

  private matchesVoice(expected: ExpectedHit, userHit: UserHit): boolean {
    if (this.config.strictHands) return samePad(expected.pad, userHit.pad)
    return userHit.voice !== undefined && expected.voice === userHit.voice
  }

  private nearest(slots: Slot[], time: number): Slot | undefined {
    let best: Slot | undefined
    let bestDistance = Infinity
    for (const slot of slots) {
      const distance = Math.abs(slot.expected.time - time)
      if (distance < bestDistance) {
        best = slot
        bestDistance = distance
      }
    }
    return best
  }

  private record(judgment: Judgment): Judgment {
    this.judgments.push(judgment)
    this.counts[judgment.grade] += 1

    if (continuesCombo(judgment.grade)) {
      this.combo += 1
      this.maxCombo = Math.max(this.maxCombo, this.combo)
    } else {
      this.combo = 0
    }

    this.score = Math.max(0, this.score + judgment.points * judgment.multiplier)
    this.earnedPoints += judgment.points
    return judgment
  }
}
