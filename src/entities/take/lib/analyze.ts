import type { Voice } from '@/entities/pattern/@x/take'
import type { Judgment, TakeStats } from '../model/types'
import { TakeJudge } from './judge'
import { gradeLetter } from './score'

/** Bucket width for the timing histogram (§10.4). */
export const HISTOGRAM_BUCKET_MS = 10
export const HISTOGRAM_RANGE_MS = 100

/** Below this the player is simply on the beat, not rushing or dragging. */
export const TIMING_VERDICT_THRESHOLD_MS = 12

export interface OffsetBucket {
  /** Centre of the bucket in ms; negative is early. */
  centerMs: number
  count: number
}

export interface TimingSummary {
  meanOffsetMs: number
  medianOffsetMs: number
  /** Share of timed hits that were early, 0–1. */
  earlyShare: number
  histogram: OffsetBucket[]
  /** Plain-language read-out, e.g. "Rushing by about 20 ms". */
  verdict: string
  /** The voice whose timing is furthest off, when one stands out. */
  worstVoice?: { voice: Voice; meanOffsetMs: number }
}

export interface WeakSpot {
  patternStep: number
  voice: Voice
  /** Mean points across every attempt at this cell, 0–100. */
  averagePoints: number
  attempts: number
}

export interface TakeResult {
  stats: TakeStats
  /** Letter grade from accuracy (§10.3). */
  grade: string
  judgments: readonly Judgment[]
  timing: TimingSummary
  /** The step x voice cell that most needs work, if the take had any faults. */
  weakSpot?: WeakSpot
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Judgments that carry a meaningful timing offset. */
function timedJudgments(judgments: readonly Judgment[]): Judgment[] {
  return judgments.filter((j) => j.offsetSec !== undefined && (j.grade === 'perfect' || j.grade === 'good'))
}

export function buildHistogram(judgments: readonly Judgment[]): OffsetBucket[] {
  const bucketCount = (HISTOGRAM_RANGE_MS * 2) / HISTOGRAM_BUCKET_MS
  const buckets: OffsetBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    centerMs: -HISTOGRAM_RANGE_MS + HISTOGRAM_BUCKET_MS * index + HISTOGRAM_BUCKET_MS / 2,
    count: 0,
  }))

  for (const judgment of timedJudgments(judgments)) {
    const offsetMs = (judgment.offsetSec ?? 0) * 1000
    const clamped = Math.max(-HISTOGRAM_RANGE_MS, Math.min(HISTOGRAM_RANGE_MS - 0.001, offsetMs))
    const index = Math.floor((clamped + HISTOGRAM_RANGE_MS) / HISTOGRAM_BUCKET_MS)
    const bucket = buckets[index]
    if (bucket) bucket.count += 1
  }
  return buckets
}

function verdictText(meanOffsetMs: number): string {
  const magnitude = Math.round(Math.abs(meanOffsetMs))
  if (magnitude < TIMING_VERDICT_THRESHOLD_MS) return 'Solid time — no consistent push or drag.'
  return meanOffsetMs < 0
    ? `Rushing by about ${magnitude} ms — let the click come to you.`
    : `Dragging by about ${magnitude} ms — lean a touch further forward.`
}

export function summarizeTiming(judgments: readonly Judgment[]): TimingSummary {
  const timed = timedJudgments(judgments)
  const offsetsMs = timed.map((j) => (j.offsetSec ?? 0) * 1000)
  const meanOffsetMs = mean(offsetsMs)

  const byVoice = new Map<Voice, number[]>()
  for (const judgment of timed) {
    const voice = judgment.expected?.voice
    if (!voice) continue
    const list = byVoice.get(voice) ?? []
    list.push((judgment.offsetSec ?? 0) * 1000)
    byVoice.set(voice, list)
  }

  let worstVoice: TimingSummary['worstVoice']
  for (const [voice, offsets] of byVoice) {
    if (offsets.length < 2) continue
    const voiceMean = mean(offsets)
    if (!worstVoice || Math.abs(voiceMean) > Math.abs(worstVoice.meanOffsetMs)) {
      worstVoice = { voice, meanOffsetMs: Math.round(voiceMean * 10) / 10 }
    }
  }

  return {
    meanOffsetMs: Math.round(meanOffsetMs * 10) / 10,
    medianOffsetMs: Math.round(median(offsetsMs) * 10) / 10,
    earlyShare: timed.length === 0 ? 0 : timed.filter((j) => (j.offsetSec ?? 0) < 0).length / timed.length,
    histogram: buildHistogram(judgments),
    verdict: verdictText(meanOffsetMs),
    ...(worstVoice ? { worstVoice } : {}),
  }
}

/**
 * The step x voice cell with the worst average score (§10.4) — what the
 * "Drill that step" shortcut loops around. Only cells that actually cost
 * points qualify, so a clean take reports no weak spot.
 */
export function findWeakSpot(judgments: readonly Judgment[]): WeakSpot | undefined {
  const cells = new Map<string, { patternStep: number; voice: Voice; points: number[] }>()

  for (const judgment of judgments) {
    const expected = judgment.expected
    if (!expected) continue
    const key = `${expected.patternStep}:${expected.voice}`
    const cell = cells.get(key) ?? { patternStep: expected.patternStep, voice: expected.voice, points: [] }
    cell.points.push(judgment.points)
    cells.set(key, cell)
  }

  let worst: WeakSpot | undefined
  for (const cell of cells.values()) {
    const averagePoints = mean(cell.points)
    if (averagePoints >= 100) continue // nothing wrong here
    if (!worst || averagePoints < worst.averagePoints) {
      worst = {
        patternStep: cell.patternStep,
        voice: cell.voice,
        averagePoints: Math.round(averagePoints * 10) / 10,
        attempts: cell.points.length,
      }
    }
  }
  return worst
}

export function summarize(judge: TakeJudge): TakeResult {
  const judgments = judge.allJudgments
  const stats = judge.stats
  const weakSpot = findWeakSpot(judgments)
  return {
    stats,
    grade: gradeLetter(stats.accuracy),
    judgments,
    timing: summarizeTiming(judgments),
    ...(weakSpot ? { weakSpot } : {}),
  }
}
